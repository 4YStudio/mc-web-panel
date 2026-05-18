import { ref, reactive, onMounted, watch, getCurrentInstance, computed } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

export default {
    template: `
    <div>
        <div class="page-header d-flex justify-content-between align-items-center">
            <h3 class="m-0 fw-bold">{{ $t('properties.title').split(' (')[0] }}</h3>
            <div class="btn-group" v-if="!notFound">
                <button class="btn btn-outline-secondary" @click="toggleEditMode">
                    <i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i>
                    <span class="d-none d-md-inline ms-1">{{ editMode==='gui' ? 'Text Mode' : 'GUI Mode' }}</span>
                </button>
                <button class="btn btn-success" @click="saveConfig" :disabled="saving">
                    <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                    <i v-else class="fa-solid fa-save me-0 me-md-2"></i><span class="d-none d-md-inline">{{ $t('common.save') }}</span>
                </button>
            </div>
        </div>

        <div v-if="notFound" class="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
            <i class="fa-solid fa-file-circle-exclamation fa-4x mb-3 opacity-25"></i>
            <h4>{{ $t('files.file_not_found', { name: 'server.properties' }) }}</h4>
            <div class="mt-4">
                <button class="btn btn-outline-danger px-4 rounded-pill fw-bold" @click="askReinstall">
                    <i class="fa-solid fa-trash-can me-2"></i>{{ $t('panel_settings.reinstall') }}
                </button>
            </div>
        </div>

        <template v-else>
            <div class="card mb-4 border-secondary-subtle">
                <div class="card-header bg-body-tertiary fw-bold">{{ $t('properties.server_icon') }}</div>
                <div class="card-body d-flex align-items-center gap-4">
                    <div class="position-relative">
                        <img v-show="hasCustomIcon" :src="iconUrl" class="rounded border" width="64" height="64" style="object-fit: cover;" @load="hasCustomIcon=true" @error="iconLoadError">
                        <div v-if="!hasCustomIcon" class="rounded border d-flex align-items-center justify-content-center bg-body-secondary text-muted" style="width: 64px; height: 64px;">
                            <img src="/logo.png" alt="Default" style="width: 32px; height: 32px; object-fit: contain; opacity: 0.5;">
                        </div>
                    </div>
                    <div>
                        <div class="mb-2 hint-box">{{ $t('properties.icon_tips') }}</div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" @click="$refs.iconInput.click()">
                                <i class="fa-solid fa-upload me-md-1"></i><span class="d-none d-md-inline">{{ $t('common.upload') }}</span>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" @click="deleteIcon" :disabled="!hasCustomIcon">
                                <i class="fa-solid fa-trash me-md-1"></i><span class="d-none d-md-inline">{{ $t('common.delete') }}</span>
                            </button>
                        </div>
                        <input type="file" ref="iconInput" class="d-none" accept="image/png" @change="uploadIcon">
                    </div>
                </div>
            </div>

            <div v-if="editMode === 'gui'" class="pb-4">
                <div class="mb-3">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-body-tertiary border-end-0"><i class="fa-solid fa-search text-muted"></i></span>
                        <input type="text" class="form-control border-start-0" :placeholder="$t('properties.filter')" v-model="filterText">
                    </div>
                </div>

                <div class="row g-3">
                    <div v-for="group in visibleGroups" :key="group.titleKey" class="col-lg-6">
                        <div class="card h-100 border-secondary-subtle shadow-sm">
                            <div class="card-header bg-body-tertiary fw-bold d-flex align-items-center">
                                {{ $t(group.titleKey) }}
                                <span class="badge bg-secondary ms-2">{{ group.items.length }}</span>
                            </div>
                            <div class="card-body">
                                <div v-for="prop in group.items" :key="prop.key" class="mb-3 row align-items-center">
                                    <label class="col-sm-5 col-form-label small text-break" :title="prop.key">
                                        {{ getLabel(prop.key) }}
                                    </label>
                                    <div class="col-sm-7">
                                        <div v-if="prop.type === 'boolean'" class="form-check form-switch">
                                            <input class="form-check-input" type="checkbox" v-model="formModel[prop.key]">
                                        </div>
                                        <CustomSelect v-else-if="prop.type === 'select'" v-model="formModel[prop.key]" :options="prop.options" size="sm" />
                                        <input v-else-if="prop.type === 'number'" type="number" class="form-control form-control-sm" v-model.number="formModel[prop.key]">
                                        <input v-else type="text" class="form-control form-control-sm" v-model="formModel[prop.key]">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="h-100">
                <div class="card h-100 shadow-sm">
                    <div class="card-header bg-body-tertiary small text-muted">mc_server/server.properties</div>
                    <textarea class="form-control border-0 rounded-0 h-100"
                        style="font-family: monospace; resize: none; min-height: 65vh;"
                        v-model="fileContent"
                        spellcheck="false"
                    ></textarea>
                </div>
            </div>
        </template>

        <div class="row g-4 mt-1">
            <div class="col-md-6">
                <div class="card h-100 border-primary-subtle shadow-sm">
                    <div class="card-header bg-primary-subtle text-primary fw-bold py-2 px-3 small text-uppercase">
                        <i class="fa-solid fa-clock-rotate-left me-2"></i>{{ $t('properties.map_backup.strategy') }}
                    </div>
                    <div class="card-body p-3 d-flex flex-column">
                        <div class="mb-3 flex-grow-1">
                            <div class="form-check form-switch d-flex justify-content-between p-0 mb-3">
                                <label class="form-check-label fw-bold text-muted">{{ $t('properties.map_backup.strategy_panel') }}</label>
                                <input class="form-check-input ms-0" type="checkbox" :checked="backupStrategy === 'panel'" @change="backupStrategy = $event.target.checked ? 'panel' : 'mod'">
                            </div>
                            <div class="form-text small mt-2 opacity-75" style="font-size: 0.75rem;">
                                <i class="fa-solid fa-circle-info me-1"></i>
                                {{ $t('properties.map_backup.panel_tips') }}
                            </div>
                        </div>
                        <button class="btn btn-primary w-100 rounded-pill fw-bold shadow-sm mt-auto" @click="saveBackupStrategy">
                            <i class="fa-solid fa-save me-2"></i>{{ $t('common.save') }}
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card h-100 border-info-subtle shadow-sm">
                    <div class="card-header bg-info-subtle text-info fw-bold py-2 px-3 small text-uppercase">
                        <i class="fa-solid fa-cube me-2"></i>{{ $t('properties.fabric_version') }}
                        <span v-if="fabricChanging" class="spinner-border spinner-border-sm text-info ms-2" role="status"></span>
                    </div>
                    <div class="card-body p-3 d-flex flex-column">
                        <div class="d-flex align-items-center gap-3 mb-3 flex-grow-1">
                            <div class="flex-fill">
                                <div class="small text-muted mb-1">{{ $t('properties.current_mc') }}</div>
                                <div class="fw-bold">{{ currentVersion.mc === 'Unknown' ? $t('common.unknown') : currentVersion.mc }}</div>
                            </div>
                            <div class="flex-fill">
                                <div class="small text-muted mb-1">{{ $t('properties.current_loader') }}</div>
                                <div class="fw-bold">{{ currentVersion.loader === 'Unknown' ? $t('common.unknown') : currentVersion.loader }}</div>
                            </div>
                        </div>
                        <button class="btn btn-outline-info w-100 rounded-pill fw-bold mt-auto" @click="openFabricModal" :disabled="fabricChanging">
                            <i class="fa-solid fa-arrows-rotate me-2"></i>{{ $t('properties.change_version') }}
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card h-100 border-danger-subtle">
                    <div class="card-header bg-danger-subtle text-danger fw-bold">
                        <i class="fa-solid fa-triangle-exclamation me-2"></i>{{ $t('common.danger_zone') }}
                    </div>
                    <div class="card-body d-flex flex-column justify-content-center">
                        <h5 class="card-title text-danger mb-2">{{ $t('panel_settings.reinstall') }}</h5>
                        <p class="card-text text-muted small mb-3">{{ $t('panel_settings.reinstall_confirm') }}</p>
                        <button class="btn btn-outline-danger w-100 mt-auto" @click="askReinstall">
                            <i class="fa-solid fa-trash-can me-2"></i>{{ $t('panel_settings.reinstall') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade" :class="{ show: fabricModalVisible }" :style="{ display: fabricModalVisible ? 'block' : 'none' }" tabindex="-1" @click.self="closeFabricModal">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 16px;">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title fw-bold">
                            <i class="fa-solid fa-cube text-primary me-2"></i>{{ $t('properties.change_version') }}
                        </h5>
                        <button type="button" class="btn-close" @click="closeFabricModal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-4">
                            <div class="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill bg-body-tertiary small">
                                <span class="text-muted">{{ $t('properties.current_mc') }}:</span>
                                <span class="fw-bold">{{ currentVersion.mc === 'Unknown' ? $t('common.unknown') : currentVersion.mc }}</span>
                                <span class="text-muted mx-1">/</span>
                                <span class="text-muted">{{ $t('properties.current_loader') }}:</span>
                                <span class="fw-bold">{{ currentVersion.loader === 'Unknown' ? $t('common.unknown') : currentVersion.loader }}</span>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold small">
                                <i class="fa-solid fa-gamepad me-1"></i>{{ $t('properties.target_mc') }}
                                <span v-if="loadingMcVersions" class="spinner-border spinner-border-sm text-primary ms-1" role="status"></span>
                            </label>
                            <CustomSelect v-model="selectedMc" :options="mcVersions" :placeholder="loadingMcVersions ? $t('common.loading') : $t('properties.choose_mc')" :disabled="loadingMcVersions" searchable @change="fetchFabricLoaders" />
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold small">
                                <i class="fa-solid fa-gear me-1"></i>{{ $t('properties.target_loader') }}
                                <span v-if="loadingLoaderVersions" class="spinner-border spinner-border-sm text-primary ms-1" role="status"></span>
                            </label>
                            <CustomSelect v-model="selectedLoader" :options="loaderVersions" :placeholder="loadingLoaderVersions ? $t('common.loading') : $t('properties.choose_loader')" :disabled="loadingLoaderVersions || !selectedMc" searchable />
                        </div>

                        <div v-if="store.isRunning" class="alert alert-warning small py-2 mb-0">
                            <i class="fa-solid fa-triangle-exclamation me-1"></i>
                            {{ $t('properties.stop_server_first') }}
                        </div>
                        <div v-else-if="selectedMc && selectedLoader" class="alert alert-info small py-2 mb-0">
                            <i class="fa-solid fa-circle-info me-1"></i>
                            {{ $t('properties.version_change_tips') }}
                        </div>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-secondary rounded-pill px-4" @click="closeFabricModal">{{ $t('common.cancel') }}</button>
                        <button type="button" class="btn btn-primary rounded-pill px-4" @click="changeFabricVersion"
                            :disabled="!selectedMc || !selectedLoader || fabricChanging || store.isRunning">
                            <span v-if="fabricChanging" class="spinner-border spinner-border-sm me-1" role="status"></span>
                            <i v-else class="fa-solid fa-download me-1"></i>{{ $t('properties.apply') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-backdrop fade" :class="{ show: fabricModalVisible }" v-if="fabricModalVisible"></div>
    </div>
    `,
    setup() {
        const editMode = ref('gui');
        const fileContent = ref('');
        const notFound = ref(false);
        const formModel = reactive({});
        const filterText = ref('');
        const saving = ref(false);
        const iconUrl = ref('/api/server/icon');
        const iconInput = ref(null);
        const hasCustomIcon = ref(false);
        const backupStrategy = ref(store.stats?.backupStrategy || 'panel');
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const currentVersion = reactive({ mc: 'Unknown', loader: 'Unknown' });
        const mcVersions = ref([]);
        const loaderVersions = ref([]);
        const selectedMc = ref('');
        const selectedLoader = ref('');
        const loadingMcVersions = ref(false);
        const loadingLoaderVersions = ref(false);
        const fabricChanging = ref(false);
        const fabricModalVisible = ref(false);

        const rawProperties = ref([]);
        const rawGroups = ref([]);
        const rawSchema = ref({});

        const getLabel = (key) => {
            // 先尝试使用 $t，如果返回的是键本身，则直接返回键
            const translated = $t('properties.labels.' + key);
            if (translated !== 'properties.labels.' + key) {
                return translated;
            }
            // 如果 $t 失败（可能是因为键包含点号），手动查找
            const lang = store.lang || 'zh';
            const manualLabels = {
                zh: {
                    'query.port': 'Query 端口',
                    'rcon.password': 'RCON 密码',
                    'rcon.port': 'RCON 端口'
                },
                en: {
                    'query.port': 'Query Port',
                    'rcon.password': 'RCON Password',
                    'rcon.port': 'RCON Port'
                }
            };
            return manualLabels[lang]?.[key] ?? key;
        };

        const visibleGroups = computed(() => {
            const filter = filterText.value.toLowerCase().trim();
            const groups = [];

            for (const group of rawGroups.value) {
                const items = rawProperties.value.filter(p => group.keys.includes(p.key));
                const filtered = filter
                    ? items.filter(p => p.key.toLowerCase().includes(filter) || String(p.value).toLowerCase().includes(filter))
                    : items;
                if (filtered.length > 0) {
                    groups.push({ titleKey: group.titleKey, items: filtered });
                }
            }

            const ungrouped = rawProperties.value.filter(p => !p.grouped);
            const filteredUngrouped = filter
                ? ungrouped.filter(p => p.key.toLowerCase().includes(filter) || String(p.value).toLowerCase().includes(filter))
                : ungrouped;
            if (filteredUngrouped.length > 0) {
                groups.push({ titleKey: 'properties.groups.other', items: filteredUngrouped });
            }

            return groups;
        });

        const loadProperties = async () => {
            try {
                const res = await api.get('/api/server/properties');
                rawProperties.value = res.data.properties;
                rawGroups.value = res.data.groups;
                rawSchema.value = res.data.schema;
                notFound.value = false;

                for (const prop of res.data.properties) {
                    formModel[prop.key] = prop.value;
                }
            } catch (e) {
                if (e.response?.status === 404) {
                    notFound.value = true;
                } else {
                    showToast($t('common.error'), 'danger');
                }
            }
        };

        const loadFileContent = async () => {
            try {
                const res = await api.get(`/api/files/content?path=server.properties`);
                fileContent.value = res.data.content;
            } catch (e) {
                fileContent.value = '# Error reading server.properties';
            }
        };

        const saveConfig = async () => {
            saving.value = true;
            try {
                if (editMode.value === 'gui') {
                    const updates = {};
                    for (const prop of rawProperties.value) {
                        const newVal = formModel[prop.key];
                        if (newVal !== undefined && newVal !== prop.value) {
                            if (prop.type === 'boolean') updates[prop.key] = newVal ? 'true' : 'false';
                            else updates[prop.key] = String(newVal);
                        }
                    }
                    if (Object.keys(updates).length > 0) {
                        await api.post('/api/server/properties', { properties: updates });
                        await loadProperties();
                    }
                } else {
                    await api.post('/api/files/save', { filepath: 'server.properties', content: fileContent.value });
                }
                showToast($t('properties.restart_tips'));
            } catch (e) {
                showToast($t('common.error'), 'danger');
            } finally {
                saving.value = false;
            }
        };

        const toggleEditMode = () => {
            if (editMode.value === 'text') {
                loadProperties();
                editMode.value = 'gui';
            } else {
                loadFileContent();
                editMode.value = 'text';
            }
        };

        const updateIconPreview = () => {
            iconUrl.value = `/api/server/icon?t=${store.serverIconVersion}`;
        };
        const iconLoadError = () => {
            hasCustomIcon.value = false;
        };

        watch(() => store.serverIconVersion, updateIconPreview);
        watch(() => store.stats?.backupStrategy, (val) => {
            if (val) backupStrategy.value = val;
        });

        const uploadIcon = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const fd = new FormData();
            fd.append('icon', file);
            try {
                await api.post('/api/server/icon', fd);
                showToast($t('common.success'));
                store.serverIconVersion = Date.now();
                e.target.value = '';
            } catch (err) { showToast('common.error', 'danger'); }
        };

        const deleteIcon = async () => {
            openModal({
                title: $t('properties.server_icon'),
                message: $t('properties.reset_icon_confirm'),
                callback: async () => {
                    try {
                        await api.delete('/api/server/icon');
                        showToast($t('common.success'));
                        store.serverIconVersion = Date.now();
                        hasCustomIcon.value = false;
                    } catch (err) {
                        const msg = err.response?.data?.error || err.message || 'common.error';
                        showToast(msg, 'danger');
                    }
                }
            });
        };

        const askReinstall = () => {
            openModal({
                title: $t('panel_settings.reinstall'),
                message: $t('panel_settings.reinstall_confirm'),
                callback: async () => {
                    try {
                        await api.post('/api/setup/reinstall');
                        showToast($t('panel_settings.reinstall_success'));
                        setTimeout(() => { window.location.reload(); }, 2000);
                    } catch (e) {
                        showToast((e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        const openFabricModal = () => {
            selectedMc.value = '';
            selectedLoader.value = '';
            loaderVersions.value = [];
            fabricModalVisible.value = true;
            if (mcVersions.value.length === 0) fetchMcVersions();
        };

        const closeFabricModal = () => {
            fabricModalVisible.value = false;
        };

        const fetchCurrentVersion = async () => {
            try {
                const res = await api.get('/api/fabric/current-version');
                currentVersion.mc = res.data.mc;
                currentVersion.loader = res.data.loader;
            } catch (e) { }
        };

        const fetchMcVersions = async () => {
            loadingMcVersions.value = true;
            try {
                const res = await api.get('/api/fabric/versions/mc');
                mcVersions.value = res.data;
            } catch (e) {
                showToast($t('properties.fetch_versions_fail'), 'danger');
            } finally {
                loadingMcVersions.value = false;
            }
        };

        const fetchFabricLoaders = async () => {
            if (!selectedMc.value) return;
            loadingLoaderVersions.value = true;
            selectedLoader.value = '';
            loaderVersions.value = [];
            try {
                const res = await api.get(`/api/fabric/versions/loader?mc=${selectedMc.value}`);
                loaderVersions.value = res.data;
            } catch (e) {
                showToast($t('properties.fetch_versions_fail'), 'danger');
            } finally {
                loadingLoaderVersions.value = false;
            }
        };

        const changeFabricVersion = async () => {
            if (!selectedMc.value || !selectedLoader.value) return;
            openModal({
                title: $t('properties.change_version'),
                message: $t('properties.change_version_confirm', { mc: selectedMc.value, loader: selectedLoader.value }),
                callback: async () => {
                    fabricChanging.value = true;
                    closeFabricModal();
                    store.task.visible = true;
                    store.task.title = $t('properties.version_changing');
                    store.task.message = `${selectedMc.value} / ${selectedLoader.value}`;
                    store.task.percent = 0;
                    try {
                        await api.post('/api/fabric/change-version', { mc: selectedMc.value, loader: selectedLoader.value });
                        fabricChanging.value = false;
                        store.task.visible = false;
                        showToast($t('properties.version_change_success'));
                        fetchCurrentVersion();
                    } catch (e) {
                        fabricChanging.value = false;
                        store.task.visible = false;
                        showToast(e.response?.data?.error || $t('common.error'), 'danger');
                    }
                }
            });
        };

        const saveBackupStrategy = async () => {
            try {
                await api.post('/api/instances/update', {
                    id: store.currentInstanceId,
                    backupStrategy: backupStrategy.value
                });
                showToast($t('common.success'));
            } catch (err) {
                showToast($t('common.error'), 'danger');
            }
        };

        onMounted(() => {
            loadProperties();
            updateIconPreview();
            fetchCurrentVersion();
        });

        return {
            editMode, fileContent, formModel, notFound,
            saveConfig, toggleEditMode, iconUrl, iconInput,
            uploadIcon, deleteIcon, updateIconPreview, iconLoadError, hasCustomIcon,
            askReinstall, backupStrategy, saveBackupStrategy,
            currentVersion, mcVersions, loaderVersions, selectedMc, selectedLoader,
            loadingMcVersions, loadingLoaderVersions, fabricChanging, fabricModalVisible,
            openFabricModal, closeFabricModal, fetchFabricLoaders, changeFabricVersion, store,
            filterText, visibleGroups, getLabel, saving
        };
    }
};
