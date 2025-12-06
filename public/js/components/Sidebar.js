import { store } from '../store.js';
import { api } from '../api.js';

export default {
    template: `
    <div class="sidebar p-3 overflow-auto">
        <h5 class="mb-4 px-2 fw-bold"><i class="fa-solid fa-cube me-2 text-primary"></i>MC Panel</h5>
        
        <nav class="nav flex-column mb-3">
            <a class="nav-link" :class="{active: store.view === 'dashboard'}" @click="store.view='dashboard'"><i class="fa-solid fa-terminal me-2"></i> 控制台</a>
            <a class="nav-link" :class="{active: store.view === 'properties'}" @click="store.view='properties'"><i class="fa-solid fa-sliders me-2"></i> 服务器设置</a>
            <a class="nav-link" :class="{active: store.view === 'mods'}" @click="store.view='mods'"><i class="fa-solid fa-microchip me-2"></i> 模组管理</a>
            <a class="nav-link" :class="{active: store.view === 'files'}" @click="store.view='files'"><i class="fa-solid fa-folder-open me-2"></i> 文件管理</a>
            <a v-if="store.hasBackupMod" class="nav-link" :class="{active: store.view === 'backups'}" @click="store.view='backups'"><i class="fa-solid fa-clock-rotate-left me-2"></i> 备份管理</a>
            <a v-if="store.hasEasyAuth" class="nav-link" :class="{active: store.view === 'easyauth'}" @click="store.view='easyauth'"><i class="fa-solid fa-user-shield me-2"></i> 认证管理</a>
            <a class="nav-link" :class="{active: store.view === 'players'}" @click="store.view='players'"><i class="fa-solid fa-users me-2"></i> 玩家管理</a>
        </nav>

        <div class="card mb-3">
            <div class="card-header py-1 px-2 small fw-bold bg-body-tertiary text-body-secondary">MC 服务器信息</div>
            <div class="card-body p-2">
                <div class="status-row"><span class="text-muted">状态</span><span class="badge" :class="store.isRunning?'bg-success':'bg-danger'">{{ store.isRunning?'运行中':'停止' }}</span></div>
                <div class="status-row"><span class="text-muted">在线人数</span><span>{{ store.stats.mc.online }} / {{ store.stats.mc.maxPlayers }}</span></div>
                <div class="progress progress-sm mb-2"><div class="progress-bar bg-success" role="progressbar" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div></div>
                <div class="status-row"><span class="text-muted">端口</span><span class="text-primary font-monospace">{{ store.stats.mc.port }}</span></div>
                <div class="status-row"><span class="text-muted text-truncate d-block" style="max-width: 100%;" :title="store.stats.mc.motd">{{ store.stats.mc.motd }}</span></div>
            </div>
        </div>

        <div class="card mb-auto">
            <div class="card-header py-1 px-2 small fw-bold bg-body-tertiary text-body-secondary">系统资源监控</div>
            <div class="card-body p-2">
                <div class="status-row"><span class="text-muted">CPU 负载</span><span>{{ store.stats.cpu }}%</span></div>
                <div class="progress progress-sm mb-2"><div class="progress-bar bg-info" role="progressbar" :style="{width: store.stats.cpu + '%'}"></div></div>
                <div class="status-row"><span class="text-muted">内存使用</span><span>{{ store.stats.mem.percentage }}%</span></div>
                <div class="progress progress-sm mb-1"><div class="progress-bar bg-warning" role="progressbar" :style="{width: store.stats.mem.percentage + '%'}"></div></div>
                <div class="text-end small text-muted" style="font-size: 0.75rem;">{{ store.stats.mem.used }}GB / {{ store.stats.mem.total }}GB</div>
            </div>
        </div>

        <div class="mt-3 d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary flex-fill" @click="toggleTheme"><i class="fa-solid fa-circle-half-stroke"></i></button>
            <button class="btn btn-sm btn-outline-danger flex-fill" @click="logout"><i class="fa-solid fa-right-from-bracket"></i></button>
        </div>
    </div>
    `,
    setup() {
        const toggleTheme = () => document.documentElement.setAttribute('data-bs-theme', document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
        const logout = async () => { await api.post('/api/auth/logout'); location.reload(); };
        return { store, toggleTheme, logout };
    }
};