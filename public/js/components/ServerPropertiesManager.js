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
            <h3>{{ $t('properties.title') }}</h3>
            <div class="btn-group">
                <button class="btn btn-outline-secondary" @click="toggleEditMode">
                    <i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i>
                    {{ editMode==='gui' ? 'Text Mode' : 'GUI Mode' }}
                </button>
                <button class="btn btn-success" @click="saveConfig">
                    <i class="fa-solid fa-save me-2"></i>{{ $t('common.save') }}
                </button>
            </div>
        </div>

        <!-- 服务器图标管理 -->
        <div class="card mb-4 border-secondary-subtle">
            <div class="card-header bg-body-tertiary fw-bold">{{ $t('properties.server_icon') }}</div>
            <div class="card-body d-flex align-items-center gap-4">
                <div class="position-relative">
                    <img v-show="hasCustomIcon" :src="iconUrl" class="rounded border" width="64" height="64" style="object-fit: cover;" @load="hasCustomIcon=true" @error="iconLoadError">
                    <div v-if="!hasCustomIcon" class="rounded border d-flex align-items-center justify-content-center bg-body-secondary text-muted" style="width: 64px; height: 64px;">
                        <i class="fa-solid fa-cube fa-2x opacity-50"></i>
                    </div>
                </div>
                <div>
                    <div class="mb-2 text-muted small">{{ $t('properties.icon_tips') }}</div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" @click="$refs.iconInput.click()">
                            <i class="fa-solid fa-upload me-1"></i>{{ $t('common.upload') }}
                        </button>
                        <button class="btn btn-sm btn-outline-danger" @click="deleteIcon" :disabled="!hasCustomIcon">
                            <i class="fa-solid fa-trash me-1"></i>{{ $t('common.delete') }}
                        </button>
                    </div>
                    <input type="file" ref="iconInput" class="d-none" accept="image/png" @change="uploadIcon">
                </div>
            </div>
        </div>

        <!-- 图形化编辑器 -->
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
    </div>
    `,
    setup() {
        const editMode = ref('gui');
        const fileContent = ref('');
        const formModel = reactive({});
        const FILE_PATH = 'server.properties';
        const iconUrl = ref('/api/server/icon');
        const iconInput = ref(null);
        const hasCustomIcon = ref(false);
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

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
            } catch (err) { showToast('Error', 'danger'); }
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
                        // Show actual error message from server if available
                        const msg = err.response?.data?.error || err.message || 'Error';
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
                parseToGui();
            } catch (e) {
                fileContent.value = '# Error reading server.properties';
                showToast($t('common.error'), 'danger');
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

        onMounted(() => {
            loadFile();
            updateIconPreview();
        });

        return {
            editMode, fileContent, formModel, PROP_GROUPS,
            saveConfig, toggleEditMode, iconUrl, iconInput,
            uploadIcon, deleteIcon, updateIconPreview, iconLoadError, hasCustomIcon
        };
    }
};