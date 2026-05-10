import { ref, watch, onMounted, computed } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';

export default {
    template: `
    <div class="sidebar d-flex flex-column h-100 overflow-hidden">
        <div class="p-4 pb-3 flex-shrink-0">
            <h5 class="fw-bold d-flex align-items-center m-0 text-truncate tracking-tight" style="font-size: 0.9375rem;">
                <img v-if="hasIcon" :src="'/api/server/icon?instanceId=' + store.currentInstanceId + '&t=' + store.serverIconVersion" class="me-3 rounded-circle" width="32" height="32" style="object-fit: cover; box-shadow: 0 2px 8px rgba(var(--c-primary-rgb), 0.12);">
                <img v-else-if="store.customLogoUrl" :src="store.customLogoUrl" alt="Logo" class="me-3" style="width: 32px; height: 32px; object-fit: contain;">
                <img v-else src="/logo.png" alt="Logo" class="me-3" style="width: 32px; height: 32px; object-fit: contain;">
                <span>{{ currentInstance ? currentInstance.name : 'MC Panel' }}</span>
            </h5>
        </div>

        <div class="flex-grow-1 overflow-auto custom-scrollbar px-3 pt-2">
            <nav class="nav flex-column mb-3">
                <a class="nav-link sidebar-item" :class="{active: store.view === 'dashboard'}" @click="selectView('dashboard')"><i class="fa-solid fa-terminal"></i> {{ $t('sidebar.dashboard') }}</a>
                <a class="nav-link sidebar-item" :class="{active: store.view === 'properties'}" @click="selectView('properties')"><i class="fa-solid fa-sliders"></i> {{ $t('sidebar.settings') }}</a>
                <a class="nav-link sidebar-item" :class="{active: store.view === 'mods'}" @click="selectView('mods')"><i class="fa-solid fa-microchip"></i> {{ $t('sidebar.mods') }}</a>
                <a class="nav-link sidebar-item" :class="{active: store.view === 'modrinth'}" @click="selectView('modrinth')"><i class="fa-solid fa-cloud-arrow-down"></i> {{ $t('sidebar.modrinth') }}</a>
                <a class="nav-link sidebar-item" :class="{active: store.view === 'files'}" @click="selectView('files')"><i class="fa-solid fa-folder-open"></i> {{ $t('sidebar.files') }}</a>
                <a v-if="currentInstance && (currentInstance.hasBackupMod || currentInstance.backupStrategy === 'panel')" 
                   class="nav-link sidebar-item" :class="{active: store.view === 'backups'}" @click="selectView('backups')">
                    <i class="fa-solid fa-clock-rotate-left"></i> 
                    {{ (currentInstance && currentInstance.backupStrategy === 'panel') ? $t('map_backup.title') : $t('sidebar.backups') }}
                </a>
                <a v-if="store.hasEasyAuth" class="nav-link sidebar-item" :class="{active: store.view === 'easyauth'}" @click="selectView('easyauth')"><i class="fa-solid fa-user-shield"></i> {{ $t('sidebar.auth') }}</a>
                <a v-if="store.hasVoicechat" class="nav-link sidebar-item" :class="{active: store.view === 'voicechat'}" @click="selectView('voicechat')"><i class="fa-solid fa-microphone"></i> {{ $t('sidebar.voicechat') }}</a>
                <a class="nav-link sidebar-item" :class="{active: store.view === 'players'}" @click="selectView('players')"><i class="fa-solid fa-users"></i> {{ $t('sidebar.players') }}</a>
                <a v-for="item in store.pluginSidebarItems.filter(i => i.location === 'instance' || i.location === 'both')" :key="item.id" class="nav-link sidebar-item" :class="{active: store.view === item.view}" @click="selectView(item.view)">
                    <i class="fa-solid" :class="item.icon" :style="item.color ? 'color:' + item.color : ''"></i> {{ $t(item.labelKey) || item.labelKey }}
                </a>
            </nav>

            <div v-if="store.consoleInfoPosition === 'sidebar'" class="px-1 animate-in">
                <div class="stat-card mb-3 shadow-none overflow-hidden" style="border-radius: 12px;">
                    <div class="stat-card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                             <span class="small fw-bold text-muted text-uppercase letter-spacing-1" style="font-size: 0.625rem;">{{ $t('dashboard.server_info') }}</span>
                             <span class="badge rounded-pill" style="font-size: 9px;" :class="store.isRunning?'bg-success':'bg-danger'">{{ store.isRunning ? 'ON' : 'OFF' }}</span>
                        </div>
                        <div v-if="store.stats && store.stats.mc" class="d-flex align-items-center mb-1">
                             <h4 class="m-0 fw-bold me-2" style="font-size: 1.25rem;">{{ store.stats.mc.online }}</h4>
                             <span class="text-muted small">/ {{ store.stats.mc.maxPlayers }}</span>
                        </div>
                        <div v-if="store.stats && store.stats.mc" class="progress" style="height: 3px; border-radius: 2px;">
                            <div class="progress-bar bg-success" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div>
                        </div>
                    </div>
                </div>

                <div class="stat-card mb-3 shadow-none overflow-hidden" style="border-radius: 12px;">
                    <div class="stat-card-body p-3">
                        <div class="mb-3">
                            <div class="d-flex justify-content-between small mb-1 fw-bold" style="font-size: 0.75rem;">
                                <span>CPU</span>
                                <span class="text-muted">{{ store.stats.cpu }}%</span>
                            </div>
                            <div class="progress" style="height: 3px; border-radius: 2px;">
                                <div class="progress-bar" :style="{width: store.stats.cpu + '%'}"></div>
                            </div>
                        </div>
                        <div>
                            <div class="d-flex justify-content-between small mb-1 fw-bold" style="font-size: 0.75rem;">
                                <span>MEM</span>
                                <span class="text-muted">{{ store.stats.mem.percentage }}%</span>
                            </div>
                            <div class="progress" style="height: 3px; border-radius: 2px;">
                                <div class="progress-bar bg-warning" :style="{width: store.stats.mem.percentage + '%'}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="p-3 border-top flex-shrink-0" style="border-color: var(--c-border-subtle) !important;">
             <div class="px-1">
                <a class="nav-link p-2 d-flex align-items-center justify-content-center text-primary small" @click="backToInstances" style="cursor: pointer; font-weight: 600; background: var(--c-primary-glow); border-radius: 10px; border: 1px solid rgba(var(--c-primary-rgb), 0.1);">
                    <i class="fa-solid fa-chevron-left me-2"></i>{{ $t('instance_manager.back_to_list') }}
                </a>
            </div>
        </div>
    </div>
    `,
    setup(props, { emit }) {
        const hasIcon = ref(false);

        const currentInstance = computed(() => {
            return store.instanceList.find(i => i.id === store.currentInstanceId);
        });

        const checkIcon = async () => {
            if (!store.currentInstanceId) {
                hasIcon.value = false;
                return;
            }
            const img = new Image();
            img.onload = () => hasIcon.value = true;
            img.onerror = () => hasIcon.value = false;
            img.src = `/api/server/icon?instanceId=${store.currentInstanceId}&t=${Date.now()}`;
        };

        watch(() => store.currentInstanceId, checkIcon);
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

        const backToInstances = () => {
            store.view = 'instance-manager';
            store.currentInstanceId = null;
            emit('close-sidebar');
        };

        return { store, toggleTheme, toggleLang, logout, selectView, hasIcon, currentInstance, backToInstances };
    }
};