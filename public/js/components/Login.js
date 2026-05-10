import { ref, watch, onMounted } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, waitForPanel, uploadFileWithChunk, isLargeFile } from '../utils.js';

export default {
    template: `
    <div class="login-page d-flex align-items-center justify-content-center h-100 w-100">
        <div class="glass-card login-card p-5 text-center" style="width: 100%; max-width: 400px;">
            <div class="mb-4">
                 <img v-if="store.customLogoUrl" :src="store.customLogoUrl" alt="Logo" class="login-logo">
                 <img v-else-if="hasIcon" :src="'/api/server/icon?t=' + store.serverIconVersion" class="login-logo rounded-circle">
                 <img v-else src="/logo.png" alt="Logo" class="login-logo">
            </div>
            <h4 class="mb-4 fw-bold tracking-tight">{{ $t('login.title') }}</h4>
            
            <div v-if="!store.auth.isSetup" class="mb-4 animate-in">
                <div class="p-2 rounded d-inline-block mb-2" style="background: var(--c-primary-subtle);">
                    <img :src="store.auth.qrCode" class="img-fluid" style="width: 150px; border-radius: 8px;">
                </div>
                <div class="small text-muted mb-3 font-monospace">{{ store.auth.secret }}</div>
                
                <div v-if="restoring" class="mb-3">
                    <div class="modern-progress" style="height: 6px;">
                        <div class="modern-progress-bar" :style="{width: uploadPercent + '%'}"></div>
                    </div>
                    <div class="text-muted small mt-1" style="font-size: 0.7rem;">{{ uploadPercent }}% - {{ $t('setup.restoring_uploading') }}</div>
                </div>

                <div class="d-grid gap-2 mb-3">
                    <div class="alert alert-info small m-0 py-2">{{ $t('login.prompt_scan') }}</div>
                    <button class="btn btn-outline-warning btn-sm py-2 border-dashed fw-bold" @click="triggerRestore" :disabled="restoring">
                        <i class="fa-solid fa-file-import me-1"></i>{{ $t('setup.restore_from_backup') }}
                    </button>
                    <input type="file" ref="restoreInput" class="d-none" accept=".zip" @change="handleRestore">
                </div>
            </div>

            <div class="mb-4">
                <input type="text" v-model="store.auth.token" class="form-control form-control-lg login-input" :placeholder="$t('login.placeholder_code')" maxlength="6" @keyup.enter="login" autofocus>
            </div>

            <button class="btn btn-primary w-100 login-btn mb-4" @click="login">
                {{ $t('login.btn_verify') }}
            </button>
            
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

        const checkIcon = async () => {
            const img = new Image();
            img.onload = () => hasIcon.value = true;
            img.onerror = () => hasIcon.value = false;
            img.src = '/api/server/icon?t=' + Date.now();
        };

        watch(() => store.serverIconVersion, checkIcon);
        onMounted(checkIcon);

        const login = async () => {
            try {
                const res = await api.post('/api/auth/login', { token: store.auth.token });
                if (res.data.success) {
                    store.auth.loggedIn = true;
                } else {
                    showToast('login.toast_fail', 'danger');
                }
            } catch (e) { showToast('login.toast_error', 'danger'); }
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
                
                // Wait for reboot then reload
                await waitForPanel();
                window.location.reload();
            } catch (e) {
                restoring.value = false;
                showToast(e.response?.data?.error || e.message, 'danger');
            }
            e.target.value = '';
        };

        return { store, login, toggleTheme, toggleLang, hasIcon, restoring, uploadPercent, restoreInput, triggerRestore, handleRestore };
    }
};
import { messages } from '../i18n.js';