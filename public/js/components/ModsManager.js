import { ref, reactive, computed, watch, onMounted, onUnmounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, uploadFileWithChunk, isLargeFile } from '../utils.js';

const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0icmdiKDEwOCwgMTE3LCAxMjUpIiBvcGFjaXR5PSIuNSI+PHBhdGggZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNXYtMTBMMTIgMnptMCAyLjg2bDcuNSAzLjc1LTMuNSAxLjc1LTcuNS0zLjc1IDMuNS0xLjc1em0tOC41IDUuNTVMTEUgMTQuMXY3LjNsLTcuNS0zLjc1di03LjN6TTIyIDE3LjI1bC03LjUgMy43NXYtNy4zbDcuNS0zLjc1djcuM3oiLz48L3N2Zz4=';

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

const LazyModCard = {
    props: ['file', 'selectedFiles'],
    emits: ['update:selectedFiles', 'click-mod'],
    template: `
        <div :class="{'opacity-75': file.isDisabled}" ref="cardEl" class="card border rounded-3 p-3 shadow-sm bg-body cursor-pointer" @click="$emit('click-mod', file)">
            <div class="d-flex align-items-center gap-3">
                <div @click.stop class="d-flex align-items-center flex-shrink-0">
                    <input class="form-check-input m-0 cursor-pointer" type="checkbox" :value="file.name" 
                        :checked="selectedFiles.includes(file.name)"
                        @change="$emit('update:selectedFiles', $event.target.checked ? [...selectedFiles, file.name] : selectedFiles.filter(n => n !== file.name))">
                </div>
                <div class="position-relative flex-shrink-0">
                    <img :src="iconUrl" @error="handleImgError" class="rounded-3 border shadow-sm" width="42" height="42" style="object-fit:cover;">
                    <div v-if="loading && !metadata" class="position-absolute top-50 start-50 translate-middle">
                        <span class="spinner-border spinner-border-sm text-primary opacity-50" style="width: 12px; height: 12px;"></span>
                    </div>
                </div>
                <div class="min-width-0 flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
                        <div class="fw-bold text-truncate small" style="color: var(--c-text-primary); font-size: 0.85rem;">{{ metadata?.title || file.name }}</div>
                        <span v-if="file.isDisabled" class="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle py-1 px-2 flex-shrink-0" style="font-size: 0.65rem;">{{ $t('common.disabled') }}</span>
                        <span v-else class="badge rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle py-1 px-2 flex-shrink-0" style="font-size: 0.65rem;">{{ $t('common.enabled') }}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-1 flex-wrap gap-2">
                        <span v-if="metadata?.version" class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill" style="font-size: 0.65rem; padding: 0.15rem 0.45rem;">{{ metadata.version }}</span>
                        <span v-else class="small text-muted font-monospace" style="font-size: 0.68rem;">-</span>
                        <span class="text-muted font-monospace small" style="font-size: 0.72rem;">{{ (file.size/1024/1024).toFixed(2) }} MB</span>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup(props) {
        const metadata = ref(props.file.metadata);
        const loading = ref(false);
        const cardEl = ref(null);
        const hasLoaded = ref(false);
        const iconError = ref(false);

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
            if (cardEl.value) observer.observe(cardEl.value);
        });

        return { metadata, loading, cardEl, iconUrl, handleImgError };
    }
};

export default {
    components: { LazyModRow, LazyModCard },
    template: `
    <div class="h-100 d-flex flex-column overflow-hidden"
         @dragenter.prevent="dragCounter++; isDragging = true" 
         @dragleave.prevent="dragCounter--; if (dragCounter <= 0) { isDragging = false; dragCounter = 0; }" 
         @dragover.prevent 
         @drop.prevent="dragCounter = 0; isDragging = false; handleDrop($event)">
        <div v-if="notFound" class="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
            <i class="fa-solid fa-folder-open fa-4x mb-3 opacity-25"></i>
            <h4>{{ $t('files.folder_not_found', { name: 'mods' }) }}</h4>
        </div>

        <template v-else>
            <div class="page-header d-flex justify-content-between align-items-center">
                <h3 class="m-0 fw-bold">{{ $t('mods.title') }}</h3>
            </div>
            

            <div class="card shadow-sm d-flex flex-column border-0 overflow-hidden" style="flex: 1; min-height: 0; border-radius: 16px;">
                <div class="card-header d-flex flex-wrap gap-2 p-2 align-items-center bg-body-tertiary border-0" style="z-index: 5;">
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
                    <div class="ms-auto flex-shrink-0 d-flex align-items-center gap-2">
                        <!-- 冲突模组按钮 -->
                        <button v-if="duplicateModGroups.length > 0" class="btn btn-sm btn-outline-warning rounded-pill px-2.5 px-md-3 shadow-sm fw-bold d-flex align-items-center gap-1.5" @click="openConflictModal" type="button">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>{{ $t('mods.conflict_btn') }}</span>
                            <span class="badge bg-warning text-dark rounded-pill" style="font-size: 0.65rem; padding: 0.25em 0.55em; line-height: 1;">{{ duplicateModGroups.length }}</span>
                        </button>
                        
                        <!-- 上传模组下拉 -->
                        <div class="dropdown">
                            <input type="file" ref="modInput" multiple class="d-none" @change="(e)=>uploadFiles(e)">
                            <input type="file" ref="modFolderInput" webkitdirectory multiple class="d-none" @change="(e)=>uploadFiles(e)">
                            <button class="btn btn-sm btn-primary rounded-pill px-2 px-md-3 shadow-sm fw-bold d-flex align-items-center gap-1 dropdown-toggle"
                                :class="{ show: uploadDropdownVisible }"
                                @click="toggleUploadDropdown($event)"
                                type="button">
                                <i class="fa-solid fa-cloud-arrow-up"></i>
                                <span>{{ $t('mods.upload_mod') }}</span>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end border-0 shadow-lg rounded-3 py-1 mt-1"
                                :class="{ show: uploadDropdownVisible }"
                                style="background: var(--c-surface); border: 1px solid var(--c-border) !important; right: 0; left: auto;">
                                <li>
                                    <a class="dropdown-item py-2 px-3 small fw-semibold cursor-pointer d-flex align-items-center gap-2" @click="$refs.modInput.click(); uploadDropdownVisible = false;" style="color: var(--c-text-primary);">
                                        <i class="fa-solid fa-file text-primary"></i>{{ $t('mods.upload_file') }}
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item py-2 px-3 small fw-semibold cursor-pointer d-flex align-items-center gap-2" @click="$refs.modFolderInput.click(); uploadDropdownVisible = false;" style="color: var(--c-text-primary);">
                                        <i class="fa-solid fa-folder text-warning"></i>{{ $t('mods.upload_folder') }}
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="card-body p-0 overflow-hidden d-flex flex-column position-relative" style="flex: 1; min-height: 0;">
                    <div v-if="isDragging" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="z-index: 10; background: rgba(var(--bs-primary-rgb), 0.15); backdrop-filter: blur(2px); border-radius: 12px; border: 3px dashed var(--bs-primary);">
                        <div class="text-center text-primary">
                            <i class="fa-solid fa-cloud-arrow-up fa-3x mb-2"></i>
                            <h5 class="fw-bold">拖拽模组文件到此处上传</h5>
                        </div>
                    </div>
                    <!-- Desktop Table View -->
                    <div class="table-responsive h-100 custom-scrollbar d-none d-md-block">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
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

                    <!-- Mobile Card View -->
                    <div class="d-md-none h-100 overflow-auto custom-scrollbar p-2.5 d-flex flex-column gap-2">
                        <div v-if="loadingList" class="text-center py-5">
                            <div class="spinner-border text-primary" role="status"></div>
                            <div class="mt-2 text-muted small">{{ $t('common.loading') }}...</div>
                        </div>
                        <template v-else>
                            <LazyModCard v-for="file in filteredFiles" :key="file.name" :file="file" 
                                v-model:selectedFiles="selectedFiles" @click-mod="showModDetails" />
                        </template>
                        <div v-if="!loadingList && filteredFiles.length === 0" class="text-center py-5 text-muted">
                            <i class="fa-solid fa-box-open fa-2x mb-2 opacity-25 d-block"></i>
                            {{ $t('mods.empty') }}
                        </div>
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
                    <div class="modal-content shadow-lg border-0 rounded-4 overflow-hidden h-100" style="max-height: 90vh; background: var(--c-surface);">
                        <div class="modal-header border-0 bg-primary text-white py-3 shadow-sm flex-shrink-0">
                            <h5 class="modal-title fw-bold d-flex align-items-center">
                                <template v-if="selectedMod.project">
                                    [{{ $t('mods.modrinth.types.' + selectedMod.project.project_type) }}] {{ selectedMod.project.title }}
                                </template>
                                <template v-else-if="selectedMod.file.metadata?.title">
                                    <span class="badge bg-white text-primary rounded-pill me-2 small fw-bold" style="font-size: 0.75rem;">{{ $t('mods.source_local') }}</span>
                                    {{ selectedMod.file.metadata.title }}
                                </template>
                                <template v-else>{{ selectedMod.file.name }}</template>
                            </h5>
                            <button type="button" class="btn-close btn-close-white" @click="selectedMod = null"></button>
                        </div>
                        
                        <div class="modal-body p-0 overflow-hidden d-flex flex-column flex-md-row" style="background: var(--c-surface);">
                            <!-- Mod Info & Introduction -->
                            <div class="col-12 overflow-auto p-3 p-md-4 custom-scrollbar" style="background: var(--c-surface);">
                                <div class="d-flex flex-column flex-sm-row gap-3 gap-md-4 mb-4" v-if="selectedMod.project">
                                    <img :src="selectedMod.project.icon_url || DEFAULT_ICON" class="rounded-4 border shadow-sm bg-white mx-auto mx-sm-0" width="100" height="100" style="object-fit: contain;">
                                    <div class="flex-grow-1 min-width-0 text-center text-sm-start">
                                        <h4 class="fw-bold mb-1">{{ selectedMod.project.title }}</h4>
                                        <div class="text-muted small mb-3 text-truncate-3">
                                            {{ bodyTranslations[selectedMod.project.id + '_desc'] || selectedMod.project.description }}
                                        </div>
                                        <div class="d-flex flex-wrap gap-2 justify-content-center justify-content-sm-start">
                                            <div class="badge rounded-pill px-2 py-1 small fw-bold border bg-primary-subtle text-primary border-primary-subtle">
                                                <i class="fa-solid fa-code-version me-1"></i>{{ selectedMod.file.metadata?.version || '-' }}
                                            </div>
                                            <div class="badge rounded-pill px-2 py-1 small fw-bold border"
                                                 :class="selectedMod.project.server_side === 'required' ? 'bg-success-subtle text-success border-success-subtle' : 'bg-secondary-subtle text-secondary border-secondary-subtle'">
                                                <i class="fa-solid fa-server me-1"></i><span class="d-none d-sm-inline">{{ $t('mods.modrinth.env_server') }}:</span> {{ $t('mods.modrinth.env_' + selectedMod.project.server_side) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="d-flex flex-column flex-sm-row gap-3 gap-md-4 mb-4" v-else-if="selectedMod.file.metadata">
                                    <img :src="selectedMod.file.metadata.icon_url || DEFAULT_ICON" class="rounded-4 border shadow-sm bg-white mx-auto mx-sm-0" width="100" height="100" style="object-fit: contain;">
                                    <div class="flex-grow-1 min-width-0 text-center text-sm-start">
                                        <div class="d-flex align-items-center justify-content-center justify-content-sm-start gap-2 mb-1 flex-wrap">
                                            <h4 class="fw-bold mb-0">{{ selectedMod.file.metadata.title || selectedMod.file.name.split('/').pop() }}</h4>
                                            <span class="badge rounded-pill bg-info-subtle text-info border border-info-subtle small fw-bold">{{ $t('mods.source_local') }}</span>
                                        </div>
                                        <div class="text-muted small mb-3">
                                            {{ selectedMod.file.metadata.description || $t('mods.no_desc') }}
                                        </div>
                                        <div class="d-flex flex-wrap gap-2 justify-content-center justify-content-sm-start">
                                            <div v-if="selectedMod.file.metadata.version" class="badge rounded-pill px-2 py-1 small fw-bold border bg-primary-subtle text-primary border-primary-subtle">
                                                <i class="fa-solid fa-code-version me-1"></i>{{ selectedMod.file.metadata.version }}
                                            </div>
                                            <div class="badge rounded-pill px-2 py-1 small fw-bold border bg-secondary-subtle text-secondary border-secondary-subtle">
                                                <i class="fa-solid fa-hard-drive me-1"></i>{{ (selectedMod.file.size/1024/1024).toFixed(2) }} MB
                                            </div>
                                            <div v-if="selectedMod.file.metadata.mod_id" class="badge rounded-pill px-2 py-1 small fw-bold border bg-body-secondary text-body-secondary">
                                                ID: {{ selectedMod.file.metadata.mod_id }}
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
                                <div v-else-if="selectedMod.file.metadata" class="border-top pt-4">
                                    <label class="form-label fw-bold text-uppercase text-muted mb-2 d-flex align-items-center">
                                        <i class="fa-solid fa-circle-info me-2 text-primary"></i>{{ $t('mods.file_info') }}
                                    </label>
                                    <div class="bg-body-tertiary p-3 rounded-4 small">
                                        <div class="row g-2">
                                            <div class="col-12 col-sm-6 text-truncate"><strong>{{ $t('mods.filename') }}:</strong> {{ selectedMod.file.name.split('/').pop() }}</div>
                                            <div class="col-12 col-sm-6" v-if="selectedMod.file.metadata.version"><strong>{{ $t('mods.version') }}:</strong> {{ selectedMod.file.metadata.version }}</div>
                                            <div class="col-12 col-sm-6" v-if="selectedMod.file.metadata.mod_id"><strong>Mod ID:</strong> {{ selectedMod.file.metadata.mod_id }}</div>
                                            <div class="col-12 col-sm-6"><strong>{{ $t('mods.filesize') }}:</strong> {{ (selectedMod.file.size/1024/1024).toFixed(2) }} MB</div>
                                            <div class="col-12 mt-2" v-if="selectedMod.file.metadata.description">
                                                <strong>{{ $t('mods.description') }}:</strong>
                                                <p class="mt-1 mb-0 text-muted">{{ selectedMod.file.metadata.description }}</p>
                                            </div>
                                        </div>
                                    </div>
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

        <!-- Upload Confirmation Modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="uploadConfirmModal.visible" class="modal-backdrop fade show" style="z-index: 2060; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);"></div>
            </Transition>

            <Transition name="scale">
                <div v-if="uploadConfirmModal.visible" class="modal show d-block" @click.self="uploadConfirmModal.visible = false" style="z-index: 2070;">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content shadow-lg border-0 rounded-4 overflow-hidden" style="background: var(--c-surface); color: var(--c-text-primary); border: 1px solid var(--c-border);">
                            <div class="modal-header border-0 bg-primary text-white py-3 shadow-sm">
                                <h5 class="modal-title fw-bold">
                                    <i class="fa-solid fa-triangle-exclamation me-2 text-warning"></i>{{ $t('mods.upload_confirm_title') }}
                                </h5>
                                <button type="button" class="btn-close btn-close-white" @click="uploadConfirmModal.visible = false"></button>
                            </div>
                            
                            <div class="modal-body p-4" style="background: var(--c-surface); color: var(--c-text-primary);">
                                <p class="small mb-3" style="color: var(--c-text-secondary);">
                                    {{ $t('mods.upload_confirm_desc') }}
                                </p>
                                
                                <div class="row g-3">
                                    <!-- Left column: Compliant files (.jar) -->
                                    <div class="col-12 col-md-6">
                                        <div class="card h-100 border rounded-3 overflow-hidden" style="background: var(--c-surface-elevated, bg-body-tertiary); border-color: var(--c-border) !important;">
                                            <div class="card-header bg-success bg-opacity-10 text-success fw-bold d-flex justify-content-between align-items-center py-2 px-3 border-0">
                                                <span><i class="fa-solid fa-circle-check me-2"></i>{{ $t('mods.compliant_files') }}</span>
                                                <span class="badge bg-success bg-opacity-20 text-success rounded-pill small">{{ compliantCheckedCount }} / {{ uploadConfirmModal.compliantFiles.length }}</span>
                                            </div>
                                            <div class="card-body p-2 overflow-auto custom-scrollbar" style="max-height: 250px;">
                                                <div v-if="uploadConfirmModal.compliantFiles.length === 0" class="text-center text-muted py-4 small">
                                                    {{ $t('mods.no_compliant') }}
                                                </div>
                                                <div v-else class="list-group list-group-flush">
                                                    <label v-for="(item, idx) in uploadConfirmModal.compliantFiles" :key="idx" class="list-group-item bg-transparent border-0 d-flex align-items-start gap-2 py-1.5 px-2 cursor-pointer">
                                                        <input class="form-check-input flex-shrink-0 mt-1" type="checkbox" v-model="item.selected">
                                                        <div class="min-width-0">
                                                            <div class="text-truncate fw-semibold small" style="color: var(--c-text-primary);" :title="item.relativePath">{{ item.file.name }}</div>
                                                            <div class="font-monospace" style="font-size: 0.65rem; color: var(--c-text-secondary);">{{ formatSize(item.file.size) }}</div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
 
                                    <!-- Right column: Non-compliant files (others) -->
                                    <div class="col-12 col-md-6">
                                        <div class="card h-100 border rounded-3 overflow-hidden" style="background: var(--c-surface-elevated, bg-body-tertiary); border-color: var(--c-border) !important;">
                                            <div class="card-header bg-warning bg-opacity-10 text-warning-emphasis fw-bold d-flex justify-content-between align-items-center py-2 px-3 border-0">
                                                <span><i class="fa-solid fa-triangle-exclamation me-2"></i>{{ $t('mods.non_compliant_files') }}</span>
                                                <span class="badge bg-warning bg-opacity-20 text-warning-emphasis rounded-pill small">{{ nonCompliantCheckedCount }} / {{ uploadConfirmModal.nonCompliantFiles.length }}</span>
                                            </div>
                                            <div class="card-body p-2 overflow-auto custom-scrollbar" style="max-height: 250px;">
                                                <div v-if="uploadConfirmModal.nonCompliantFiles.length === 0" class="text-center text-muted py-4 small">
                                                    {{ $t('mods.no_non_compliant') }}
                                                </div>
                                                <div v-else class="list-group list-group-flush">
                                                    <label v-for="(item, idx) in uploadConfirmModal.nonCompliantFiles" :key="idx" class="list-group-item bg-transparent border-0 d-flex align-items-start gap-2 py-1.5 px-2 cursor-pointer">
                                                        <input class="form-check-input flex-shrink-0 mt-1" type="checkbox" v-model="item.selected">
                                                        <div class="min-width-0 flex-grow-1">
                                                            <div class="text-truncate fw-semibold small" style="color: var(--c-text-primary);" :title="item.relativePath">{{ item.relativePath }}</div>
                                                            <div class="font-monospace d-flex justify-content-between align-items-center mt-0.5" style="font-size: 0.65rem; color: var(--c-text-secondary);">
                                                                <span>{{ formatSize(item.file.size) }}</span>
                                                                <span class="badge bg-secondary-subtle text-secondary-emphasis rounded-pill px-1" style="font-size: 0.6rem;">
                                                                    {{ item.isDir ? $t('mods.is_folder') : $t('mods.is_non_jar') }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="modal-footer border-0 px-4 py-3 d-flex justify-content-end gap-2" style="background: var(--c-surface-elevated, var(--c-surface)); border-top: 1px solid var(--c-border) !important;">
                                <button type="button" class="btn btn-secondary px-3 py-1.5 rounded-pill shadow-sm fw-bold small" @click="uploadConfirmModal.visible = false">{{ $t('common.cancel') }}</button>
                                <button type="button" class="btn btn-primary px-3 py-1.5 rounded-pill shadow-sm fw-bold small" @click="confirmUploadFromModal" :disabled="!hasAnySelectedFiles">{{ $t('common.confirm') }}{{ $t('common.upload') }}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- Conflict Resolution Modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="conflictModal.visible" class="modal-backdrop fade show" style="z-index: 2060; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);"></div>
            </Transition>

            <Transition name="scale">
                <div v-if="conflictModal.visible" class="modal show d-block" @click.self="conflictModal.visible = false" style="z-index: 2070;">
                    <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
                        <div class="modal-content shadow-lg border-0 rounded-4 overflow-hidden conflict-modal-content" style="background: var(--c-surface); color: var(--c-text-primary); border: 1px solid var(--c-border); height: 85vh; max-height: 720px;">
                            <div class="modal-header border-0 bg-warning text-dark py-2.5 py-md-3 px-3 px-md-4 shadow-sm d-flex justify-content-between align-items-center">
                                <h5 class="modal-title fw-bold m-0 d-flex align-items-center gap-2 fs-6 fs-md-5">
                                    <i class="fa-solid fa-triangle-exclamation"></i>{{ $t('mods.conflict_title') }}
                                </h5>
                                <button type="button" class="btn-close" @click="conflictModal.visible = false"></button>
                            </div>
                            
                            <!-- 移动端若有多组冲突模组，显示横向滚动选项卡 -->
                            <div v-if="duplicateModGroups.length > 1" class="d-md-none px-3 py-2 border-bottom overflow-x-auto d-flex gap-2 flex-nowrap bg-body-tertiary custom-scrollbar flex-shrink-0" style="border-color: var(--c-border) !important; -webkit-overflow-scrolling: touch;">
                                <button v-for="(group, idx) in duplicateModGroups" :key="idx"
                                    class="btn btn-sm rounded-pill text-nowrap py-1 px-3 d-flex align-items-center gap-1.5 flex-shrink-0"
                                    :class="conflictModal.selectedGroupIdx === idx ? 'btn-primary' : 'btn-outline-secondary'"
                                    @click="conflictModal.selectedGroupIdx = idx">
                                    <span class="small fw-semibold">{{ group.name }}</span>
                                    <span class="badge rounded-pill" :class="conflictModal.selectedGroupIdx === idx ? 'bg-white text-primary' : 'bg-warning text-dark'" style="font-size: 0.65rem;">
                                        {{ group.files.length }}
                                    </span>
                                </button>
                            </div>

                            <!-- 二栏布局主体 (PC左右二栏，移动端主详情展示) -->
                            <div class="modal-body p-0 d-flex flex-column flex-md-row overflow-hidden" style="flex: 1; min-height: 0;">
                                <!-- 左侧栏：冲突模组列表 (PC保留侧边栏) -->
                                <div class="d-none d-md-flex border-end flex-column custom-scrollbar overflow-auto conflict-sidebar flex-shrink-0" style="background: var(--c-surface-elevated, rgba(0,0,0,0.02)); border-color: var(--c-border) !important;">
                                    <div class="p-2.5 p-md-3 border-bottom text-muted small fw-bold bg-body-tertiary" style="border-color: var(--c-border) !important;">
                                        {{ $t('mods.conflict_list', { count: duplicateModGroups.length }) }}
                                    </div>
                                    <div class="list-group list-group-flush flex-grow-1">
                                        <button v-for="(group, idx) in duplicateModGroups" :key="idx"
                                            class="list-group-item list-group-item-action border-0 py-2.5 px-3 d-flex flex-column align-items-start gap-1 cursor-pointer"
                                            :class="{ active: conflictModal.selectedGroupIdx === idx }"
                                            @click="conflictModal.selectedGroupIdx = idx"
                                            style="background: transparent; color: var(--c-text-primary);">
                                            <div class="w-100 d-flex justify-content-between align-items-start gap-2">
                                                <span class="fw-bold text-truncate" :class="{ 'text-primary': conflictModal.selectedGroupIdx === idx }" style="font-size: 0.85rem;">{{ group.name }}</span>
                                                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning border-opacity-25 rounded-pill px-2 py-0.5" style="font-size: 0.65rem; flex-shrink: 0;">
                                                    {{ $t('mods.versions_count', { count: group.files.length }) }}
                                                </span>
                                            </div>
                                            <span class="text-muted text-truncate w-100" style="font-size: 0.7rem; text-align: left;">
                                                {{ $t('mods.earliest_time', { time: getEarliestTime(group.files) }) }}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- 右侧栏：冲突模组详情 -->
                                <div class="flex-grow-1 p-3 p-md-4 d-flex flex-column overflow-auto custom-scrollbar" style="min-width: 0; background: var(--c-surface);">
                                    <div v-if="duplicateModGroups[conflictModal.selectedGroupIdx]" class="d-flex flex-column h-100">
                                        <div class="mb-3 mb-md-4 pb-2 pb-md-3 border-bottom d-flex align-items-center justify-content-between" style="border-color: var(--c-border) !important;">
                                            <div>
                                                <h5 class="fw-bold mb-1 fs-6 fs-md-5" style="color: var(--c-text-primary);">{{ duplicateModGroups[conflictModal.selectedGroupIdx].name }}</h5>
                                                <div class="small text-muted" style="font-size: 0.75rem;">{{ $t('mods.conflict_desc') }}</div>
                                            </div>
                                        </div>
                                        
                                        <!-- 版本卡片列表 -->
                                        <div class="d-flex flex-column gap-2.5 gap-md-3 overflow-auto custom-scrollbar flex-grow-1 pr-1 pb-2">
                                            <div v-for="(mod, mIdx) in duplicateModGroups[conflictModal.selectedGroupIdx].files" :key="mIdx"
                                                class="card border rounded-3 p-2.5 p-sm-3 shadow-sm d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center gap-2.5 gap-sm-3"
                                                style="background: var(--c-surface-elevated, rgba(0,0,0,0.01)); border-color: var(--c-border) !important;">
                                                <div class="min-width-0 flex-grow-1">
                                                    <div class="d-flex align-items-center gap-2 mb-1">
                                                        <i class="fa-solid fa-cube text-success fa-lg flex-shrink-0"></i>
                                                        <span class="fw-bold text-truncate small" style="color: var(--c-text-primary);" :title="mod.name">{{ mod.name }}</span>
                                                        <span v-if="mod.isDisabled" class="badge bg-secondary-subtle text-secondary-emphasis rounded-pill flex-shrink-0" style="font-size: 0.65rem;">{{ $t('common.disabled') }}</span>
                                                    </div>
                                                    <div class="font-monospace text-muted mt-1 d-flex flex-wrap gap-x-3 gap-y-1" style="font-size: 0.72rem;">
                                                        <span>{{ $t('mods.file_size', { size: formatSize(mod.size) }) }}</span>
                                                        <span>{{ $t('mods.mtime', { time: formatModTime(mod.mtime) }) }}</span>
                                                        <span v-if="mod.metadata?.version" class="text-primary fw-bold">{{ $t('mods.metadata_version', { version: mod.metadata.version }) }}</span>
                                                    </div>
                                                </div>
                                                <button class="btn btn-sm btn-outline-success px-3.5 py-1.5 rounded-pill shadow-sm fw-bold small flex-shrink-0 w-100 w-sm-auto"
                                                    @click="resolveConflictKeep(duplicateModGroups[conflictModal.selectedGroupIdx], mod)">
                                                    <i class="fa-solid fa-check me-1"></i>{{ $t('mods.keep_this_version') }}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-else class="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                                        <i class="fa-solid fa-circle-check fa-3x mb-2 text-success"></i>
                                        <span>{{ $t('mods.no_conflicts') }}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 对话框底部 -->
                            <div class="modal-footer border-0 px-3 px-md-4 py-2.5 py-md-3 d-flex flex-row justify-content-between align-items-center flex-nowrap" style="background: var(--c-surface-elevated, var(--c-surface)); border-top: 1px solid var(--c-border) !important;">
                                <div class="form-check form-switch m-0 d-flex align-items-center gap-2" style="padding-left: 2.8em;">
                                    <input class="form-check-input cursor-pointer m-0" type="checkbox" id="skipConfirmCheck" v-model="conflictModal.skipConfirm" style="cursor: pointer;">
                                    <label class="form-check-label text-muted small cursor-pointer fw-semibold text-truncate" for="skipConfirmCheck" style="font-size: 0.75rem;">
                                        {{ $t('mods.skip_confirm') }}
                                    </label>
                                </div>
                                <button type="button" class="btn btn-secondary px-3.5 py-1 rounded-pill shadow-sm fw-bold small flex-shrink-0" @click="conflictModal.visible = false">{{ $t('common.close') }}</button>
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
        const modFolderInput = ref(null);
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;
        const loadingList = ref(false);

        // Drag & Drop State
        const isDragging = ref(false);
        const dragCounter = ref(0);

        // Upload Confirm State
        const uploadConfirmModal = reactive({
            visible: false,
            compliantFiles: [],
            nonCompliantFiles: [],
            targetPath: 'mods'
        });
        // Conflict Resolution Modal State
        const conflictModal = reactive({
            visible: false,
            selectedGroupIdx: 0,
            skipConfirm: localStorage.getItem('mc_skip_mod_conflict_confirm') === 'true'
        });

        watch(() => conflictModal.skipConfirm, (val) => {
            localStorage.setItem('mc_skip_mod_conflict_confirm', val ? 'true' : 'false');
        });

        const openConflictModal = () => {
            conflictModal.selectedGroupIdx = 0;
            conflictModal.visible = true;
        };

        const compliantCheckedCount = computed(() => {
            return uploadConfirmModal.compliantFiles.filter(f => f.selected).length;
        });

        const nonCompliantCheckedCount = computed(() => {
            return uploadConfirmModal.nonCompliantFiles.filter(f => f.selected).length;
        });

        const hasAnySelectedFiles = computed(() => {
            return uploadConfirmModal.compliantFiles.some(f => f.selected) || 
                   uploadConfirmModal.nonCompliantFiles.some(f => f.selected);
        });

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
            if (!file.metadata) {
                loadingDetails.value = true;
                try {
                    const metaRes = await api.get(`/api/mods/local/metadata?file=${encodeURIComponent(file.name)}`);
                    if (metaRes.data?.metadata) {
                        file.metadata = metaRes.data.metadata;
                        file.hash = metaRes.data.hash;
                    }
                } catch (err) {
                    console.error('Failed to get local metadata for details', err);
                } finally {
                    loadingDetails.value = false;
                }
            }

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
            processFilesForUpload(files);
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

        const processFilesForUpload = (files) => {
            const compliant = [];
            const nonCompliant = [];

            for (const item of files) {
                const isJar = item.file.name.toLowerCase().endsWith('.jar');
                const isInsideFolder = item.relativePath.includes('/');
                
                if (isJar && !isInsideFolder) {
                    compliant.push({ file: item.file, relativePath: item.relativePath, selected: true });
                } else {
                    nonCompliant.push({
                        file: item.file,
                        relativePath: item.relativePath,
                        selected: false,
                        isDir: isInsideFolder
                    });
                }
            }

            if (nonCompliant.length > 0) {
                uploadConfirmModal.compliantFiles = compliant;
                uploadConfirmModal.nonCompliantFiles = nonCompliant;
                uploadConfirmModal.visible = true;
            } else {
                executeUpload(compliant);
            }
        };

        const uploadFiles = async (e) => {
            const files = e.target.files;
            if (!files.length) return;
            const fileListArray = [];
            for (let i = 0; i < files.length; i++) {
                fileListArray.push({ file: files[i], relativePath: files[i].webkitRelativePath || files[i].name });
            }
            processFilesForUpload(fileListArray);
            e.target.value = '';
        };

        const confirmUploadFromModal = () => {
            uploadConfirmModal.visible = false;
            const selectedCompliant = uploadConfirmModal.compliantFiles.filter(f => f.selected);
            const selectedNonCompliant = uploadConfirmModal.nonCompliantFiles.filter(f => f.selected);
            const allToUpload = [...selectedCompliant, ...selectedNonCompliant];
            executeUpload(allToUpload);
        };

        const executeUpload = async (filesToUpload) => {
            if (!filesToUpload.length) return;
            const totalSize = filesToUpload.reduce((s, f) => s + f.file.size, 0);
            let uploadedSize = 0;

            const controller = new AbortController();
            store.task.visible = true;
            store.task.title = '上传模组';
            store.task.percent = 0;
            store.task.processedSize = 0;
            store.task.totalSize = totalSize;
            store.task.fileName = '';
            store.task.speed = 0;
            store.task.canCancel = true;
            store.task.onCancel = () => {
                controller.abort();
            };

            let lastTime = Date.now();
            let lastLoaded = 0;

            const updateProgress = (loadedBytes, currentFileName) => {
                const currentUploaded = uploadedSize + loadedBytes;
                store.task.percent = Math.min(100, Math.round((currentUploaded * 100) / totalSize));
                store.task.processedSize = currentUploaded;
                store.task.fileName = currentFileName;

                const now = Date.now();
                const timeDiff = (now - lastTime) / 1000;
                if (timeDiff >= 0.5) {
                    const loadedDiff = currentUploaded - lastLoaded;
                    store.task.speed = Math.round(loadedDiff / timeDiff);
                    lastTime = now;
                    lastLoaded = currentUploaded;
                }
            };

            try {
                const largeFiles = filesToUpload.filter(f => isLargeFile(f.file));
                const smallFiles = filesToUpload.filter(f => !isLargeFile(f.file));

                if (smallFiles.length) {
                    for (const item of smallFiles) {
                        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                        
                        const fd = new FormData();
                        fd.append('files', item.file, item.relativePath);
                        fd.append('path', 'mods');
                        fd.append('fileNames', JSON.stringify([item.relativePath]));

                        await api.post('/api/files/upload', fd, {
                            signal: controller.signal,
                            onUploadProgress: (p) => {
                                if (p.total) {
                                    updateProgress(p.loaded, item.relativePath);
                                }
                            }
                        });
                        uploadedSize += item.file.size;
                        lastTime = Date.now();
                        lastLoaded = uploadedSize;
                        store.task.processedSize = uploadedSize;
                    }
                }

                for (const item of largeFiles) {
                    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                    await uploadFileWithChunk(item.file, {
                        initUrl: '/api/files/chunk/init',
                        completeUrl: '/api/files/chunk/complete',
                        cancelUrl: '/api/files/chunk/cancel',
                        fileName: item.relativePath,
                        extraInitData: { targetPath: 'mods' },
                        signal: controller.signal,
                        onProgress: (bytesDone, bytesTotal, chunkNum, totalChunks) => {
                            updateProgress(bytesDone, item.relativePath);
                        }
                    });
                    uploadedSize += item.file.size;
                    lastTime = Date.now();
                    lastLoaded = uploadedSize;
                    store.task.processedSize = uploadedSize;
                }

                showToast($t('common.success'));
                loadFiles();
            } catch (err) {
                if (err.name === 'AbortError' || axios.isCancel(err) || err.message === 'canceled') {
                    showToast('已取消上传', 'warning');
                } else {
                    showToast($t('common.error'), 'danger');
                }
            } finally {
                setTimeout(() => { store.task.visible = false; }, 500);
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

        const getModSlug = (filename) => {
            let name = filename.replace(/\.jar(\.disabled)?$/i, '');
            name = name.toLowerCase();
            const match = name.match(/[-_](mc)?\d/);
            if (match) {
                return name.substring(0, match.index);
            }
            return name.replace(/[-_]?\d.*$/, '').trim();
        };

        const duplicateModGroups = computed(() => {
            const groups = {};
            for (const file of fileList.value) {
                let key = '';
                let displayName = '';
                if (file.metadata && file.metadata.project_id) {
                    key = `project:${file.metadata.project_id}`;
                    displayName = file.metadata.title || file.name;
                } else {
                    const slug = getModSlug(file.name);
                    key = `slug:${slug}`;
                    displayName = slug;
                }
                
                if (!groups[key]) {
                    groups[key] = {
                        name: displayName,
                        files: []
                    };
                }
                groups[key].files.push(file);
            }
            return Object.values(groups).filter(g => g.files.length > 1);
        });

        watch(duplicateModGroups, (newVal) => {
            if (conflictModal.selectedGroupIdx >= newVal.length) {
                conflictModal.selectedGroupIdx = Math.max(0, newVal.length - 1);
            }
        }, { deep: true });

        const getEarliestTime = (files) => {
            if (!files || !files.length) return '';
            const times = files.map(f => {
                const t = new Date(f.mtime).getTime();
                return isNaN(t) ? 0 : t;
            }).filter(t => t > 0);
            return times.length ? new Date(Math.min(...times)).toLocaleDateString() : '';
        };

        const formatModTime = (time) => {
            if (!time) return '';
            const d = new Date(time);
            return isNaN(d.getTime()) ? '' : d.toLocaleString();
        };

        const resolveConflictKeep = async (group, keepMod) => {
            const toDelete = group.files.filter(f => f.name !== keepMod.name).map(f => f.name);
            if (!toDelete.length) return;

            const executeDelete = async () => {
                await operateFiles('delete', toDelete);
                if (duplicateModGroups.value.length === 0) {
                    conflictModal.visible = false;
                }
            };

            if (conflictModal.skipConfirm) {
                await executeDelete();
            } else {
                openModal({
                    title: $t('mods.confirm_keep_title'),
                    message: $t('mods.confirm_keep_msg', { name: keepMod.name, count: toDelete.length }),
                    callback: executeDelete
                });
            }
        };

        const uploadDropdownVisible = ref(false);
        const toggleUploadDropdown = (event) => {
            event.stopPropagation();
            uploadDropdownVisible.value = !uploadDropdownVisible.value;
        };
        const closeUploadDropdown = () => {
            uploadDropdownVisible.value = false;
        };

        onMounted(() => {
            loadFiles();
            document.addEventListener('click', closeUploadDropdown);
        });

        onUnmounted(() => {
            document.removeEventListener('click', closeUploadDropdown);
        });

        return {
            fileList, filteredFiles, selectedFiles, selectAll, searchQuery, modInput, modFolderInput,
            uploadFiles, operateFiles, askDelete, notFound, loadingList, store,
            selectedMod, loadingDetails, translatingBody, bodyTranslations,
            showModDetails, translateBody, renderMarkdown,
            isDragging, dragCounter, uploadConfirmModal, compliantCheckedCount,
            nonCompliantCheckedCount, hasAnySelectedFiles, handleDrop, confirmUploadFromModal,
            formatSize, duplicateModGroups, resolveConflictKeep, getEarliestTime, formatModTime,
            uploadDropdownVisible, toggleUploadDropdown,
            conflictModal, openConflictModal,
            DEFAULT_ICON
        };
    }
};