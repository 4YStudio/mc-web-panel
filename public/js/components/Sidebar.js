import { ref, watch, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';

export default {
    template: `
    <div class="sidebar d-flex flex-column h-100 overflow-hidden">
        <div class="p-4 flex-shrink-0">
            <h5 class="fw-bold d-flex align-items-center m-0">
                <img v-if="hasIcon" :src="'/api/server/icon?t=' + store.serverIconVersion" class="me-3 rounded-circle shadow-sm" width="36" height="36" style="object-fit: cover;">
                <i v-else class="fa-solid fa-cube me-3 text-primary" style="font-size: 1.5rem;"></i>
                <span style="letter-spacing: -0.5px;">MC Panel</span>
            </h5>
        </div>
        
        <div class="flex-grow-1 overflow-auto custom-scrollbar px-3">
            <nav class="nav flex-column mb-4">
                <a class="nav-link" :class="{active: store.view === 'dashboard'}" @click="selectView('dashboard')"><i class="fa-solid fa-terminal"></i> {{ $t('sidebar.dashboard') }}</a>
                <a class="nav-link" :class="{active: store.view === 'properties'}" @click="selectView('properties')"><i class="fa-solid fa-sliders"></i> {{ $t('sidebar.settings') }}</a>
                <a class="nav-link" :class="{active: store.view === 'mods'}" @click="selectView('mods')"><i class="fa-solid fa-microchip"></i> {{ $t('sidebar.mods') }}</a>
                <a class="nav-link" :class="{active: store.view === 'modrinth'}" @click="selectView('modrinth')"><i class="fa-solid fa-cloud-arrow-down"></i> {{ $t('sidebar.modrinth') }}</a>
                <a class="nav-link" :class="{active: store.view === 'files'}" @click="selectView('files')"><i class="fa-solid fa-folder-open"></i> {{ $t('sidebar.files') }}</a>
                <a v-if="store.hasBackupMod" class="nav-link" :class="{active: store.view === 'backups'}" @click="selectView('backups')"><i class="fa-solid fa-clock-rotate-left"></i> {{ $t('sidebar.backups') }}</a>
                <a v-if="store.hasEasyAuth" class="nav-link" :class="{active: store.view === 'easyauth'}" @click="selectView('easyauth')"><i class="fa-solid fa-user-shield"></i> {{ $t('sidebar.auth') }}</a>
                <a v-if="store.hasVoicechat" class="nav-link" :class="{active: store.view === 'voicechat'}" @click="selectView('voicechat')"><i class="fa-solid fa-microphone"></i> {{ $t('sidebar.voicechat') }}</a>
                <a class="nav-link" :class="{active: store.view === 'players'}" @click="selectView('players')"><i class="fa-solid fa-users"></i> {{ $t('sidebar.players') }}</a>
                <a class="nav-link" :class="{active: store.view === 'panel-settings'}" @click="selectView('panel-settings')"><i class="fa-solid fa-cog"></i> {{ $t('panel_settings.title') }}</a>
                <a class="nav-link" :class="{active: store.view === 'about'}" @click="selectView('about')"><i class="fa-solid fa-circle-info"></i> {{ $t('about.title') }}</a>
            </nav>

            <!-- Sidebar Stats (Conditionally shown) -->
            <div v-if="store.consoleInfoPosition === 'sidebar'" class="px-1 animate-in">
                <div class="card border-0 bg-body-tertiary mb-3 shadow-none overflow-hidden" style="border-radius: 12px;">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                             <span class="small fw-bold text-muted text-uppercase letter-spacing-1">{{ $t('dashboard.server_info') }}</span>
                             <span class="badge rounded-pill" style="font-size: 10px;" :class="store.isRunning?'bg-success':'bg-danger'">{{ store.isRunning ? 'ON' : 'OFF' }}</span>
                        </div>
                        <div class="d-flex align-items-center mb-1">
                             <h4 class="m-0 fw-bold me-2">{{ store.stats.mc.online }}</h4>
                             <span class="text-muted small">/ {{ store.stats.mc.maxPlayers }}</span>
                        </div>
                        <div class="progress" style="height: 4px; border-radius: 2px;">
                            <div class="progress-bar bg-success" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 bg-body-tertiary mb-3 shadow-none overflow-hidden" style="border-radius: 12px;">
                    <div class="card-body p-3">
                        <div class="mb-3">
                            <div class="d-flex justify-content-between small mb-1 fw-bold">
                                <span>CPU</span>
                                <span class="text-muted">{{ store.stats.cpu }}%</span>
                            </div>
                            <div class="progress" style="height: 4px; border-radius: 2px;">
                                <div class="progress-bar bg-primary" :style="{width: store.stats.cpu + '%'}"></div>
                            </div>
                        </div>
                        <div>
                            <div class="d-flex justify-content-between small mb-1 fw-bold">
                                <span>MEM</span>
                                <span class="text-muted">{{ store.stats.mem.percentage }}%</span>
                            </div>
                            <div class="progress" style="height: 4px; border-radius: 2px;">
                                <div class="progress-bar bg-warning" :style="{width: store.stats.mem.percentage + '%'}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="p-3 flex-shrink-0 d-flex gap-2 border-top">
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

        const checkIcon = async () => {
            const img = new Image();
            img.onload = () => hasIcon.value = true;
            img.onerror = () => hasIcon.value = false;
            img.src = '/api/server/icon?t=' + Date.now();
        };

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