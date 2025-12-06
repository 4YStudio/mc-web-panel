import { ref, reactive, onMounted, watch, computed } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';
import Avatar from './Avatar.js'

// --- 正则工具 ---
const createRegex = (key) => new RegExp(`("^|\\n|\\s)${key}\\s*[:=]\\s*([^\\n#]+)`, 'm');

// --- Schema 定义 (保持不变) ---
const SCHEMAS = {
    'main.conf': [
        { title: '登录与会话', items: [{ key: 'premium-auto-login', label: '正版自动登录', type: 'boolean' }, { key: 'offline-by-default', label: '默认为离线玩家', type: 'boolean' }, { key: 'session-timeout', label: '会话保持(秒)', type: 'number' }, { key: 'max-login-tries', label: '最大尝试次数', type: 'number' }, { key: 'kick-timeout', label: '超时踢出(秒)', type: 'number' }] },
        { title: '全局密码', items: [{ key: 'enable-global-password', label: '启用全局密码', type: 'boolean' }, { key: 'single-use-global-password', label: '仅注册时使用', type: 'boolean' }] },
        { title: '其他', items: [{ key: 'hide-player-coords', label: '隐藏坐标', type: 'boolean' }, { key: 'debug', label: '调试模式', type: 'boolean' }] }
    ],
    'extended.conf': [
        { title: '未登录限制', items: [{ key: 'allow-chat', label: '允许聊天', type: 'boolean' }, { key: 'allow-commands', label: '允许指令', type: 'boolean' }, { key: 'allow-movement', label: '允许移动', type: 'boolean' }, { key: 'allow-block-interaction', label: '允许交互', type: 'boolean' }, { key: 'allow-block-breaking', label: '允许破坏', type: 'boolean' }, { key: 'hide-inventory', label: '隐藏背包', type: 'boolean' }, { key: 'player-invulnerable', label: '无敌模式', type: 'boolean' }] },
        { title: '规则', items: [{ key: 'min-password-length', label: '最小密码长度', type: 'number' }, { key: 'max-password-length', label: '最大密码长度', type: 'number' }, { key: 'username-regexp', label: '用户名正则', type: 'text' }] }
    ],
    'translation.conf': [{ title: '翻译', items: [{ key: 'enable-server-side-translation', label: '启用服务端翻译', type: 'boolean' }] }]
};

