import { ref, watch, onMounted } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, waitForPanel, uploadFileWithChunk, isLargeFile, t } from '../utils.js';

export default {
    template: `
    <div class="login-page d-flex justify-content-center w-100 h-100 overflow-y-auto py-4 py-md-5">
        <div class="glass-card login-card p-4 p-md-5 text-center animate-in my-auto" style="width: 100%; max-width: 440px;">
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
                    <div class="text-muted small mt-1 d-flex justify-content-between" style="font-size: 0.75rem;">
                        <span>{{ restoreStatusText }}</span>
                        <span>{{ uploadPercent }}%</span>
                    </div>
                </div>

                <div class="d-grid gap-2 mb-3">
                    <button class="btn btn-outline-warning btn-sm py-2 border-dashed fw-bold" @click="triggerRestore" :disabled="restoring">
                        <i class="fa-solid fa-file-import me-1"></i>{{ $t('setup.restore_from_backup') }}
                    </button>
                    <input type="file" ref="restoreInput" class="d-none" accept=".zip" @change="handleSetupRestore">
                </div>
            </div>

            <!-- 2. 标准登录与灾难恢复 -->
            <div v-else class="animate-in mb-3">
                <!-- 模式一: 账号密码登录 -->
                <div v-if="loginMode === 'password'" class="text-start">
                    <h4 class="mb-4 fw-bold text-center tracking-tight">{{ $t('login.title') }}</h4>
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

                    <div class="mt-4 pt-3 border-top border-secondary-subtle text-center">
                        <button class="btn btn-link text-warning-emphasis text-decoration-none small py-0 fw-semibold" @click="switchMode('recovery')">
                            <i class="fa-solid fa-life-ring me-1"></i> {{ $t('login.disaster_recovery') }}
                        </button>
                    </div>
                </div>

                <!-- 模式二: 2FA 令牌直登 -->
                <div v-else-if="loginMode === '2fa'" class="animate-in text-center">
                    <h4 class="mb-4 fw-bold text-center tracking-tight">{{ $t('login.title') }}</h4>
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

                    <div class="mt-4 pt-3 border-top border-secondary-subtle text-center">
                        <button class="btn btn-link text-warning-emphasis text-decoration-none small py-0 fw-semibold" @click="switchMode('recovery')">
                            <i class="fa-solid fa-life-ring me-1"></i> {{ $t('login.disaster_recovery') }}
                        </button>
                    </div>
                </div>

                <!-- 模式三: 灾难恢复 / 从备份还原 -->
                <div v-else-if="loginMode === 'recovery'" class="animate-in text-start">
                    <div class="text-center mb-3">
                        <div class="d-inline-flex align-items-center justify-content-center bg-warning-subtle text-warning rounded-circle mb-2" style="width: 46px; height: 46px;">
                            <i class="fa-solid fa-life-ring fa-xl"></i>
                        </div>
                        <h5 class="fw-bold tracking-tight mb-1 text-warning-emphasis">{{ $t('login.recovery_title') }}</h5>
                        <div class="text-muted small" style="font-size: 0.8rem;">{{ $t('login.recovery_desc') }}</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label small fw-semibold mb-1">{{ $t('login.recovery_pass_label') }}</label>
                        <input type="password" v-model="recoveryPass" class="form-control" :placeholder="$t('login.recovery_pass_placeholder')" :disabled="restoring">
                    </div>

                    <div class="mb-3">
                        <label class="form-label small fw-semibold mb-1">{{ $t('login.recovery_file_label') }}</label>
                        <div class="d-grid">
                            <button type="button" class="btn btn-outline-secondary text-start d-flex align-items-center justify-content-between py-2" @click="triggerRecoveryFile" :disabled="restoring">
                                <span class="text-truncate me-2">
                                    <i class="fa-solid fa-file-zipper me-2 text-warning"></i>
                                    <span v-if="recoveryFile" class="fw-semibold">{{ recoveryFile.name }} ({{ formatFileSize(recoveryFile.size) }})</span>
                                    <span v-else class="text-muted">{{ $t('login.recovery_select_file') }}</span>
                                </span>
                                <i class="fa-solid fa-folder-open text-muted"></i>
                            </button>
                            <input type="file" ref="recoveryFileInput" class="d-none" accept=".zip" @change="handleRecoveryFileSelect">
                        </div>
                    </div>

                    <div v-if="restoring" class="mb-3 animate-in">
                        <div class="modern-progress" style="height: 6px;">
                            <div class="modern-progress-bar" :style="{width: uploadPercent + '%'}"></div>
                        </div>
                        <div class="text-muted small mt-1 d-flex justify-content-between" style="font-size: 0.75rem;">
                            <span>{{ restoreStatusText }}</span>
                            <span>{{ uploadPercent }}%</span>
                        </div>
                    </div>

                    <button class="btn btn-warning w-100 mb-2 py-2 fw-bold text-dark" @click="startDisasterRecovery" :disabled="restoring || !recoveryFile || !recoveryPass">
                        <i class="fa-solid fa-rotate-left me-1"></i> {{ $t('login.recovery_btn_start') }}
                    </button>

                    <div class="text-center mt-3">
                        <button class="btn btn-link text-secondary small text-decoration-none" @click="switchMode('password')" :disabled="restoring">
                            <i class="fa-solid fa-arrow-left me-1"></i> {{ $t('login.recovery_btn_cancel') }}
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
        const restoreStatusText = ref('');
        const restoreInput = ref(null);
        const recoveryFileInput = ref(null);

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
        
        // Mode switchable state: 'password', '2fa', or 'recovery'
        const loginMode = ref('password');

        // Disaster Recovery States
        const recoveryPass = ref('');
        const recoveryFile = ref(null);

        const formatFileSize = (bytes) => {
            if (!bytes) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            let size = bytes;
            let unitIdx = 0;
            while (size >= 1024 && unitIdx < units.length - 1) {
                size /= 1024;
                unitIdx++;
            }
            return `${size.toFixed(1)} ${units[unitIdx]}`;
        };

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
            if (mode !== 'recovery') {
                localStorage.setItem('preferred_login_mode', mode);
            }
            if (mode === 'password') {
                refreshCaptcha();
                loginCaptcha.value = '';
            } else if (mode === '2fa') {
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

        const triggerRestore = () => restoreInput.value && restoreInput.value.click();
        const triggerRecoveryFile = () => recoveryFileInput.value && recoveryFileInput.value.click();

        const handleRecoveryFileSelect = (e) => {
            const file = e.target.files[0];
            if (file) {
                recoveryFile.value = file;
            }
            e.target.value = '';
        };

        const executeRestore = async (file, adminPassword = '') => {
            if (!file) return;

            restoring.value = true;
            uploadPercent.value = 0;
            restoreStatusText.value = t('setup.restoring_uploading');

            const reqHeaders = adminPassword ? { 'x-admin-password': adminPassword } : {};

            try {
                let filename;
                if (isLargeFile(file)) {
                    const chunkResult = await uploadFileWithChunk(file, {
                        initUrl: '/api/panel/backups/import-chunk/init',
                        uploadUrl: '/api/panel/backups/import-chunk/upload',
                        completeUrl: '/api/panel/backups/import-chunk/complete',
                        cancelUrl: '/api/panel/backups/import-chunk/cancel',
                        headers: reqHeaders,
                        onProgress: (bytesDone, bytesTotal) => {
                            uploadPercent.value = Math.round((bytesDone * 100) / bytesTotal);
                        }
                    });
                    filename = chunkResult.filename;
                } else {
                    const formData = new FormData();
                    formData.append('backup', file);
                    showToast('setup.restoring_uploading', 'info');
                    const uploadRes = await api.post('/api/panel/backups/import', formData, {
                        headers: { 'Content-Type': 'multipart/form-data', ...reqHeaders },
                        onUploadProgress: (p) => {
                            if (p.total) {
                                uploadPercent.value = Math.round((p.loaded * 100) / p.total);
                            }
                        }
                    });
                    filename = uploadRes.data.filename;
                }
                
                restoreStatusText.value = t('setup.restoring_applying');
                showToast('setup.restoring_applying', 'info');
                await api.post('/api/panel/backups/restore', { filename, adminPassword }, { headers: reqHeaders });
                
                await waitForPanel();
                window.location.reload();
            } catch (e) {
                restoring.value = false;
                showToast(e.response?.data?.error || e.message, 'danger');
            }
        };

        const handleSetupRestore = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await executeRestore(file, '');
            }
            e.target.value = '';
        };

        const startDisasterRecovery = async () => {
            if (!recoveryPass.value) {
                showToast('login.recovery_no_pass', 'warning');
                return;
            }
            if (!recoveryFile.value) {
                showToast('login.recovery_no_file', 'warning');
                return;
            }
            await executeRestore(recoveryFile.value, recoveryPass.value);
        };

        return {
            store, hasIcon, restoring, uploadPercent, restoreStatusText, restoreInput, recoveryFileInput,
            initUser, initPass, initConfirmPass, enable2FA, init2FAToken,
            loginUser, loginPass, loginCaptcha, login2FAToken, captchaSvg, loginMode,
            recoveryPass, recoveryFile, formatFileSize,
            refreshCaptcha, switchMode, setupAdmin, loginPassword, login2FA,
            toggleTheme, toggleLang, triggerRestore, triggerRecoveryFile,
            handleRecoveryFileSelect, handleSetupRestore, startDisasterRecovery
        };
    }
};