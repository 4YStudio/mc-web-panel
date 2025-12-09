import { ref, watch, onMounted } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';

export default {
    template: `
    <div class="d-flex align-items-center justify-content-center h-100 w-100" style="background: radial-gradient(circle at center, var(--c-bg-base), #000000 150%);">
        <div class="glass-card p-4 p-md-5 text-center" style="width: 100%; max-width: 400px;">
            <div class="mb-4">
                 <img v-if="hasIcon" :src="'/api/server/icon?t=' + store.serverIconVersion" class="rounded-circle shadow-lg" width="80" height="80" style="object-fit: cover;">
                 <i v-else class="fa-solid fa-cube text-primary" style="font-size: 4rem;"></i>
            </div>
            <h4 class="mb-4 fw-bold">{{ $t('login.title') }}</h4>
            
            <div v-if="!store.auth.isSetup" class="mb-4">
                <div class="p-2 bg-white rounded d-inline-block shadow-sm">
                    <img :src="store.auth.qrCode" class="img-fluid" style="width: 150px;">
                </div>
                <div class="small text-muted mt-2 font-monospace">{{ store.auth.secret }}</div>
                <div class="alert alert-info mt-3 small">{{ $t('login.prompt_scan') }}</div>
            </div>

            <div class="mb-4">
                <input type="text" v-model="store.auth.token" class="form-control form-control-lg text-center font-monospace" :placeholder="$t('login.placeholder_code')" maxlength="6" @keyup.enter="login" autofocus style="letter-spacing: 4px;">
            </div>

            <button class="btn btn-primary w-100 btn-lg mb-3 shadow-sm" @click="login">
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
                    showToast(messages[store.lang].login.toast_fail, 'danger');
                }
            } catch (e) { showToast(messages[store.lang].login.toast_error, 'danger'); }
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

        return { store, login, toggleTheme, toggleLang, hasIcon };
    }
};
import { messages } from '../i18n.js';