export default {
    components: { Avatar },
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>EasyAuth 认证管理</h3>
            <div v-if="currentTab === 'config'" class="btn-group">
                <button v-if="currentSchema" class="btn btn-outline-secondary" @click="toggleEditMode"><i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i> {{ editMode==='gui' ? '文本' : '图形' }}</button>
                <button class="btn btn-success" @click="saveConfig"><i class="fa-solid fa-save me-2"></i>保存配置</button>
            </div>
        </div>

        <ul class="nav nav-tabs mb-3">
            <li class="nav-item"><a class="nav-link" :class="{active: currentTab==='users'}" @click="currentTab='users'">用户管理</a></li>
            <li class="nav-item"><a class="nav-link" :class="{active: currentTab==='config'}" @click="currentTab='config'">配置管理</a></li>
        </ul>

        <!-- 1. 用户列表 -->
        <div v-if="currentTab === 'users'">
            <div class="input-group mb-3">
                <span class="input-group-text"><i class="fa-solid fa-search"></i></span>
                <input type="text" class="form-control" v-model="searchUser" placeholder="搜索玩家...">
                <button class="btn btn-outline-secondary" @click="loadUsers"><i class="fa-solid fa-rotate"></i> 刷新</button>
            </div>

            <div class="card shadow-sm">
                <table class="table table-hover align-middle mb-0">
                    <thead><tr><th>玩家</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
                        <tr v-for="user in filteredUsers" :key="user.username">
                             <td>
                                <div class="d-flex align-items-center">
                                    <avatar :player="user.username" :size="24" class="me-2"></avatar>
                                    {{ user.username }}
                                </div>
                            </td>
                            <td><span class="badge" :class="user.is_registered?'bg-success':'bg-warning'">{{ user.is_registered?'已注册':'未注册' }}</span></td>
                            <td>
                                <!-- 新增：修改密码按钮 -->
                                <button class="btn btn-sm btn-outline-primary me-2" @click="askChangePass(user.username)">
                                    <i class="fa-solid fa-key me-1"></i>密码
                                </button>
                                <button class="btn btn-sm btn-outline-danger" @click="askDeleteUser(user.username)">
                                    <i class="fa-solid fa-trash-can me-1"></i>注销
                                </button>
                            </td>
                        </tr>
                        <tr v-if="filteredUsers.length === 0"><td colspan="3" class="text-center text-muted py-3">无数据</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 2. 配置管理 -->
        <div v-if="currentTab === 'config'" class="row g-3" style="height: 65vh;">
            <div class="col-md-3 h-100">
                <div class="list-group h-100 overflow-auto shadow-sm">
                    <button v-for="file in configFiles" class="list-group-item list-group-item-action" :class="{active: currentFile===file}" @click="loadFile(file)"><i class="fa-regular fa-file-code me-2"></i>{{ file }}</button>
                </div>
            </div>
            <div class="col-md-9 h-100">
                <div v-if="editMode === 'text' || !currentSchema" class="card h-100 shadow-sm border-secondary-subtle">
                    <div class="card-header bg-body-tertiary small text-muted">{{ currentFile || '请选择文件' }}</div>
                    <textarea v-if="currentFile" class="form-control border-0 rounded-0 bg-body text-body h-100" style="font-family: monospace; resize: none;" v-model="fileContent" spellcheck="false"></textarea>
                </div>
                <div v-else class="h-100 overflow-auto pr-2">
                    <div class="row g-3">
                        <div class="col-md-12" v-for="(group, idx) in currentSchema" :key="idx">
                            <div class="card border-secondary-subtle">
                                <div class="card-header bg-body-tertiary fw-bold">{{ group.title }}</div>
                                <div class="card-body">
                                    <div v-for="item in group.items" :key="item.key" class="mb-3 row align-items-center">
                                        <label class="col-sm-5 col-form-label small">{{ item.label }}</label>
                                        <div class="col-sm-7">
                                            <div v-if="item.type === 'boolean'" class="form-check form-switch"><input class="form-check-input" type="checkbox" v-model="formModel[item.key]"></div>
                                            <input v-else-if="item.type === 'number'" type="number" class="form-control form-control-sm" v-model="formModel[item.key]">
                                            <select v-else-if="item.type === 'select'" class="form-select form-select-sm" v-model="formModel[item.key]"><option v-for="opt in item.options" :value="opt">{{ opt }}</option></select>
                                            <input v-else type="text" class="form-control form-control-sm" v-model="formModel[item.key]">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const currentTab = ref('users');
        const userList = ref([]);
        const searchUser = ref('');
        const configFiles = ref([]);
        const currentFile = ref('');
        const fileContent = ref('');
        const editMode = ref('text');
        const formModel = reactive({});
        const currentSchema = computed(() => SCHEMAS[currentFile.value] || null);

        const loadUsers = async () => { try { const res = await api.get('/api/easyauth/users'); userList.value = res.data; } catch (e) { showToast('DB错误', 'danger'); } };

        // --- 修改密码逻辑 ---
        const askChangePass = (username) => {
            openModal({
                title: `修改密码: ${username}`,
                message: '请输入该玩家的新密码 (建议大于4位):',
                mode: 'input',
                placeholder: '新密码...',
                callback: async (newPass) => {
                    if (!newPass) return;
                    try {
                        const res = await api.post('/api/easyauth/password', { username, password: newPass });
                        if (res.data.success) showToast('密码修改成功');
                        else showToast(res.data.message, 'warning');
                    } catch (e) { showToast('修改失败: ' + (e.response?.data?.error || e.message), 'danger'); }
                }
            });
        };

        const askDeleteUser = (username) => {
            openModal({
                title: '确认注销', message: `确定注销 [${username}] 吗？`,
                callback: async () => {
                    try {
                        const res = await api.post('/api/easyauth/delete', { username });
                        if (res.data.success) { showToast('已注销'); loadUsers(); } else showToast('失败', 'warning');
                    } catch (e) { showToast('失败', 'danger'); }
                }
            });
        };

        const loadFileList = async () => { try { const res = await api.get('/api/easyauth/configs'); configFiles.value = res.data; if (res.data.length && !currentFile.value) loadFile(res.data.find(f => f.includes('main')) || res.data[0]); } catch (e) { } };
        const loadFile = async (fn) => { try { const res = await api.get(`/api/files/content?path=config/EasyAuth/${fn}`); fileContent.value = res.data.content; currentFile.value = fn; if (currentSchema.value) { editMode.value = 'gui'; parseToGui(); } else { editMode.value = 'text'; } } catch (e) { } };

        const parseToGui = () => {
            const text = fileContent.value;
            currentSchema.value.forEach(g => g.items.forEach(i => {
                const match = text.match(createRegex(i.key));
                if (match) {
                    let v = match[2].trim().split('#')[0].trim().replace(/^['"](.*)['"]$/, '$1');
                    if (i.type === 'boolean') formModel[i.key] = (v === 'true');
                    else if (i.type === 'number') formModel[i.key] = Number(v);
                    else formModel[i.key] = v;
                } else formModel[i.key] = i.type === 'boolean' ? false : '';
            }));
        };
        const syncToText = () => {
            let text = fileContent.value;
            currentSchema.value.forEach(g => g.items.forEach(i => {
                if (formModel[i.key] !== undefined) text = text.replace(createRegex(i.key), (m, p) => p + String(formModel[i.key]));
            }));
            fileContent.value = text;
        };
        const saveConfig = async () => {
            if (!currentFile.value) return;
            if (editMode.value === 'gui') syncToText();
            try { await api.post('/api/files/save', { filepath: `config/EasyAuth/${currentFile.value}`, content: fileContent.value }); showToast('保存成功'); } catch (e) { showToast('失败', 'danger'); }
        };
        const toggleEditMode = () => { if (editMode.value === 'text') { parseToGui(); editMode.value = 'gui'; } else { syncToText(); editMode.value = 'text'; } };

        const filteredUsers = ref([]);
        watch([userList, searchUser], () => filteredUsers.value = userList.value.filter(u => u.username.toLowerCase().includes(searchUser.value.toLowerCase())));
        watch(currentTab, (val) => { if (val === 'users') loadUsers(); if (val === 'config') loadFileList(); });
        onMounted(loadUsers);

        return { currentTab, filteredUsers, searchUser, configFiles, currentFile, fileContent, editMode, currentSchema, formModel, loadUsers, askDeleteUser, askChangePass, loadFile, saveConfig, toggleEditMode };
    }
};