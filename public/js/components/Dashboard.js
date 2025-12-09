import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, formatLog } from '../utils.js';
import { ref, nextTick, watch } from '/js/vue.esm-browser.js';

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="fw-bold m-0 tracking-tight">{{ $t('dashboard.console_title') }}</h3>
            <div>
                <button v-if="!store.isRunning" @click="serverAction('start')" class="btn btn-success px-4 shadow-sm"><i class="fa-solid fa-play me-2"></i>{{ $t('dashboard.start') }}</button>
                <button v-else @click="serverAction('stop')" class="btn btn-danger px-4 shadow-sm"><i class="fa-solid fa-stop me-2"></i>{{ $t('dashboard.stop') }}</button>
            </div>
        </div>

        <!-- System Stats Overview -->
        <div class="row g-4 mb-4">
            <div class="col-md-6">
                <div class="card h-100 border-0">
                    <div class="card-header bg-transparent border-0 pb-0 pt-4 px-4">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1"><i class="fa-solid fa-server me-2"></i>{{ $t('dashboard.server_info') }}</h6>
                             <span class="badge rounded-pill font-monospace" :class="store.isRunning?'bg-success-subtle text-success':'bg-danger-subtle text-danger'">{{ store.isRunning ? $t('dashboard.state_running') : $t('dashboard.state_stopped') }}</span>
                        </div>
                    </div>
                    <div class="card-body px-4 pb-4">
                         <div class="d-flex align-items-end mb-3">
                             <div class="display-6 fw-bold me-2">{{ store.stats.mc.online }}</div>
                             <div class="text-muted mb-2">/ {{ store.stats.mc.maxPlayers }} {{ $t('dashboard.online_players') }}</div>
                         </div>
                         
                         <div class="progress mb-3" style="height: 8px; border-radius: 4px;">
                            <div class="progress-bar bg-success" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div>
                         </div>
                         <div class="text-truncate small text-muted font-monospace"><i class="fa-solid fa-quote-left me-2 opacity-50"></i>{{ store.stats.mc.motd }}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                 <div class="card h-100 border-0">
                    <div class="card-header bg-transparent border-0 pb-0 pt-4 px-4">
                        <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1"><i class="fa-solid fa-microchip me-2"></i>{{ $t('dashboard.system_resource') }}</h6>
                    </div>
                    <div class="card-body px-4 pb-4">
                         <div class="mb-4">
                             <div class="d-flex justify-content-between small mb-1 fw-bold">
                                 <span>{{ $t('dashboard.cpu_usage') }}</span>
                                 <span :class="{'text-danger': store.stats.cpu > 80}">{{ store.stats.cpu }}%</span>
                             </div>
                             <div class="progress" style="height: 8px; border-radius: 4px;">
                                <div class="progress-bar bg-primary" :style="{width: store.stats.cpu + '%'}"></div>
                             </div>
                         </div>
                         <div>
                             <div class="d-flex justify-content-between small mb-1 fw-bold">
                                 <span>{{ $t('dashboard.mem_usage') }} ({{ store.stats.mem.percentage }}%)</span>
                                 <span class="text-muted font-monospace">{{ store.stats.mem.used }}G / {{ store.stats.mem.total }}G</span>
                             </div>
                             <div class="progress" style="height: 8px; border-radius: 4px;">
                                <div class="progress-bar bg-warning" :style="{width: store.stats.mem.percentage + '%'}"></div>
                             </div>
                         </div>
                    </div>
                 </div>
            </div>
        </div>

        <div class="console-output mb-3" id="consoleBox">
            <div v-for="(log,i) in store.logs" :key="i" v-html="formatLog(log)"></div>
        </div>
        <div class="input-group">
            <input type="text" class="form-control" v-model="command" @keyup.enter="sendCommand" :placeholder="$t('dashboard.send_cmd_placeholder')">
            <button class="btn btn-primary" @click="sendCommand">{{ $t('dashboard.send') }}</button>
        </div>
    </div>
    `,
    setup() {
        const command = ref('');

        const scrollToBottom = () => {
            nextTick(() => {
                const el = document.getElementById('consoleBox');
                if (el) el.scrollTop = el.scrollHeight;
            });
        };

        // 监听日志变化自动滚动
        watch(() => store.logs.length, scrollToBottom);

        const serverAction = async (act) => { await api.post(`/api/server/${act}`); showToast('已发送'); };
        const sendCommand = async () => {
            if (command.value) {
                await api.post('/api/server/command', { command: command.value });
                command.value = '';
            }
        };

        return { store, command, serverAction, sendCommand, formatLog };
    }
};