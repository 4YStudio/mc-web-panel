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