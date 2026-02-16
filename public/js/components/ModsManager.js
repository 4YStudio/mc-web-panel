import { ref, reactive, computed, watch, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

const LazyModRow = {
    props: ['file', 'selectedFiles'],
    emits: ['update:selectedFiles', 'click-mod'],
    template: `
        <tr :class="{'opacity-50': file.isDisabled}" ref="row" @click="$emit('click-mod', file)" class="cursor-pointer">
            <td @click.stop class="px-3">
                <input class="form-check-input" type="checkbox" :value="file.name" 
                    :checked="selectedFiles.includes(file.name)"
                    @change="$emit('update:selectedFiles', $event.target.checked ? [...selectedFiles, file.name] : selectedFiles.filter(n => n !== file.name))">
            </td>
            <td>
                <div class="d-flex align-items-center gap-2 gap-md-3">
                    <div class="position-relative flex-shrink-0">
                        <img :src="iconUrl" @error="handleImgError" class="rounded border shadow-sm" width="36" height="36" style="object-fit:cover;">
                        <div v-if="loading && !metadata" class="position-absolute top-50 start-50 translate-middle">
                            <span class="spinner-border spinner-border-sm text-primary opacity-50" style="width: 10px; height: 10px;"></span>
                        </div>
                    </div>
                    <div class="min-width-0">
                        <div class="fw-bold text-truncate small">{{ metadata?.title || file.name }}</div>
                        <div class="d-flex gap-2 align-items-center mt-1">
                            <span v-if="metadata" class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 0.65rem; padding: 0.15rem 0.4rem;">{{ metadata.version }}</span>
                            <span class="small text-muted font-monospace d-none d-md-inline" style="font-size: 0.7rem;">{{ file.name }}</span>
                            <div class="d-sm-none small text-muted" style="font-size: 0.7rem;">{{ (file.size/1024/1024).toFixed(2) }} MB</div>
                        </div>
                    </div>
                </div>
            </td>
            <td>
                <span v-if="file.isDisabled" class="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle py-1" style="font-size: 0.7rem;">{{ $t('common.disabled') }}</span>
                <span v-else class="badge rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle py-1" style="font-size: 0.7rem;">{{ $t('common.enabled') }}</span>
            </td>
            <td class="text-end text-muted small px-3 d-none d-sm-table-cell">{{ (file.size/1024/1024).toFixed(2) }} MB</td>
        </tr>
    `,
    // ... setup remains similar but with emit logic if needed, actually the template emit is enough

    setup(props) {
        const metadata = ref(props.file.metadata);
        const loading = ref(false);
        const row = ref(null);
        const hasLoaded = ref(false);
        const iconError = ref(false);

        const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0icmdiKDEwOCwgMTE3LCAxMjUpIiBvcGFjaXR5PSIuNSI+PHBhdGggZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNXYtMTBMMTIgMnptMCAyLjg2bDcuNSAzLjc1LTMuNSAxLjc1LTcuNS0zLjc1IDMuNS0xLjc1em0tOC41IDUuNTVMTEUgMTQuMXY3LjNsLTcuNS0zLjc1di03LjN6TTIyIDE3LjI1bC03LjUgMy43NXYtNy4zbDcuNS0zLjc1djcuM3oiLz48L3N2Zz4=';

        const iconUrl = computed(() => {
            if (iconError.value) return DEFAULT_ICON;
            return metadata.value?.icon_url || DEFAULT_ICON;
        });

        watch(metadata, () => {
            iconError.value = false;
        });

        const handleImgError = () => {
            if (iconUrl.value === DEFAULT_ICON) return;
            iconError.value = true;
        };

        const fetchMeta = async () => {
            if (hasLoaded.value || metadata.value) return;
            loading.value = true;
            try {
                const res = await api.get(`/api/mods/local/metadata?file=${encodeURIComponent(props.file.name)}`);
                if (res.data.metadata) {
                    metadata.value = res.data.metadata;
                    props.file.metadata = res.data.metadata;
                    props.file.hash = res.data.hash;
                }
            } catch (e) { console.error('Enrichment failed', props.file.name); }
            finally {
                loading.value = false;
                hasLoaded.value = true;
            }
        };

        onMounted(() => {
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    fetchMeta();
                    observer.disconnect();
                }
            }, { threshold: 0.1 });
            if (row.value) observer.observe(row.value);
        });

        return { metadata, loading, row, iconUrl, handleImgError };
    }
};

