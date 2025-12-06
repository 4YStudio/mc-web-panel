import { ref, computed, watch, onMounted } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column">
        <!-- 1. 文件列表视图 -->
        <div v-if="!editingFile" class="d-flex flex-column h-100">
            <!-- 顶部导航栏 -->
            <div class="d-flex justify-content-between align-items-center mb-3">
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb mb-0 p-2 bg-body-tertiary rounded">
                        <li class="breadcrumb-item text-primary" @click="changeDir('')">
                            <i class="fa-solid fa-house"></i>
                        </li>
                        <li v-for="(p, idx) in pathParts" :key="idx" 
                            class="breadcrumb-item" 
                            @click="changeDir(pathParts.slice(0, idx+1).join('/'))">
                            {{ p }}
                        </li>
                    </ol>
                </nav>
                <div class="input-group" style="width: 250px;">
                    <span class="input-group-text"><i class="fa-solid fa-search"></i></span>
                    <input type="text" class="form-control" v-model="searchQuery" placeholder="当前目录搜索...">
                </div>
            </div>

            <!-- 操作工具栏 -->
            <div class="card mb-3 bg-dark border-secondary flex-shrink-0">
                <div class="card-body p-2 d-flex flex-wrap gap-2 align-items-center">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary" @click="refreshFiles" title="刷新"><i class="fa-solid fa-rotate"></i></button>
                        <button class="btn btn-sm btn-outline-secondary" @click="askCompress" :disabled="!selectedFiles.length" title="压缩"><i class="fa-solid fa-file-zipper"></i></button>
                        <button class="btn btn-sm btn-outline-danger" @click="askDelete(selectedFiles)" :disabled="!selectedFiles.length" title="删除"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" @click="copyToClipboard('copy')" :disabled="!selectedFiles.length"><i class="fa-solid fa-copy"></i></button>
                        <button class="btn btn-sm btn-outline-primary" @click="copyToClipboard('move')" :disabled="!selectedFiles.length"><i class="fa-solid fa-scissors"></i></button>
                        <button v-if="clipboard.files.length" class="btn btn-sm btn-warning" @click="pasteFiles"><i class="fa-solid fa-paste"></i> ({{ clipboard.files.length }})</button>
                    </div>
                    <div class="ms-auto d-flex gap-2">
                        <input type="file" ref="fileUp" multiple class="d-none" @change="(e)=>uploadFiles(e)">
                        <button class="btn btn-sm btn-primary" @click="$refs.fileUp.click()"><i class="fa-solid fa-file-upload"></i> 文件</button>
                        <input type="file" ref="folderUp" webkitdirectory class="d-none" @change="(e)=>uploadFiles(e)">
                        <button class="btn btn-sm btn-primary" @click="$refs.folderUp.click()"><i class="fa-solid fa-folder-plus"></i> 文件夹</button>
                    </div>
                </div>
            </div>

            <!-- 文件列表表格 -->
            <div class="card flex-grow-1 overflow-auto">
                <table class="table table-hover table-sm mb-0 align-middle">
                    <thead style="z-index: 5;">
                        <tr>
                            <th style="width: 30px;"><input type="checkbox" v-model="selectAll" class="form-check-input"></th>
                            <th>名称</th>
                            <th style="width: 100px;">大小</th>
                            <th style="width: 150px;">修改时间</th>
                            <th style="width: 140px;" class="text-end">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="currentPath !== ''" class="file-row" @click="goUp()">
                            <td></td>
                            <td colspan="4"><i class="fa-solid fa-turn-up text-primary ms-2"></i> 返回上一级</td>
                        </tr>
                        <tr v-for="f in filteredFiles" :key="f.name" class="file-row" :class="{selected: selectedFiles.includes(f.name)}">
                            <td @click.stop><input type="checkbox" :value="f.name" v-model="selectedFiles" class="form-check-input"></td>
                            
                            <!-- 点击名称：文件夹进入，文件尝试编辑 -->
                            <td @click="f.isDir ? changeDir(joinPath(currentPath, f.name)) : editFile(f.name)">
                                <i class="fa-solid me-2" :class="getIcon(f)"></i>
                                {{ f.name }}
                            </td>
                            
                            <td>{{ f.isDir ? '-' : formatSize(f.size) }}</td>
                            <td class="small text-muted">{{ new Date(f.mtime).toLocaleString() }}</td>
                            
                            <td class="text-end">
                                <div class="btn-group">
                                    <!-- 编辑按钮：如果是文本文件显示 -->
                                    <button v-if="!f.isDir" class="btn btn-xs btn-link text-info" @click.stop="editFile(f.name)" title="编辑">
                                        <i class="fa-solid fa-pen-to-square"></i>
                                    </button>
                                    <button v-if="!f.isDir" class="btn btn-xs btn-link text-light" @click.stop="downloadFile(f.name)" title="下载">
                                        <i class="fa-solid fa-download"></i>
                                    </button>
                                    <button class="btn btn-xs btn-link text-danger" @click.stop="askDelete([f.name])" title="删除">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="filteredFiles.length === 0">
                            <td colspan="5" class="text-center text-muted py-3">空文件夹</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- 2. 编辑器视图 (全屏模式) -->
        <div v-else class="d-flex flex-column h-100">
            <div class="card h-100 border-secondary d-flex flex-column">
                <div class="card-header bg-body-tertiary d-flex justify-content-between align-items-center py-2">
                    <div class="d-flex align-items-center">
                        <i class="fa-solid fa-file-pen me-2 text-warning"></i>
                        <span class="fw-bold">{{ editingFile }}</span>
                        <span class="badge bg-secondary ms-2" v-if="hasUnsavedChanges">未保存</span>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-success me-2" @click="saveFile">
                            <i class="fa-solid fa-save me-1"></i>保存 (Ctrl+S)
                        </button>
                        <button class="btn btn-sm btn-secondary" @click="closeEditor">
                            <i class="fa-solid fa-xmark me-1"></i>关闭
                        </button>
                    </div>
                </div>
                
                <!-- 文本输入框 -->
                <textarea 
                    ref="editorArea"
                    class="form-control border-0 rounded-0 bg-dark text-light flex-grow-1 p-3" 
                    style="font-family: 'Consolas', 'Monaco', monospace; resize: none; font-size: 14px; line-height: 1.5;" 
                    v-model="fileContent"
                    @keydown.ctrl.s.prevent="saveFile"
                    spellcheck="false"
                ></textarea>
            </div>
        </div>
    </div>
    `,
    setup() {
        const currentPath = ref('');
        const fileList = ref([]);
        const selectedFiles = ref([]);
        const selectAll = ref(false);
        const searchQuery = ref('');
        
        // 编辑器状态
        const editingFile = ref(null);
        const fileContent = ref('');
        const originalContent = ref(''); // 用于对比是否修改
        const editorArea = ref(null);

        const clipboard = ref({ action: '', files: [], sourcePath: '' });
        const fileUp = ref(null);
        const folderUp = ref(null);

        // --- 路径处理 ---
        const pathParts = computed(() => currentPath.value ? currentPath.value.split('/') : []);
        const joinPath = (base, name) => base ? `${base}/${name}` : name;
        const goUp = () => {
            if(!currentPath.value) return;
            const parts = currentPath.value.split('/');
            parts.pop();
            changeDir(parts.join('/'));
        };

        // --- 列表加载 ---
        const changeDir = (path) => { currentPath.value = path; loadFiles(); };
        const loadFiles = async () => {
            try {
                const res = await api.get(`/api/files/list?path=${currentPath.value}`);
                // 排序：文件夹在前，然后按名称
                fileList.value = res.data.sort((a, b) => {
                    if (a.isDir !== b.isDir) return b.isDir - a.isDir;
                    return a.name.localeCompare(b.name);
                });
                selectedFiles.value = [];
                selectAll.value = false;
            } catch(e) { showToast('加载失败', 'danger'); }
        };

        const filteredFiles = computed(() => fileList.value.filter(f => f.name.toLowerCase().includes(searchQuery.value.toLowerCase())));
        watch(selectAll, (v) => selectedFiles.value = v ? filteredFiles.value.map(f => f.name) : []);

        // --- 图标样式 ---
        const getIcon = (f) => {
            if (f.isDir) return 'fa-folder text-warning';
            if (f.name.endsWith('.jar')) return 'fa-cube text-success';
            if (/\.(json|toml|yaml|yml|conf|properties)$/.test(f.name)) return 'fa-file-code text-info';
            if (/\.(log|txt|md)$/.test(f.name)) return 'fa-file-lines text-secondary';
            if (/\.(zip|tar|gz)$/.test(f.name)) return 'fa-file-zipper text-danger';
            return 'fa-file text-muted';
        };

        const formatSize = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        };

        // --- 文件编辑逻辑 (增强版) ---
        // 支持的后缀列表
        const EDITABLE_EXTS = ['txt', 'log', 'json', 'yml', 'yaml', 'properties', 'conf', 'toml', 'cfg', 'ini', 'sh', 'bat', 'js', 'md', 'xml'];
        
        const editFile = async (name) => {
            const ext = name.split('.').pop().toLowerCase();
            // 如果不是常见文本格式，且文件没有点号（如 LICENSE），也尝试允许编辑
            if (!EDITABLE_EXTS.includes(ext) && name.includes('.')) {
                if(!confirm(`文件 ${name} 可能不是文本文件，确定要编辑吗？`)) return;
            }

            const fullPath = joinPath(currentPath.value, name);
            try {
                const res = await api.get(`/api/files/content?path=${fullPath}`);
                fileContent.value = res.data.content;
                originalContent.value = res.data.content; // 记录原始内容
                editingFile.value = fullPath;
            } catch(e) { showToast('无法读取文件内容', 'danger'); }
        };

        const hasUnsavedChanges = computed(() => fileContent.value !== originalContent.value);

        const saveFile = async () => {
            try {
                await api.post('/api/files/save', { filepath: editingFile.value, content: fileContent.value });
                originalContent.value = fileContent.value; // 更新原始值
                showToast('保存成功');
            } catch(e) { showToast('保存失败', 'danger'); }
        };

        const closeEditor = () => {
            if (hasUnsavedChanges.value) {
                if(!confirm('有未保存的修改，确定关闭吗？')) return;
            }
            editingFile.value = null;
            fileContent.value = '';
        };

        // --- 基础文件操作 ---
        const uploadFiles = async (e) => {
            const files = e.target.files;
            if (!files.length) return;
            const fd = new FormData();
            let total = 0;
            for (let i=0; i<files.length; i++) { fd.append('files', files[i]); total += files[i].size; }
            fd.append('path', currentPath.value);
            
            store.task.visible = true; store.task.title = '上传中'; store.task.percent = 0;
            try {
                await api.post('/api/files/upload', fd, {
                    onUploadProgress: (p) => {
                        if(p.total) store.task.percent = Math.round((p.loaded*100)/p.total);
                        store.task.message = `${formatSize(p.loaded)} / ${formatSize(p.total)}`;
                    }
                });
                showToast('上传成功'); loadFiles();
            } catch(e){ showToast('失败','danger'); }
            finally { setTimeout(()=>store.task.visible=false, 500); e.target.value=''; }
        };

        const operateFiles = async (action, files, dest = '', extra = {}) => {
            const fullFiles = files.map(f => joinPath(currentPath.value, f));
            try {
                await api.post('/api/files/operate', { action, sources: fullFiles, destination: dest, ...extra });
                showToast('操作成功'); loadFiles();
            } catch(e) { showToast('操作失败', 'danger'); }
        };

        const copyToClipboard = (action) => {
            clipboard.value = { action, files: [...selectedFiles.value], sourcePath: currentPath.value };
            showToast(`已${action==='copy'?'复制':'剪切'} ${selectedFiles.value.length} 个项目`);
            selectedFiles.value = [];
        };

        const pasteFiles = async () => {
            const sources = clipboard.value.files.map(f => joinPath(clipboard.value.sourcePath, f));
            try {
                await api.post('/api/files/operate', { action: clipboard.value.action, sources: sources, destination: currentPath.value });
                showToast('粘贴完成'); loadFiles();
                if (clipboard.value.action === 'move') clipboard.value.files = [];
            } catch(e) { showToast('粘贴失败', 'danger'); }
        };

        const askCompress = () => openModal({
            title: '压缩', message: '压缩包名称 (.zip):', mode: 'input', placeholder: 'archive.zip',
            callback: (name) => operateFiles('compress', selectedFiles.value, currentPath.value, { compressName: name.endsWith('.zip')?name:name+'.zip' })
        });
        const askDelete = (files) => openModal({ title: '确认删除', message: `删除 ${files.length} 个项目？`, callback: () => operateFiles('delete', files) });
        
        const downloadFile = (name) => window.open(`/api/files/download?path=${joinPath(currentPath.value, name)}`, '_blank');

        const refreshFiles = () => loadFiles();

        onMounted(() => loadFiles());

        return {
            currentPath, pathParts, fileList, filteredFiles, selectedFiles, selectAll, searchQuery,
            editingFile, fileContent, hasUnsavedChanges, editorArea, clipboard, fileUp, folderUp,
            changeDir, goUp, joinPath, getIcon, formatSize,
            uploadFiles, copyToClipboard, pasteFiles, askCompress, askDelete, downloadFile,
            editFile, saveFile, closeEditor, refreshFiles
        };
    }
};