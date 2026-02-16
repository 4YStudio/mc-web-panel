import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, formatLog, t } from '../utils.js';
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
            <div class="d-flex justify-content-between align-items-center mb-3 mb-md-4 flex-shrink-0">
                <h3 class="fw-bold m-0 tracking-tight">{{ $t('dashboard.console_title') }}</h3>
                <div class="d-flex gap-2">
                    <button @click="openStartupSettings" class="btn btn-outline-secondary border shadow-sm px-2 px-md-3" style="border-radius: 10px;" :title="$t('instance_manager.settings_btn')">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                    <button v-if="!store.isRunning" @click="serverAction('start')" class="btn btn-success px-3 px-md-4 shadow-sm fw-bold" style="border-radius: 10px;">
                        <i class="fa-solid fa-play me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.start') }}</span>
                    </button>
                    <button v-else @click="serverAction('stop')" class="btn btn-danger px-3 px-md-4 shadow-sm fw-bold" style="border-radius: 10px;">
                        <i class="fa-solid fa-stop me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.stop') }}</span>
                    </button>
                </div>
            </div>

            <!-- System Stats Overview (Conditionally shown) -->
            <div v-if="store.consoleInfoPosition === 'top'" class="row g-3 g-md-4 mb-3 mb-md-4 flex-shrink-0">
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header bg-transparent border-0 pb-0 pt-3 pt-md-4 px-3 px-md-4">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1"><i class="fa-solid fa-server me-2"></i>{{ $t('dashboard.server_info') }}</h6>
                                 <span class="badge rounded-pill font-monospace" :class="store.isRunning?'bg-success-subtle text-success':'bg-danger-subtle text-danger'">{{ store.isRunning ? $t('dashboard.state_running') : $t('dashboard.state_stopped') }}</span>
                            </div>
                        </div>
                        <div class="card-body px-3 px-md-4 pb-3 pb-md-4">
                              <div v-if="store.stats && store.stats.mc" class="d-flex align-items-end mb-2 mb-md-3">
                                  <div class="display-6 fw-bold me-2">{{ store.stats.mc.online }}</div>
                                  <div class="text-muted mb-2 small">/ {{ store.stats.mc.maxPlayers }} {{ $t('dashboard.online_players') }}</div>
                              </div>
                             
                              <div v-if="store.stats && store.stats.mc" class="progress mb-3" style="height: 6px; border-radius: 3px;">
                                 <div class="progress-bar bg-success" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div>
                              </div>
                              <div v-if="store.stats && store.stats.mc" class="text-truncate small text-muted font-monospace mb-2"><i class="fa-solid fa-quote-left me-2 opacity-50"></i>{{ store.stats.mc.motd }}</div>
                             
                             <div class="d-flex justify-content-between small text-muted border-top pt-2 mt-2 flex-wrap gap-2" style="font-size: 0.75rem;">
                                <span>{{ $t('dashboard.target') }}: {{ store.stats.version?.mc || 'Unknown' }}</span>
                                <span>{{ $t('dashboard.loader') }}: {{ store.stats.version?.loader || 'Unknown' }}</span>
                                <span>{{ $t('dashboard.java_version') }}: <span class="fw-bold">{{ store.stats.javaVersion || 'Checking...' }}</span></span>
                             </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                     <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header bg-transparent border-0 pb-0 pt-3 pt-md-4 px-3 px-md-4">
                            <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1"><i class="fa-solid fa-microchip me-2"></i>{{ $t('dashboard.system_resource') }}</h6>
                        </div>
                        <div class="card-body px-3 px-md-4 pb-3 pb-md-4">
                             <div class="mb-3 mb-md-4">
                                 <div class="d-flex justify-content-between small mb-1 fw-bold">
                                     <span>{{ $t('dashboard.cpu_usage') }}</span>
                                     <span :class="{'text-danger': store.stats.cpu > 80}">{{ store.stats.cpu }}%</span>
                                 </div>
                                 <div class="progress" style="height: 6px; border-radius: 3px;">
                                    <div class="progress-bar bg-primary" :style="{width: store.stats.cpu + '%'}"></div>
                                 </div>
                             </div>
                             <div>
                                 <div class="d-flex justify-content-between small mb-1 fw-bold">
                                     <span>{{ $t('dashboard.mem_usage') }} ({{ store.stats.mem.percentage }}%)</span>
                                     <span class="text-muted font-monospace" style="font-size: 0.75rem;">{{ store.stats.mem.used }}G / {{ store.stats.mem.total }}G</span>
                                 </div>
                                 <div class="progress" style="height: 6px; border-radius: 3px;">
                                    <div class="progress-bar bg-warning" :style="{width: store.stats.mem.percentage + '%'}"></div>
                                 </div>
                             </div>
                        </div>
                     </div>
                </div>
            </div>

            <div class="console-output flex-grow-1 mb-3 position-relative" id="consoleBox" style="font-size: 0.75rem; padding: 1rem; border-radius: 12px;">
                <div v-for="(log,i) in store.logs" :key="i" v-html="formatLog(log)"></div>
            </div>
            
            <div class="input-group flex-shrink-0">
                <input type="text" class="form-control border-0 bg-body-tertiary px-3 px-md-4 py-2 py-md-3" v-model="command" @keyup.enter="sendCommand" :placeholder="$t('dashboard.send_cmd_placeholder')" style="border-radius: 12px 0 0 12px;">
                <button class="btn btn-primary px-3 px-md-4 fw-bold" @click="sendCommand" style="border-radius: 0 12px 12px 0;">{{ $t('dashboard.send') }}</button>
            </div>
        </div> <!-- End Normal Dashboard -->

        <!-- Startup Settings Modal -->
        <div class="modal fade" id="startupModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 20px;">
                    <div class="modal-header border-0 pb-0 pt-4 px-4">
                        <h5 class="modal-title fw-bold"><i class="fa-solid fa-gear me-2 text-primary"></i>{{ $t('instance_manager.settings_btn') }}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.jar_name') }}</label>
                            <div class="input-group">
                                <select class="form-select" v-model="form.jarName">
                                    <option v-for="jar in jars" :key="jar" :value="jar">{{ jar }}</option>
                                    <option v-if="!jars.length && form.jarName" :value="form.jarName">{{ form.jarName }}</option>
                                </select>
                                <button class="btn btn-outline-secondary" @click="fetchJars"><i class="fa-solid fa-rotate"></i></button>
                            </div>
                        </div>
                        <div class="mb-0">
                            <label class="form-label small fw-bold text-muted">{{ $t('instance_manager.java_args_label') }}</label>
                            <textarea class="form-control font-monospace small" rows="5" v-model="form.javaArgs" :placeholder="$t('instance_manager.java_args_placeholder')"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer border-0 p-4 pt-0">
                        <button class="btn btn-light px-4 fw-bold" data-bs-dismiss="modal" style="border-radius: 10px;">{{ $t('common.cancel') }}</button>
                        <button class="btn btn-primary px-4 fw-bold shadow-sm" @click="saveStartupSettings" :disabled="saving" style="border-radius: 10px;">
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
                if (payload.javaArgs) {
                    payload.javaArgs = payload.javaArgs.split('\n').map(a => a.trim()).filter(a => a);
                }
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

        const sendCommand = async () => {
            if (command.value) {
                await api.post('/api/server/command', { command: command.value });
                command.value = '';
            }
        };

        return { store, command, serverAction, sendCommand, formatLog, onSetupComplete, openStartupSettings, saveStartupSettings, saving, form, jars, fetchJars };
    }
};