export default {
    components: { LazyModRow },
    template: `
    <div class="h-100 d-flex flex-column overflow-hidden">
        <div v-if="notFound" class="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
            <i class="fa-solid fa-folder-open fa-4x mb-3 opacity-25"></i>
            <h4>{{ $t('files.folder_not_found', { name: 'mods' }) }}</h4>
        </div>

        <template v-else>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3 class="m-0 fw-bold">{{ $t('mods.title') }}</h3>
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" @click="store.view = 'modrinth'">
                    <i class="fa-solid fa-globe me-1"></i>{{ $t('mods.browse_modrinth') }}
                </button>
            </div>
            
            <div class="card shadow-sm d-flex flex-column border-0 overflow-hidden" style="flex: 1; min-height: 0; border-radius: 16px;">
                <div class="card-header d-flex flex-wrap gap-2 p-2 align-items-center bg-body-tertiary border-0 overflow-hidden">
                    <div class="input-group input-group-sm mb-0 flex-shrink-0" style="width: 120px;">
                        <span class="input-group-text border-0 bg-body shadow-sm"><i class="fa-solid fa-search"></i></span>
                        <input type="text" class="form-control border-0 bg-body shadow-sm px-1" v-model="searchQuery" :placeholder="$t('common.search')">
                    </div>
                    <div class="vr mx-1 d-none d-sm-block"></div>
                    <div class="d-flex gap-1 flex-wrap flex-grow-1">
                        <button class="btn btn-sm btn-outline-warning border rounded-3 px-2 py-1 flex-grow-1 flex-md-grow-0" style="font-size: 0.75rem;" @click="operateFiles('disable', selectedFiles)" :disabled="!selectedFiles.length">
                            <i class="fa-solid fa-ban me-1"></i><span class="d-none d-md-inline">{{ $t('files.disable') }}</span><span class="d-inline d-md-none">{{ $t('files.disable') }}</span>
                        </button>
                        <button class="btn btn-sm btn-outline-success border rounded-3 px-2 py-1 flex-grow-1 flex-md-grow-0" style="font-size: 0.75rem;" @click="operateFiles('enable', selectedFiles)" :disabled="!selectedFiles.length">
                            <i class="fa-solid fa-check me-1"></i><span class="d-none d-md-inline">{{ $t('files.enable') }}</span><span class="d-inline d-md-none">{{ $t('files.enable') }}</span>
                        </button>
                        <button class="btn btn-sm btn-outline-danger border rounded-3 px-2 py-1 flex-grow-1 flex-md-grow-0" style="font-size: 0.75rem;" @click="askDelete(selectedFiles)" :disabled="!selectedFiles.length">
                            <i class="fa-solid fa-trash me-1"></i><span class="d-none d-md-inline">{{ $t('common.delete') }}</span><span class="d-inline d-md-none">{{ $t('common.delete') }}</span>
                        </button>
                    </div>
                    <div class="ms-auto flex-shrink-0">
                        <input type="file" ref="modInput" multiple class="d-none" @change="(e)=>uploadFiles(e)">
                        <button class="btn btn-sm btn-primary rounded-pill px-2 px-md-3 shadow-sm fw-bold" @click="$refs.modInput.click()">
                            <i class="fa-solid fa-upload"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body p-0 overflow-hidden d-flex flex-column" style="flex: 1; min-height: 0;">
                    <div class="table-responsive h-100 custom-scrollbar">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="sticky-top bg-body" style="z-index: 5;">
                                <tr class="small text-uppercase text-muted fw-bold">
                                    <th style="width: 40px;" class="px-3"><input class="form-check-input" type="checkbox" v-model="selectAll"></th>
                                    <th>{{ $t('common.name') }}</th>
                                    <th style="width: 100px;">{{ $t('common.status') }}</th>
                                    <th style="width: 100px;" class="text-end px-3 d-none d-sm-table-cell">{{ $t('common.size') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="loadingList">
                                    <td colspan="4" class="text-center py-5">
                                        <div class="spinner-border text-primary" role="status"></div>
                                        <div class="mt-2 text-muted small">{{ $t('common.loading') }}...</div>
                                    </td>
                                </tr>
                                <template v-else>
                                    <LazyModRow v-for="file in filteredFiles" :key="file.name" :file="file" 
                                        v-model:selectedFiles="selectedFiles" @click-mod="showModDetails" />
                                </template>
                                <tr v-if="!loadingList && filteredFiles.length === 0">
                                    <td colspan="4" class="text-center py-5 text-muted">
                                        <i class="fa-solid fa-box-open fa-2x mb-2 opacity-25 d-block"></i>
                                        {{ $t('mods.empty') }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </template>

        <!-- Mod Details Modal (Reused layout from ModrinthBrowser) -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="loadingDetails" class="modal-backdrop fade show" style="z-index: 2060; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);">
                    <div class="h-100 d-flex flex-column align-items-center justify-content-center text-white gap-3">
                        <div class="spinner-border spinner-border-lg text-primary" style="width: 3rem; height: 3rem;"></div>
                        <h5 class="fw-bold">{{ $t('common.loading') }}</h5>
                    </div>
                </div>
            </Transition>

            <Transition name="fade">
                <div v-if="selectedMod" class="modal-backdrop fade show" style="z-index: 2060; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);"></div>
            </Transition>

            <Transition name="scale">
                <div v-if="selectedMod" class="modal show d-block" @click.self="selectedMod = null" style="z-index: 2070;">
                    <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
                    <div class="modal-content shadow-lg border-0 rounded-4 overflow-hidden bg-body h-100" style="max-height: 90vh;">
                        <div class="modal-header border-0 bg-primary text-white py-3 shadow-sm flex-shrink-0">
                            <h5 class="modal-title fw-bold d-flex align-items-center">
                                <template v-if="selectedMod.project">
                                    [{{ $t('mods.modrinth.types.' + selectedMod.project.project_type) }}] {{ selectedMod.project.title }}
                                </template>
                                <template v-else>{{ selectedMod.file.name }}</template>
                            </h5>
                            <button type="button" class="btn-close btn-close-white" @click="selectedMod = null"></button>
                        </div>
                        
                        <div class="modal-body p-0 overflow-hidden d-flex flex-column flex-md-row">
                            <!-- Mod Info & Introduction -->
                            <div class="col-12 overflow-auto p-3 p-md-4 custom-scrollbar bg-body">
                                <div class="d-flex flex-column flex-sm-row gap-3 gap-md-4 mb-4" v-if="selectedMod.project">
                                    <img :src="selectedMod.project.icon_url" class="rounded-4 border shadow-sm bg-white mx-auto mx-sm-0" width="100" height="100" style="object-fit: contain;">
                                    <div class="flex-grow-1 min-width-0 text-center text-sm-start">
                                        <h4 class="fw-bold mb-1">{{ selectedMod.project.title }}</h4>
                                        <div class="text-muted small mb-3 text-truncate-3">
                                            {{ bodyTranslations[selectedMod.project.id + '_desc'] || selectedMod.project.description }}
                                        </div>
                                        <div class="d-flex flex-wrap gap-2 justify-content-center justify-content-sm-start">
                                            <div class="badge rounded-pill px-2 py-1 small fw-bold border bg-primary-subtle text-primary border-primary-subtle">
                                                <i class="fa-solid fa-code-version me-1"></i>{{ selectedMod.file.metadata?.version }}
                                            </div>
                                            <div class="badge rounded-pill px-2 py-1 small fw-bold border"
                                                 :class="selectedMod.project.server_side === 'required' ? 'bg-success-subtle text-success border-success-subtle' : 'bg-secondary-subtle text-secondary border-secondary-subtle'">
                                                <i class="fa-solid fa-server me-1"></i><span class="d-none d-sm-inline">{{ $t('mods.modrinth.env_server') }}:</span> {{ $t('mods.modrinth.env_' + selectedMod.project.server_side) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="text-center py-4 bg-body-tertiary rounded-4 mb-4 mx-3 mx-md-0">
                                    <i class="fa-solid fa-file-zipper fa-3x mb-3 opacity-25"></i>
                                    <h5 class="fw-bold px-2 text-wrap">{{ selectedMod.file.name.split('/').pop() }}</h5>
                                    <p class="text-muted small mb-0">{{ (selectedMod.file.size/1024/1024).toFixed(2) }} MB</p>
                                </div>
                                
                                <div v-if="selectedMod.project" class="border-top pt-4">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <label class="form-label fw-bold text-uppercase text-muted mb-0 d-flex align-items-center">
                                            <i class="fa-solid fa-file-lines me-2 text-primary"></i>{{ $t('mods.modrinth.introduction') }}
                                        </label>
                                        <button class="btn btn-xs btn-outline-primary rounded-pill px-2 px-md-3 fw-bold" @click="translateBody" :disabled="translatingBody">
                                            <span v-if="translatingBody" class="spinner-border spinner-border-sm me-1"></span>
                                            <i v-else class="fa-solid fa-language me-1"></i>
                                            {{ translatingBody ? $t('mods.translating') : (bodyTranslations[selectedMod.project.id] ? $t('common.close') : $t('mods.translate')) }}
                                        </button>
                                    </div>
                                    <div class="mod-description-container bg-body-tertiary p-3 rounded-4 small text-body overflow-auto" style="max-height: 400px;"
                                         v-html="renderMarkdown(bodyTranslations[selectedMod.project.id] || selectedMod.project.body)"></div>
                                </div>
                                <div v-else class="text-center py-5 opacity-50">
                                    {{ $t('mods.no_info') || 'No additional information available for this mod.' }}
                                </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
    `,
    setup() {
        const fileList = ref([]);
        const notFound = ref(false);
        const selectedFiles = ref([]);
        const selectAll = ref(false);
        const searchQuery = ref('');
        const modInput = ref(null);
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;
        const loadingList = ref(false);

        // Mod Details State
        const selectedMod = ref(null);
        const loadingDetails = ref(false);
        const translatingBody = ref(false);
        const bodyTranslations = reactive({});

        const loadFiles = async () => {
            try {
                loadingList.value = true;
                const res = await api.get('/api/mods/local/list');
                fileList.value = res.data;
                notFound.value = false;
                selectedFiles.value = [];
                selectAll.value = false;
            } catch (e) {
                if (e.response?.status === 404) {
                    notFound.value = true;
                } else {
                    showToast($t('common.error'), 'danger');
                }
            } finally {
                loadingList.value = false;
            }
        };

        const showModDetails = async (file) => {
            const projectId = file.metadata?.project_id;
            if (!projectId) {
                selectedMod.value = { file, project: null };
                return;
            }

            loadingDetails.value = true;
            try {
                const res = await api.get(`/api/mods/modrinth/project/${projectId}`);
                selectedMod.value = { file, project: res.data.project };
            } catch (e) {
                console.error('Failed to fetch project details', e);
                selectedMod.value = { file, project: null };
            } finally {
                loadingDetails.value = false;
            }
        };

        const translateBody = async () => {
            const id = selectedMod.value?.project?.id;
            if (!id || !selectedMod.value.project.body) return;
            if (bodyTranslations[id]) {
                delete bodyTranslations[id];
                delete bodyTranslations[id + '_desc'];
                return;
            }

            translatingBody.value = true;
            try {
                const [resBody, resDesc] = await Promise.all([
                    api.post('/api/ai/translate', { text: selectedMod.value.project.body }),
                    api.post('/api/ai/translate', { text: selectedMod.value.project.description })
                ]);
                bodyTranslations[id] = resBody.data.translated;
                bodyTranslations[id + '_desc'] = resDesc.data.translated;
            } catch (e) {
                const errKey = e.response?.data?.error === 'AI_NOT_CONFIGURED' ? 'mods.translate_fail_config' : 'mods.translate_fail';
                showToast($t(errKey), 'warning');
            } finally {
                translatingBody.value = false;
            }
        };

        const renderMarkdown = (text) => {
            if (!text) return '';
            // Basic markdown simulation
            return text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        };

        const filteredFiles = computed(() => {
            return fileList.value.filter(f => f.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
        });

        watch(selectAll, (v) => {
            selectedFiles.value = v ? filteredFiles.value.map(f => f.name) : [];
        });

        const formatSize = (bytes) => {
            if (bytes === 0) return '0 B';
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
            store.task.title = $t('common.loading');
            store.task.percent = 0;
            store.task.message = `...`;
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
                showToast($t('common.success'));
                loadFiles();
            } catch (e) {
                showToast($t('common.error'), 'danger');
            } finally {
                setTimeout(() => { store.task.visible = false; }, 500);
                e.target.value = '';
            }
        };

        const operateFiles = async (action, files) => {
            const fullFiles = files.map(f => 'mods/' + f);
            try {
                await api.post('/api/files/operate', { action, sources: fullFiles, destination: '' });
                showToast($t('common.success'));
                loadFiles();
            } catch (e) {
                showToast($t('common.error'), 'danger');
            }
        };

        const askDelete = (files) => {
            openModal({
                title: $t('common.delete'),
                message: $t('common.delete_confirm', { count: files.length }),
                callback: () => operateFiles('delete', files)
            });
        };

        onMounted(() => loadFiles());

        return {
            fileList, filteredFiles, selectedFiles, selectAll, searchQuery, modInput,
            uploadFiles, operateFiles, askDelete, notFound, loadingList, store,
            selectedMod, loadingDetails, translatingBody, bodyTranslations,
            showModDetails, translateBody, renderMarkdown
        };
    }
};