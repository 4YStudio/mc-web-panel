import { ref, computed, watch, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, t } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column">
        <Transition name="fade" mode="out-in">
            <!-- 1. 文件列表视图 -->
            <div v-if="!editingFile" class="d-flex flex-column h-100" key="list">
                <!-- 顶部导航栏 -->
                <div class="row g-2 align-items-center mb-3">
                    <div class="col-12 col-md-auto flex-grow-1 overflow-hidden">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb mb-0 p-2 bg-body-tertiary rounded flex-nowrap overflow-auto no-scrollbar" style="font-size: 0.9rem;">
                                <li class="breadcrumb-item text-primary cursor-pointer" @click="changeDir('')">
                                    <i class="fa-solid fa-house"></i>
                                </li>
                                <li v-for="(p, idx) in pathParts" :key="idx" 
                                    class="breadcrumb-item text-truncate cursor-pointer" 
                                    style="max-width: 120px;"
                                    @click="changeDir(pathParts.slice(0, idx+1).join('/'))">
                                    {{ p }}
                                </li>
                            </ol>
                        </nav>
                    </div>
                    <div class="col-12 col-md-auto">
                        <div class="input-group input-group-sm mb-0">
                            <span class="input-group-text border-0 bg-body-tertiary"><i class="fa-solid fa-search"></i></span>
                            <input type="text" class="form-control border-0 bg-body-tertiary px-2" v-model="searchQuery" :placeholder="$t('common.search') + '...'">
                        </div>
                    </div>
                </div>

                <!-- 操作工具栏 -->
                <div class="card mb-3 bg-body-tertiary border-secondary flex-shrink-0">
                    <div class="card-body p-2 d-flex flex-wrap gap-2 align-items-center">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-secondary" @click="refreshFiles" :title="$t('common.refresh')"><i class="fa-solid fa-rotate"></i></button>
                            <button class="btn btn-sm btn-outline-secondary" @click="askCompress" :disabled="!selectedFiles.length" :title="$t('files.compress')"><i class="fa-solid fa-file-zipper"></i></button>
                            <button class="btn btn-sm btn-outline-danger" @click="askDelete(selectedFiles)" :disabled="!selectedFiles.length" :title="$t('common.delete')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" @click="copyToClipboard('copy')" :disabled="!selectedFiles.length" :title="$t('files.copy')"><i class="fa-solid fa-copy"></i></button>
                            <button class="btn btn-sm btn-outline-primary" @click="copyToClipboard('move')" :disabled="!selectedFiles.length" :title="$t('files.move')"><i class="fa-solid fa-scissors"></i></button>
                            <button v-if="clipboard.files.length" class="btn btn-sm btn-warning" @click="pasteFiles"><i class="fa-solid fa-paste"></i> ({{ clipboard.files.length }})</button>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" @click="$refs.fileUp.click()" :title="$t('files.upload_file')"><i class="fa-solid fa-file-upload"></i></button>
                            <button class="btn btn-sm btn-outline-success" @click="askNewFile" :title="$t('files.new_file')"><i class="fa-solid fa-file-circle-plus"></i></button>
                            <button class="btn btn-sm btn-outline-success" @click="askNewFolder" :title="$t('files.new_folder')"><i class="fa-solid fa-folder-plus"></i></button>
                        </div>
                        <input type="file" ref="fileUp" multiple class="d-none" @change="(e)=>uploadFiles(e)">
                        <div class="ms-auto d-flex gap-2">
                        </div>
                    </div>
                </div>

                <!-- 文件列表表格 -->
                <div class="card flex-grow-1 overflow-hidden border-0 shadow-sm" style="border-radius: 12px;">
                    <div class="table-responsive h-100 custom-scrollbar">
                        <table class="table table-hover table-sm mb-0 align-middle">
                            <thead class="sticky-top bg-body" style="z-index: 5;">
                                <tr class="small text-uppercase text-muted">
                                    <th style="width: 35px;" class="px-3"><input type="checkbox" v-model="selectAll" class="form-check-input"></th>
                                    <th>{{ $t('common.name') }}</th>
                                    <th style="width: 80px;" class="d-none d-sm-table-cell">{{ $t('common.size') }}</th>
                                    <th style="width: 140px;" class="d-none d-md-table-cell">{{ $t('common.time') }}</th>
                                    <th style="width: 50px; min-width: 50px;" class="text-end px-3">
                                        <span class="d-none d-md-inline">{{ $t('common.actions') }}</span>
                                    </th>
                                </tr>
                            </thead>
                            <TransitionGroup tag="tbody" name="list">
                                <tr v-if="currentPath !== ''" class="file-row" @click="goUp()" key="..">
                                    <td class="px-3"></td>
                                    <td colspan="4" class="py-2"><i class="fa-solid fa-turn-up text-primary ms-2 me-2"></i> ..</td>
                                </tr>
                                <tr v-for="f in filteredFiles" :key="f.name" class="file-row" :class="{selected: selectedFiles.includes(f.name)}">
                                    <td @click.stop class="px-3"><input type="checkbox" :value="f.name" v-model="selectedFiles" class="form-check-input"></td>
                                    
                                    <!-- 点击名称：文件夹进入，文件尝试编辑 -->
                                    <td @click="f.isDir ? changeDir(joinPath(currentPath, f.name)) : editFile(f.name)" class="text-truncate" style="max-width: 200px;">
                                        <i class="fa-solid me-2" :class="getIcon(f)"></i>
                                        {{ f.name }}
                                        <div class="d-sm-none x-small text-muted">{{ f.isDir ? '-' : formatSize(f.size) }}</div>
                                    </td>
                                    
                                    <td class="d-none d-sm-table-cell small">{{ f.isDir ? '-' : formatSize(f.size) }}</td>
                                    <td class="small text-muted d-none d-md-table-cell">{{ new Date(f.mtime).toLocaleString() }}</td>
                                    
                                    <td class="text-end px-3">
                                        <!-- Desktop actions -->
                                        <div class="d-none d-md-flex justify-content-end gap-1">
                                            <button v-if="!f.isDir" class="btn btn-xs btn-link text-info p-1" @click.stop="editFile(f.name)" :title="$t('common.edit')">
                                                <i class="fa-solid fa-file-pen"></i>
                                            </button>
                                            <button class="btn btn-xs btn-link text-primary p-1" @click.stop="askRename(f)" :title="$t('common.edit')">
                                                <i class="fa-solid fa-pen"></i>
                                            </button>
                                            <button v-if="!f.isDir" class="btn btn-xs btn-link text-secondary p-1" @click.stop="downloadFile(f.name)" :title="$t('common.download')">
                                                <i class="fa-solid fa-download"></i>
                                            </button>
                                            <button class="btn btn-xs btn-link text-danger p-1" @click.stop="askDelete([f.name])" :title="$t('common.delete')">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                        <!-- Mobile actions dropdown -->
                                        <div class="d-md-none dropdown">
                                            <button class="btn btn-link btn-xs text-secondary p-0" type="button" @click.stop="toggleActionMenu(f.name)">
                                                <i class="fa-solid fa-ellipsis-vertical"></i>
                                            </button>
                                            <Transition name="scale">
                                                <ul v-if="activeActionMenu === f.name" class="dropdown-menu dropdown-menu-end shadow border-0 p-1 d-block" style="border-radius: 12px; z-index: 1060; min-width: 120px; position: absolute; right: 0;">
                                                    <li v-if="!f.isDir"><button class="dropdown-item rounded-3 py-1 fw-bold small" @click.stop="editFile(f.name); activeActionMenu=null"><i class="fa-solid fa-file-pen me-2 text-info"></i>{{ $t('common.edit') }}</button></li>
                                                    <li><button class="dropdown-item rounded-3 py-1 fw-bold small" @click.stop="askRename(f); activeActionMenu=null"><i class="fa-solid fa-pen me-2 text-primary"></i>{{ $t('common.edit') }}</button></li>
                                                    <li v-if="!f.isDir"><button class="dropdown-item rounded-3 py-1 fw-bold small" @click.stop="downloadFile(f.name); activeActionMenu=null"><i class="fa-solid fa-download me-2 text-secondary"></i>{{ $t('common.download') }}</button></li>
                                                    <li><hr class="dropdown-divider opacity-10 my-1"></li>
                                                    <li><button class="dropdown-item rounded-3 py-1 text-danger fw-bold small" @click.stop="askDelete([f.name]); activeActionMenu=null"><i class="fa-solid fa-trash me-2"></i>{{ $t('common.delete') }}</button></li>
                                                </ul>
                                            </Transition>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="filteredFiles.length === 0" key="empty">
                                    <td colspan="5" class="text-center text-muted py-5">
                                        <i class="fa-solid fa-folder-open fa-2x mb-2 opacity-25 d-block"></i>
                                        {{ $t('files.total', {count: 0}) }}
                                    </td>
                                </tr>
                            </TransitionGroup>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- 2. 编辑器视图 (全屏模式) -->
            <div v-else class="d-flex flex-column h-100" key="editor">
                <div class="card h-100 border-0 shadow-sm d-flex flex-column" style="border-radius: 12px; overflow: hidden;">
                    <div class="card-header bg-body-tertiary d-flex justify-content-between align-items-center py-2 px-3">
                        <div class="d-flex align-items-center overflow-hidden">
                            <i class="fa-solid fa-file-pen me-2 text-warning flex-shrink-0"></i>
                            <span class="fw-bold text-truncate" style="max-width: 150px; md-width: auto;">{{ editingFile.split('/').pop() }}</span>
                            <span class="badge bg-secondary ms-2 d-none d-sm-inline" v-if="hasUnsavedChanges">Unsaved</span>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-success px-2 px-md-3" @click="saveFile">
                                <i class="fa-solid fa-save me-md-1"></i><span class="d-none d-md-inline">{{ $t('common.save') }}</span>
                            </button>
                            <button class="btn btn-sm btn-secondary px-2 px-md-3" @click="closeEditor">
                                <i class="fa-solid fa-xmark me-md-1"></i><span class="d-none d-md-inline">{{ $t('common.close') }}</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- 文本输入框 -->
                    <textarea 
                        ref="editorArea"
                        class="form-control border-0 rounded-0 flex-grow-1 p-3 custom-scrollbar" 
                        style="font-family: 'Consolas', 'Monaco', monospace; resize: none; font-size: 13px; line-height: 1.5; background: var(--c-bg-base);" 
                        v-model="fileContent"
                        @keydown.ctrl.s.prevent="saveFile"
                        spellcheck="false"
                    ></textarea>
                </div>
            </div>
        </Transition>
    </div>
    `,
    setup() {
        // ... (existing setup code) ...
        const currentPath = ref('');
        const fileList = ref([]);
        const selectedFiles = ref([]);
        const selectAll = ref(false);
        const searchQuery = ref('');
        const activeActionMenu = ref(null);
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;
        const editingFile = ref(null);
        const fileContent = ref('');
        const originalContent = ref('');
        const editorArea = ref(null);
        const clipboard = ref({ action: '', files: [], sourcePath: '' });
        const fileUp = ref(null);
        const folderUp = ref(null);

        // ... computed ...
        const pathParts = computed(() => currentPath.value ? currentPath.value.split('/') : []);
        const joinPath = (base, name) => base ? `${base}/${name}` : name;
        const goUp = () => { if (!currentPath.value) return; const parts = currentPath.value.split('/'); parts.pop(); changeDir(parts.join('/')); };
        const changeDir = (path) => { currentPath.value = path; loadFiles(); };
        const loadFiles = async () => { try { const res = await api.get(`/api/files/list?path=${currentPath.value}`); fileList.value = res.data.sort((a, b) => { if (a.isDir !== b.isDir) return b.isDir - a.isDir; return a.name.localeCompare(b.name); }); selectedFiles.value = []; selectAll.value = false; } catch (e) { showToast($t('common.error'), 'danger'); } };
        const filteredFiles = computed(() => fileList.value.filter(f => f.name.toLowerCase().includes(searchQuery.value.toLowerCase())));
        watch(selectAll, (v) => selectedFiles.value = v ? filteredFiles.value.map(f => f.name) : []);
        const getIcon = (f) => { if (f.isDir) return 'fa-folder text-warning'; if (f.name.endsWith('.jar')) return 'fa-cube text-success'; if (/\.(json|toml|yaml|yml|conf|properties)$/.test(f.name)) return 'fa-file-code text-info'; if (/\.(log|txt|md)$/.test(f.name)) return 'fa-file-lines text-secondary'; if (/\.(zip|tar|gz)$/.test(f.name)) return 'fa-file-zipper text-danger'; return 'fa-file text-muted'; };
        const formatSize = (bytes) => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]; };

        // --- 文件编辑逻辑 (增强版) ---
        const EDITABLE_EXTS = ['txt', 'log', 'json', 'yml', 'yaml', 'properties', 'conf', 'toml', 'cfg', 'ini', 'sh', 'bat', 'js', 'md', 'xml'];

        const editFile = async (name) => {
            const ext = name.split('.').pop().toLowerCase();
            const doEdit = async () => {
                const fullPath = joinPath(currentPath.value, name);
                try {
                    const res = await api.get(`/api/files/content?path=${fullPath}`);
                    fileContent.value = res.data.content;
                    originalContent.value = res.data.content;
                    editingFile.value = fullPath;
                } catch (e) { showToast(t('files.error_read'), 'danger'); }
            };

            if (!EDITABLE_EXTS.includes(ext) && name.includes('.')) {
                openModal({
                    title: $t('files.modal_edit_warning_title'),
                    message: $t('files.modal_edit_warning_msg', { name: name }),
                    callback: doEdit
                });
            } else {
                doEdit();
            }
        };

        // ... rest of the file ...


        const hasUnsavedChanges = computed(() => fileContent.value !== originalContent.value);

        const saveFile = async () => {
            try {
                await api.post('/api/files/save', { filepath: editingFile.value, content: fileContent.value });
                originalContent.value = fileContent.value; // 更新原始值
                showToast($t('common.success'));
            } catch (e) { showToast($t('common.error'), 'danger'); }
        };

        const closeEditor = () => {
            if (hasUnsavedChanges.value) {
                if (!confirm(t('common.unsaved_changes'))) return;
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
            for (let i = 0; i < files.length; i++) {
                fd.append('files', files[i], files[i].webkitRelativePath || files[i].name);
                total += files[i].size;
            }
            fd.append('path', currentPath.value);

            store.task.visible = true; store.task.title = $t('common.upload'); store.task.percent = 0;
            try {
                await api.post('/api/files/upload', fd, {
                    onUploadProgress: (p) => {
                        if (p.total) store.task.percent = Math.round((p.loaded * 100) / p.total);
                        store.task.message = `${formatSize(p.loaded)} / ${formatSize(p.total)}`;
                    }
                });
                showToast($t('common.success')); loadFiles();
            } catch (e) { showToast($t('common.error'), 'danger'); }
            finally { setTimeout(() => store.task.visible = false, 500); e.target.value = ''; }
        };

        const operateFiles = async (action, files, dest = '', extra = {}) => {
            const fullFiles = files.map(f => joinPath(currentPath.value, f));
            try {
                await api.post('/api/files/operate', { action, sources: fullFiles, destination: dest, ...extra });
                showToast($t('common.success')); loadFiles();
            } catch (e) { showToast($t('common.error'), 'danger'); }
        };

        const copyToClipboard = (action) => {
            clipboard.value = { action, files: [...selectedFiles.value], sourcePath: currentPath.value };
            showToast(t('files.clipboard_msg', { action: action === 'copy' ? t('files.copy') : t('files.move'), count: selectedFiles.value.length }));
            selectedFiles.value = [];
        };

        const pasteFiles = async () => {
            const sources = clipboard.value.files.map(f => joinPath(clipboard.value.sourcePath, f));
            try {
                await api.post('/api/files/operate', { action: clipboard.value.action, sources: sources, destination: currentPath.value });
                showToast($t('common.success')); loadFiles();
                if (clipboard.value.action === 'move') clipboard.value.files = [];
            } catch (e) { showToast($t('common.error'), 'danger'); }
        };

        const askCompress = () => openModal({
            title: $t('files.modal_compress_title'), message: $t('files.modal_compress_name'), mode: 'input', placeholder: 'archive.zip',
            callback: (name) => operateFiles('compress', selectedFiles.value, currentPath.value, { compressName: name.endsWith('.zip') ? name : name + '.zip' })
        });
        const askDelete = (files) => openModal({ title: $t('common.delete'), message: $t('common.delete_confirm', { count: files.length }), callback: () => operateFiles('delete', files) });

        const askNewFolder = () => openModal({
            title: $t('files.new_folder'), message: $t('files.modal_new_folder'), mode: 'input',
            callback: async (name) => {
                if (!name) return;
                try { await api.post('/api/files/mkdir', { path: joinPath(currentPath.value, name) }); showToast($t('common.success')); loadFiles(); }
                catch (e) { showToast($t('common.error'), 'danger'); }
            }
        });

        const askNewFile = () => openModal({
            title: $t('files.new_file'), message: $t('files.modal_new_file'), mode: 'input', placeholder: 'example.txt',
            callback: async (name) => {
                if (!name) return;
                try {
                    await api.post('/api/files/create', { path: joinPath(currentPath.value, name) });
                    showToast($t('common.success')); loadFiles();
                    editFile(name); // Auto open editor
                }
                catch (e) { showToast($t('common.error'), 'danger'); }
            }
        });

        const askRename = (file) => openModal({
            title: $t('common.edit'), message: $t('files.modal_new_file'), mode: 'input', inputValue: file.name,
            callback: async (newName) => {
                if (!newName || newName === file.name) return;
                try {
                    await api.post('/api/files/rename', { oldPath: joinPath(currentPath.value, file.name), newPath: joinPath(currentPath.value, newName) });
                    showToast($t('common.success')); loadFiles();
                } catch (e) { showToast($t('common.error'), 'danger'); }
            }
        });

        const downloadFile = (name) => window.open(`/api/files/download?path=${joinPath(currentPath.value, name)}`, '_blank');

        const refreshFiles = () => loadFiles();
        const toggleActionMenu = (name) => {
            activeActionMenu.value = activeActionMenu.value === name ? null : name;
        };

        onMounted(() => loadFiles());

        return {
            currentPath, pathParts, fileList, filteredFiles, selectedFiles, selectAll, searchQuery,
            editingFile, fileContent, hasUnsavedChanges, editorArea, clipboard, fileUp, folderUp,
            changeDir, goUp, joinPath, getIcon, formatSize,
            uploadFiles, copyToClipboard, pasteFiles, askCompress, askDelete, downloadFile,
            editFile, saveFile, closeEditor, refreshFiles, askRename, askNewFile, askNewFolder,
            toggleActionMenu, activeActionMenu
        };
    }
};