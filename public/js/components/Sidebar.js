import { ref, watch, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';

export default {
    template: `
    <div class="sidebar d-flex flex-column h-100 overflow-auto">
        <div class="p-4 mb-2">
            <h5 class="fw-bold d-flex align-items-center m-0">
                <img v-if="hasIcon" :src="'/api/server/icon?t=' + store.serverIconVersion" class="me-3 rounded-circle shadow-sm" width="36" height="36" style="object-fit: cover;">
                <i v-else class="fa-solid fa-cube me-3 text-primary" style="font-size: 1.5rem;"></i>
                <span style="letter-spacing: -0.5px;">MC Panel</span>
            </h5>
        </div>
        
        <nav class="nav flex-column mb-auto px-3">
            <a class="nav-link" :class="{active: store.view === 'dashboard'}" @click="selectView('dashboard')"><i class="fa-solid fa-terminal"></i> {{ $t('sidebar.dashboard') }}</a>
            <a class="nav-link" :class="{active: store.view === 'properties'}" @click="selectView('properties')"><i class="fa-solid fa-sliders"></i> {{ $t('sidebar.settings') }}</a>
            <a class="nav-link" :class="{active: store.view === 'mods'}" @click="selectView('mods')"><i class="fa-solid fa-microchip"></i> {{ $t('sidebar.mods') }}</a>
            <a class="nav-link" :class="{active: store.view === 'files'}" @click="selectView('files')"><i class="fa-solid fa-folder-open"></i> {{ $t('sidebar.files') }}</a>
            <a v-if="store.hasBackupMod" class="nav-link" :class="{active: store.view === 'backups'}" @click="selectView('backups')"><i class="fa-solid fa-clock-rotate-left"></i> {{ $t('sidebar.backups') }}</a>
            <a v-if="store.hasEasyAuth" class="nav-link" :class="{active: store.view === 'easyauth'}" @click="selectView('easyauth')"><i class="fa-solid fa-user-shield"></i> {{ $t('sidebar.auth') }}</a>
            <a v-if="store.hasVoicechat" class="nav-link" :class="{active: store.view === 'voicechat'}" @click="selectView('voicechat')"><i class="fa-solid fa-microphone"></i> {{ $t('sidebar.voicechat') }}</a>
            <a class="nav-link" :class="{active: store.view === 'players'}" @click="selectView('players')"><i class="fa-solid fa-users"></i> {{ $t('sidebar.players') }}</a>
            <a class="nav-link" :class="{active: store.view === 'panel-settings'}" @click="selectView('panel-settings')"><i class="fa-solid fa-cog"></i> {{ $t('panel_settings.title') }}</a>
        </nav>

        <div class="p-3 mt-auto d-flex gap-2">
            <button class="btn btn-sm btn-light flex-fill border" @click="toggleLang" :title="$t('common.switchLang')">
                <i class="fa-solid fa-language"></i> {{ store.lang === 'zh' ? 'EN' : '中' }}
            </button>
            <button class="btn btn-sm btn-light flex-fill border" @click="toggleTheme" :title="$t('common.switchTheme')"><i class="fa-solid fa-circle-half-stroke"></i></button>
            <button class="btn btn-sm btn-light flex-fill border text-danger" @click="logout" :title="$t('common.logout')"><i class="fa-solid fa-right-from-bracket"></i></button>
        </div>
    </div>
    `,
    setup(props, { emit }) {
        const hasIcon = ref(false);
        const { proxy } = getCurrentInstance(); // Need proxy for $t? No, used in template. But good to have.
        // Actually Sidebar uses {{ $t(...) }} in template which uses globalProperties.

        const checkIcon = async () => {
            // Try to load the image to see if it exists
            const img = new Image();
            img.onload = () => hasIcon.value = true;
            img.onerror = () => hasIcon.value = false;
            img.src = '/api/server/icon?t=' + Date.now();
        };

        // Watch for version changes to re-check
        watch(() => store.serverIconVersion, checkIcon);
        onMounted(checkIcon);

        const toggleTheme = () => {
            const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        };

        const toggleLang = () => {
            store.lang = store.lang === 'zh' ? 'en' : 'zh';
            localStorage.setItem('lang', store.lang);
        };

        const logout = async () => { await api.post('/api/auth/logout'); location.reload(); };

        const selectView = (view) => {
            store.view = view;
            emit('close-sidebar');
        };

        return { store, toggleTheme, toggleLang, logout, selectView, hasIcon };
    }
};