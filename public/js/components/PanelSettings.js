import { ref, reactive, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column overflow-hidden">
        <div class="d-flex justify-content-between align-items-center mb-5 flex-shrink-0">
            <div class="d-flex align-items-center">
                <button @click="store.view = 'instance-manager'" class="btn-back me-3">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <h2 class="fw-black m-0 tracking-tight" style="font-size: 2.2rem;">{{ $t('panel_settings.title') }}</h2>
            </div>
            <div class="btn-group">
                <button class="btn btn-success px-4 py-2 fw-bold shadow-sm" @click="saveConfig" :disabled="saving" style="border-radius: 12px;">
                    <i class="fa-solid fa-save me-2"></i>{{ $t('common.save') }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted fw-medium">{{ $t('common.loading') }}</p>
        </div>

        <div v-else class="row g-4 overflow-auto custom-scrollbar pb-5">
            <!-- 基础设置 -->
            <div class="col-md-6">
                <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px;">
                    <div class="card-header bg-primary-subtle text-primary border-0 fw-bold py-3 px-4" style="border-radius: 16px 16px 0 0;">
                        <i class="fa-solid fa-sliders me-2"></i>{{ $t('panel_settings.basic') }}
                    </div>
                    <div class="card-body p-4">
                        <div class="mb-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.port') }}</label>
                            <input type="number" class="form-control" v-model.number="config.port" min="1024" max="65535">
                            <div class="form-text small opacity-75">{{ $t('panel_settings.port_desc') }}</div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.default_lang') }}</label>
                            <select class="form-select" v-model="config.defaultLang">
                                <option value="zh">中文</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                        
                        <div class="mb-4">
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
                                <option value="hide">{{ $t('panel_settings.pos_hide') }}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 安全设置 -->
            <div class="col-md-6">
                <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px;">
                    <div class="card-header bg-danger-subtle text-danger border-0 fw-bold py-3 px-4" style="border-radius: 16px 16px 0 0;">
                        <i class="fa-solid fa-shield-halved me-2"></i>{{ $t('panel_settings.security') }}
                    </div>
                    <div class="card-body p-4">
                        <div class="mb-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.secret') }}</label>
                            <div class="input-group">
                                <input type="text" class="form-control" :value="config.secret" readonly>
                                <button class="btn btn-outline-danger" @click="reset2FA">
                                    <i class="fa-solid fa-rotate me-1"></i>{{ $t('panel_settings.reset_2fa') }}
                                </button>
                            </div>
                            <div class="form-text small">{{ $t('panel_settings.secret_masked') }}</div>
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
                    <div class="card-header bg-info-subtle text-info border-0 fw-bold py-3 px-4" style="border-radius: 16px 16px 0 0;">
                        <i class="fa-solid fa-robot me-2"></i>{{ $t('panel_settings.ai_settings') }}
                    </div>
                    <div class="card-body p-4">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_endpoint') }}</label>
                            <input type="text" class="form-control" v-model="config.aiEndpoint" :placeholder="$t('panel_settings.ai_endpoint_desc')">
                            <div class="form-text small opacity-75">{{ $t('panel_settings.ai_endpoint_desc') }}</div>
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
        </div>
    </div>
    `,
    setup() {
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const loading = ref(true);
        const saving = ref(false);
        const testingAI = ref(false);
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
            aiModel: ''
        });

        const javaArgsText = ref('');
        const jars = ref([]);

        const loadJars = async () => {
            try {
                const res = await api.get('/api/panel/jars');
                jars.value = res.data;
            } catch (e) {
                console.error('Failed to load jars:', e);
            }
        };

        const loadConfig = async () => {
            try {
                loading.value = true;
                const res = await api.get('/api/panel/config');
                Object.assign(config, res.data);
                javaArgsText.value = config.javaArgs.join('\n');

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
                                setTimeout(() => {
                                    if (portChanged) {
                                        const protocol = window.location.protocol;
                                        const hostname = window.location.hostname;
                                        window.location.href = `${protocol}//${hostname}:${newPort}`;
                                    } else {
                                        window.location.reload();
                                    }
                                }, 3000);
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
        });

        return {
            store, loading, saving, testingAI, config, javaArgsText, jars,
            saveConfig, testAI, reset2FA
        };
    }
};
