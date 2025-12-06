import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, formatLog } from '../utils.js';
import { ref, nextTick, watch } from '/js/vue.esm-browser.js';

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>控制台</h3>
            <div>
                <button v-if="!store.isRunning" @click="serverAction('start')" class="btn btn-success"><i class="fa-solid fa-play"></i></button>
                <button v-else @click="serverAction('stop')" class="btn btn-danger"><i class="fa-solid fa-stop"></i></button>
            </div>
        </div>

        <!-- System Stats Overview -->
        <div class="row g-3 mb-3">
            <div class="col-md-6">
                <div class="card h-100 shadow-sm">
                    <div class="card-header bg-body-tertiary fw-bold small text-muted"><i class="fa-solid fa-server me-2"></i>MC 服务器信息</div>
                    <div class="card-body">
                         <div class="d-flex justify-content-between align-items-center mb-2">
                             <div class="d-flex align-items-center">
                                 <div class="rounded-circle me-2" :class="store.isRunning?'bg-success':'bg-danger'" style="width: 10px; height: 10px;"></div>
                                 <span class="fw-bold">{{ store.isRunning ? '运行中' : '停止' }}</span>
                             </div>
                             <span class="badge bg-secondary font-monospace">{{ store.stats.mc.port }}</span>
                         </div>
                         
                         <label class="small text-muted mb-1">在线人数 ({{ store.stats.mc.online }} / {{ store.stats.mc.maxPlayers }})</label>
                         <div class="progress mb-2" style="height: 6px;">
                            <div class="progress-bar bg-success" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div>
                         </div>
                         <div class="text-truncate small text-muted" :title="store.stats.mc.motd">{{ store.stats.mc.motd }}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                 <div class="card h-100 shadow-sm">
                    <div class="card-header bg-body-tertiary fw-bold small text-muted"><i class="fa-solid fa-gauge-high me-2"></i>系统资源</div>
                    <div class="card-body">
                         <div class="mb-2">
                             <div class="d-flex justify-content-between small mb-1">
                                 <span class="text-muted">CPU</span>
                                 <span>{{ store.stats.cpu }}%</span>
                             </div>
                             <div class="progress" style="height: 6px;">
                                <div class="progress-bar bg-info" :style="{width: store.stats.cpu + '%'}"></div>
                             </div>
                         </div>
                         <div>
                             <div class="d-flex justify-content-between small mb-1">
                                 <span class="text-muted">内存 ({{ store.stats.mem.used }}G / {{ store.stats.mem.total }}G)</span>
                                 <span>{{ store.stats.mem.percentage }}%</span>
                             </div>
                             <div class="progress" style="height: 6px;">
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
            <input type="text" class="form-control" v-model="command" @keyup.enter="sendCommand" placeholder="发送指令...">
            <button class="btn btn-primary" @click="sendCommand">发送</button>
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