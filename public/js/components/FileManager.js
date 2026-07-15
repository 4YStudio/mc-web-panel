import { ref, computed, watch, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, t, uploadFileWithChunk, isLargeFile } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column">
        <Transition name="fade" mode="out-in">
            <!-- 1. 文件列表视图 -->
            <div v-if="!editingFile && !previewingFile" class="d-flex flex-column h-100" key="list"
                @dragenter.prevent="dragCounter++; isDragging = true" @dragleave.prevent="dragCounter--; if (dragCounter <= 0) { isDragging = false; dragCounter = 0; }" @dragover.prevent @drop.prevent="dragCounter = 0; isDragging = false; handleDrop($event)">
                <!-- 页面标题 -->
                <div class="page-header d-flex justify-content-between align-items-center">
                    <h3 class="m-0 fw-bold"><i class="fa-solid fa-folder-open me-2 text-primary"></i>{{ $t('sidebar.files') }}</h3>
                </div>

                <!-- 顶部导航栏 -->
                <div class="row g-2 align-items-center mb-2">
                    <div class="col-12 col-md-auto flex-grow-1 overflow-hidden">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb mb-0 p-2 border-secondary rounded flex-nowrap overflow-auto no-scrollbar" style="font-size: 0.9rem; background-color: var(--c-surface) !important; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: row; align-items: center;">
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
                            <span class="input-group-text border-secondary border-end-0" style="backdrop-filter: none; background-color: var(--c-surface) !important;"><i class="fa-solid fa-search opacity-50"></i></span>
                            <input type="text" class="form-control border-secondary border-start-0 px-2" style="backdrop-filter: none; color: inherit; background-color: var(--c-surface) !important;" v-model="searchQuery" :placeholder="$t('common.search') + '...'">
                        </div>
                    </div>
                </div>

                <!-- 操作工具栏 -->
                <div class="card mb-3 bg-body-tertiary border-secondary flex-shrink-0">
                    <div class="card-body p-2 d-flex flex-wrap gap-2 align-items-center">
                        <div class="btn-group">
                            <button v-if="currentPath !== ''" class="btn btn-sm btn-outline-secondary" @click="goUp()" :title="$t('files.go_up')"><i class="fa-solid fa-turn-up"></i></button>
                            <button class="btn btn-sm btn-outline-secondary" @click="refreshFiles" :title="$t('common.refresh')"><i class="fa-solid fa-rotate"></i></button>
                            <button class="btn btn-sm btn-outline-secondary" @click="askCompress" :disabled="!selectedFiles.length" :title="$t('files.compress')"><i class="fa-solid fa-file-zipper"></i></button>
                            <button class="btn btn-sm btn-outline-secondary" @click="extractSelected" :disabled="!selectedArchiveFiles.length" :title="$t('files.extract')"><i class="fa-solid fa-box-open"></i></button>
                            <button class="btn btn-sm btn-outline-danger" @click="askDelete(selectedFiles)" :disabled="!selectedFiles.length" :title="$t('common.delete')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" @click="copyToClipboard('copy')" :disabled="!selectedFiles.length" :title="$t('files.copy')"><i class="fa-solid fa-copy"></i></button>
                            <button class="btn btn-sm btn-outline-primary" @click="copyToClipboard('move')" :disabled="!selectedFiles.length" :title="$t('files.move')"><i class="fa-solid fa-scissors"></i></button>
                            <button v-if="clipboard.files.length" class="btn btn-sm btn-warning" @click="pasteFiles"><i class="fa-solid fa-paste"></i> ({{ clipboard.files.length }})</button>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" @click="$refs.fileUp.click()" :title="$t('files.upload_file')"><i class="fa-solid fa-file-upload"></i></button>
                            <button class="btn btn-sm btn-outline-primary" @click="$refs.folderUp.click()" :title="$t('files.upload_folder')"><i class="fa-solid fa-upload"></i></button>
                            <button class="btn btn-sm btn-outline-success" @click="askNewFile" :title="$t('files.new_file')"><i class="fa-solid fa-file-circle-plus"></i></button>
                            <button class="btn btn-sm btn-outline-success" @click="askNewFolder" :title="$t('files.new_folder')"><i class="fa-solid fa-folder-plus"></i></button>
                        </div>
                        <input type="file" ref="fileUp" multiple class="d-none" @change="(e)=>uploadFiles(e)">
                        <input type="file" ref="folderUp" webkitdirectory multiple class="d-none" @change="(e)=>uploadFiles(e)">
                        <div class="ms-auto d-flex gap-2">
                        </div>
                    </div>
                </div>

                <!-- 文件列表表格 -->
                <div class="card flex-grow-1 overflow-hidden position-relative" style="border-radius: 12px;">
                    <div v-if="isDragging" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="z-index: 10; background: rgba(var(--bs-primary-rgb), 0.15); backdrop-filter: blur(2px); border-radius: 12px; border: 3px dashed var(--bs-primary);">
                        <div class="text-center text-primary">
                            <i class="fa-solid fa-cloud-arrow-up fa-3x mb-2"></i>
                            <h5 class="fw-bold">{{ $t('files.drop_to_upload') }}</h5>
                        </div>
                    </div>
                    <div class="table-responsive h-100 custom-scrollbar">
                        <table class="table table-hover table-sm mb-0 align-middle">
                            <thead>
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
                                <tr v-for="f in filteredFiles" :key="f.name" class="file-row" :class="{selected: selectedFiles.includes(f.name)}">
                                    <td @click.stop class="px-3"><input type="checkbox" :value="f.name" v-model="selectedFiles" class="form-check-input"></td>
                                    
                                    <!-- 点击名称：文件夹进入，图片预览，压缩包预览，其他文件编辑 -->
                                    <td @click="f.isDir ? changeDir(joinPath(currentPath, f.name)) : isImageFile(f.name) ? previewImage(f.name) : isArchive(f.name) ? previewArchive(f.name) : editFile(f.name)" class="py-2 pe-0 cursor-pointer">
                                        <div class="d-flex align-items-center">
                                            <i class="fa-solid me-2 flex-shrink-0" :class="getIcon(f)" style="width: 1.2rem; text-align: center;"></i>
                                            <span class="text-truncate flex-grow-1" style="max-width: calc(100vw - 180px);">{{ f.name }}</span>
                                            <div class="d-sm-none small text-muted opacity-75 ms-auto me-2 flex-shrink-0 text-end" style="min-width: 60px;">{{ f.isDir ? '-' : formatSize(f.size) }}</div>
                                        </div>
                                    </td>
                                    
                                    <td class="d-none d-sm-table-cell small">{{ f.isDir ? '-' : formatSize(f.size) }}</td>
                                    <td class="small text-muted d-none d-md-table-cell">{{ new Date(f.mtime).toLocaleString() }}</td>
                                    
                                    <td class="text-end px-3 py-2">
                                        <!-- Desktop actions -->
                                        <div class="d-none d-md-flex justify-content-end gap-1">
                                            <button v-if="isArchive(f.name)" class="btn btn-xs btn-link text-warning p-1" @click.stop="extractFile(f.name)" :title="$t('files.extract')">
                                                <i class="fa-solid fa-file-zipper"></i>
                                            </button>
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
                                            <button class="btn btn-link btn-xs text-secondary p-1" type="button" @click.stop="toggleActionMenu(f.name)">
                                                <i class="fa-solid fa-ellipsis-vertical"></i>
                                            </button>
                                            <Transition name="scale">
                                                <ul v-if="activeActionMenu === f.name" class="dropdown-menu dropdown-menu-end shadow border-0 p-1 d-block" style="border-radius: 12px; z-index: 1060; min-width: 120px; position: absolute; right: 0;">
                                                    <li v-if="isArchive(f.name)"><button class="dropdown-item rounded-3 py-1 fw-bold small" @click.stop="extractFile(f.name); activeActionMenu=null"><i class="fa-solid fa-file-zipper me-2 text-warning"></i>{{ $t('files.extract') }}</button></li>
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
            <div v-else-if="editingFile" class="d-flex flex-column h-100" key="editor">
                <div class="card h-100 d-flex flex-column" style="border-radius: 12px; overflow: hidden;">
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

            <!-- 3. 预览视图 -->
            <div v-else-if="previewingFile" class="d-flex flex-column h-100" key="preview">
                <div class="card h-100 d-flex flex-column" style="border-radius: 12px; overflow: hidden;">
                    <div class="card-header bg-body-tertiary d-flex justify-content-between align-items-center py-2 px-3">
                        <div class="d-flex align-items-center overflow-hidden">
                            <i class="fa-solid me-2 flex-shrink-0" :class="previewType === 'image' ? 'fa-file-image text-primary' : 'fa-file-zipper text-danger'"></i>
                            <span class="fw-bold text-truncate" style="max-width: 300px;">{{ previewingFile.split('/').pop() }}</span>
                        </div>
                        <div class="d-flex gap-2">
                            <button v-if="previewType === 'archive'" class="btn btn-sm btn-warning px-2 px-md-3" @click="askExtract(previewingFile.split('/').pop())">
                                <i class="fa-solid fa-box-open me-md-1"></i><span class="d-none d-md-inline">{{ $t('files.extract') }}</span>
                            </button>
                            <button class="btn btn-sm btn-secondary px-2 px-md-3" @click="closePreview">
                                <i class="fa-solid fa-xmark me-md-1"></i><span class="d-none d-md-inline">{{ $t('common.close') }}</span>
                            </button>
                        </div>
                    </div>
                    <div class="flex-grow-1 overflow-auto custom-scrollbar p-3">
                        <!-- 图片预览 -->
                        <div v-if="previewType === 'image'" class="d-flex align-items-center justify-content-center h-100">
                            <img :src="previewData" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;" @error="previewData = ''">
                        </div>
                        <!-- 压缩包预览 -->
                        <div v-else-if="previewType === 'archive'">
                            <div v-if="previewData && previewData.length > 0">
                                <table class="table table-sm table-hover mb-0">
                                    <thead>
                                        <tr class="small text-uppercase text-muted">
                                            <th>{{ $t('common.name') }}</th>
                                            <th style="width: 80px;">{{ $t('common.size') }}</th>
                                            <th style="width: 80px;" class="d-none d-sm-table-cell">{{ $t('files.compress') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="entry in previewData" :key="entry.name">
                                            <td class="text-truncate" style="max-width: 400px;">
                                                <i class="fa-solid me-1" :class="entry.isDir ? 'fa-folder text-warning' : 'fa-file text-muted'" style="width: 1rem;"></i>
                                                {{ entry.name }}
                                            </td>
                                            <td class="small">{{ entry.isDir ? '-' : formatSize(entry.size) }}</td>
                                            <td class="small d-none d-sm-table-cell">{{ entry.isDir ? '-' : formatSize(entry.compressedSize) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div v-else class="text-center text-muted py-5">
                                <i class="fa-solid fa-spinner fa-spin fa-2x mb-2 d-block"></i>
                                {{ $t('common.loading') }}...
                            </div>
                        </div>
                    </div>
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
        const isDragging = ref(false);
        const dragCounter = ref(0);
        const previewingFile = ref(null);
        const previewType = ref('');
        const previewData = ref(null);

        // ... computed ...
        const pathParts = computed(() => currentPath.value ? currentPath.value.split('/') : []);
        const joinPath = (base, name) => base ? `${base}/${name}` : name;
        const goUp = () => { if (!currentPath.value) return; const parts = currentPath.value.split('/'); parts.pop(); changeDir(parts.join('/')); };
        const changeDir = (path) => { currentPath.value = path; loadFiles(); };
        const loadFiles = async () => { try { const res = await api.get(`/api/files/list?path=${currentPath.value}`); fileList.value = res.data.sort((a, b) => { if (a.isDir !== b.isDir) return b.isDir - a.isDir; return a.name.localeCompare(b.name); }); selectedFiles.value = []; selectAll.value = false; } catch (e) { showToast($t('common.error'), 'danger'); } };
        const filteredFiles = computed(() => fileList.value.filter(f => f.name.toLowerCase().includes(searchQuery.value.toLowerCase())));
        const selectedArchiveFiles = computed(() => selectedFiles.value.filter(f => isArchive(f)));
        watch(selectAll, (v) => selectedFiles.value = v ? filteredFiles.value.map(f => f.name) : []);
        const getIcon = (f) => { if (f.isDir) return 'fa-folder text-warning'; if (f.name.endsWith('.jar')) return 'fa-cube text-success'; if (/\.(json|toml|yaml|yml|conf|properties)$/.test(f.name)) return 'fa-file-code text-info'; if (/\.(log|txt|md)$/.test(f.name)) return 'fa-file-lines text-secondary'; if (/\.(zip|tar|gz)$/.test(f.name)) return 'fa-file-zipper text-danger'; if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/.test(f.name)) return 'fa-file-image text-primary'; return 'fa-file text-muted'; };
        const formatSize = (bytes) => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]; };
        const isArchive = (name) => /\.(zip|tar\.gz|tgz|tar|gz)$/i.test(name);
        const isImageFile = (name) => /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/i.test(name);
        const previewImage = (name) => {
            previewingFile.value = joinPath(currentPath.value, name);
            previewType.value = 'image';
            const params = new URLSearchParams({ path: joinPath(currentPath.value, name) });
            if (store.currentInstanceId) params.set('instanceId', store.currentInstanceId);
            previewData.value = `/api/files/preview-image?${params.toString()}`;
        };
        const previewArchive = async (name) => {
            previewingFile.value = joinPath(currentPath.value, name);
            previewType.value = 'archive';
            previewData.value = [];
            try {
                const res = await api.get(`/api/files/archive-list?path=${encodeURIComponent(joinPath(currentPath.value, name))}`);
                previewData.value = res.data.entries || [];
            } catch (e) {
                showToast($t('common.error'), 'danger');
            }
        };
        const closePreview = () => {
            previewingFile.value = null;
            previewType.value = '';
            previewData.value = null;
        };
        const askExtract = (name) => {
            const defaultDest = name.replace(/\.(zip|tar\.gz|tgz|tar|gz)$/i, '');
            openModal({
                title: $t('files.modal_extract_title'),
                message: $t('files.modal_extract_dest'),
                mode: 'input',
                inputValue: defaultDest,
                placeholder: defaultDest,
                callback: async (dest) => {
                    const destPath = dest ? joinPath(currentPath.value, dest) : joinPath(currentPath.value, defaultDest);
                    await operateFilesWithProgress('extract', [name], destPath);
                }
            });
        };
        const extractFile = (name) => askExtract(name);
        const extractSelected = () => {
            if (selectedArchiveFiles.value.length === 0) return;
            if (selectedArchiveFiles.value.length === 1) {
                askExtract(selectedArchiveFiles.value[0]);
            } else {
                selectedArchiveFiles.value.forEach(f => {
                    const defaultDest = f.replace(/\.(zip|tar\.gz|tgz|tar|gz)$/i, '');
                    operateFilesWithProgress('extract', [f], joinPath(currentPath.value, defaultDest));
                });
            }
            selectedFiles.value = selectedFiles.value.filter(f => !isArchive(f));
        };

        const handleDrop = async (e) => {
            isDragging.value = false;
            const items = e.dataTransfer.items;
            const files = [];
            if (items && items.length > 0) {
                const entries = [];
                for (let i = 0; i < items.length; i++) {
                    if (items[i].kind !== 'file') continue;
                    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                    if (entry) {
                        entries.push(entry);
                    } else {
                        const f = items[i].getAsFile();
                        if (f) files.push({ file: f, relativePath: f.name });
                    }
                }
                for (const entry of entries) {
                    await collectFilesFromEntry(entry, '', files);
                }
            } else {
                for (let i = 0; i < e.dataTransfer.files.length; i++) {
                    const f = e.dataTransfer.files[i];
                    files.push({ file: f, relativePath: f.webkitRelativePath || f.name });
                }
            }
            if (!files.length) return;
            await uploadDroppedFiles(files);
        };

        const collectFilesFromEntry = async (entry, basePath, files) => {
            if (entry.isFile) {
                const file = await new Promise((resolve) => entry.file(resolve));
                files.push({ file, relativePath: basePath + file.name });
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                const allEntries = [];
                await new Promise((resolve) => {
                    const readBatch = () => {
                        reader.readEntries((batch) => {
                            if (!batch.length) resolve();
                            else { allEntries.push(...batch); readBatch(); }
                        }, (err) => { console.warn('readEntries error:', err); resolve(); });
                    };
                    readBatch();
                });
                for (const e of allEntries) {
                    await collectFilesFromEntry(e, basePath + entry.name + '/', files);
                }
            }
        };

        const uploadDroppedFiles = async (fileEntries) => {
            store.task.visible = true; store.task.title = $t('common.upload'); store.task.percent = 0;
            const allFiles = fileEntries.map(e => e.file);
            let totalSize = allFiles.reduce((s, f) => s + f.size, 0);
            let uploadedSize = 0;

            try {
                const smallFiles = fileEntries.filter(e => !isLargeFile(e.file));
                const largeFiles = fileEntries.filter(e => isLargeFile(e.file));

                if (smallFiles.length) {
                    const fd = new FormData();
                    const fileNames = [];
                    for (const e of smallFiles) {
                        fd.append('files', e.file, e.relativePath);
                        fileNames.push(e.relativePath);
                    }
                    fd.append('path', currentPath.value);
                    fd.append('fileNames', JSON.stringify(fileNames));
                    const smallTotal = smallFiles.reduce((s, e) => s + e.file.size, 0);
                    await api.post('/api/files/upload', fd, {
                        onUploadProgress: (p) => {
                            if (p.total) {
                                const currentUploaded = uploadedSize + p.loaded;
                                store.task.percent = Math.round((currentUploaded * 100) / totalSize);
                                store.task.message = `${formatSize(currentUploaded)} / ${formatSize(totalSize)}`;
                            }
                        }
                    });
                    uploadedSize += smallTotal;
                }

                for (const entry of largeFiles) {
                    await uploadFileWithChunk(entry.file, {
                        initUrl: '/api/files/chunk/init',
                        completeUrl: '/api/files/chunk/complete',
                        fileName: entry.relativePath,
                        extraInitData: { targetPath: currentPath.value },
                        onProgress: (bytesDone, bytesTotal, chunkNum, totalChunks) => {
                            const currentUploaded = uploadedSize + bytesDone;
                            store.task.percent = Math.round((currentUploaded * 100) / totalSize);
                            store.task.message = `${formatSize(currentUploaded)} / ${formatSize(totalSize)}`;
                            store.task.subMessage = `${chunkNum} / ${totalChunks}`;
                        }
                    });
                    uploadedSize += entry.file.size;
                }

                showToast($t('common.success')); loadFiles();
            } catch (e) { showToast($t('common.error'), 'danger'); }
            finally { setTimeout(() => store.task.visible = false, 500); }
        };

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

            const largeFiles = [];
            const smallFiles = [];
            for (let i = 0; i < files.length; i++) {
                if (isLargeFile(files[i])) largeFiles.push(files[i]);
                else smallFiles.push(files[i]);
            }

            store.task.visible = true; store.task.title = $t('common.upload'); store.task.percent = 0;
            let totalSize = Array.from(files).reduce((s, f) => s + f.size, 0);
            let uploadedSize = 0;

            try {
                if (smallFiles.length) {
                    const fd = new FormData();
                    const fileNames = [];
                    for (const f of smallFiles) {
                        fd.append('files', f, f.webkitRelativePath || f.name);
                        fileNames.push(f.webkitRelativePath || f.name);
                    }
                    fd.append('path', currentPath.value);
                    fd.append('fileNames', JSON.stringify(fileNames));
                    const smallTotal = smallFiles.reduce((s, f) => s + f.size, 0);
                    await api.post('/api/files/upload', fd, {
                        onUploadProgress: (p) => {
                            if (p.total) {
                                const currentUploaded = uploadedSize + p.loaded;
                                store.task.percent = Math.round((currentUploaded * 100) / totalSize);
                                store.task.message = `${formatSize(currentUploaded)} / ${formatSize(totalSize)}`;
                            }
                        }
                    });
                    uploadedSize += smallTotal;
                }

                for (const file of largeFiles) {
                    const chunkResult = await uploadFileWithChunk(file, {
                        initUrl: '/api/files/chunk/init',
                        completeUrl: '/api/files/chunk/complete',
                        fileName: file.webkitRelativePath || file.name,
                        extraInitData: { targetPath: currentPath.value },
                        onProgress: (bytesDone, bytesTotal, chunkNum, totalChunks) => {
                            const currentUploaded = uploadedSize + bytesDone;
                            store.task.percent = Math.round((currentUploaded * 100) / totalSize);
                            store.task.message = `${formatSize(currentUploaded)} / ${formatSize(totalSize)}`;
                            store.task.subMessage = `${chunkNum} / ${totalChunks}`;
                        }
                    });
                    uploadedSize += file.size;
                }

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

        const operateFilesWithProgress = async (action, files, dest = '', extra = {}) => {
            const fullFiles = files.map(f => joinPath(currentPath.value, f));
            const isCompressOrExtract = action === 'compress' || action === 'extract';
            if (isCompressOrExtract) {
                store.task.visible = true;
                store.task.title = action === 'compress' ? $t('files.compressing') : $t('files.extracting');
                store.task.percent = -1;
                store.task.message = files.length === 1 ? files[0] : `${files.length} files`;
                store.task.subMessage = '';
            }
            try {
                await api.post('/api/files/operate', { action, sources: fullFiles, destination: dest, ...extra });
                showToast($t('common.success')); loadFiles();
            } catch (e) { showToast($t('common.error'), 'danger'); }
            finally {
                if (isCompressOrExtract) {
                    store.task.percent = 100;
                    setTimeout(() => { store.task.visible = false; }, 500);
                }
            }
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

        const askCompress = () => {
            const defaultName = selectedFiles.value.length === 1 ? selectedFiles.value[0].split('.').shift() : 'archive';
            openModal({
                title: $t('files.modal_compress_title'), 
                message: $t('files.modal_compress_name'), 
                mode: 'input', 
                inputValue: defaultName,
                suffix: '.zip',
                placeholder: 'archive',
                callback: (name) => {
                    if (!name) return;
                    const finalName = name.endsWith('.zip') ? name : name + '.zip';
                    operateFilesWithProgress('compress', selectedFiles.value, currentPath.value, { compressName: finalName });
                }
            });
        };
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

        const downloadFile = (name) => {
            const params = new URLSearchParams({ path: joinPath(currentPath.value, name) });
            if (store.currentInstanceId) params.set('instanceId', store.currentInstanceId);
            window.open(`/api/files/download?${params.toString()}`, '_blank');
        };

        const refreshFiles = () => loadFiles();
        const toggleActionMenu = (name) => {
            activeActionMenu.value = activeActionMenu.value === name ? null : name;
        };

        onMounted(() => loadFiles());

        return {
            currentPath, pathParts, fileList, filteredFiles, selectedFiles, selectAll, searchQuery,
            editingFile, fileContent, hasUnsavedChanges, editorArea, clipboard, fileUp, folderUp, isDragging, dragCounter,
            previewingFile, previewType, previewData,
            changeDir, goUp, joinPath, getIcon, formatSize, isArchive, isImageFile, extractFile, extractSelected, selectedArchiveFiles, handleDrop,
            uploadFiles, copyToClipboard, pasteFiles, askCompress, askDelete, downloadFile,
            editFile, saveFile, closeEditor, refreshFiles, askRename, askNewFile, askNewFolder,
            previewImage, previewArchive, closePreview,
            toggleActionMenu, activeActionMenu
        };
    }
};