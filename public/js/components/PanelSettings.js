import { ref, reactive, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, waitForPanel } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column animate-in overflow-hidden">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-3 mb-md-4 px-1 flex-shrink-0">
            <div class="d-flex align-items-center overflow-hidden">
                <button @click="store.view = 'instance-manager'" class="btn-back me-3">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <h3 class="m-0 fw-bold d-flex align-items-center text-truncate">
                    <i class="fa-solid fa-sliders me-2 me-md-3 text-primary d-none d-md-inline"></i>
                    <span>{{ $t('panel_settings.title') }}</span>
                </h3>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-success btn-sm px-3 px-md-4 py-2 fw-bold shadow-sm" @click="saveConfig" :disabled="saving" style="border-radius: 12px;">
                    <i class="fa-solid fa-save me-md-2"></i><span class="d-none d-md-inline">{{ $t('common.save') }}</span>
                </button>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted fw-medium">{{ $t('common.loading') }}</p>
        </div>

        <div v-else class="row g-3 g-md-4 overflow-auto custom-scrollbar pb-5">
            <!-- 基础设置 -->
            <div class="col-md-6">
                <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px;">
                    <div class="card-header bg-primary-subtle text-primary border-0 fw-bold py-2 py-md-3 px-3 px-md-4" style="border-radius: 16px 16px 0 0;">
                        <i class="fa-solid fa-sliders me-2"></i>{{ $t('panel_settings.basic') }}
                    </div>
                    <div class="card-body p-3 p-md-4">
                        <div class="mb-3 mb-md-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.port') }}</label>
                            <input type="number" class="form-control" v-model.number="config.port" min="1024" max="65535">
                            <div class="form-text small opacity-75" style="font-size: 0.7rem;">{{ $t('panel_settings.port_desc') }}</div>
                        </div>
                        
                        <div class="mb-3 mb-md-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.default_lang') }}</label>
                            <select class="form-select" v-model="config.defaultLang">
                                <option value="zh">中文</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                        
                        <div class="mb-3 mb-md-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.theme') }}</label>
                            <select class="form-select" v-model="config.theme">
                                <option value="light">{{ $t('panel_settings.theme_light') }}</option>
                                <option value="dark">{{ $t('panel_settings.theme_dark') }}</option>
                                <option value="auto">{{ $t('panel_settings.theme_auto') }}</option>
                            </select>
                        </div>

                        <div class="mb-0">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.console_info_position') }}</label>
                            <select class="form-select" v-model="config.consoleInfoPosition">
                                <option value="top">{{ $t('panel_settings.pos_top') }}</option>
                                <option value="sidebar">{{ $t('panel_settings.pos_sidebar') }}</option>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 高级设置 -->
            <div class="col-md-6">
                <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px;">
                    <div class="card-header bg-secondary-subtle text-secondary border-0 fw-bold py-2 py-md-3 px-3 px-md-4" style="border-radius: 16px 16px 0 0;">
                        <i class="fa-solid fa-gear me-2"></i>{{ $t('panel_settings.advanced') }}
                    </div>
                    <div class="card-body p-3 p-md-4">
                        <div class="mb-3 mb-md-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.github_proxy') }}</label>
                            <div class="input-group input-group-sm">
                                <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i class="fa-solid fa-list-ul"></i>
                                </button>
                                <ul class="dropdown-menu shadow-sm border-0">
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = ''"><i class="fa-solid fa-ban me-2 opacity-50"></i>{{ $t('common.disabled') }}</a></li>
                                    <li><hr class="dropdown-divider opacity-50"></li>
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = 'https://gh-proxy.org'">gh-proxy.org</a></li>
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = 'https://hk.gh-proxy.org'">hk.gh-proxy.org</a></li>
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = 'https://cdn.gh-proxy.org'">cdn.gh-proxy.org</a></li>
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = 'https://edgeone.gh-proxy.org'">edgeone.gh-proxy.org</a></li>
                                </ul>
                                <input type="text" class="form-control" v-model="config.githubProxy" :placeholder="$t('panel_settings.github_proxy_desc')">
                            </div>
                            <div class="form-text small opacity-75" style="font-size: 0.7rem;">{{ $t('panel_settings.github_proxy_desc') }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 安全设置 -->
            <div class="col-md-6">
                <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px;">
                    <div class="card-header bg-danger-subtle text-danger border-0 fw-bold py-2 py-md-3 px-3 px-md-4" style="border-radius: 16px 16px 0 0;">
                        <i class="fa-solid fa-shield-halved me-2"></i>{{ $t('panel_settings.security') }}
                    </div>
                    <div class="card-body p-3 p-md-4">
                        <div class="mb-3 mb-md-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.secret') }}</label>
                            <div class="input-group input-group-sm">
                                <input type="text" class="form-control" :value="config.secret" readonly>
                                <button class="btn btn-outline-danger" @click="reset2FA">
                                    <i class="fa-solid fa-rotate d-md-none"></i>
                                    <span class="d-none d-md-inline"><i class="fa-solid fa-rotate me-1"></i>{{ $t('panel_settings.reset_2fa') }}</span>
                                </button>
                            </div>
                            <div class="form-text small" style="font-size: 0.7rem;">{{ $t('panel_settings.secret_masked') }}</div>
                        </div>
                        
                        <div class="mb-0">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.session_timeout') }}</label>
                            <input type="number" class="form-control" v-model.number="config.sessionTimeout" min="1" max="365">
                        </div>
                    </div>
                </div>
            </div>

            <!-- AI 设置 -->
            <div class="col-md-6">
                <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px;">
                    <div class="card-header bg-info-subtle text-info border-0 fw-bold py-2 py-md-3 px-3 px-md-4" style="border-radius: 16px 16px 0 0;">
                        <i class="fa-solid fa-robot me-2"></i>{{ $t('panel_settings.ai_settings') }}
                    </div>
                    <div class="card-body p-3 p-md-4">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_endpoint') }}</label>
                            <input type="text" class="form-control" v-model="config.aiEndpoint" :placeholder="$t('panel_settings.ai_endpoint_desc')">
                            <div class="form-text small opacity-75" style="font-size: 0.7rem;">{{ $t('panel_settings.ai_endpoint_desc') }}</div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_key') }}</label>
                            <input type="password" class="form-control" v-model="config.aiKey" :placeholder="$t('panel_settings.ai_key_desc')">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_model') }}</label>
                            <input type="text" class="form-control" v-model="config.aiModel" :placeholder="$t('panel_settings.ai_model_placeholder')">
                        </div>
                        <div class="d-grid mt-4">
                            <button class="btn btn-outline-info fw-bold" @click="testAI" :disabled="testingAI" style="border-radius: 12px;">
                                <span v-if="testingAI" class="spinner-border spinner-border-sm me-2"></span>
                                <i v-else class="fa-solid fa-vial me-2"></i>{{ $t('panel_settings.ai_test') }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 备份与维护 -->
            <div class="col-md-12">
                <div class="card border-0 shadow-sm" style="border-radius: 16px;">
                    <div class="card-header bg-warning-subtle text-warning-emphasis border-0 fw-bold py-2 py-md-3 px-3 px-md-4" style="border-radius: 16px 16px 0 0;">
                        <div class="d-flex justify-content-between align-items-center">
                            <span><i class="fa-solid fa-box-archive me-2"></i>{{ $t('panel_settings.backup_maintenance') || '备份与维护' }}</span>
                            <div class="d-flex gap-2">
                                <button class="btn btn-outline-warning btn-sm rounded-pill fw-bold" @click="triggerRestoreImport">
                                    <i class="fa-solid fa-file-import me-1"></i>{{ $t('panel_settings.import_backup') || '导入备份' }}
                                </button>
                                <button class="btn btn-warning btn-sm rounded-pill fw-bold" @click="askCreateGlobalBackup">
                                    <i class="fa-solid fa-plus me-1"></i>{{ $t('panel_settings.create_global_backup') || '创建全局备份' }}
                                </button>
                                <input type="file" ref="restoreInput" class="d-none" accept=".zip" @change="handleRestoreImport">
                            </div>
                        </div>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="bg-body-tertiary">
                                    <tr class="small text-uppercase text-muted fw-bold">
                                        <th class="px-4">{{ $t('common.name') }}</th>
                                        <th>{{ $t('common.size') }}</th>
                                        <th>{{ $t('common.time') }}</th>
                                        <th class="text-end px-4">{{ $t('common.actions') }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="b in globalBackups" :key="b.name">
                                        <td class="px-4">
                                            <div class="fw-bold small">{{ b.name }}</div>
                                            <div class="text-muted" style="font-size: 0.7rem;">{{ b.note || '-' }}</div>
                                        </td>
                                        <td class="small">{{ (b.size/1024/1024).toFixed(1) }} MB</td>
                                        <td class="small text-muted">{{ new Date(b.mtime).toLocaleString() }}</td>
                                        <td class="text-end px-4">
                                            <div class="d-flex justify-content-end gap-1">
                                                <button class="btn btn-xs btn-outline-success border-0" @click="downloadGlobalBackup(b)" :title="$t('common.download')">
                                                    <i class="fa-solid fa-download"></i>
                                                </button>
                                                <button class="btn btn-xs btn-outline-primary border-0" @click="askRestoreGlobalBackup(b)" :title="$t('backups.restore')">
                                                    <i class="fa-solid fa-clock-rotate-left"></i>
                                                </button>
                                                <button class="btn btn-xs btn-outline-danger border-0" @click="deleteGlobalBackup(b)" :title="$t('common.delete')">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="!globalBackups.length">
                                        <td colspan="4" class="text-center text-muted py-4 small">
                                            {{ $t('common.no_data') || '暂无全局备份' }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const loading = ref(true);
        const saving = ref(false);
        const testingAI = ref(false);
        const globalBackups = ref([]);
        const config = reactive({
            port: 3000,
            defaultLang: 'zh',
            theme: 'auto',
            consoleInfoPosition: 'top',
            jarName: '',
            javaArgs: [],
            secret: '',
            sessionTimeout: 7,
            maxLogHistory: 1000,
            monitorInterval: 2000,
            aiEndpoint: '',
            aiKey: '',
            aiModel: '',
            githubProxy: ''
        });

        const javaArgsText = ref('');
        const jars = ref([]);
        const instances = ref([]);
        const javaList = ref([]);
        const restoreInput = ref(null);

        const loadJars = async () => {
            try {
                const res = await api.get('/api/panel/jars');
                jars.value = res.data;
            } catch (e) {
                console.error('Failed to load jars:', e);
            }
        };

        const loadGlobalBackups = async () => {
            try {
                const res = await api.get('/api/backups/global/list');
                globalBackups.value = res.data;
            } catch (e) { }
        };

        const loadInstances = async () => {
            try {
                const res = await api.get('/api/instances/list');
                instances.value = res.data;
            } catch (e) { }
        };

        const loadJavaList = async () => {
            try {
                const res = await api.get('/api/java/installed');
                javaList.value = res.data;
            } catch (e) { }
        };

        const triggerRestoreImport = () => restoreInput.value.click();
        const handleRestoreImport = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            saving.value = true;
            const formData = new FormData();
            formData.append('backup', file);

            try {
                showToast($t('setup.restoring_uploading') || '正在上传备份...', 'info');
                const uploadRes = await api.post('/api/backups/global/import', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                showToast($t('panel_settings.restoring') || '正在应用备份，面板即将重启...', 'info');
                await api.post('/api/backups/global/restore', { filename: uploadRes.data.filename });
                
                setTimeout(() => window.location.reload(), 5000);
            } catch (e) {
                saving.value = false;
                showToast(e.response?.data?.error || e.message, 'danger');
            }
            e.target.value = '';
        };

        const askCreateGlobalBackup = () => {
            const managedJava = javaList.value.filter(j => j.source !== 'local');

            const instanceListHtml = instances.value.length ? `
                <div class="mt-2 p-2 bg-body-tertiary rounded small" style="max-height: 150px; overflow-y: auto;">
                    ${instances.value.map(i => `
                        <div class="form-check mb-1">
                            <input class="form-check-input check-inst-item" type="checkbox" value="${i.id}" id="check-inst-${i.id}" checked>
                            <label class="form-check-label" for="check-inst-${i.id}">${i.name} <span class="opacity-50">(${i.id})</span></label>
                        </div>
                    `).join('')}
                </div>
            ` : `<div class="small text-muted py-2">${$t('panel_settings.no_instances')}</div>`;

            const javaListHtml = managedJava.length ? `
                <div class="mt-2 p-2 bg-body-tertiary rounded small" style="max-height: 150px; overflow-y: auto;">
                    ${managedJava.map(j => `
                        <div class="form-check mb-1">
                            <input class="form-check-input check-java-item" type="checkbox" value="${j.id}" id="check-java-${j.id}" checked>
                            <label class="form-check-label" for="check-java-${j.id}">Java ${j.featureVersion} <span class="opacity-50">(${j.id})</span></label>
                        </div>
                    `).join('')}
                </div>
            ` : `<div class="small text-muted py-2">${$t('panel_settings.no_java')}</div>`;

            openModal({
                title: $t('panel_settings.create_global_backup') || '创建全局备份',
                message: `
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">${$t('backups.prompt_note') || '备注'}</label>
                        <input type="text" id="backup-note" class="form-control form-control-sm" placeholder="e.g. Before update">
                    </div>
                    <div class="small fw-bold text-muted mb-2">${$t('panel_settings.backup_include') || '包含内容'}</div>
                    <div class="form-check small mb-1">
                        <input class="form-check-input" type="checkbox" id="check-configs" checked>
                        <label class="form-check-label" for="check-configs">${$t('panel_settings.backup_configs') || '面板配置 (data/*.json)'}</label>
                    </div>
                    
                    <div class="mt-3 ms-2">
                        <div class="form-check small mb-1">
                            <input class="form-check-input" type="checkbox" id="check-java-all" checked onchange="document.querySelectorAll('.check-java-item').forEach(i=>i.checked=this.checked)">
                            <label class="form-check-label fw-bold" for="check-java-all">${$t('panel_settings.backup_java') || 'Java 环境'}</label>
                        </div>
                        ${javaListHtml}
                    </div>

                    <div class="mt-3 ms-2">
                        <div class="form-check small mb-1">
                            <input class="form-check-input" type="checkbox" id="check-inst-all" checked onchange="document.querySelectorAll('.check-inst-item').forEach(i=>i.checked=this.checked)">
                            <label class="form-check-label fw-bold" for="check-inst-all">${$t('panel_settings.backup_instances') || '游戏实例'}</label>
                        </div>
                        ${instanceListHtml}
                    </div>
                `,
                callback: async () => {
                    const note = document.getElementById('backup-note').value;
                    const configs = document.getElementById('check-configs').checked;
                    
                    const javaItems = Array.from(document.querySelectorAll('.check-java-item:checked')).map(i => i.value);
                    const instItems = Array.from(document.querySelectorAll('.check-inst-item:checked')).map(i => i.value);
                    
                    const options = {
                        configs,
                        java: javaItems,
                        instances: instItems
                    };

                    try {
                        showToast($t('common.processing') || '正在创建备份...', 'info');
                        await api.post('/api/backups/global/create', { note, options });
                        showToast($t('common.success'), 'success');
                        loadGlobalBackups();
                    } catch (e) {
                        showToast(e.message, 'danger');
                    }
                }
            });
        };

        const downloadGlobalBackup = (b) => {
            window.open(`/api/backups/global/download?filename=${encodeURIComponent(b.name)}`, '_blank');
        };

        const askRestoreGlobalBackup = (b) => {
            openModal({
                title: $t('backups.restore') || '恢复备份',
                message: $t('panel_settings.restore_global_confirm') || `确定要还原备份 ${b.name} 吗？这会覆盖当前所有配置和实例，完成后面板将重启。`,
                callback: async () => {
                    try {
                        showToast($t('panel_settings.restoring') || '正在应用备份，面板即将重启...', 'info');
                        await api.post('/api/backups/global/restore', { filename: b.name });
                        setTimeout(() => window.location.reload(), 5000);
                    } catch (e) {
                        showToast(e.message, 'danger');
                    }
                }
            });
        };

        const deleteGlobalBackup = (b) => {
            openModal({
                title: $t('common.delete'),
                message: $t('backups.confirm_delete_msg', { name: b.name }),
                callback: async () => {
                    try {
                        await api.post('/api/backups/global/delete', { filename: b.name });
                        showToast($t('common.success'), 'success');
                        loadGlobalBackups();
                    } catch (e) {
                        showToast(e.message, 'danger');
                    }
                }
            });
        };

        const loadConfig = async () => {
            try {
                loading.value = true;
                const res = await api.get('/api/panel/config');
                Object.assign(config, res.data);
                javaArgsText.value = (config.javaArgs || []).join('\n');

                const currentTheme = localStorage.getItem('theme');
                const currentLang = localStorage.getItem('lang');

                if (currentTheme && config.theme !== currentTheme && config.theme === 'auto') {
                    config.theme = currentTheme;
                }
                if (currentLang && config.defaultLang !== currentLang) {
                    config.defaultLang = currentLang;
                }
            } catch (e) {
                showToast($t('common.error') + ': ' + (e.response?.data?.error || e.message), 'danger');
            } finally {
                loading.value = false;
            }
        };

        const saveConfig = async () => {
            try {
                saving.value = true;
                config.javaArgs = javaArgsText.value.split('\n').map(s => s.trim()).filter(s => s);
                const res = await api.post('/api/panel/config', config);

                if (res.data.success) {
                    if (config.theme && config.theme !== 'auto') {
                        document.documentElement.setAttribute('data-bs-theme', config.theme);
                        localStorage.setItem('theme', config.theme);
                    }
                    if (config.defaultLang) {
                        const { store } = await import('../store.js');
                        store.lang = config.defaultLang;
                        localStorage.setItem('lang', config.defaultLang);
                    }

                    // Sync consoleInfoPosition to global store immediately
                    const { store } = await import('../store.js');
                    store.consoleInfoPosition = config.consoleInfoPosition;

                    showToast($t('panel_settings.save_success'), 'success');

                    openModal({
                        title: $t('panel_settings.restart_required'),
                        message: $t('panel_settings.restart_confirm'),
                        callback: async () => {
                            try {
                                const currentPort = window.location.port || '80';
                                const newPort = config.port.toString();
                                const portChanged = currentPort !== newPort;
                                await api.post('/api/panel/restart');
                                showToast($t('panel_settings.restarting'), 'info');
                                
                                await waitForPanel(portChanged ? newPort : null);
                                if (portChanged) {
                                    const protocol = window.location.protocol;
                                    const hostname = window.location.hostname;
                                    window.location.href = `${protocol}//${hostname}:${newPort}`;
                                } else {
                                    window.location.reload();
                                }
                            } catch (e) {
                                showToast($t('common.error'), 'danger');
                            }
                        }
                    });
                }
            } catch (e) {
                showToast($t('panel_settings.validation_error') + ': ' + (e.response?.data?.error || e.message), 'danger');
            } finally {
                saving.value = false;
            }
        };

        const testAI = async () => {
            if (!config.aiEndpoint || !config.aiModel) {
                showToast($t('panel_settings.validation_error'), 'warning');
                return;
            }
            testingAI.value = true;
            try {
                await api.post('/api/panel/ai/test', {
                    aiEndpoint: config.aiEndpoint,
                    aiKey: config.aiKey,
                    aiModel: config.aiModel
                });
                showToast($t('panel_settings.ai_test_success'), 'success');
            } catch (e) {
                showToast($t('panel_settings.ai_test_fail') + ': ' + (e.response?.data?.error || e.message), 'danger');
            } finally {
                testingAI.value = false;
            }
        };

        const reset2FA = () => {
            openModal({
                title: $t('panel_settings.reset_2fa'),
                message: $t('panel_settings.reset_2fa_confirm'),
                callback: async () => {
                    try {
                        const res = await api.get('/api/panel/2fa/generate');
                        const { secret, qr } = res.data;
                        const verifyFlow = () => {
                            setTimeout(() => {
                                openModal({
                                    title: $t('panel_settings.reset_2fa_setup'),
                                    message: `
                                        <div class="text-center">
                                            <p>${$t('panel_settings.reset_2fa_instruction')}</p>
                                            <img src="${qr}" class="img-fluid mb-2" style="max-width: 250px;">
                                            <p class="text-muted small user-select-all">${secret}</p>
                                        </div>
                                    `,
                                    mode: 'input',
                                    placeholder: '6-digit Code',
                                    callback: async (code) => {
                                        if (!code) return;
                                        try {
                                            await api.post('/api/panel/2fa/verify', { secret, token: code });
                                            showToast($t('panel_settings.reset_2fa_success'), 'success');
                                            loadConfig();
                                        } catch (e) {
                                            showToast($t('common.error') + ': ' + (e.response?.data?.error || 'Invalid Code'), 'danger');
                                            verifyFlow();
                                        }
                                    }
                                });
                            }, 300);
                        };
                        verifyFlow();
                    } catch (e) {
                        showToast($t('common.error') + ': ' + (e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        onMounted(() => {
            loadConfig();
            loadJars();
            loadGlobalBackups();
            loadInstances();
            loadJavaList();
        });

        return {
            store, loading, saving, testingAI, globalBackups, config, javaArgsText, jars,
            saveConfig, testAI, reset2FA,
            askCreateGlobalBackup, downloadGlobalBackup, askRestoreGlobalBackup, deleteGlobalBackup,
            restoreInput, triggerRestoreImport, handleRestoreImport
        };
    }
};
