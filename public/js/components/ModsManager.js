import { ref, computed, watch, onMounted } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

export default {
    template: `
    <div>
        <h3>模组管理</h3>
        <div class="card shadow-sm">
            <div class="card-header d-flex gap-2 p-2 align-items-center bg-body-tertiary">
                <input type="text" class="form-control form-control-sm" style="max-width: 200px;" v-model="searchQuery" placeholder="搜索...">
                <div class="vr"></div>
                <button class="btn btn-sm btn-outline-warning" @click="operateFiles('disable', selectedFiles)" :disabled="!selectedFiles.length">禁用</button>
                <button class="btn btn-sm btn-outline-success" @click="operateFiles('enable', selectedFiles)" :disabled="!selectedFiles.length">启用</button>
                <button class="btn btn-sm btn-outline-danger" @click="askDelete(selectedFiles)" :disabled="!selectedFiles.length">删除</button>
                <div class="ms-auto">
                    <input type="file" ref="modInput" multiple class="d-none" @change="(e)=>uploadFiles(e)">
                    <button class="btn btn-sm btn-primary" @click="$refs.modInput.click()">上传</button>
                </div>
            </div>
            <ul class="list-group list-group-flush">
                <li class="list-group-item bg-body-tertiary fw-bold d-flex align-items-center">
                    <input class="form-check-input me-3" type="checkbox" v-model="selectAll"><span>文件名</span>
                </li>
                <li v-for="file in filteredFiles" :key="file.name" class="list-group-item d-flex align-items-center mod-item" :class="{'disabled-mod': file.isDisabled}">
                    <input class="form-check-input me-3" type="checkbox" :value="file.name" v-model="selectedFiles">
                    <span class="mod-name text-truncate flex-grow-1" :title="file.name">{{ file.name }}</span>
                    <span v-if="file.isDisabled" class="badge bg-warning text-dark me-2">已禁用</span>
                    <span class="small text-muted">{{ (file.size/1024/1024).toFixed(2) }} MB</span>
                </li>
            </ul>
        </div>
    </div>
    `,
    setup() {
        const fileList = ref([]);
        const selectedFiles = ref([]);
        const selectAll = ref(false);
        const searchQuery = ref('');
        const modInput = ref(null);

        const loadFiles = async () => {
            try {
                const res = await api.get(`/api/files/list?path=mods`);
                fileList.value = res.data.sort((a, b) => b.isDir - a.isDir);
                selectedFiles.value = [];
                selectAll.value = false;
            } catch (e) { showToast('加载模组列表失败', 'danger'); }
        };

        const filteredFiles = computed(() => fileList.value.filter(f => f.name.toLowerCase().includes(searchQuery.value.toLowerCase())));
        watch(selectAll, (v) => selectedFiles.value = v ? filteredFiles.value.map(f => f.name) : []);

        const formatSize = (bytes) => {
            if(bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const uploadFiles = async (e) => {
            const files = e.target.files;
            if (!files.length) return;
            
            const fd = new FormData();
            let totalSize = 0;
            for (let i = 0; i < files.length; i++) {
                fd.append('files', files[i]);
                totalSize += files[i].size;
            }
            fd.append('path', 'mods');

            store.task.visible = true;
            store.task.title = '正在上传模组';
            store.task.percent = 0;
            store.task.message = `正在上传 ${files.length} 个文件...`;
            store.task.subMessage = `0 / ${formatSize(totalSize)}`;

            try {
                await api.post('/api/files/upload', fd, {
                    onUploadProgress: (p) => {
                        if (p.total) {
                            const percent = Math.round((p.loaded * 100) / p.total);
                            store.task.percent = percent;
                            store.task.subMessage = `${formatSize(p.loaded)} / ${formatSize(p.total)}`;
                        }
                    }
                });
                showToast('上传成功');
                loadFiles();
            } catch (e) { showToast('上传失败', 'danger'); }
            finally {
                setTimeout(() => { store.task.visible = false; }, 500);
                e.target.value = '';
            }
        };

        const operateFiles = async (action, files) => {
            const fullFiles = files.map(f => 'mods/' + f);
            try {
                await api.post('/api/files/operate', { action, sources: fullFiles, destination: '' });
                showToast('操作成功');
                loadFiles();
            } catch (e) { showToast('操作失败', 'danger'); }
        };

        const askDelete = (files) => {
            openModal({
                title: '删除模组',
                message: `确定要删除选中的 ${files.length} 个模组吗？`,
                callback: () => operateFiles('delete', files)
            });
        };

        onMounted(() => loadFiles());

        return { fileList, filteredFiles, selectedFiles, selectAll, searchQuery, modInput, uploadFiles, operateFiles, askDelete };
    }
};