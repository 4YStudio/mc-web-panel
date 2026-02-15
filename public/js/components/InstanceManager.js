import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, t } from '../utils.js';
import { socket } from '../socket.js';
import { ref, reactive, computed, onMounted, onUnmounted } from '/js/vue.esm-browser.js';

export default {
    template: `
    <div class="animate-in vh-100 w-100 d-flex flex-column bg-body-tertiary overflow-hidden">
        <!-- Top Navigation (Global) -->
        <nav class="navbar navbar-expand-lg border-bottom bg-body sticky-top shadow-sm px-4 py-2 z-index-dropdown">
            <div class="container-fluid p-0">
                <span class="navbar-brand fw-bold d-flex align-items-center m-0 py-0" style="font-size: 1.1rem;">
                    <img src="/logo.png" alt="Logo" class="me-2" style="width: 1.4rem; height: 1.4rem; object-fit: contain;">
                    <span>MC Panel Hub</span>
                </span>
                <div class="d-flex gap-2 align-items-center">
                    <div class="d-flex gap-2 me-3">
                        <button @click="toggleLang" class="btn btn-outline-secondary border shadow-sm btn-sm px-3 fw-bold" style="border-radius: 8px;">
                            <i class="fa-solid fa-language me-1"></i> {{ store.lang === 'zh' ? 'EN' : '中' }}
                        </button>
                        <button @click="toggleTheme" class="btn btn-outline-secondary border shadow-sm btn-sm px-3" style="border-radius: 8px;">
                            <i class="fa-solid fa-circle-half-stroke"></i>
                        </button>
                    </div>
                    
                    <button @click="store.view = 'panel-settings'" class="btn btn-sm btn-primary px-3 py-2 fw-bold shadow-sm me-1" style="border-radius: 10px;">
                        <i class="fa-solid fa-gear text-white me-2"></i>{{ $t('panel_settings.title') }}
                    </button>
                    <button @click="store.view = 'java'" class="btn btn-sm btn-primary px-3 py-2 fw-bold shadow-sm" style="border-radius: 10px;">
                         <i class="fa-brands fa-java text-white me-2"></i>{{ $t('instance_manager.manage_java') }}
                    </button>
                    <button @click="store.view = 'about'" class="btn btn-sm btn-primary px-3 py-2 fw-bold shadow-sm ms-1" style="border-radius: 10px;">
                        <i class="fa-solid fa-circle-info text-white me-2"></i>{{ $t('about.title') }}
                    </button>
                    <div class="vr mx-2 opacity-10"></div>
                    <button @click="logout" class="btn btn-sm btn-outline-danger border-0 px-3 py-2 fw-bold" style="border-radius: 10px;">
                        <i class="fa-solid fa-right-from-bracket me-2"></i>{{ $t('common.logout') }}
                    </button>
                </div>
            </div>
        </nav>

        <div class="flex-grow-1 overflow-auto custom-scrollbar p-4 p-md-5">
            <div class="container-xxl p-0">
                <div class="d-flex justify-content-between align-items-center mb-5">
                    <div>
                        <h2 class="fw-black m-0 tracking-tight" style="font-size: 2.2rem;">{{ $t('instance_manager.title') }}</h2>
                        <p class="text-muted fw-medium m-0 opacity-75">{{ store.instanceList.length }} {{ $t('instance_manager.title') }}</p>
                    </div>
                    <div>
                        <button @click="showCreateModal" class="btn btn-primary px-4 py-2 fw-bold shadow-sm" style="border-radius: 12px;">
                            <i class="fa-solid fa-plus me-2"></i>{{ $t('instance_manager.create_btn') }}
                        </button>
                    </div>
                </div>

        <div class="row g-4 transition-container">
            <div v-for="(inst, idx) in filteredInstances" :key="inst.id" class="col-md-6 col-lg-4 col-xl-3 animate-in" :style="{'animation-delay': (idx * 0.05) + 's'}">
                <div class="card h-100 border-0 shadow-sm hover-shadow transition-all" :class="{'border-primary border-2': store.currentInstanceId === inst.id}">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="d-flex align-items-center">
                                <div class="me-3 position-relative" style="width: 48px; height: 48px;">
                                    <img 
                                        v-if="inst.hasIcon" 
                                        :src="'/api/server/icon?instanceId=' + inst.id + '&t=' + (inst._iconVer || 0)" 
                                        class="rounded-3 shadow-sm w-100 h-100" 
                                        style="object-fit: cover;"
                                    >
                                    <div 
                                        v-else 
                                        class="bg-primary-subtle text-primary rounded-3 w-100 h-100 d-flex align-items-center justify-content-center"
                                    >
                                        <i class="fa-solid fa-server fa-lg"></i>
                                    </div>
                                </div>
                                <div class="overflow-hidden">
                                    <h5 class="fw-bold m-0 text-truncate">{{ inst.name }}</h5>
                                    <div class="d-flex align-items-center mt-1">
                                        <span class="status-indicator me-2" :class="inst.isRunning ? 'bg-success' : 'bg-danger'"></span>
                                        <span class="small text-muted">{{ inst.isRunning ? $t('instance_manager.state_running') : $t('instance_manager.state_stopped') }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="small mb-4">
                            <div class="d-flex justify-content-between mb-1">
                                <span class="text-muted">{{ $t('dashboard.online_players') }}</span>
                                <span class="fw-bold">{{ inst.onlinePlayers || 0 }} / {{ inst.maxPlayers || 20 }}</span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span class="text-muted">{{ $t('dashboard.target') }}</span>
                                <span class="fw-bold text-truncate ms-2">{{ inst.version?.mc || 'Unknown' }}</span>
                            </div>
                        </div>

                            <div class="btn-group w-100 shadow-sm mt-auto instance-card-btn-group">
                                <button @click.stop="enterInstance(inst)" class="btn btn-primary px-3" :title="$t('instance_manager.select_btn')">
                                    <i class="fa-solid fa-arrow-right"></i>
                                </button>
                                <button v-if="!inst.isRunning" @click.stop="quickAction(inst, 'start')" class="btn btn-success px-3" :title="$t('dashboard.start')">
                                    <i class="fa-solid fa-play"></i>
                                </button>
                                <button v-else @click.stop="quickAction(inst, 'stop')" class="btn btn-danger px-3" :title="$t('dashboard.stop')">
                                    <i class="fa-solid fa-stop"></i>
                                </button>
                                <button @click.stop="openSettings(inst)" class="btn btn-light border-start-0 border-end-0 px-3" :title="$t('instance_manager.settings_btn')">
                                    <i class="fa-solid fa-gear"></i>
                                </button>
                                <button @click.stop="deleteInstance(inst)" class="btn btn-outline-danger px-3" :title="$t('instance_manager.delete_btn')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-if="filteredInstances.length === 0" class="col-12 py-5 text-center">
                <div class="display-1 text-muted opacity-10 mb-4"><i class="fa-solid fa-folder-open"></i></div>
                <h4 class="text-muted">{{ $t('instance_manager.no_instances') }}</h4>
            </div>
        </div>

            </div> <!-- End container-xxl -->
            <!-- End Flex-Grow Content -->
    </div> <!-- End hub container -->

    <!-- Create/Edit Modal [Moved inside root div to satisfy Transition single-root requirement] -->
    <Teleport to="body">
        <div class="modal fade" id="instanceModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header border-0 pb-0 pt-4 px-4">
                        <h5 class="modal-title fw-bold">{{ isEditing ? $t('instance_manager.edit_modal_title') : $t('instance_manager.create_modal_title') }}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('instance_manager.name_label') }}</label>
                            <input type="text" class="form-control" v-model="form.name" :placeholder="$t('instance_manager.name_placeholder')">
                        </div>
                        <div v-if="isEditing" class="mb-3 animate-in">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.jar_name') }}</label>
                            <input type="text" class="form-control" v-model="form.jarName" :placeholder="$t('instance_manager.jar_placeholder')">
                        </div>
                        <div class="mb-0 animate-in">
                            <label class="form-label small fw-bold text-muted">{{ $t('instance_manager.java_path_label') }}</label>
                            <select class="form-select" v-model="form.javaPath">
                                <option value="">{{ $t('common.unknown') }} (Default)</option>
                                <option v-for="java in store.javaInstallations" :key="java.path" :value="java.path">
                                    {{ java.version }} ({{ java.path }})
                                </option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer border-0 p-4 pt-0">
                        <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">{{ $t('common.cancel') }}</button>
                        <button type="button" class="btn btn-primary px-4" @click="saveInstance">{{ $t('common.confirm') }}</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
    </div>
    `,
    setup() {
        // const { t } = VueI18n.useI18n(); // global mixin used in template, maybe not needed here if not used in script? 
        // usage in script: t is used in showToast. imported from utils.
        const form = ref({ id: '', name: '', jarName: '', javaArgs: '', javaPath: '' });
        const isEditing = ref(false);
        const modal = ref(null);
        const searchTerm = ref('');
        const iconErrors = reactive({});

        const filteredInstances = computed(() => {
            if (!searchTerm.value) return store.instanceList;
            const lower = searchTerm.value.toLowerCase();
            return store.instanceList.filter(i => i.name.toLowerCase().includes(lower));
        });

        const showCreateModal = () => {
            isEditing.value = false;
            form.value = { id: '', name: '', jarName: '', javaArgs: '', javaPath: '' };
            modal.value.show();
        };

        const openSettings = (inst) => {
            isEditing.value = true;
            form.value = {
                id: inst.id,
                name: inst.name,
                jarName: inst.jarName || '',
                javaArgs: Array.isArray(inst.javaArgs) ? inst.javaArgs.join('\n') : (inst.javaArgs || ''),
                javaPath: inst.javaPath || ''
            };
            modal.value.show();
        };

        const saveInstance = async () => {
            if (!form.value.name) return;
            try {
                const payload = { ...form.value };
                if (payload.javaArgs && typeof payload.javaArgs === 'string') {
                    payload.javaArgs = payload.javaArgs.split('\n').map(a => a.trim()).filter(a => a);
                }

                if (isEditing.value) {
                    await api.post('/api/instances/update', payload);
                    showToast(t('instance_manager.update_success'));
                } else {
                    await api.post('/api/instances/create', payload);
                    showToast(t('instance_manager.create_success'));
                }
                modal.value.hide();
                fetchInstances();
            } catch (e) {
                showToast(e.response?.data?.error || 'Error');
            }
        };

        const deleteInstance = async (inst) => {
            const msg = store.lang === 'zh' ? `确定要删除实例 "${inst.name}" 吗？此操作不可撤销。` : `Are you sure you want to delete "${inst.name}"? This cannot be undone.`;
            if (!confirm(msg)) return;
            try {
                await api.post('/api/instances/delete', { id: inst.id });
                showToast(t('instance_manager.delete_success'));
                fetchInstances();
            } catch (e) {
                showToast(e.response?.data?.error || t('common.error'));
            }
        };

        const enterInstance = async (inst) => {
            try {
                await api.post('/api/instances/select', { id: inst.id });
                store.currentInstanceId = inst.id;
                store.logs = []; // Clear old logs
                socket.emit('req_history'); // Request new history
                store.view = 'dashboard';
            } catch (e) {
                showToast(t('instance_manager.select_fail'));
            }
        };

        const fetchInstances = async () => {
            try {
                const res = await api.get('/api/instances/list');
                store.instanceList = res.data;
            } catch (e) { }
        };

        const fetchJava = async () => {
            try {
                const res = await api.get('/api/java/installed');
                store.javaInstallations = res.data;
            } catch (e) { }
        };

        const toggleTheme = () => {
            const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        };

        const toggleLang = () => {
            store.lang = store.lang === 'zh' ? 'en' : 'zh';
            localStorage.setItem('lang', store.lang);
        };

        const logout = async () => {
            await api.post('/api/auth/logout');
            location.reload();
        };

        onMounted(() => {
            modal.value = new bootstrap.Modal(document.getElementById('instanceModal'));
            fetchInstances();
            fetchJava();

            // User requested polling every 10s
            // Real-time updates are handled by socket, but we ensure connection here
            const pollTimer = setInterval(() => {
                if (!socket.connected) socket.connect();
                // We could force fetch, but it overrides dynamic status. 
                // Just log to confirm it's "active".
                // console.log('Polling instance status...');
            }, 10000);

            onUnmounted(() => clearInterval(pollTimer));
        });

        const quickAction = async (inst, act) => {
            try {
                await api.post('/api/instances/select', { id: inst.id });
                await api.post(`/api/server/${act}`);
                showToast(t('instance_manager.action_sent', { name: inst.name, action: act }));
                setTimeout(fetchInstances, 1000);
            } catch (e) {
                showToast(e.response?.data?.error || t('common.error'), 'danger');
            }
        };

        return {
            store, form, isEditing, searchTerm, iconErrors,
            saveInstance, showCreateModal, openSettings, enterInstance,
            deleteInstance, quickAction,
            filteredInstances, toggleTheme, toggleLang, logout
        };
    }
};
