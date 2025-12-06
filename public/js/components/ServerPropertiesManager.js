import { ref, reactive, onMounted, watch } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../utils.js';

// --- 配置定义 (Schema) ---
// 定义哪些配置项需要在图形界面显示，以及它们的类型和说明
const PROP_GROUPS = [
    {
        title: '基础设置 (General)',
        items: [
            { key: 'motd', label: '服务器简介 (MOTD)', type: 'text', desc: '显示在多人游戏列表中的文字' },
            { key: 'server-port', label: '服务器端口', type: 'number', desc: '默认 25565' },
            { key: 'max-players', label: '最大玩家数', type: 'number' },
            { key: 'online-mode', label: '正版验证 (Online Mode)', type: 'boolean', desc: '开启则必须验证正版账号，关闭可允许离线登录' },
            { key: 'white-list', label: '启用白名单', type: 'boolean', desc: '开启后仅白名单内的玩家可进入' },
            { key: 'enable-rcon', label: '启用 RCON', type: 'boolean', desc: '允许远程控制台连接' }
        ]
    },
    {
        title: '游戏规则 (Gameplay)',
        items: [
            { key: 'gamemode', label: '默认游戏模式', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
            { key: 'force-gamemode', label: '强制游戏模式', type: 'boolean', desc: '玩家加入时是否强制切换为默认模式' },
            { key: 'difficulty', label: '难度', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
            { key: 'hardcore', label: '极限模式', type: 'boolean', desc: '死后无法重生' },
            { key: 'pvp', label: '允许 PVP', type: 'boolean', desc: '玩家之间是否可以互相攻击' },
            { key: 'allow-flight', label: '允许飞行', type: 'boolean', desc: '允许生存模式玩家使用飞行挂而不被踢出' }
        ]
    },
    {
        title: '世界生成 (World)',
        items: [
            { key: 'level-seed', label: '地图种子 (Seed)', type: 'text', desc: '留空则随机生成' },
            { key: 'level-type', label: '地图类型', type: 'select', options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified'] },
            { key: 'level-name', label: '存档文件夹名', type: 'text', desc: '默认 world' },
            { key: 'generate-structures', label: '生成建筑', type: 'boolean', desc: '村庄、地牢等' },
            { key: 'allow-nether', label: '允许进入下界', type: 'boolean' }
        ]
    },
    {
        title: '生成控制 (Spawning)',
        items: [
            { key: 'spawn-monsters', label: '生成怪物', type: 'boolean' },
            { key: 'spawn-animals', label: '生成动物', type: 'boolean' },
            { key: 'spawn-npcs', label: '生成村民 (NPC)', type: 'boolean' },
            { key: 'difficulty', label: '难度', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] }
        ]
    },
    {
        title: '性能与网络 (Network)',
        items: [
            { key: 'view-distance', label: '视距 (Chunks)', type: 'number', min: 2, max: 32 },
            { key: 'simulation-distance', label: '模拟距离', type: 'number', min: 2, max: 32 },
            { key: 'max-tick-time', label: '最大 Tick 时间', type: 'number', desc: '设为 -1 可防止 watchdog 自动关闭服务器' },
            { key: 'rate-limit', label: '踢出刷屏玩家', type: 'number', desc: '0 为禁用' }
        ]
    }
];

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>服务器配置 (server.properties)</h3>
            <div class="btn-group">
                <button class="btn btn-outline-secondary" @click="toggleEditMode">
                    <i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i>
                    {{ editMode==='gui' ? '切换文本模式' : '切换图形模式' }}
                </button>
                <button class="btn btn-success" @click="saveConfig">
                    <i class="fa-solid fa-save me-2"></i>保存配置
                </button>
            </div>
        </div>

        <!-- 服务器图标管理 -->
        <div class="card mb-4 border-secondary-subtle">
            <div class="card-header bg-body-tertiary fw-bold">服务器图标 (Server Icon)</div>
            <div class="card-body d-flex align-items-center gap-4">
                <div class="position-relative">
                    <img :src="iconUrl" class="rounded border" width="64" height="64" style="object-fit: cover;" @error="iconLoadError">
                </div>
                <div>
                    <div class="mb-2 text-muted small">建议尺寸: 64x64 PNG</div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" @click="$refs.iconInput.click()">
                            <i class="fa-solid fa-upload me-1"></i>上传图标
                        </button>
                        <button class="btn btn-sm btn-outline-danger" @click="deleteIcon">
                            <i class="fa-solid fa-trash me-1"></i>重置
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

        const updateIconPreview = () => {
            iconUrl.value = `/api/server/icon?t=${store.serverIconVersion}`;
        }
        const iconLoadError = (e) => {
            // Fallback placeholder if no icon
            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBmaWxsPSIjNjg3NjhiIiBkPSJNMCUyNTZDMCUyNTYlMjAyNTYuc3ZnIi8+'; // Just a blank or keep broken? Better to use a placeholder or detect error.
            // Actually, let's just use the FontAwesome logic in sidebar, but here we expect an image.
            // Let's use a generic placeholder URL or a base64 gray box.
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
                showToast('图标上传成功');
                store.serverIconVersion = Date.now();
                e.target.value = '';
            } catch (err) { showToast('上传失败', 'danger'); }
        };

        const deleteIcon = async () => {
            if (!confirm('确定要重置图标吗？')) return;
            try {
                await api.delete('/api/server/icon');
                showToast('图标已重置');
                store.serverIconVersion = Date.now();
            } catch (err) { showToast('重置失败', 'danger'); }
        };

        // 正则：匹配 key=value (兼容空格)
        const createRegex = (key) => new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm');

        const loadFile = async () => {
            try {
                const res = await api.get(`/api/files/content?path=${FILE_PATH}`);
                fileContent.value = res.data.content;
                parseToGui();
            } catch (e) {
                fileContent.value = '# 无法读取 server.properties';
                showToast('读取失败', 'danger');
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
                showToast('配置已保存 (需重启服务器)');
            } catch (e) { showToast('保存失败', 'danger'); }
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