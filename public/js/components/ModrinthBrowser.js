import { ref, reactive, computed, watch, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, t } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column">
        <div class="d-flex justify-content-between align-items-center mb-3 px-1 animate-in flex-wrap gap-2">
            <h3 class="m-0 d-flex align-items-center">
                <i class="fa-solid fa-cloud-arrow-down me-2 me-md-3 text-primary"></i>
                <span class="d-none d-sm-inline">{{ $t('sidebar.modrinth') }}</span>
                <span class="d-inline d-sm-none">Modrinth</span>
            </h3>
            
            <div class="d-flex gap-2 align-items-center">
                <button class="btn btn-sm btn-outline-primary d-md-none fw-bold" @click="showMobileFilters = true">
                    <i class="fa-solid fa-filter"></i><span class="d-none d-sm-inline ms-1">{{ $t('common.filter') }}</span>
                </button>
                <select class="form-select form-select-sm border-0 bg-body shadow-sm fw-bold" style="width: 120px; md-width: 140px; color: inherit;" v-model="sortBy" @change="searchModrinth(true)">
                    <option v-for="(v, k) in SORT_OPTIONS" :key="k" :value="k">{{ $t('mods.modrinth.sorting.'+k) }}</option>
                </select>
            </div>
        </div>

        <div class="flex-grow-1 overflow-hidden d-flex bg-body-tertiary rounded-4 border shadow-sm animate-in delay-100">
            <!-- Sidebar Filters -->
            <div class="sidebar-filters overflow-auto bg-body border-end px-3 py-4 d-none d-md-block" style="width: 260px; min-width: 260px;">
                <div class="mb-4">
                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                        <i class="fa-solid fa-search me-2"></i>{{ $t('common.search') }}
                    </label>
                    <div class="input-group input-group-sm modrinth-search-group">
                        <input type="text" class="form-control border-secondary-subtle" v-model="modrinthSearch" @keyup.enter="searchModrinth(true)" :placeholder="$t('mods.search_modrinth')">
                        <button class="btn btn-outline-secondary" @click="searchModrinth(true)"><i class="fa-solid fa-search"></i></button>
                    </div>
                </div>

                <!-- Loaders Filter -->
                <div class="mb-4">
                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                        <i class="fa-solid fa-microchip me-2"></i>{{ $t('mods.loader') }}
                    </label>
                    <div class="p-2 border rounded-3 bg-body-tertiary">
                        <div v-for="l in LOADERS" :key="l" class="form-check small mb-2">
                            <input class="form-check-input" type="checkbox" :value="l" v-model="filters.loaders" :id="'l-'+l">
                            <label class="form-check-label text-capitalize fw-medium" :for="'l-'+l">{{ l }}</label>
                        </div>
                    </div>
                </div>

                <!-- Versions Filter -->
                <div class="mb-4">
                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                        <i class="fa-solid fa-code-branch me-2"></i>{{ $t('dashboard.target') }}
                    </label>
                    <div class="filter-list custom-scrollbar overflow-auto pe-2 border rounded-3 p-2 bg-body-tertiary" style="max-height: 180px;">
                        <div class="form-check small mb-2" v-for="v in ALL_VERSIONS" :key="v">
                            <input class="form-check-input" type="checkbox" :value="v" v-model="filters.versions" :id="'v-'+v">
                            <label class="form-check-label fw-medium" :for="'v-'+v">{{ v }}</label>
                        </div>
                    </div>
                </div>

                <!-- Side Filter -->
                <div class="mb-4">
                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                        <i class="fa-solid fa-server me-2"></i>{{ $t('mods.modrinth.environment') }}
                    </label>
                    <div class="form-check small mb-2">
                        <input class="form-check-input" type="checkbox" value="server_side:required" v-model="filters.environment" id="env-server">
                        <label class="form-check-label fw-medium" for="env-server">{{ $t('mods.modrinth.env.server') }}</label>
                    </div>
                    <div class="form-check small mb-2">
                        <input class="form-check-input" type="checkbox" value="client_side:required" v-model="filters.environment" id="env-client">
                        <label class="form-check-label fw-medium" for="env-client">{{ $t('mods.modrinth.env.client') }}</label>
                    </div>
                </div>

                <!-- Functional Categories -->
                <div class="mb-3">
                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                        <i class="fa-solid fa-tags me-2"></i>{{ $t('mods.categories_title') }}
                    </label>
                    <div class="filter-list border rounded-3 p-2 bg-body-tertiary overflow-auto custom-scrollbar" style="max-height: 300px;">
                        <div class="form-check small mb-2" v-for="cat in CATEGORIES" :key="cat.id">
                            <input class="form-check-input" type="checkbox" :value="cat.id" v-model="filters.categories" :id="'cat-'+cat.id">
                            <label class="form-check-label d-flex align-items-center fw-medium" :for="'cat-'+cat.id">
                                <i :class="cat.icon" class="me-2 opacity-75 text-primary" style="width: 16px;"></i>
                                {{ $t('mods.categories.'+cat.id).startsWith('mods.categories.') ? cat.id : $t('mods.categories.'+cat.id) }}
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Results -->
            <div class="flex-grow-1 overflow-auto p-4 position-relative bg-body shadow-inner custom-scrollbar">
                <div v-if="loadingModrinth && modrinthResults.length === 0" class="position-absolute top-50 start-50 translate-middle text-center">
                    <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
                    <div class="text-muted fw-medium fs-5">{{ $t('mods.modrinth.searching') }}</div>
                </div>

                <div v-else-if="!loadingModrinth && modrinthResults.length === 0" class="text-center py-5 text-muted h-100 d-flex flex-column justify-content-center">
                    <i class="fa-solid fa-cloud-moon fa-4x mb-4 opacity-10"></i>
                    <h5 class="fw-bold opacity-50">{{ $t('mods.modrinth.no_results') }}</h5>
                    <p class="small opacity-50">{{ $t('mods.modrinth.try_different') }}</p>
                    <button class="btn btn-sm btn-outline-primary mx-auto mt-3 rounded-pill" @click="clearFilters">{{ $t('mods.modrinth.reset_filters') }}</button>
                </div>

                <div v-else class="row g-3 g-md-4">
                    <div v-for="mod in modrinthResults" :key="mod.project_id" class="col-12 col-xl-6">
                        <div class="card border-0 shadow-sm modrinth-result-card h-100 bg-body-tertiary hover-grow transition-all cursor-pointer" @click="fetchModDetails(mod.project_id)">
                            <div class="card-body d-flex flex-column flex-md-row gap-3 gap-md-4 p-3 p-md-4">
                                <div class="flex-shrink-0 d-flex justify-content-center">
                                    <div class="position-relative">
                                        <img :src="mod.icon_url || 'https://modrinth.com/img/brand/icon_dark.svg'" class="rounded-4 border shadow-sm bg-white" width="64" height="64" style="object-fit:cover; width: 64px; height: 64px;">
                                    </div>
                                </div>
                                <div class="flex-grow-1 min-width-0 d-flex flex-column text-center text-md-start">
                                    <div class="d-flex flex-column flex-md-row justify-content-between align-items-center align-items-md-start mb-1">
                                        <h6 class="mb-0 fw-bold text-truncate text-primary w-100">{{ mod.title }}</h6>
                                        <div class="text-md-end text-muted small mt-1 mt-md-0 flex-shrink-0 fw-bold">
                                            <i class="fa-solid fa-download me-1 opacity-50"></i>{{ formatDownloads(mod.downloads) }}
                                        </div>
                                    </div>
                                    <div class="small text-muted mb-2 opacity-75 fw-medium" style="font-size: 0.75rem;">
                                        {{ $t('mods.modrinth.last_updated') }} {{ formatDate(mod.date_modified) }}
                                    </div>
                                    <p class="text-muted small mb-3 text-truncate-2 lh-sm flex-grow-1" style="font-size: 0.82rem;">
                                        {{ translations[mod.project_id] || mod.description }}
                                    </p>
                                    <div class="d-flex flex-wrap gap-1 align-items-center justify-content-center justify-content-md-start">
                                        <span v-for="cat in mod.categories.slice(0, 3)" :key="cat" class="badge bg-primary-subtle text-primary small fw-semibold rounded-pill px-2 py-1">
                                            {{ $t('mods.categories.'+cat).startsWith('mods.categories.') ? cat : $t('mods.categories.'+cat) }}
                                        </span>
                                        <button class="btn btn-link btn-xs p-0 ms-md-auto text-decoration-none small opacity-75 fw-bold d-flex align-items-center" @click.stop="translateMod(mod)" :disabled="translatingModIds.has(mod.project_id)">
                                            <span v-if="translatingModIds.has(mod.project_id)" class="spinner-border spinner-border-sm me-1" style="width: 10px; height: 10px;"></span>
                                            <i v-else class="fa-solid fa-language me-1"></i>
                                            {{ translatingModIds.has(mod.project_id) ? $t('mods.translating') : (translations[mod.project_id] ? $t('common.close') : $t('mods.translate')) }}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-12 text-center py-5">
                        <button class="btn btn-primary px-5 rounded-pill shadow-sm fw-bold" @click="loadMore" v-if="hasMore" :disabled="loadingModrinth">
                            <span v-if="loadingModrinth" class="spinner-border spinner-border-sm me-2"></span>
                            {{ loadingModrinth ? $t('common.loading') : $t('common.load_more') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Mobile Filter Modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showMobileFilters" class="modal-backdrop fade show" style="z-index: 2070; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);"></div>
            </Transition>
            
            <Transition name="scale">
                <div class="modal show d-block" v-if="showMobileFilters" tabindex="-1" @click.self="showMobileFilters = false" style="z-index: 2080;">
                    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content border-0 shadow-lg rounded-4">
                            <div class="modal-header border-0 pb-0 pt-4 px-4">
                                <h5 class="modal-title fw-bold"><i class="fa-solid fa-filter me-2 text-primary"></i>{{ $t('common.filter') }}</h5>
                                <button type="button" class="btn-close" @click="showMobileFilters = false"></button>
                            </div>
                            <div class="modal-body p-4">
                                <!-- Duplicate filter logic here or refactor into component. 
                                     For simplicity in this single-file component, we duplicate the inner filters. -->
                                <!-- Search -->
                                <div class="mb-4">
                                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                                        <i class="fa-solid fa-search me-2"></i>{{ $t('common.search') }}
                                    </label>
                                    <div class="input-group input-group-sm modrinth-search-group">
                                        <input type="text" class="form-control" v-model="modrinthSearch" @keyup.enter="searchModrinth(true); showMobileFilters = false" :placeholder="$t('mods.search_modrinth')">
                                        <button class="btn btn-primary" @click="searchModrinth(true); showMobileFilters = false"><i class="fa-solid fa-search"></i></button>
                                    </div>
                                </div>
                                <!-- Loaders -->
                                <div class="mb-4">
                                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                                        <i class="fa-solid fa-microchip me-2"></i>{{ $t('mods.loader') }}
                                    </label>
                                    <div class="d-flex flex-wrap gap-2">
                                        <div v-for="l in LOADERS" :key="l" class="form-check small mb-0 p-0">
                                            <input type="checkbox" class="btn-check" :value="l" v-model="filters.loaders" :id="'ml-'+l" autocomplete="off">
                                            <label class="btn btn-sm btn-outline-primary border rounded-pill px-3 py-1 text-capitalize" :for="'ml-'+l">{{ l }}</label>
                                        </div>
                                    </div>
                                </div>
                                <!-- Versions -->
                                <div class="mb-4">
                                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                                        <i class="fa-solid fa-code-branch me-2"></i>{{ $t('dashboard.target') }}
                                    </label>
                                    <div class="d-flex flex-wrap gap-2 overflow-auto no-scrollbar pb-2" style="max-height: 150px;">
                                        <div v-for="v in ALL_VERSIONS.slice(0, 15)" :key="v" class="form-check small p-0">
                                            <input type="checkbox" class="btn-check" :value="v" v-model="filters.versions" :id="'mv-'+v" autocomplete="off">
                                            <label class="btn btn-sm btn-outline-secondary border rounded-pill px-3 py-1" :for="'mv-'+v">{{ v }}</label>
                                        </div>
                                    </div>
                                </div>
                                <!-- Categories -->
                                <div class="mb-0">
                                    <label class="fw-bold small text-uppercase text-muted mb-3 d-flex align-items-center">
                                        <i class="fa-solid fa-tags me-2"></i>{{ $t('mods.categories_title') }}
                                    </label>
                                    <div class="d-flex flex-wrap gap-2 overflow-auto no-scrollbar" style="max-height: 200px;">
                                        <div v-for="cat in CATEGORIES" :key="cat.id" class="form-check small p-0">
                                            <input type="checkbox" class="btn-check" :value="cat.id" v-model="filters.categories" :id="'mc-'+cat.id" autocomplete="off">
                                            <label class="btn btn-sm btn-outline-info border rounded-pill px-3 py-1" :for="'mc-'+cat.id">
                                                {{ $t('mods.categories.'+cat.id).startsWith('mods.categories.') ? cat.id : $t('mods.categories.'+cat.id) }}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer border-0 p-4 pt-0">
                                <button class="btn btn-light w-100 fw-bold border" @click="clearFilters(); showMobileFilters = false">{{ $t('mods.modrinth.reset_filters') }}</button>
                                <button class="btn btn-primary w-100 fw-bold shadow-sm" @click="showMobileFilters = false">{{ $t('common.confirm') }}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- Mod Details Modal & Loading -->
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
                                [{{ $t('mods.modrinth.types.' + selectedMod.project.project_type) }}] {{ selectedMod.project.title }}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" @click="selectedMod = null"></button>
                        </div>
                        
                        <!-- Sticky Filter Header -->
                        <div class="bg-body-tertiary border-bottom px-3 px-md-4 py-2 d-flex gap-2 gap-md-3 align-items-center flex-shrink-0 overflow-auto no-scrollbar">
                            <div class="d-flex align-items-center gap-2">
                                <label class="small fw-bold text-muted text-uppercase mb-0 text-nowrap"><i class="fa-solid fa-gamepad me-1"></i>{{ $t('mods.game_version') }}</label>
                                <select class="form-select form-select-sm border-2 fw-bold" style="width: 100px; md-width: 120px;" v-model="filterGameVersion">
                                    <option v-for="v in availableGameVersions" :key="v" :value="v">{{ v }}</option>
                                </select>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <label class="small fw-bold text-muted text-uppercase mb-0 text-nowrap"><i class="fa-solid fa-microchip me-1"></i>{{ $t('mods.loader') }}</label>
                                <select class="form-select form-select-sm border-2 fw-bold" style="width: 100px; md-width: 120px;" v-model="filterLoader">
                                    <option v-for="l in availableLoaders" :key="l" :value="l">{{ l }}</option>
                                </select>
                            </div>
                            <div class="ms-auto small text-muted fw-bold d-none d-sm-block text-nowrap">
                                {{ $t('mods.modrinth.found_versions', { count: filteredVersions.length }) }}
                            </div>
                        </div>

                        <div class="modal-body p-0 overflow-hidden d-flex flex-column flex-md-row">
                            <!-- Left: Mod Info & Introduction -->
                            <div class="col-12 col-md-7 border-end overflow-auto p-3 p-md-4 custom-scrollbar bg-body">
                                <div class="d-flex gap-3 gap-md-4 mb-3 mb-md-4">
                                    <img :src="selectedMod.project.icon_url" class="rounded-4 border shadow-sm bg-white" width="64" height="64" style="object-fit: contain; width: 64px; height: 64px; md-width: 100px; md-height: 100px;">
                                    <div class="flex-grow-1 min-width-0">
                                        <h5 class="fw-bold mb-1 text-truncate">{{ selectedMod.project.title }}</h5>
                                        <div class="text-muted small mb-2 mb-md-3 text-truncate-2">
                                            {{ bodyTranslations[selectedMod.project.id + '_desc'] || selectedMod.project.description }}
                                        </div>
                                        <div class="d-flex flex-wrap gap-1">
                                            <div class="badge rounded-pill px-2 py-1 small fw-bold border" style="font-size: 0.7rem;"
                                                 :class="selectedMod.project.server_side === 'required' ? 'bg-success-subtle text-success border-success-subtle' : 'bg-secondary-subtle text-secondary border-secondary-subtle'">
                                                {{ $t('mods.modrinth.env_server') }}: {{ $t('mods.modrinth.env_' + selectedMod.project.server_side) }}
                                            </div>
                                            <div class="badge rounded-pill px-2 py-1 small fw-bold border" style="font-size: 0.7rem;"
                                                 :class="selectedMod.project.client_side === 'required' ? 'bg-info-subtle text-info border-info-subtle' : 'bg-secondary-subtle text-secondary border-secondary-subtle'">
                                                {{ $t('mods.modrinth.env_client') }}: {{ $t('mods.modrinth.env_' + selectedMod.project.client_side) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="border-top pt-4">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <label class="form-label fw-bold text-uppercase text-muted mb-0 d-flex align-items-center">
                                            <i class="fa-solid fa-file-lines me-2 text-primary"></i>{{ $t('mods.modrinth.introduction') || 'Mod Introduction' }}
                                        </label>
                                        <button v-if="selectedMod.project.body" class="btn btn-xs btn-outline-primary rounded-pill px-3 fw-bold" @click="translateBody" :disabled="translatingBody">
                                            <span v-if="translatingBody" class="spinner-border spinner-border-sm me-1"></span>
                                            <i v-else class="fa-solid fa-language me-1"></i>
                                            {{ translatingBody ? $t('mods.translating') : (bodyTranslations[selectedMod.project.id] ? $t('common.close') : $t('mods.translate')) }}
                                        </button>
                                    </div>
                                    <div class="mod-description-container bg-body-tertiary p-3 rounded-4 small text-body" 
                                         v-html="renderMarkdown(bodyTranslations[selectedMod.project.id] || selectedMod.project.body)"></div>
                                </div>
                            </div>

                            <!-- Right: File List -->
                            <div class="col-12 col-md-5 bg-body-tertiary overflow-auto p-3 p-md-4 custom-scrollbar">
                                <label class="form-label fw-bold text-uppercase text-muted mb-3 d-flex align-items-center">
                                    <i class="fa-solid fa-download me-2 text-primary"></i>{{ $t('mods.select_version') }}
                                </label>
                                
                                <div v-if="filteredVersions.length === 0" class="text-center py-5 opacity-50">
                                    <i class="fa-solid fa-folder-open fa-3x mb-3"></i>
                                    <p class="small fw-bold">{{ $t('mods.no_versions') }}</p>
                                </div>

                                <div v-else class="d-flex flex-column gap-3">
                                    <div v-for="v in filteredVersions" :key="v.id" 
                                         class="card border border-2 shadow-sm rounded-4 overflow-hidden transition-all hover-grow"
                                         :class="downloadingId === v.id ? 'border-primary' : 'border-transparent'">
                                        <div class="card-body p-3">
                                            <div class="d-flex justify-content-between align-items-start mb-2">
                                                <div class="fw-bold text-primary text-truncate pe-2">{{ v.name }}</div>
                                                <div class="badge rounded-pill" :class="v.version_type === 'release' ? 'bg-success' : 'bg-warning'">{{ v.version_type }}</div>
                                            </div>
                                            <div class="small text-muted mb-3 d-flex flex-wrap gap-2">
                                                <span><i class="fa-regular fa-calendar me-1"></i>{{ formatDate(v.date_published) }}</span>
                                                <span v-if="v.files[0]"><i class="fa-solid fa-weight-hanging me-1"></i>{{ (v.files[0].size/1024/1024).toFixed(2) }} MB</span>
                                            </div>
                                            <button class="btn btn-sm btn-primary w-100 rounded-pill fw-bold" @click="downloadModForVersion(v)" :disabled="downloadingId">
                                                <span v-if="downloadingId === v.id" class="spinner-border spinner-border-sm me-1"></span>
                                                <i v-else class="fa-solid fa-cloud-arrow-down me-1"></i>
                                                {{ downloadingId === v.id ? $t('mods.installing') : $t('mods.install') }}
                                            </button>
                                        </div>
                                    </div>
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
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const modrinthSearch = ref('');
        const modrinthResults = ref([]);
        const loadingModrinth = ref(true);
        const loadingDetails = ref(false);
        const selectedMod = ref(null);
        const selectedVersionIdx = ref(0);
        const downloadingId = ref(null);
        const showMobileFilters = ref(false);
        const filterGameVersion = ref('');
        const filterLoader = ref('fabric');
        const offset = ref(0);
        const hasMore = ref(true);

        const translatingBody = ref(false);
        const translatingModIds = reactive(new Set());
        const bodyTranslations = reactive({});

        const availableGameVersions = computed(() => {
            if (!selectedMod.value) return [];
            const versions = new Set();
            selectedMod.value.versions.forEach(v => {
                v.game_versions.forEach(gv => versions.add(gv));
            });
            return Array.from(versions).sort((a, b) => {
                // Simple version sort (reverse)
                return b.localeCompare(a, undefined, { numeric: true });
            });
        });

        const availableLoaders = computed(() => {
            if (!selectedMod.value || !filterGameVersion.value) return [];
            const loaders = new Set();
            selectedMod.value.versions.forEach(v => {
                if (v.game_versions.includes(filterGameVersion.value)) {
                    v.loaders.forEach(l => loaders.add(l));
                }
            });
            return Array.from(loaders).sort();
        });

        const filteredVersions = computed(() => {
            if (!selectedMod.value) return [];
            return selectedMod.value.versions
                .map((v, idx) => ({ ...v, origIdx: idx }))
                .filter(v => {
                    const matchGame = !filterGameVersion.value || v.game_versions.includes(filterGameVersion.value);
                    const matchLoader = !filterLoader.value || v.loaders.includes(filterLoader.value);
                    return matchGame && matchLoader;
                });
        });

        const renderMarkdown = (text) => {
            if (!text) return '';
            // Very basic markdown to HTML for intro display
            let html = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/_(.*?)_/g, '<em>$1</em>')
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-primary">$1</a>')
                .replace(/^# (.*$)/gim, '<h1 class="mt-3 mb-2">$1</h1>')
                .replace(/^## (.*$)/gim, '<h2 class="mt-3 mb-2">$1</h2>')
                .replace(/^### (.*$)/gim, '<h3 class="mt-3 mb-2">$1</h3>')
                .replace(/^\* (.*$)/gim, '<li class="ms-3">$1</li>')
                .replace(/^- (.*$)/gim, '<li class="ms-3">$1</li>')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');
            return html;
        };

        const sortBy = ref('relevance');
        const ALL_VERSIONS = ref(['1.21.1', '1.20.1', '1.19.2', '1.18.2', '1.16.5']);
        const translations = reactive({});

        const CATEGORIES = [
            { id: 'adventure', icon: 'fa-solid fa-compass' },
            { id: 'cursed', icon: 'fa-solid fa-ghost' },
            { id: 'decoration', icon: 'fa-solid fa-couch' },
            { id: 'economy', icon: 'fa-solid fa-coins' },
            { id: 'equipment', icon: 'fa-solid fa-shield-halved' },
            { id: 'food', icon: 'fa-solid fa-utensils' },
            { id: 'game-mechanics', icon: 'fa-solid fa-hammer' },
            { id: 'library', icon: 'fa-solid fa-book' },
            { id: 'magic', icon: 'fa-solid fa-wand-sparkles' },
            { id: 'management', icon: 'fa-solid fa-tasks' },
            { id: 'minigame', icon: 'fa-solid fa-gamepad' },
            { id: 'mobs', icon: 'fa-solid fa-paw' },
            { id: 'optimization', icon: 'fa-solid fa-gauge-high' },
            { id: 'social', icon: 'fa-solid fa-users' },
            { id: 'storage', icon: 'fa-solid fa-box-open' },
            { id: 'technology', icon: 'fa-solid fa-gear' },
            { id: 'transportation', icon: 'fa-solid fa-train' },
            { id: 'utility', icon: 'fa-solid fa-screwdriver-wrench' },
            { id: 'worldgen', icon: 'fa-solid fa-earth-americas' }
        ];

        const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'modloader', 'rift'];

        const SORT_OPTIONS = {
            relevance: 'relevance',
            downloads: 'downloads',
            follows: 'follows',
            newest: 'newest',
            updated: 'updated'
        };

        const filters = reactive({
            versions: [],
            loaders: ['fabric'],
            categories: [],
            environment: []
        });

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString(store.lang === 'zh' ? 'zh-CN' : 'en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        };

        const formatDownloads = (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num;
        };

        const clearFilters = () => {
            filters.versions = [];
            filters.loaders = ['fabric'];
            filters.categories = [];
            filters.environment = [];
            modrinthSearch.value = '';
            searchModrinth(true);
        };

        const fetchVersions = async () => {
            try {
                const res = await api.get('/api/mods/modrinth/versions');
                if (res.data) {
                    ALL_VERSIONS.value = res.data
                        .filter(v => v.version_type === 'release')
                        .map(v => v.version)
                        .slice(0, 50);
                }
            } catch (e) { console.error('Failed to fetch versions', e); }
        };

        const detectVersion = () => {
            const mcVer = store.stats?.mc?.version || store.stats?.version?.mc;
            if (mcVer && !filters.versions.length) {
                if (ALL_VERSIONS.value.includes(mcVer)) {
                    filters.versions = [mcVer];
                } else {
                    const major = mcVer.split('.').slice(0, 2).join('.');
                    if (ALL_VERSIONS.value.includes(major)) {
                        filters.versions = [major];
                    }
                }
            }
        };

        const searchModrinth = async (reset = true) => {
            if (reset) {
                modrinthResults.value = [];
                offset.value = 0;
            }
            loadingModrinth.value = true;
            try {
                const facets = [["project_type:mod"]];
                if (filters.loaders.length) {
                    facets.push(filters.loaders.map(l => `categories:${l}`));
                }
                if (filters.versions.length) {
                    facets.push(filters.versions.map(v => `versions:${v}`));
                }
                if (filters.categories.length) {
                    filters.categories.forEach(cat => {
                        facets.push([`categories:${cat}`]);
                    });
                }
                if (filters.environment.length) {
                    filters.environment.forEach(env => {
                        facets.push([env]);
                    });
                }

                const res = await api.get('/api/mods/modrinth/search', {
                    params: {
                        q: modrinthSearch.value,
                        facets: JSON.stringify(facets),
                        offset: offset.value,
                        limit: 20,
                        index: sortBy.value
                    }
                });
                modrinthResults.value = [...modrinthResults.value, ...res.data.hits];
                hasMore.value = res.data.hits.length === 20;
            } catch (e) {
                console.error('[Modrinth Search Error]', e);
                showToast('mods.modrinth.search_fail', 'danger');
            }
            finally { loadingModrinth.value = false; }
        };

        const loadMore = () => {
            offset.value += 20;
            searchModrinth(false);
        };

        const translateMod = async (mod) => {
            if (translations[mod.project_id]) {
                delete translations[mod.project_id];
                return;
            }
            translatingModIds.add(mod.project_id);
            try {
                const res = await api.post('/api/ai/translate', { text: mod.description });
                translations[mod.project_id] = res.data.translated;
            } catch (e) {
                const errKey = e.response?.data?.error === 'AI_NOT_CONFIGURED' ? 'mods.translate_fail_config' : 'mods.translate_fail';
                showToast(errKey, 'warning');
            }

            finally { translatingModIds.delete(mod.project_id); }
        };

        const translateBody = async () => {
            const id = selectedMod.value?.project?.id;
            if (!id || !selectedMod.value.project.body) return;
            if (bodyTranslations[id]) {
                delete bodyTranslations[id]; // Toggle back to original intro
                delete bodyTranslations[id + '_desc']; // Toggle back to original desc
                return;
            }

            translatingBody.value = true;
            try {
                // Translate body and description in parallel
                const [resBody, resDesc] = await Promise.all([
                    api.post('/api/ai/translate', { text: selectedMod.value.project.body }),
                    api.post('/api/ai/translate', { text: selectedMod.value.project.description })
                ]);
                bodyTranslations[id] = resBody.data.translated;
                bodyTranslations[id + '_desc'] = resDesc.data.translated;
            } catch (e) {
                const errKey = e.response?.data?.error === 'AI_NOT_CONFIGURED' ? 'mods.translate_fail_config' : 'mods.translate_fail';
                showToast(errKey, 'warning');
            }

            finally { translatingBody.value = false; }
        };

        const downloadModForVersion = async (version) => {
            if (!version) return;
            const primaryFile = version.files.find(f => f.primary) || version.files[0];
            if (!primaryFile) return;

            downloadingId.value = version.id;
            try {
                await api.post('/api/mods/modrinth/download', {
                    url: primaryFile.url,
                    filename: primaryFile.filename
                });
                showToast('mods.download_success', 'success', { name: selectedMod.value.project.title });
                selectedMod.value = null;
            } catch (e) { showToast('mods.download_fail', 'danger', { error: e.message }); }
            finally { downloadingId.value = null; }
        };

        const fetchModDetails = async (id) => {
            loadingDetails.value = true;
            try {
                const res = await api.get(`/api/mods/modrinth/project/${id}`);
                selectedMod.value = res.data;

                // Initialize filters based on current server or first available
                if (availableGameVersions.value.length > 0) {
                    const currentMc = store.stats?.mc?.version || store.stats?.version?.mc;
                    filterGameVersion.value = availableGameVersions.value.includes(currentMc)
                        ? currentMc
                        : availableGameVersions.value[0];
                }

                if (availableLoaders.value.length > 0) {
                    const defaultLoader = filters.loaders[0] || 'fabric';
                    filterLoader.value = availableLoaders.value.includes(defaultLoader)
                        ? defaultLoader
                        : availableLoaders.value[0];
                }

                if (filteredVersions.value.length > 0) {
                    selectedVersionIdx.value = filteredVersions.value[0].origIdx;
                } else {
                    selectedVersionIdx.value = 0;
                }
            } catch (e) { showToast('mods.modrinth.fetch_detail_fail', 'danger'); }
            finally { loadingDetails.value = false; }
        };

        // Watchers for hierarchical selection
        watch([filterGameVersion, filterLoader], () => {
            if (filteredVersions.value.length > 0) {
                selectedVersionIdx.value = filteredVersions.value[0].origIdx;
            }
        });

        const downloadMod = async () => {
            const version = selectedMod.value.versions[selectedVersionIdx.value];
            await downloadModForVersion(version);
        };

        watch(filters, () => searchModrinth(true), { deep: true });

        onMounted(async () => {
            await fetchVersions();
            detectVersion();
            searchModrinth(true);
        });

        return {
            modrinthSearch, modrinthResults, loadingModrinth, loadingDetails,
            selectedMod, selectedVersionIdx, downloadingId, showMobileFilters,
            filterGameVersion, filterLoader, availableGameVersions, availableLoaders, filteredVersions,
            renderMarkdown, translatingBody, bodyTranslations, translatingModIds, translateBody,
            filters, ALL_VERSIONS, CATEGORIES, LOADERS, SORT_OPTIONS, sortBy,
            hasMore, translations, formatDate, formatDownloads, clearFilters,
            searchModrinth, loadMore, translateMod, fetchModDetails, downloadMod, downloadModForVersion
        };
    }
};
