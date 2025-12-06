import { store } from '../store.js';
import { api } from '../api.js';

export default {
    template: `
    <div class="sidebar p-3 d-flex flex-column h-100 overflow-auto">
        <h5 class="mb-4 px-2 fw-bold"><i class="fa-solid fa-cube me-2 text-primary"></i>MC Panel</h5>
        
        <nav class="nav flex-column mb-auto">
            <a class="nav-link" :class="{active: store.view === 'dashboard'}" @click="store.view='dashboard'"><i class="fa-solid fa-terminal me-2"></i> 控制台</a>
            <a class="nav-link" :class="{active: store.view === 'properties'}" @click="store.view='properties'"><i class="fa-solid fa-sliders me-2"></i> 服务器设置</a>
            <a class="nav-link" :class="{active: store.view === 'mods'}" @click="store.view='mods'"><i class="fa-solid fa-microchip me-2"></i> 模组管理</a>
            <a class="nav-link" :class="{active: store.view === 'files'}" @click="store.view='files'"><i class="fa-solid fa-folder-open me-2"></i> 文件管理</a>
            <a v-if="store.hasBackupMod" class="nav-link" :class="{active: store.view === 'backups'}" @click="store.view='backups'"><i class="fa-solid fa-clock-rotate-left me-2"></i> 备份管理</a>
            <a v-if="store.hasEasyAuth" class="nav-link" :class="{active: store.view === 'easyauth'}" @click="store.view='easyauth'"><i class="fa-solid fa-user-shield me-2"></i> 认证管理</a>
            <a v-if="store.hasVoicechat" class="nav-link" :class="{active: store.view === 'voicechat'}" @click="store.view='voicechat'"><i class="fa-solid fa-microphone me-2"></i> 语音设置</a>
            <a class="nav-link" :class="{active: store.view === 'players'}" @click="store.view='players'"><i class="fa-solid fa-users me-2"></i> 玩家管理</a>
        </nav>

        <div class="mt-auto d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary flex-fill" @click="toggleTheme"><i class="fa-solid fa-circle-half-stroke"></i></button>
            <button class="btn btn-sm btn-outline-danger flex-fill" @click="logout"><i class="fa-solid fa-right-from-bracket"></i></button>
        </div>
    </div>
    `,
    setup() {
        const toggleTheme = () => {
            const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        };
        const logout = async () => { await api.post('/api/auth/logout'); location.reload(); };
        return { store, toggleTheme, logout };
    }
};