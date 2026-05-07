import { ref, reactive, onMounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

// --- 配置定义 (Schema) ---
// Keys for i18n, descriptions removed for brevity or need keys too.
// I'll assume users accept English for direct property keys, but sections can be translated.
// Actually, I can wrap the whole PROP_GROUPS in a function or just use Title keys.
const PROP_GROUPS = [
    {
        titleKey: 'properties.groups.general',
        items: [
            { key: 'motd', labelKey: 'properties.labels.motd', type: 'text' },
            { key: 'server-port', labelKey: 'properties.labels.port', type: 'number' },
            { key: 'max-players', labelKey: 'properties.labels.max_players', type: 'number' },
            { key: 'online-mode', labelKey: 'properties.labels.online_mode', type: 'boolean' },
            { key: 'white-list', labelKey: 'properties.labels.white_list', type: 'boolean' },
            { key: 'enable-rcon', labelKey: 'properties.labels.enable_rcon', type: 'boolean' }
        ]
    },
    {
        titleKey: 'properties.groups.gameplay',
        items: [
            { key: 'gamemode', labelKey: 'properties.labels.gamemode', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
            { key: 'force-gamemode', labelKey: 'properties.labels.force_gamemode', type: 'boolean' },
            { key: 'difficulty', labelKey: 'properties.labels.difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
            { key: 'hardcore', labelKey: 'properties.labels.hardcore', type: 'boolean' },
            { key: 'pvp', labelKey: 'properties.labels.pvp', type: 'boolean' },
            { key: 'allow-flight', labelKey: 'properties.labels.allow_flight', type: 'boolean' }
        ]
    },
    {
        titleKey: 'properties.groups.world',
        items: [
            { key: 'level-seed', labelKey: 'properties.labels.level_seed', type: 'text' },
            { key: 'level-type', labelKey: 'properties.labels.level_type', type: 'select', options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified'] },
            { key: 'level-name', labelKey: 'properties.labels.level_name', type: 'text' },
            { key: 'generate-structures', labelKey: 'properties.labels.generate_structures', type: 'boolean' },
            { key: 'allow-nether', labelKey: 'properties.labels.allow_nether', type: 'boolean' }
        ]
    },
    {
        titleKey: 'properties.groups.spawning',
        items: [
            { key: 'spawn-monsters', labelKey: 'properties.labels.spawn_monsters', type: 'boolean' },
            { key: 'spawn-animals', labelKey: 'properties.labels.spawn_animals', type: 'boolean' },
            { key: 'spawn-npcs', labelKey: 'properties.labels.spawn_npcs', type: 'boolean' },
            { key: 'difficulty', labelKey: 'properties.labels.difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] }
        ]
    },
    {
        titleKey: 'properties.groups.network',
        items: [
            { key: 'view-distance', labelKey: 'properties.labels.view_distance', type: 'number', min: 2, max: 32 },
            { key: 'simulation-distance', labelKey: 'properties.labels.simulation_distance', type: 'number', min: 2, max: 32 },
            { key: 'max-tick-time', labelKey: 'properties.labels.max_tick_time', type: 'number' },
            { key: 'rate-limit', labelKey: 'properties.labels.rate_limit', type: 'number' }
        ]
    }
];

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="m-0 fw-bold">{{ $t('properties.title').split(' (')[0] }}</h3>
            <div class="btn-group" v-if="!notFound">
                <button class="btn btn-outline-secondary" @click="toggleEditMode">
                    <i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i>
                    <span class="d-none d-md-inline ms-1">{{ editMode==='gui' ? 'Text Mode' : 'GUI Mode' }}</span>
                </button>
                <button class="btn btn-success" @click="saveConfig">
                    <i class="fa-solid fa-save me-0 me-md-2"></i><span class="d-none d-md-inline">{{ $t('common.save') }}</span>
                </button>
            </div>
        </div>

        <!-- 文件未找到提示 -->
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
            <!-- 服务器图标管理 -->
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
                        <div class="mb-2 text-muted small">{{ $t('properties.icon_tips') }}</div>
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

            <!-- 编辑区域 -->
            <div v-if="editMode === 'gui'" class="row g-4 pb-4">
                <div class="col-md-6" v-for="(group, idx) in PROP_GROUPS" :key="idx">
                    <div class="card h-100 border-secondary">
                        <div class="card-header bg-body-tertiary fw-bold">{{ $t(group.titleKey) }}</div>
                        <div class="card-body">
                            <div v-for="item in group.items" :key="item.key" class="mb-3 row align-items-center">
                                <label class="col-sm-5 col-form-label small">{{ $t(item.labelKey) }}</label>
                                <div class="col-sm-7">
                                    
                                    <!-- Boolean -->
                                    <div v-if="item.type === 'boolean'" class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" v-model="formModel[item.key]">
                                    </div>
                                    
                                    <!-- Select -->
                                    <select v-else-if="item.type === 'select'" class="form-select form-select-sm" v-model="formModel[item.key]">
                                        <option v-for="opt in item.options" :value="opt">{{ opt }}</option>
                                    </select>

                                    <!-- Number/Text -->
                                    <input v-else :type="item.type" class="form-control form-control-sm" v-model="formModel[item.key]">
                                    
                                    <div v-if="item.desc" class="form-text text-secondary small" style="font-size: 0.75rem;">{{ item.desc }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 备份策略 -->
                <div class="col-md-6">
                    <div class="card h-100 border-primary-subtle shadow-sm overflow-hidden" style="border-radius: 12px;">
                        <div class="card-header bg-primary-subtle text-primary fw-bold border-0 py-2 px-3 small text-uppercase">
                            <i class="fa-solid fa-clock-rotate-left me-2"></i>{{ $t('map_backup.strategy') }}
                        </div>
                        <div class="card-body p-3 d-flex flex-column">
                            <div class="mb-3 flex-grow-1">
                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('map_backup.strategy') }}</label>
                                <select class="form-select border-0 bg-body-tertiary fw-bold" v-model="backupStrategy">
                                    <option value="panel">{{ $t('map_backup.strategy_panel') }}</option>
                                    <option value="mod">{{ $t('map_backup.strategy_mod') }}</option>
                                </select>
                                <div class="form-text small mt-2 opacity-75" style="font-size: 0.75rem;">
                                    <i class="fa-solid fa-circle-info me-1"></i>
                                    {{ backupStrategy === 'mod' ? $t('backups.tips') : $t('map_backup.panel_tips') }}
                                </div>
                            </div>
                            <button class="btn btn-primary w-100 rounded-pill fw-bold shadow-sm mt-auto" @click="saveBackupStrategy">
                                <i class="fa-solid fa-save me-2"></i>{{ $t('common.save') }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Fabric 核心版本 (左下角) -->
                <div class="col-md-6">
                    <div class="card h-100 border-info-subtle shadow-sm overflow-hidden" style="border-radius: 12px;">
                        <div class="card-header bg-info-subtle text-info fw-bold border-0 py-2 px-3 small text-uppercase">
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

                <!-- 危险区域 (右下角) -->
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

            <!-- 文本编辑器 -->
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

        <!-- Fabric 版本选择对话框 -->
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
                            <select class="form-select" v-model="selectedMc" @change="fetchFabricLoaders" :disabled="loadingMcVersions">
                                <option value="">{{ loadingMcVersions ? $t('common.loading') : $t('properties.choose_mc') }}</option>
                                <option v-for="v in mcVersions" :key="v" :value="v">{{ v }}</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold small">
                                <i class="fa-solid fa-gear me-1"></i>{{ $t('properties.target_loader') }}
                                <span v-if="loadingLoaderVersions" class="spinner-border spinner-border-sm text-primary ms-1" role="status"></span>
                            </label>
                            <select class="form-select" v-model="selectedLoader" :disabled="loadingLoaderVersions || !selectedMc">
                                <option value="">{{ loadingLoaderVersions ? $t('common.loading') : $t('properties.choose_loader') }}</option>
                                <option v-for="v in loaderVersions" :key="v" :value="v">{{ v }}</option>
                            </select>
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
        const FILE_PATH = 'server.properties';
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
            loaderVersions.value = [];
            selectedLoader.value = '';
            loadingLoaderVersions.value = true;
            try {
                const res = await api.get(`/api/fabric/versions/loader/${selectedMc.value}`);
                loaderVersions.value = res.data;
                if (res.data.length > 0) selectedLoader.value = res.data[0];
            } catch (e) {
                showToast($t('properties.fetch_versions_fail'), 'danger');
            } finally {
                loadingLoaderVersions.value = false;
            }
        };

        const changeFabricVersion = () => {
            openModal({
                title: $t('properties.change_version'),
                message: $t('properties.change_version_confirm', { mc: selectedMc.value, loader: selectedLoader.value }),
                callback: async () => {
                    fabricChanging.value = true;
                    try {
                        await api.post('/api/fabric/change-version', {
                            gameVersion: selectedMc.value,
                            loaderVersion: selectedLoader.value
                        });
                        showToast($t('properties.version_changing'), 'info');
                        let checks = 0;
                        const interval = setInterval(async () => {
                            checks++;
                            try {
                                const res = await api.get('/api/fabric/current-version');
                                if (res.data.mc === selectedMc.value && res.data.loader === selectedLoader.value) {
                                    clearInterval(interval);
                                    fabricChanging.value = false;
                                    currentVersion.mc = res.data.mc;
                                    currentVersion.loader = res.data.loader;
                                    fabricModalVisible.value = false;
                                    showToast($t('properties.version_change_success'), 'success');
                                }
                            } catch (e) { }
                            if (checks > 60) {
                                clearInterval(interval);
                                fabricChanging.value = false;
                                showToast($t('properties.version_change_timeout'), 'warning');
                                fetchCurrentVersion();
                            }
                        }, 2000);
                    } catch (e) {
                        fabricChanging.value = false;
                        const msg = e.response?.data?.error || e.message;
                        showToast(msg, 'danger');
                    }
                }
            });
        };

        const updateIconPreview = () => {
            // Force reload with timestamp. We assume it might exist, or let error handler catch it.
            // Resetting hasCustomIcon to true optimistically? No, better let the img load event decide.
            // But if we deleted it, we know it's gone.
            iconUrl.value = `/api/server/icon?t=${store.serverIconVersion}`;
        }
        const iconLoadError = (e) => {
            hasCustomIcon.value = false;
        };

        // Watch global version
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

        // 正则：匹配 key=value (兼容空格)
        const createRegex = (key) => new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm');

        const loadFile = async () => {
            try {
                const res = await api.get(`/api/files/content?path=${FILE_PATH}`);
                fileContent.value = res.data.content;
                notFound.value = false;
                parseToGui();
            } catch (e) {
                if (e.response?.status === 404) {
                    notFound.value = true;
                } else {
                    fileContent.value = '# Error reading server.properties';
                    showToast($t('common.error'), 'danger');
                }
            }
        };

        // 解析文本到 GUI 模型
        const parseToGui = () => {
            const text = fileContent.value;
            PROP_GROUPS.forEach(group => {
                group.items.forEach(item => {
                    const match = text.match(createRegex(item.key));
                    if (match) {
                        let valStr = match[1].trim();
                        if (item.type === 'boolean') formModel[item.key] = (valStr === 'true');
                        else if (item.type === 'number') formModel[item.key] = Number(valStr);
                        else formModel[item.key] = valStr;
                    } else {
                        // 默认值处理
                        formModel[item.key] = item.type === 'boolean' ? false : '';
                    }
                });
            });
        };

        // 将 GUI 模型回写到文本 (保留注释)
        const syncToText = () => {
            let text = fileContent.value;
            // 记录哪些key已经被替换
            const updatedKeys = new Set();

            PROP_GROUPS.forEach(group => {
                group.items.forEach(item => {
                    if (formModel[item.key] !== undefined) {
                        const regex = createRegex(item.key);
                        if (regex.test(text)) {
                            // 替换现有行
                            text = text.replace(regex, `${item.key}=${formModel[item.key]}`);
                            updatedKeys.add(item.key);
                        } else {
                            // 如果原文件中没有这个key，追加到末尾
                            text += `\n${item.key}=${formModel[item.key]}`;
                        }
                    }
                });
            });
            fileContent.value = text;
        };

        const saveConfig = async () => {
            if (editMode.value === 'gui') syncToText();
            try {
                await api.post('/api/files/save', { filepath: FILE_PATH, content: fileContent.value });
                showToast($t('properties.restart_tips'));
            } catch (e) { showToast($t('common.error'), 'danger'); }
        };

        const toggleEditMode = () => {
            if (editMode.value === 'text') {
                parseToGui();
                editMode.value = 'gui';
            } else {
                syncToText();
                editMode.value = 'text';
            }
        };

        const askReinstall = () => {
            openModal({
                title: $t('panel_settings.reinstall'),
                message: $t('panel_settings.reinstall_confirm'),
                callback: async () => {
                    try {
                        await api.post('/api/setup/reinstall');
                        showToast($t('panel_settings.reinstall_success'));
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    } catch (e) {
                        showToast((e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        onMounted(() => {
            loadFile();
            updateIconPreview();
            fetchCurrentVersion();
        });



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

        return {
            editMode, fileContent, formModel, PROP_GROUPS, notFound,
            saveConfig, toggleEditMode, iconUrl, iconInput,
            uploadIcon, deleteIcon, updateIconPreview, iconLoadError, hasCustomIcon,
            askReinstall, backupStrategy, saveBackupStrategy,
            currentVersion, mcVersions, loaderVersions, selectedMc, selectedLoader,
            loadingMcVersions, loadingLoaderVersions, fabricChanging, fabricModalVisible,
            openFabricModal, closeFabricModal, fetchFabricLoaders, changeFabricVersion, store
        };
    }
};