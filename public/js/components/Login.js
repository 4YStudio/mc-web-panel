import { ref, watch, onMounted } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, waitForPanel, uploadFileWithChunk, isLargeFile } from '../utils.js';

export default {
    template: `
    <div class="login-page d-flex align-items-center justify-content-center h-100 w-100">
        <style>
        /* 统一登录与初始化页面输入框样式 */
        .login-page .form-control {
            height: 50px !important;
            font-size: 0.95rem !important;
            font-family: inherit !important;
            font-weight: 500 !important;
            background: rgba(255, 255, 255, 0.04) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            color: var(--c-text-primary) !important;
            letter-spacing: normal !important;
            text-align: left !important;
            padding: 0.75rem 1.25rem !important;
            border-radius: 8px !important;
        }

        .login-page .form-control:focus {
            background: rgba(255, 255, 255, 0.08) !important;
            border-color: var(--c-primary) !important;
            box-shadow: 0 0 0 0.25rem rgba(var(--c-primary-rgb), 0.15) !important;
        }

        /* 专门为 2FA 验证码输入框定义的样式 (居中、等宽、大间距) */
        .login-page .login-input-2fa {
            text-align: center !important;
            font-family: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace !important;
            letter-spacing: 6px !important;
            font-size: 1.25rem !important;
            font-weight: 600 !important;
            padding: 0.75rem 0.5rem !important;
            height: 50px !important;
        }

        /* 验证码布局对齐 */
        .login-page .captcha-input-field {
            border-top-right-radius: 0px !important;
            border-bottom-right-radius: 0px !important;
        }

        .login-page .captcha-img-container {
            height: 50px !important;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 120px !important;
            border-top-left-radius: 0px !important;
            border-bottom-left-radius: 0px !important;
            border-top-right-radius: 8px !important;
            border-bottom-right-radius: 8px !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-left: 0 !important;
        }

        [data-bs-theme="dark"] .login-page .captcha-img-container {
            background: #ffffff !important;
        }

        /* Label 样式微调，使其更高端 */
        .login-page .form-label {
            font-size: 0.72rem !important;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--c-text-secondary) !important;
            margin-bottom: 0.4rem !important;
            font-weight: 700 !important;
            opacity: 0.85;
        }
        </style>

        <div class="glass-card login-card p-4 p-md-5 text-center animate-in" style="width: 100%; max-width: 420px;">
            <div class="mb-4">
                 <img v-if="store.customLogoUrl" :src="store.customLogoUrl" alt="Logo" class="login-logo">
                 <img v-else-if="hasIcon" :src="'/api/server/icon?t=' + store.serverIconVersion" class="login-logo rounded-circle">
                 <img v-else src="/logo.png" alt="Logo" class="login-logo">
            </div>
            
            <!-- 1. 初始化设置向导 -->
            <div v-if="!store.auth.initialized" class="animate-in text-start mb-3">
                <h4 class="mb-4 fw-bold text-center tracking-tight text-primary">{{ $t('login.init_title') }}</h4>
                
                <div class="mb-3">
                    <label class="form-label mb-1">{{ $t('login.placeholder_user') }}</label>
                    <input type="text" v-model="initUser" class="form-control" :placeholder="$t('login.placeholder_user')">
                </div>
                <div class="mb-3">
                    <label class="form-label mb-1">{{ $t('login.placeholder_pass') }}</label>
                    <input type="password" v-model="initPass" class="form-control" :placeholder="$t('login.placeholder_pass')">
                </div>
                <div class="mb-3">
                    <label class="form-label mb-1">{{ $t('login.placeholder_confirm_pass') }}</label>
                    <input type="password" v-model="initConfirmPass" class="form-control" :placeholder="$t('login.placeholder_confirm_pass')">
                </div>
                
                <div class="form-check form-switch mb-4 ms-1">
                    <input class="form-check-input cursor-pointer" type="checkbox" role="switch" id="enable2faSwitch" v-model="enable2FA">
                    <label class="form-check-label small fw-semibold cursor-pointer" for="enable2faSwitch">{{ $t('login.enable_2fa') }}</label>
                </div>

                <div v-if="enable2FA" class="mb-4 p-3 rounded border border-dashed text-center animate-in" style="background: var(--c-surface-elevated);">
                    <div class="p-2 rounded d-inline-block mb-2 bg-white shadow-sm">
                        <img :src="store.auth.qrCode" class="img-fluid" style="width: 150px; border-radius: 8px;">
                    </div>
                    <div class="small text-muted mb-3 font-monospace user-select-all" style="font-size: 0.8rem;">{{ store.auth.secret }}</div>
                    <div class="alert alert-info small py-2 text-start mb-3" style="font-size: 0.75rem;">{{ $t('login.prompt_scan') }}</div>
                    <input type="text" v-model="init2FAToken" class="form-control login-input-2fa text-center font-monospace" :placeholder="$t('login.placeholder_code')" maxlength="6">
                </div>

                <button class="btn btn-primary w-100 login-btn mb-3 py-2 fw-bold" @click="setupAdmin">
                    {{ $t('login.btn_init') }}
                </button>

                <div v-if="restoring" class="mb-3 animate-in">
                    <div class="modern-progress" style="height: 6px;">
                        <div class="modern-progress-bar" :style="{width: uploadPercent + '%'}"></div>
                    </div>
                    <div class="text-muted small mt-1" style="font-size: 0.7rem;">{{ uploadPercent }}% - {{ $t('setup.restoring_uploading') }}</div>
                </div>

                <div class="d-grid gap-2 mb-3">
                    <button class="btn btn-outline-warning btn-sm py-2 border-dashed fw-bold" @click="triggerRestore" :disabled="restoring">
                        <i class="fa-solid fa-file-import me-1"></i>{{ $t('setup.restore_from_backup') }}
                    </button>
                    <input type="file" ref="restoreInput" class="d-none" accept=".zip" @change="handleRestore">
                </div>
            </div>

            <!-- 2. 标准登录 -->
            <div v-else class="animate-in text-start mb-3">
                <h4 class="mb-4 fw-bold text-center tracking-tight">{{ $t('login.title') }}</h4>

                <!-- 模式一: 账号密码登录 -->
                <div v-if="loginMode === 'password'">
                    <div class="mb-3">
                        <input type="text" v-model="loginUser" class="form-control" :placeholder="$t('login.placeholder_user')" @keyup.enter="loginPassword" autofocus>
                    </div>
                    <div class="mb-3">
                        <input type="password" v-model="loginPass" class="form-control" :placeholder="$t('login.placeholder_pass')" @keyup.enter="loginPassword">
                    </div>
                    <div class="mb-4">
                        <div class="input-group">
                            <input type="text" v-model="loginCaptcha" class="form-control captcha-input-field" :placeholder="$t('login.placeholder_captcha')" maxlength="4" @keyup.enter="loginPassword">
                            <div class="captcha-img-container cursor-pointer border overflow-hidden" @click="refreshCaptcha" v-html="captchaSvg" title="点击刷新验证码"></div>
                        </div>
                    </div>
                    
                    <button class="btn btn-primary w-100 login-btn mb-3 py-2 fw-bold" @click="loginPassword">
                        {{ $t('login.btn_login') }}
                    </button>

                    <div v-if="store.auth.isSetup" class="text-center">
                        <button class="btn btn-link text-primary small text-decoration-none fw-semibold" @click="switchMode('2fa')">
                            <i class="fa-solid fa-shield-halved me-1"></i> {{ $t('login.switch_to_2fa') }}
                        </button>
                    </div>
                </div>

                <!-- 模式二: 2FA 令牌直登 -->
                <div v-else class="animate-in text-center">
                    <div class="alert alert-info small py-2 mb-3">{{ $t('login.placeholder_code') }}</div>
                    <div class="mb-4">
                        <input type="text" v-model="login2FAToken" class="form-control form-control-lg login-input-2fa text-center font-monospace" :placeholder="$t('login.placeholder_code')" maxlength="6" @keyup.enter="login2FA" autofocus>
                    </div>
                    <button class="btn btn-primary w-100 login-btn mb-3 py-2 fw-bold" @click="login2FA">
                        {{ $t('login.btn_verify') }}
                    </button>
                    
                    <div class="text-center mt-2">
                        <button class="btn btn-link text-primary small text-decoration-none fw-semibold" @click="switchMode('password')">
                            <i class="fa-solid fa-key me-1"></i> {{ $t('login.switch_to_password') }}
                        </button>
                    </div>
                </div>
            </div>

            <div class="d-flex justify-content-center gap-3">
                <button class="btn btn-link text-muted small text-decoration-none" @click="toggleTheme">
                    <i class="fa-solid fa-circle-half-stroke me-1"></i> {{ $t('common.switchTheme') }}
                </button>
                <button class="btn btn-link text-muted small text-decoration-none" @click="toggleLang">
                    <i class="fa-solid fa-language me-1"></i> {{ store.lang === 'zh' ? 'English' : '中文' }}
                </button>
            </div>
        </div>
    </div>
    `,
    setup() {
        const hasIcon = ref(false);
        const restoring = ref(false);
        const uploadPercent = ref(0);
        const restoreInput = ref(null);

        // Setup States
        const initUser = ref('admin');
        const initPass = ref('');
        const initConfirmPass = ref('');
        const enable2FA = ref(true);
        const init2FAToken = ref('');

        // Login States
        const loginUser = ref('');
        const loginPass = ref('');
        const loginCaptcha = ref('');
        const login2FAToken = ref('');
        const captchaSvg = ref('');
        
        // Mode switchable state: 'password' or '2fa'
        const loginMode = ref('password');

        const checkIcon = async () => {
            const img = new Image();
            img.onload = () => hasIcon.value = true;
            img.onerror = () => hasIcon.value = false;
            img.src = '/api/server/icon?t=' + Date.now();
        };

        const refreshCaptcha = async () => {
            try {
                const res = await api.get('/api/auth/captcha');
                captchaSvg.value = res.data.svg;
            } catch (e) {
                console.error('Failed to load captcha', e);
            }
        };

        watch(() => store.serverIconVersion, checkIcon);

        onMounted(() => {
            checkIcon();
            if (store.auth.initialized) {
                if (store.auth.isSetup && localStorage.getItem('preferred_login_mode') === '2fa') {
                    loginMode.value = '2fa';
                }
                refreshCaptcha();
            }
        });

        // Watch for store.auth.initialized transitions
        watch(() => store.auth.initialized, (val) => {
            if (val) {
                refreshCaptcha();
            }
        });

        const switchMode = (mode) => {
            loginMode.value = mode;
            localStorage.setItem('preferred_login_mode', mode);
            if (mode === 'password') {
                refreshCaptcha();
                loginCaptcha.value = '';
            } else {
                login2FAToken.value = '';
            }
        };

        const setupAdmin = async () => {
            if (!initUser.value) {
                showToast('login.placeholder_user', 'warning');
                return;
            }
            if (!initPass.value || initPass.value.length < 6) {
                showToast('密码长度必须大于等于 6 位', 'warning');
                return;
            }
            if (initPass.value !== initConfirmPass.value) {
                showToast('login.mismatch_pass', 'warning');
                return;
            }
            if (enable2FA.value && !init2FAToken.value) {
                showToast('login.placeholder_code', 'warning');
                return;
            }

            try {
                const res = await api.post('/api/auth/setup', {
                    username: initUser.value,
                    password: initPass.value,
                    enable2FA: enable2FA.value,
                    token: init2FAToken.value,
                    tempSecret: store.auth.secret
                });
                if (res.data.success) {
                    showToast('login.toast_init_success', 'success');
                    store.auth.initialized = true;
                    store.auth.loggedIn = true;
                }
            } catch (err) {
                showToast(err.response?.data?.error || 'login.toast_init_fail', 'danger');
            }
        };

        const loginPassword = async () => {
            if (!loginUser.value) {
                showToast('login.placeholder_user', 'warning');
                return;
            }
            if (!loginPass.value) {
                showToast('login.placeholder_pass', 'warning');
                return;
            }
            if (!loginCaptcha.value) {
                showToast('login.placeholder_captcha', 'warning');
                return;
            }

            try {
                const res = await api.post('/api/auth/login', {
                    username: loginUser.value,
                    password: loginPass.value,
                    captcha: loginCaptcha.value
                });
                if (res.data.success) {
                    store.auth.loggedIn = true;
                }
            } catch (err) {
                showToast(err.response?.data?.error || 'login.toast_login_fail', 'danger');
                refreshCaptcha();
                loginCaptcha.value = '';
            }
        };

        const login2FA = async () => {
            if (!login2FAToken.value) {
                showToast('login.placeholder_code', 'warning');
                return;
            }

            try {
                const res = await api.post('/api/auth/login', {
                    token: login2FAToken.value
                });
                if (res.data.success) {
                    store.auth.loggedIn = true;
                }
            } catch (err) {
                showToast(err.response?.data?.error || 'login.toast_fail', 'danger');
            }
        };

        const toggleTheme = () => {
            const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        };

        const toggleLang = () => {
            store.lang = store.lang === 'zh' ? 'en' : 'zh';
            localStorage.setItem('lang', store.lang);
        };

        const triggerRestore = () => restoreInput.value.click();

        const handleRestore = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            restoring.value = true;
            uploadPercent.value = 0;

            try {
                let filename;
                if (isLargeFile(file)) {
                    const chunkResult = await uploadFileWithChunk(file, {
                        initUrl: '/api/backups/global/import-chunk/init',
                        completeUrl: '/api/backups/global/import-chunk/complete',
                        onProgress: (bytesDone, bytesTotal) => {
                            uploadPercent.value = Math.round((bytesDone * 100) / bytesTotal);
                        }
                    });
                    filename = chunkResult.filename;
                } else {
                    const formData = new FormData();
                    formData.append('backup', file);
                    showToast('setup.restoring_uploading', 'info');
                    const uploadRes = await api.post('/api/backups/global/import', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        onUploadProgress: (p) => {
                            uploadPercent.value = Math.round((p.loaded * 100) / p.total);
                        }
                    });
                    filename = uploadRes.data.filename;
                }
                
                showToast('setup.restoring_applying', 'info');
                await api.post('/api/backups/global/restore', { filename });
                
                await waitForPanel();
                window.location.reload();
            } catch (e) {
                restoring.value = false;
                showToast(e.response?.data?.error || e.message, 'danger');
            }
            e.target.value = '';
        };

        return {
            store, hasIcon, restoring, uploadPercent, restoreInput,
            initUser, initPass, initConfirmPass, enable2FA, init2FAToken,
            loginUser, loginPass, loginCaptcha, login2FAToken, captchaSvg, loginMode,
            refreshCaptcha, switchMode, setupAdmin, loginPassword, login2FA,
            toggleTheme, toggleLang, triggerRestore, handleRestore
        };
    }
};
import { messages } from '../i18n.js';