import { ref, watch, onMounted } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';

export default {
    template: `
    <div class="sidebar p-3 d-flex flex-column h-100 overflow-auto">
        <h5 class="mb-4 px-2 fw-bold d-flex align-items-center">
            <img v-if="hasIcon" :src="'/api/server/icon?t=' + store.serverIconVersion" class="me-2 rounded" width="32" height="32" style="object-fit: cover;">
            <i v-else class="fa-solid fa-cube me-2 text-primary" style="font-size: 1.5rem;"></i>
            MC Panel
        </h5>
        
        <nav class="nav flex-column mb-auto">
            <a class="nav-link" :class="{active: store.view === 'dashboard'}" @click="selectView('dashboard')"><i class="fa-solid fa-terminal me-2"></i> 控制台</a>
            <a class="nav-link" :class="{active: store.view === 'properties'}" @click="selectView('properties')"><i class="fa-solid fa-sliders me-2"></i> 服务器设置</a>
            <a class="nav-link" :class="{active: store.view === 'mods'}" @click="selectView('mods')"><i class="fa-solid fa-microchip me-2"></i> 模组管理</a>
            <a class="nav-link" :class="{active: store.view === 'files'}" @click="selectView('files')"><i class="fa-solid fa-folder-open me-2"></i> 文件管理</a>
            <a v-if="store.hasBackupMod" class="nav-link" :class="{active: store.view === 'backups'}" @click="selectView('backups')"><i class="fa-solid fa-clock-rotate-left me-2"></i> 备份管理</a>
            <a v-if="store.hasEasyAuth" class="nav-link" :class="{active: store.view === 'easyauth'}" @click="selectView('easyauth')"><i class="fa-solid fa-user-shield me-2"></i> 认证管理</a>
            <a v-if="store.hasVoicechat" class="nav-link" :class="{active: store.view === 'voicechat'}" @click="selectView('voicechat')"><i class="fa-solid fa-microphone me-2"></i> 语音设置</a>
            <a class="nav-link" :class="{active: store.view === 'players'}" @click="selectView('players')"><i class="fa-solid fa-users me-2"></i> 玩家管理</a>
        </nav>

        <div class="mt-auto d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary flex-fill" @click="toggleTheme"><i class="fa-solid fa-circle-half-stroke"></i></button>
            <button class="btn btn-sm btn-outline-danger flex-fill" @click="logout"><i class="fa-solid fa-right-from-bracket"></i></button>
        </div>
    </div>
    `,
    setup(props, { emit }) {
        const hasIcon = ref(false);

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
        const logout = async () => { await api.post('/api/auth/logout'); location.reload(); };

        const selectView = (view) => {
            store.view = view;
            emit('close-sidebar');
        };

        return { store, toggleTheme, logout, selectView, hasIcon };
    }
};