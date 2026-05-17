import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, formatLog, t, openModal } from '../utils.js';
import { ref, nextTick, watch, onMounted } from '/js/vue.esm-browser.js';
import SetupWizard from './SetupWizard.js';

export default {
    components: { SetupWizard },
    template: `
    <div class="h-100 d-flex flex-column overflow-hidden">
        <!-- Setup Wizard -->
        <SetupWizard v-if="!store.isSetup" @setup-complete="onSetupComplete" />

        <!-- Normal Dashboard -->
        <div v-else class="h-100 d-flex flex-column animate-in delay-100">
            <div class="page-header d-flex justify-content-between align-items-center flex-shrink-0">
                <h3 class="fw-bold m-0 tracking-tight">{{ $t('dashboard.console_title') }}</h3>
                <div class="d-flex gap-2">
                    <button @click="openStartupSettings" class="btn btn-outline-secondary px-2 px-md-3" :title="$t('instance_manager.settings_btn')">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                    <button v-if="!store.isRunning" @click="serverAction('start')" class="btn btn-success px-3 px-md-4 fw-bold">
                        <i class="fa-solid fa-play me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.start') }}</span>
                    </button>
                    <template v-else>
                        <button @click="serverAction('stop')" class="btn btn-danger px-3 px-md-4 fw-bold">
                            <i class="fa-solid fa-stop me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.stop') }}</span>
                        </button>
                        <button @click="forceStop" class="btn btn-outline-danger px-2 px-md-3" :title="$t('dashboard.force_stop')">
                            <i class="fa-solid fa-skull-crossbones"></i>
                        </button>
                    </template>
                </div>
            </div>

            <!-- System Stats Overview -->
            <div v-if="store.consoleInfoPosition === 'top'" class="row g-3 mb-3 flex-shrink-0">
                <div class="col-md-6 stagger-item">
                    <div class="stat-card h-100">
                        <div class="stat-card-header">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1" style="font-size: 0.6875rem;"><i class="fa-solid fa-server me-2"></i>{{ $t('dashboard.server_info') }}</h6>
                                 <span class="badge rounded-pill font-monospace" :class="store.isRunning?'bg-success-subtle text-success':'bg-danger-subtle text-danger'">{{ store.isRunning ? $t('dashboard.state_running') : $t('dashboard.state_stopped') }}</span>
                            </div>
                        </div>
                        <div class="stat-card-body">
                              <div v-if="store.stats && store.stats.mc" class="d-flex align-items-end mb-2">
                                  <div class="fw-bold me-2" style="font-size: 2rem; line-height: 1;">{{ store.stats.mc.online }}</div>
                                  <div class="text-muted mb-1 small">/ {{ store.stats.mc.maxPlayers }} {{ $t('dashboard.online_players') }}</div>
                              </div>
                             
                              <div v-if="store.stats && store.stats.mc" class="progress mb-3" style="height: 4px;">
                                 <div class="progress-bar bg-success" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div>
                              </div>
                              <div v-if="store.stats && store.stats.mc" class="text-truncate small text-muted font-monospace mb-2"><i class="fa-solid fa-quote-left me-2 opacity-50"></i>{{ store.stats.mc.motd }}</div>
                             
                             <div class="d-flex justify-content-between small text-muted border-top pt-2 mt-2 flex-wrap gap-2" style="font-size: 0.6875rem; border-color: var(--c-border-subtle) !important;">
                                <span>{{ $t('dashboard.target') }}: {{ store.stats.version?.mc || 'Unknown' }}</span>
                                <span>{{ $t('dashboard.loader') }}: {{ store.stats.version?.loader || 'Unknown' }}</span>
                                <span>{{ $t('dashboard.java_version') }}: <span class="fw-bold">{{ store.stats.javaVersion || 'Checking...' }}</span></span>
                             </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 stagger-item" style="animation-delay: 0.1s;">
                     <div class="stat-card h-100">
                        <div class="stat-card-header">
                            <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1" style="font-size: 0.6875rem;"><i class="fa-solid fa-microchip me-2"></i>{{ $t('dashboard.system_resource') }}</h6>
                        </div>
                        <div class="stat-card-body">
                             <div class="mb-3">
                                 <div class="d-flex justify-content-between small mb-1 fw-bold">
                                     <span>{{ $t('dashboard.cpu_usage') }}</span>
                                     <span :class="{'text-danger': store.stats.cpu > 80}">{{ store.stats.cpu }}%</span>
                                 </div>
                                 <div class="progress" style="height: 4px;">
                                    <div class="progress-bar" :style="{width: store.stats.cpu + '%'}"></div>
                                 </div>
                             </div>
                             <div>
                                 <div class="d-flex justify-content-between small mb-1 fw-bold">
                                     <span>{{ $t('dashboard.mem_usage') }} ({{ store.stats.mem.percentage }}%)</span>
                                     <span class="text-muted font-monospace" style="font-size: 0.6875rem;">{{ store.stats.mem.used }}G / {{ store.stats.mem.total }}G</span>
                                 </div>
                                 <div class="progress" style="height: 4px;">
                                    <div class="progress-bar bg-warning" :style="{width: store.stats.mem.percentage + '%'}"></div>
                                 </div>
                             </div>
                        </div>
                     </div>
                </div>
            </div>

            <div class="console-output flex-grow-1 mb-3 position-relative" id="consoleBox">
                <div v-for="(log,i) in store.logs" :key="i" v-html="formatLog(log)"></div>
            </div>
            
            <div class="input-group flex-shrink-0 cmd-input-group">
                <input type="text" class="form-control" v-model="command" @keyup.enter="sendCommand" :placeholder="$t('dashboard.send_cmd_placeholder')">
                <button class="btn btn-primary fw-bold" @click="sendCommand">{{ $t('dashboard.send') }}</button>
            </div>
        </div>

        <!-- Startup Settings Modal -->
        <div class="modal fade" id="startupModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fa-solid fa-gear me-2 text-primary"></i>{{ $t('instance_manager.settings_btn') }}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.jar_name') }}</label>
                            <div class="d-flex gap-2 align-items-center">
                                <div style="flex:1;min-width:0">
                                    <CustomSelect v-model="form.jarName" :options="jars.length ? jars : (form.jarName ? [form.jarName] : [])" :placeholder="$t('panel_settings.jar_name')" />
                                </div>
                                <button class="btn btn-outline-secondary flex-shrink-0" @click="fetchJars"><i class="fa-solid fa-rotate"></i></button>
                            </div>
                        </div>
                        <div class="mb-0">
                            <label class="form-label small fw-bold text-muted">{{ $t('instance_manager.java_args_label') }}</label>
                            <textarea class="form-control font-monospace small" rows="5" v-model="form.javaArgs" :placeholder="$t('instance_manager.java_args_placeholder')"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary px-4" data-bs-dismiss="modal">{{ $t('common.cancel') }}</button>
                        <button class="btn btn-primary px-4" @click="saveStartupSettings" :disabled="saving">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                            {{ $t('common.confirm') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const command = ref('');
        const startupModal = ref(null);
        const saving = ref(false);
        const jars = ref([]);
        const form = ref({ jarName: '', javaArgs: '' });

        const scrollToBottom = () => {
            nextTick(() => {
                const el = document.getElementById('consoleBox');
                if (el) el.scrollTop = el.scrollHeight;
            });
        };

        const onSetupComplete = () => {
            store.isSetup = true;
            location.reload();
        };

        const fetchJars = async () => {
            try {
                const res = await api.get('/api/panel/jars');
                jars.value = res.data;
            } catch (e) { }
        };

        const openStartupSettings = () => {
            const inst = store.instanceList.find(i => i.id === store.currentInstanceId);
            if (inst) {
                form.value = {
                    jarName: inst.jarName || '',
                    javaArgs: Array.isArray(inst.javaArgs) ? inst.javaArgs.join('\n') : (inst.javaArgs || '')
                };
            }
            fetchJars();
            startupModal.value.show();
        };

        const saveStartupSettings = async () => {
            saving.value = true;
            try {
                const payload = {
                    id: store.currentInstanceId,
                    ...form.value
                };
                payload.javaArgs = (payload.javaArgs || '').split('\n').map(a => a.trim()).filter(a => a);
                await api.post('/api/instances/update', payload);
                showToast('instance_manager.update_success');
                startupModal.value.hide();
                // Refresh instances to update local state
                const res = await api.get('/api/instances/list');
                store.instanceList = res.data;
            } catch (e) {
                showToast(e.response?.data?.error || 'common.error', 'danger');
            } finally {
                saving.value = false;
            }
        };

        watch(() => store.logs.length, scrollToBottom);

        onMounted(() => {
            scrollToBottom();
            setTimeout(scrollToBottom, 100);
            startupModal.value = new bootstrap.Modal(document.getElementById('startupModal'));
        });

        const serverAction = async (act) => {
            try {
                await api.post(`/api/server/${act}`);
                showToast('dashboard.toast_sent');
            } catch (e) {
                showToast('common.error', 'danger');
            }
        };

        const forceStop = () => {
            openModal({
                title: t('dashboard.force_stop_confirm_title'),
                message: t('dashboard.force_stop_confirm_msg'),
                callback: async () => {
                    try {
                        await api.post('/api/server/force_stop');
                        showToast('dashboard.force_stop_sent');
                    } catch (e) {
                        showToast('common.error', 'danger');
                    }
                }
            });
        };

        const sendCommand = async () => {
            if (command.value) {
                await api.post('/api/server/command', { command: command.value });
                command.value = '';
            }
        };

        return { store, command, serverAction, forceStop, sendCommand, formatLog, onSetupComplete, openStartupSettings, saveStartupSettings, saving, form, jars, fetchJars };
    }
};