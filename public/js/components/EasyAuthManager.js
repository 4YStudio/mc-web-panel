import { ref, reactive, onMounted, watch, computed, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';
import Avatar from './Avatar.js'

// --- 正则工具 ---
const createRegex = (key) => new RegExp(`("^|\\n|\\s)${key}\\s*[:=]\\s*([^\\n#]+)`, 'm');

// --- Schema 定义 (保持不变) ---
// Keys should remain as is, Labels could be i18n keys if we support config translation, but keeping it simple for now.
// Will rely on users understanding English config terms or update them later.
const SCHEMAS = {
    'main.conf': [
        { titleKey: 'easyauth.config_groups.login_session', items: [{ key: 'premium-auto-login', labelKey: 'easyauth.config_labels.premium_auto_login', type: 'boolean' }, { key: 'offline-by-default', labelKey: 'easyauth.config_labels.offline_by_default', type: 'boolean' }, { key: 'session-timeout', labelKey: 'easyauth.config_labels.session_timeout', type: 'number' }, { key: 'max-login-tries', labelKey: 'easyauth.config_labels.max_login_tries', type: 'number' }, { key: 'kick-timeout', labelKey: 'easyauth.config_labels.kick_timeout', type: 'number' }] },
        { titleKey: 'easyauth.config_groups.global_password', items: [{ key: 'enable-global-password', labelKey: 'easyauth.config_labels.enable_global_password', type: 'boolean' }, { key: 'single-use-global-password', labelKey: 'easyauth.config_labels.single_use_global_password', type: 'boolean' }] },
        { titleKey: 'easyauth.config_groups.others', items: [{ key: 'hide-player-coords', labelKey: 'easyauth.config_labels.hide_player_coords', type: 'boolean' }, { key: 'debug', labelKey: 'easyauth.config_labels.debug', type: 'boolean' }] }
    ],
    'extended.conf': [
        { titleKey: 'easyauth.config_groups.restrictions', items: [{ key: 'allow-chat', labelKey: 'easyauth.config_labels.allow_chat', type: 'boolean' }, { key: 'allow-commands', labelKey: 'easyauth.config_labels.allow_commands', type: 'boolean' }, { key: 'allow-movement', labelKey: 'easyauth.config_labels.allow_movement', type: 'boolean' }, { key: 'allow-block-interaction', labelKey: 'easyauth.config_labels.allow_block_interaction', type: 'boolean' }, { key: 'allow-block-breaking', labelKey: 'easyauth.config_labels.allow_block_breaking', type: 'boolean' }, { key: 'hide-inventory', labelKey: 'easyauth.config_labels.hide_inventory', type: 'boolean' }, { key: 'player-invulnerable', labelKey: 'easyauth.config_labels.player_invulnerable', type: 'boolean' }] },
        { titleKey: 'easyauth.config_groups.rules', items: [{ key: 'min-password-length', labelKey: 'easyauth.config_labels.min_password_length', type: 'number' }, { key: 'max-password-length', labelKey: 'easyauth.config_labels.max_password_length', type: 'number' }, { key: 'username-regexp', labelKey: 'easyauth.config_labels.username_regexp', type: 'text' }] }
    ],
    'translation.conf': [{ titleKey: 'easyauth.config_groups.others', items: [{ key: 'enable-server-side-translation', labelKey: 'easyauth.config_labels.enable_server_side_translation', type: 'boolean' }] }]
};

export default {
    components: { Avatar },
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>EasyAuth</h3>
            <div v-if="currentTab === 'config'" class="btn-group">
                <button v-if="currentSchema" class="btn btn-outline-secondary" @click="toggleEditMode"><i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i> {{ editMode==='gui' ? 'Text' : 'GUI' }}</button>
                <button class="btn btn-success" @click="saveConfig"><i class="fa-solid fa-save me-2"></i>{{ $t('common.save') }}</button>
            </div>
        </div>

        <ul class="nav nav-tabs mb-3">
            <li class="nav-item"><a class="nav-link" :class="{active: currentTab==='users'}" @click="currentTab='users'">{{ $t('easyauth.users') }}</a></li>
            <li class="nav-item"><a class="nav-link" :class="{active: currentTab==='config'}" @click="currentTab='config'">{{ $t('easyauth.config') }}</a></li>
        </ul>

        <!-- 1. 用户列表 -->
        <div v-if="currentTab === 'users'">
            <div class="input-group mb-3">
                <span class="input-group-text"><i class="fa-solid fa-search"></i></span>
                <input type="text" class="form-control" v-model="searchUser" :placeholder="$t('common.search') + '...'">
                <button class="btn btn-outline-secondary" @click="loadUsers"><i class="fa-solid fa-rotate"></i> {{ $t('common.refresh') }}</button>
            </div>

            <div class="card shadow-sm">
                <table class="table table-hover align-middle mb-0">
                    <thead><tr><th>{{ $t('common.player') }}</th><th>{{ $t('common.status') }}</th><th>{{ $t('common.actions') }}</th></tr></thead>
                    <tbody>
                        <tr v-for="user in filteredUsers" :key="user.username">
                             <td>
                                <div class="d-flex align-items-center">
                                    <avatar :player="user.username" :size="24" class="me-2"></avatar>
                                    {{ user.username }}
                                </div>
                            </td>
                            <td><span class="badge" :class="user.is_registered?'bg-success':'bg-warning'">{{ user.is_registered ? $t('easyauth.registered') : $t('easyauth.unregistered') }}</span></td>
                            <td>
                                <!-- 新增：修改密码按钮 -->
                                <button class="btn btn-sm btn-outline-primary me-2" @click="askChangePass(user.username)">
                                    <i class="fa-solid fa-key me-1"></i>{{ $t('easyauth.password') }}
                                </button>
                                <button class="btn btn-sm btn-outline-danger" @click="askDeleteUser(user.username)">
                                    <i class="fa-solid fa-trash-can me-1"></i>{{ $t('easyauth.unregister') }}
                                </button>
                            </td>
                        </tr>
                        <tr v-if="filteredUsers.length === 0"><td colspan="3" class="text-center text-muted py-3">{{ $t('mods.empty') }}</td></tr>
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
                <Transition name="fade" mode="out-in">
                    <div v-if="editMode === 'text' || !currentSchema" class="card h-100 shadow-sm border-secondary-subtle" key="text">
                        <div class="card-header bg-body-tertiary small text-muted">{{ currentFile || 'Select File' }}</div>
                        <textarea v-if="currentFile" class="form-control border-0 rounded-0 bg-body text-body h-100" style="font-family: monospace; resize: none;" v-model="fileContent" spellcheck="false"></textarea>
                    </div>
                    <div v-else class="h-100 overflow-auto pr-2" key="gui">
                        <div class="row g-3">
                            <div class="col-md-12" v-for="(group, idx) in currentSchema" :key="idx">
                                <div class="card border-secondary-subtle">
                                    <div class="card-header bg-body-tertiary fw-bold">{{ $t(group.titleKey) }}</div>
                                    <div class="card-body">
                                        <div v-for="item in group.items" :key="item.key" class="mb-3 row align-items-center">
                                            <label class="col-sm-5 col-form-label small">{{ $t(item.labelKey) }}</label>
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
                </Transition>
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
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const loadUsers = async () => { try { const res = await api.get('/api/easyauth/users'); userList.value = res.data; } catch (e) { showToast($t('common.error'), 'danger'); } };

        // --- 修改密码逻辑 ---
        const askChangePass = (username) => {
            openModal({
                title: `${$t('easyauth.password')}: ${username}`,
                message: $t('easyauth.new_password_prompt'),
                mode: 'input',
                placeholder: $t('easyauth.new_password_placeholder'),
                callback: async (newPass) => {
                    if (!newPass) return;
                    try {
                        const res = await api.post('/api/easyauth/password', { username, password: newPass });
                        if (res.data.success) showToast($t('common.success'));
                        else showToast(res.data.message, 'warning');
                    } catch (e) { showToast('Error: ' + (e.response?.data?.error || e.message), 'danger'); }
                }
            });
        };

        const askDeleteUser = (username) => {
            openModal({
                title: $t('common.confirm'),
                message: `${$t('easyauth.confirm_unregister')} [${username}]?`,
                callback: async () => {
                    try {
                        const res = await api.post('/api/easyauth/delete', { username });
                        if (res.data.success) { showToast($t('common.success')); loadUsers(); } else showToast('Failed', 'warning');
                    } catch (e) { showToast('Failed', 'danger'); }
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
            try { await api.post('/api/files/save', { filepath: `config/EasyAuth/${currentFile.value}`, content: fileContent.value }); showToast($t('common.success')); } catch (e) { showToast($t('common.error'), 'danger'); }
        };
        const toggleEditMode = () => { if (editMode.value === 'text') { parseToGui(); editMode.value = 'gui'; } else { syncToText(); editMode.value = 'text'; } };

        const filteredUsers = ref([]);
        watch([userList, searchUser], () => filteredUsers.value = userList.value.filter(u => u.username.toLowerCase().includes(searchUser.value.toLowerCase())));
        watch(currentTab, (val) => { if (val === 'users') loadUsers(); if (val === 'config') loadFileList(); });
        onMounted(loadUsers);

        return { currentTab, filteredUsers, searchUser, configFiles, currentFile, fileContent, editMode, currentSchema, formModel, loadUsers, askDeleteUser, askChangePass, loadFile, saveConfig, toggleEditMode };
    }
};