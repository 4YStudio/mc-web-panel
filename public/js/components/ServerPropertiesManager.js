import { ref, reactive, onMounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../utils.js';

// --- 配置定义 (Schema) ---
// Keys for i18n, descriptions removed for brevity or need keys too.
// I'll assume users accept English for direct property keys, but sections can be translated.
// Actually, I can wrap the whole PROP_GROUPS in a function or just use Title keys.
const PROP_GROUPS = [
    {
        title: '基础设置 (General)',
        items: [
            { key: 'motd', label: 'Motd', type: 'text' },
            { key: 'server-port', label: 'Port', type: 'number' },
            { key: 'max-players', label: 'Max Players', type: 'number' },
            { key: 'online-mode', label: 'Online Mode', type: 'boolean' },
            { key: 'white-list', label: 'White List', type: 'boolean' },
            { key: 'enable-rcon', label: 'Enable RCON', type: 'boolean' }
        ]
    },
    {
        title: '游戏规则 (Gameplay)',
        items: [
            { key: 'gamemode', label: 'Gamemode', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
            { key: 'force-gamemode', label: 'Force Gamemode', type: 'boolean' },
            { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
            { key: 'hardcore', label: 'Hardcore', type: 'boolean' },
            { key: 'pvp', label: 'PVP', type: 'boolean' },
            { key: 'allow-flight', label: 'Allow Flight', type: 'boolean' }
        ]
    },
    {
        title: '世界生成 (World)',
        items: [
            { key: 'level-seed', label: 'Seed', type: 'text' },
            { key: 'level-type', label: 'Level Type', type: 'select', options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified'] },
            { key: 'level-name', label: 'Level Name', type: 'text' },
            { key: 'generate-structures', label: 'Generate Structures', type: 'boolean' },
            { key: 'allow-nether', label: 'Allow Nether', type: 'boolean' }
        ]
    },
    {
        title: '生成控制 (Spawning)',
        items: [
            { key: 'spawn-monsters', label: 'Spawn Monsters', type: 'boolean' },
            { key: 'spawn-animals', label: 'Spawn Animals', type: 'boolean' },
            { key: 'spawn-npcs', label: 'Spawn NPCs', type: 'boolean' },
            { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] }
        ]
    },
    {
        title: '性能与网络 (Network)',
        items: [
            { key: 'view-distance', label: 'View Distance', type: 'number', min: 2, max: 32 },
            { key: 'simulation-distance', label: 'Sim Distance', type: 'number', min: 2, max: 32 },
            { key: 'max-tick-time', label: 'Max Tick Time', type: 'number' },
            { key: 'rate-limit', label: 'Rate Limit', type: 'number' }
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
            <div class="card-header bg-body-tertiary fw-bold">Server Icon</div>
            <div class="card-body d-flex align-items-center gap-4">
                <div class="position-relative">
                    <img :src="iconUrl" class="rounded border" width="64" height="64" style="object-fit: cover;" @error="iconLoadError">
                </div>
                <div>
                    <div class="mb-2 text-muted small">64x64 PNG</div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" @click="$refs.iconInput.click()">
                            <i class="fa-solid fa-upload me-1"></i>{{ $t('common.upload') }}
                        </button>
                        <button class="btn btn-sm btn-outline-danger" @click="deleteIcon">
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
                    <div class="card-header bg-body-tertiary fw-bold">{{ group.title }}</div>
                    <div class="card-body">
                        <div v-for="item in group.items" :key="item.key" class="mb-3 row align-items-center">
                            <label class="col-sm-5 col-form-label small">{{ item.label }}</label>
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
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const updateIconPreview = () => {
            iconUrl.value = `/api/server/icon?t=${store.serverIconVersion}`;
        }
        const iconLoadError = (e) => {
            e.target.style.display = 'none'; // Hide if broken, but we need structure. 
            // Better: reset to a placeholder image.
            e.target.src = '/favicon.ico'; // Temporary fallback or similar
            e.target.style.display = 'block';
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
            if (!confirm('Reset Icon?')) return;
            try {
                await api.delete('/api/server/icon');
                showToast($t('common.success'));
                store.serverIconVersion = Date.now();
            } catch (err) { showToast('Error', 'danger'); }
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
            uploadIcon, deleteIcon, updateIconPreview, iconLoadError
        };
    }
};