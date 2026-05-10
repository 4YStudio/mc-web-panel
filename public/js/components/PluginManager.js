import { ref, reactive, onMounted, computed, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';
import PluginDevGuide from './PluginDevGuide.js';

export default {
    components: {
        PluginDevGuide
    },
    template: `
    <div class="animate-in">
        <div class="page-header d-flex justify-content-between align-items-center mb-4">
            <div class="d-flex align-items-center">
                <button @click="showGuide ? showGuide = false : (store.view = store.prevView || 'instance-manager')" class="btn-back me-3">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div>
                    <h3 class="m-0 fw-bold d-flex align-items-center">
                        <i class="fa-solid fa-puzzle-piece me-2 me-md-3 text-primary"></i>
                        <span>{{ showGuide ? $t('plugins.guide_title') : $t('plugins.title') }}</span>
                    </h3>
                    <p class="text-muted mb-0 mt-1 small d-none d-md-block">{{ showGuide ? $t('plugins.guide_desc') : $t('plugins.description') }}</p>
                </div>
            </div>
            <div class="d-flex gap-2">
                <template v-if="!showGuide">
                    <button class="btn btn-outline-primary rounded-pill px-3 px-md-4" @click="showGuide = true">
                        <i class="fa-solid fa-book"></i><span class="d-none d-md-inline ms-1">{{ $t('plugins.guide_button') }}</span>
                    </button>
                    <button class="btn btn-primary rounded-pill px-3 px-md-4 fw-bold shadow-sm" @click="openInstallModal">
                        <i class="fa-solid fa-plus-circle"></i><span class="d-none d-md-inline ms-1">{{ $t('plugins.install') }}</span>
                    </button>
                </template>
                <template v-else>
                </template>
            </div>
        </div>

        <div v-if="showGuide">
            <plugin-dev-guide ref="devGuide" @close="showGuide = false"></plugin-dev-guide>
        </div>
        <div v-else class="plugin-list-view">
            <div v-if="loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <div class="text-muted mt-2 small">{{ $t('common.loading') }}</div>
            </div>
            <div v-else>
                <div v-if="plugins.length > 0" class="row g-3">
                    <div v-for="(plugin, idx) in plugins" :key="plugin.id" class="col-md-6 col-lg-4 stagger-item" :style="{'animation-delay': (idx * 0.05) + 's'}">
                        <div class="card h-100 plugin-card border-secondary shadow-sm" style="border-radius: 16px; transition: all 0.3s ease; background-color: var(--c-surface) !important;">
                            <div class="card-body p-3 p-md-4">
                                <div class="d-flex align-items-start justify-content-between mb-3">
                                    <div class="d-flex align-items-center gap-3">
                                        <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                                             :style="{background: plugin.color + '18', color: plugin.color, width: '44px', height: '44px', borderRadius: '12px'}">
                                            <i class="fa-solid" :class="plugin.icon" style="font-size: 1.1rem;"></i>
                                        </div>
                                        <div>
                                            <div class="fw-bold text-truncate" style="max-width: 140px;">{{ plugin.name }}</div>
                                            <div class="text-muted" style="font-size: 0.72rem;">v{{ plugin.version }} · {{ plugin.author }}</div>
                                        </div>
                                    </div>
                                </div>
                                <p class="text-muted small mb-3" style="line-height: 1.5; height: 3em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{{ plugin.description }}</p>
                                <div class="d-flex align-items-center justify-content-between">
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="status-indicator" :class="plugin.enabled && plugin.loaded ? 'bg-success' : 'bg-secondary'" style="width: 6px; height: 6px;"></span>
                                        <span class="small" :class="plugin.enabled && plugin.loaded ? 'text-success' : 'text-muted'">
                                            {{ plugin.enabled && plugin.loaded ? $t('plugins.running') : $t('plugins.stopped') }}
                                        </span>
                                    </div>
                                    <div class="d-flex gap-2 align-items-center">
                                        <div class="form-check form-switch m-0 me-1">
                                            <input class="form-check-input" type="checkbox" :checked="plugin.enabled"
                                                @change="togglePlugin(plugin)" :disabled="toggling === plugin.id">
                                        </div>
                                        <button class="btn btn-sm btn-outline-secondary px-2 py-0" @click="exportPlugin(plugin)" style="font-size: 0.72rem; border-radius: 8px;" :title="$t('common.export')">
                                            <i class="fa-solid fa-download"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger px-2 py-0" @click="askUninstall(plugin)" style="font-size: 0.72rem; border-radius: 8px;" :title="$t('common.delete')">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="text-center py-5">
                    <i class="fa-solid fa-puzzle-piece d-block mb-3 opacity-25" style="font-size: 3rem;"></i>
                    <p class="text-muted mb-0">{{ $t('plugins.no_plugins') }}</p>
                    <p class="text-muted small">{{ $t('plugins.no_plugins_hint') }}</p>
                </div>
            </div>
        </div>

        <Teleport to="body">
            <Transition name="modal-fade">
                <div class="modal fade show" v-if="showInstallModal" style="display: block; z-index: 1050;">
                    <div class="modal-backdrop fade show" @click="closeInstallModal" style="z-index: -1;"></div>
                    <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                        <div class="modal-content border-0 shadow-lg overflow-hidden" style="border-radius: 20px; background-color: var(--c-surface); color: var(--c-text-primary);">
                            <div class="modal-header border-0 pb-0 pt-4 px-4">
                                <h5 class="modal-title fw-bold">
                                    <i class="fa-solid me-2 text-primary" :class="showUninstallConfirm ? 'fa-trash-can' : (updatingPlugin || analysisResult?.isUpdate ? 'fa-arrows-rotate' : 'fa-plus-circle')"></i>
                                    <span v-if="showUninstallConfirm">
                                        {{ $t('plugins.uninstall_title') }}
                                    </span>
                                    <span v-else-if="analysisResult">
                                        {{ analysisResult.isUpdate ? $t('plugins.update_title', {name: analysisResult.manifest.name}) : $t('plugins.install_confirm_title') }}
                                    </span>
                                    <span v-else>
                                        {{ updatingPlugin ? $t('plugins.update_title', {name: updatingPlugin.name}) : $t('plugins.install_title') }}
                                    </span>
                                </h5>
                                <button type="button" class="btn-close" @click="closeInstallModal"></button>
                            </div>
                            <div class="modal-body px-4 py-4">
                                <div v-if="showUninstallConfirm" class="text-center py-2">
                                    <div class="rounded-circle bg-danger-subtle text-danger mx-auto d-flex align-items-center justify-content-center mb-4" style="width: 80px; height: 80px;">
                                        <i class="fa-solid fa-trash-can" style="font-size: 2.2rem;"></i>
                                    </div>
                                    <h5 class="fw-bold mb-3">{{ $t('plugins.uninstall_confirm', {name: pluginToUninstall?.name}) }}</h5>
                                    <p class="text-muted small mb-4 px-4">{{ $t('plugins.uninstall_warning_hint') }}</p>
                                    
                                    <div class="text-start mb-0">
                                        <label class="form-label small fw-bold text-muted">{{ $t('plugins.type_to_confirm_hint', {name: pluginToUninstall?.name}) }}</label>
                                        <input type="text" class="form-control text-center fw-bold" v-model="uninstallConfirmName" :placeholder="pluginToUninstall?.name" @keyup.enter="confirmUninstall">
                                    </div>
                                </div>
                                <div v-else-if="!disclaimerAccepted" class="text-center py-3">
                                    <div class="rounded-3 d-inline-flex align-items-center justify-content-center bg-warning-subtle text-warning mb-3" style="width: 64px; height: 64px; border-radius: 16px !important;">
                                        <i class="fa-solid fa-shield-halved" style="font-size: 1.5rem;"></i>
                                    </div>
                                    <h6 class="fw-bold mb-3">{{ $t('plugins.disclaimer_title') }}</h6>
                                    <div class="text-start p-3 disclaimer-box rounded-3 mb-3 small" style="line-height: 1.6; max-height: 200px; overflow-y: auto;">
                                        <p class="mb-2">{{ $t('plugins.disclaimer_line1') }}</p>
                                        <p class="mb-2">{{ $t('plugins.disclaimer_line2') }}</p>
                                        <p class="mb-0">{{ $t('plugins.disclaimer_line3') }}</p>
                                    </div>
                                    <div class="form-check d-inline-block text-start mb-0">
                                        <input type="checkbox" class="form-check-input" id="disclaimerCheck" v-model="disclaimerChecked">
                                        <label class="form-check-label small fw-medium" for="disclaimerCheck">{{ $t('plugins.disclaimer_confirm') }}</label>
                                    </div>
                                </div>
                                <div v-else-if="analysisResult">
                                    <div class="plugin-preview-card p-4 rounded-4 mb-3" :class="analysisResult.isUpdate ? 'bg-info-subtle border-info-subtle' : 'bg-primary-subtle border-primary-subtle'" style="border: 1px solid;">
                                        <div class="d-flex align-items-start gap-3">
                                            <div class="bg-white rounded-3 p-3 shadow-sm">
                                                <i class="fa-solid fa-puzzle-piece text-primary" style="font-size: 2rem;"></i>
                                            </div>
                                            <div class="flex-grow-1">
                                                <div class="d-flex align-items-center gap-2 mb-1">
                                                    <h5 class="fw-bold mb-0">{{ analysisResult.manifest.name }}</h5>
                                                    <span class="badge rounded-pill" :class="analysisResult.isUpdate ? 'bg-info' : 'bg-primary'">
                                                        {{ analysisResult.isUpdate ? $t('plugins.update_badge') : $t('plugins.new_badge') }}
                                                    </span>
                                                </div>
                                                <p class="text-muted small mb-2">{{ analysisResult.manifest.description }}</p>
                                                <div class="d-flex flex-wrap gap-3 small">
                                                    <span><i class="fa-solid fa-code-branch me-1 text-muted"></i>{{ analysisResult.manifest.version }}</span>
                                                    <span><i class="fa-solid fa-user me-1 text-muted"></i>{{ analysisResult.manifest.author }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div v-if="analysisResult.isUpdate && analysisResult.existing" class="mt-4 p-3 bg-white bg-opacity-50 rounded-3 border border-white">
                                            <h6 class="fw-bold small mb-2"><i class="fa-solid fa-clock-rotate-left me-1"></i>{{ $t('plugins.update_comparison') }}</h6>
                                            <div class="row g-2 text-center">
                                                <div class="col-5">
                                                    <div class="small text-muted">{{ $t('plugins.current_version') }}</div>
                                                    <div class="fw-bold text-danger">{{ analysisResult.existing.version }}</div>
                                                </div>
                                                <div class="col-2 d-flex align-items-center justify-content-center">
                                                    <i class="fa-solid fa-arrow-right text-muted"></i>
                                                </div>
                                                <div class="col-5">
                                                    <div class="small text-muted">{{ $t('plugins.new_version') }}</div>
                                                    <div class="fw-bold text-success">{{ analysisResult.manifest.version }}</div>
                                                </div>
                                            </div>
                                            <div v-if="compareVersions(analysisResult.manifest.version, analysisResult.existing.version) < 0" class="mt-2 text-center text-warning small fw-bold">
                                                <i class="fa-solid fa-triangle-exclamation me-1"></i>{{ $t('plugins.downgrade_warning') }}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="alert alert-info border-0 rounded-3 small">
                                        <i class="fa-solid fa-circle-info me-2"></i>{{ $t('plugins.install_confirm_hint') }}
                                    </div>
                                </div>
                                <div v-else>
                                    <div class="mb-4 text-center">
                                        <div class="rounded-circle bg-primary-subtle mx-auto d-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                                            <i class="fa-solid fa-cloud-arrow-up text-primary" style="font-size: 1.5rem;"></i>
                                        </div>
                                        <p class="text-muted small px-3">{{ $t('plugins.upload_desc') }}</p>
                                    </div>

                                    <div class="mb-3">
                                        <label class="form-label small fw-bold text-muted">{{ $t('plugins.install_file_label') }}</label>
                                        <div class="input-group">
                                            <input type="file" class="form-control border-end-0" ref="installFileInput" accept=".zip" @change="handleFileChange" style="border-radius: 12px 0 0 12px;">
                                            <span class="input-group-text bg-white border-start-0" style="border-radius: 0 12px 12px 0;"><i class="fa-solid fa-file-zipper text-muted"></i></span>
                                        </div>
                                        <div class="form-text small text-muted mt-2">{{ $t('plugins.install_file_hint') }}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer border-0 pt-0 px-4 pb-4">
                                <button class="btn rounded-pill px-4" @click="closeInstallModal" :disabled="installing" :class="store.isDark ? 'btn-outline-light' : 'btn-light'">{{ $t('common.cancel') }}</button>
                                
                                <button v-if="showUninstallConfirm" class="btn btn-danger rounded-pill px-4 fw-bold" @click="confirmUninstall" :disabled="installing || uninstallConfirmName !== pluginToUninstall?.name">
                                    <span v-if="installing" class="spinner-border spinner-border-sm me-1"></span>
                                    <i v-else class="fa-solid fa-trash-can me-1"></i>{{ $t('common.delete') }}
                                </button>

                                <button v-else-if="!disclaimerAccepted" class="btn btn-warning rounded-pill px-4 fw-bold" @click="disclaimerAccepted = disclaimerChecked" :disabled="!disclaimerChecked">
                                    <i class="fa-solid fa-check me-1"></i>{{ $t('plugins.disclaimer_agree') }}
                                </button>
                                
                                <button v-else-if="analysisResult" class="btn btn-primary rounded-pill px-4 fw-bold" @click="confirmInstall" :disabled="installing">
                                    <span v-if="installing" class="spinner-border spinner-border-sm me-1"></span>
                                    <i v-else class="fa-solid fa-check-circle me-1"></i>
                                    {{ analysisResult.isUpdate ? $t('plugins.confirm_update') : $t('plugins.confirm_install') }}
                                </button>

                                <button v-else class="btn btn-primary rounded-pill px-4 fw-bold" @click="startUpload" :disabled="installing || !hasFile">
                                    <span v-if="installing" class="spinner-border spinner-border-sm me-1"></span>
                                    <i v-else class="fa-solid fa-cloud-arrow-up me-1"></i>{{ $t('plugins.upload_analyze') }}
                                </button>
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

        const plugins = ref([]);
        const loading = ref(false);
        const toggling = ref(null);
        const showInstallModal = ref(false);
        const disclaimerAccepted = ref(false);
        const disclaimerChecked = ref(false);
        const installPath = ref('');
        const installing = ref(false);
        const installFileInput = ref(null);
        const updatingPlugin = ref(null);
        const analysisResult = ref(null);
        const hasFile = ref(false);
        const showUninstallConfirm = ref(false);
        const pluginToUninstall = ref(null);
        const uninstallConfirmName = ref('');
        const showGuide = ref(false);

        const refreshPlugins = async () => {
            loading.value = true;
            try {
                const res = await api.get('/api/plugins/list');
                plugins.value = res.data;
            } catch (e) {
                showToast(e.response?.data?.error || e.message, 'danger');
            } finally {
                loading.value = false;
            }
        };

        const togglePlugin = async (plugin) => {
            toggling.value = plugin.id;
            try {
                const action = plugin.enabled ? 'disable' : 'enable';
                await api.post(`/api/plugins/${action}`, { pluginId: plugin.id });
                showToast($t(`plugins.${action}d_success`, { name: plugin.name }), 'success');
                await refreshPlugins();
            } catch (e) {
                showToast(e.response?.data?.error || e.message, 'danger');
            } finally {
                toggling.value = null;
            }
        };

        const exportPlugin = (plugin) => {
            window.open(`/api/plugins/export/${plugin.id}`, '_blank');
        };

        const openInstallModal = () => {
            updatingPlugin.value = null;
            analysisResult.value = null;
            disclaimerAccepted.value = false;
            disclaimerChecked.value = false;
            showUninstallConfirm.value = false;
            showInstallModal.value = true;
        };

        const openUpdateModal = (plugin) => {
            updatingPlugin.value = plugin;
            analysisResult.value = null;
            disclaimerAccepted.value = true; // Skip disclaimer for updates
            showUninstallConfirm.value = false;
            showInstallModal.value = true;
        };

        const closeInstallModal = () => {
            if (installing.value) return;
            showInstallModal.value = false;
            // Delay clearing to allow animation to finish
            setTimeout(() => {
                updatingPlugin.value = null;
                analysisResult.value = null;
                hasFile.value = false;
                showUninstallConfirm.value = false;
                pluginToUninstall.value = null;
                uninstallConfirmName.value = '';
            }, 300);
        };

        const handleFileChange = (e) => {
            hasFile.value = !!e.target.files[0];
        };

        const startUpload = async () => {
            const file = installFileInput.value.files[0];
            if (!file) return;

            installing.value = true;
            const formData = new FormData();
            formData.append('plugin', file);

            try {
                const res = await api.post('/api/plugins/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                analysisResult.value = res.data;
                // If it's an update, skip disclaimer
                if (analysisResult.value.isUpdate) {
                    disclaimerAccepted.value = true;
                }
            } catch (e) {
                showToast(e.response?.data?.error || e.message, 'danger');
            } finally {
                installing.value = false;
            }
        };

        const confirmInstall = async () => {
            if (!analysisResult.value) return;
            installing.value = true;
            try {
                await api.post('/api/plugins/install-confirm', { 
                    pluginPath: analysisResult.value.tempDir,
                    isUpdate: analysisResult.value.isUpdate
                });
                showToast(analysisResult.value.isUpdate ? $t('plugins.update_success') : $t('plugins.install_success'), 'success');
                showInstallModal.value = false;
                analysisResult.value = null;
                await refreshPlugins();
            } catch (e) {
                showToast(e.response?.data?.error || e.message, 'danger');
            } finally {
                installing.value = false;
            }
        };

        const askUninstall = (plugin) => {
            pluginToUninstall.value = plugin;
            showUninstallConfirm.value = true;
            uninstallConfirmName.value = '';
            showInstallModal.value = true;
        };

        const confirmUninstall = async () => {
            if (!pluginToUninstall.value || uninstallConfirmName.value !== pluginToUninstall.value.name) return;
            installing.value = true;
            try {
                await api.post('/api/plugins/uninstall', { pluginId: pluginToUninstall.value.id });
                showToast($t('plugins.uninstalled_success', { name: pluginToUninstall.value.name }), 'success');
                showInstallModal.value = false;
                await refreshPlugins();
            } catch (e) {
                showToast(e.response?.data?.error || e.message, 'danger');
            } finally {
                installing.value = false;
            }
        };

        const compareVersions = (v1, v2) => {
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
                const p1 = parts1[i] || 0;
                const p2 = parts2[i] || 0;
                if (p1 > p2) return 1;
                if (p1 < p2) return -1;
            }
            return 0;
        };

        onMounted(() => {
            refreshPlugins();
        });

        return {
            store, plugins, loading, toggling,
            showInstallModal, disclaimerAccepted, disclaimerChecked, installPath, installing, installFileInput,
            refreshPlugins, togglePlugin, exportPlugin, askUninstall, confirmUninstall, startUpload, confirmInstall, openInstallModal, openUpdateModal, closeInstallModal,
            updatingPlugin, analysisResult, hasFile, handleFileChange, compareVersions,
            showUninstallConfirm, pluginToUninstall, uninstallConfirmName,
            showGuide
        };
    }
};
