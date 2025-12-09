import { ref, reactive, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { showToast, openModal } from '../utils.js';

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>{{ $t('panel_settings.title') }}</h3>
            <div class="btn-group">
                <button class="btn btn-success" @click="saveConfig" :disabled="saving">
                    <i class="fa-solid fa-save me-2"></i>{{ $t('common.save') }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border" role="status"></div>
            <p class="mt-2">{{ $t('common.loading') }}</p>
        </div>

        <div v-else class="row g-4">
            <!-- 基础设置 -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-primary text-white fw-bold">
                        <i class="fa-solid fa-sliders me-2"></i>{{ $t('panel_settings.basic') }}
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.port') }}</label>
                            <input type="number" class="form-control" v-model.number="config.port" min="1024" max="65535">
                            <div class="form-text">{{ $t('panel_settings.port_desc') }}</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.default_lang') }}</label>
                            <select class="form-select" v-model="config.defaultLang">
                                <option value="zh">中文</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.theme') }}</label>
                            <select class="form-select" v-model="config.theme">
                                <option value="light">{{ $t('panel_settings.theme_light') }}</option>
                                <option value="dark">{{ $t('panel_settings.theme_dark') }}</option>
                                <option value="auto">{{ $t('panel_settings.theme_auto') }}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 服务器配置 -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-success text-white fw-bold">
                        <i class="fa-solid fa-server me-2"></i>{{ $t('panel_settings.server') }}
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.jar_name') }}</label>
                            <input type="text" class="form-control" v-model="config.jarName">
                            <div class="form-text">{{ $t('panel_settings.jar_name_desc') }}</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.java_args') }}</label>
                            <textarea class="form-control" rows="4" v-model="javaArgsText" style="font-family: monospace;"></textarea>
                            <div class="form-text">{{ $t('panel_settings.java_args_desc') }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 安全设置 -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-danger text-white fw-bold">
                        <i class="fa-solid fa-shield-halved me-2"></i>{{ $t('panel_settings.security') }}
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.secret') }}</label>
                            <div class="input-group">
                                <input type="text" class="form-control" :value="config.secret" readonly>
                                <button class="btn btn-outline-danger" @click="reset2FA">
                                    <i class="fa-solid fa-rotate me-1"></i>{{ $t('panel_settings.reset_2fa') }}
                                </button>
                            </div>
                            <div class="form-text">{{ $t('panel_settings.secret_masked') }}</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.session_timeout') }}</label>
                            <input type="number" class="form-control" v-model.number="config.sessionTimeout" min="1" max="365">
                        </div>
                    </div>
                </div>
            </div>

            <!-- 高级设置 -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-warning text-dark fw-bold">
                        <i class="fa-solid fa-gear me-2"></i>{{ $t('panel_settings.advanced') }}
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.max_log_history') }}</label>
                            <input type="number" class="form-control" v-model.number="config.maxLogHistory" min="100" max="10000">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">{{ $t('panel_settings.monitor_interval') }}</label>
                            <input type="number" class="form-control" v-model.number="config.monitorInterval" min="1000" max="10000" step="100">
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
        const config = reactive({
            port: 3000,
            defaultLang: 'zh',
            theme: 'auto',
            jarName: '',
            javaArgs: [],
            secret: '',
            sessionTimeout: 7,
            maxLogHistory: 1000,
            monitorInterval: 2000
        });

        const javaArgsText = ref('');

        const loadConfig = async () => {
            try {
                loading.value = true;
                const res = await api.get('/api/panel/config');
                Object.assign(config, res.data);
                javaArgsText.value = config.javaArgs.join('\\n');

                // 如果配置中的主题/语言与当前不同,使用当前的(localStorage优先)
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

                // 解析 Java 参数
                config.javaArgs = javaArgsText.value.split('\\n').map(s => s.trim()).filter(s => s);

                const res = await api.post('/api/panel/config', config);

                if (res.data.success) {
                    // 立即同步主题和语言设置
                    if (config.theme && config.theme !== 'auto') {
                        document.documentElement.setAttribute('data-bs-theme', config.theme);
                        localStorage.setItem('theme', config.theme);
                    }

                    if (config.defaultLang) {
                        // 导入 store 来更新语言
                        const { store } = await import('../store.js');
                        store.lang = config.defaultLang;
                        localStorage.setItem('lang', config.defaultLang);
                    }

                    showToast($t('panel_settings.save_success'), 'success');

                    // 询问是否重启
                    openModal({
                        title: $t('panel_settings.restart_required'),
                        message: $t('panel_settings.restart_confirm'),
                        callback: async () => {
                            try {
                                await api.post('/api/panel/restart');
                                showToast($t('panel_settings.restarting'), 'info');

                                // 3秒后刷新页面
                                setTimeout(() => {
                                    window.location.reload();
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

        const reset2FA = () => {
            openModal({
                title: $t('panel_settings.reset_2fa'),
                message: $t('panel_settings.reset_2fa_confirm'),
                callback: async () => {
                    try {
                        const res = await api.post('/api/panel/reset-2fa');

                        if (res.data.success) {
                            // 显示新的二维码
                            openModal({
                                title: $t('panel_settings.reset_2fa_success'),
                                message: `
                                    <div class="text-center">
                                        <p>${$t('panel_settings.reset_2fa_instruction')}</p>
                                        <img src="${res.data.qr}" class="img-fluid mb-3" style="max-width: 300px;">
                                        <p class="text-muted small">Secret: ${res.data.secret}</p>
                                    </div>
                                `,
                                callback: () => {
                                    // 重新加载配置
                                    loadConfig();
                                }
                            });
                        }
                    } catch (e) {
                        showToast($t('common.error') + ': ' + (e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        onMounted(loadConfig);

        return {
            loading,
            saving,
            config,
            javaArgsText,
            saveConfig,
            reset2FA
        };
    }
};
