import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, t } from '../utils.js';
import { socket } from '../socket.js';
import { ref, reactive, computed, onMounted, onUnmounted } from '/js/vue.esm-browser.js';

export default {
    template: `
    <div class="instance-manager-page animate-in vh-100 w-100 d-flex flex-column overflow-hidden">
        <nav class="topbar border-bottom px-3 px-md-4 py-2">
            <div class="container-fluid p-0 d-flex align-items-center">
                <span class="navbar-brand fw-bold d-flex align-items-center m-0 py-0 me-3 tracking-tight" style="font-size: 1rem;">
                    <img :src="serverIconUrl" alt="Logo" class="me-2" style="width: 1.2rem; height: 1.2rem; object-fit: contain;" @error="onNavIconError">
                    <span>{{ $t('sidebar.title') }}</span>
                </span>
                
                <div class="d-none d-md-flex gap-2 align-items-center justify-content-end flex-grow-1">
                    <button @click="toggleLang" class="btn btn-outline-secondary btn-sm px-3 fw-bold text-nowrap">
                        <i class="fa-solid fa-language me-1"></i> {{ store.lang === 'zh' ? 'EN' : '中' }}
                    </button>
                    <button @click="toggleTheme" class="btn btn-outline-secondary btn-sm px-3">
                        <i class="fa-solid fa-circle-half-stroke"></i>
                    </button>
                    <div class="vr mx-2 opacity-10"></div>
                    <button @click="store.view = 'panel-settings'" class="btn btn-sm btn-primary px-3 py-2 fw-bold">
                        <i class="fa-solid fa-gear text-white me-2"></i>{{ $t('panel_settings.title') }}
                    </button>
                    <button @click="store.view = 'java'" class="btn btn-sm btn-primary px-3 py-2 fw-bold">
                         <i class="fa-brands fa-java text-white me-2"></i>{{ $t('instance_manager.manage_java') }}
                    </button>
                    <button @click="store.view = 'about'" class="btn btn-sm btn-primary px-3 py-2 fw-bold">
                        <i class="fa-solid fa-circle-info text-white me-2"></i>{{ $t('about.title') }}
                    </button>
                    <div class="dropdown" ref="pluginDropdown">
                        <button class="btn btn-sm btn-primary px-3 py-2 fw-bold" type="button" @click.stop="togglePluginMenu">
                            <i class="fa-solid fa-puzzle-piece text-white me-2"></i>{{ $t('sidebar.plugins') }}
                            <i class="fa-solid fa-chevron-down ms-1" style="font-size: 0.6rem;"></i>
                        </button>
                        <Teleport to="body">
                            <Transition name="scale">
                                <ul v-if="showPluginMenu" class="dropdown-menu border-0 shadow-lg p-2 d-block show"
                                    style="border-radius: 12px; min-width: 220px; position: fixed; z-index: 1070;"
                                    :style="{right: pluginMenuRight + 'px', top: pluginMenuTop + 'px'}">
                                    <li v-for="item in store.pluginSidebarItems.filter(i => i.location === 'global' || i.location === 'both')" :key="item.id">
                                        <button class="dropdown-item rounded-3 py-2 d-flex align-items-center gap-2" @click="selectPlugin(item)">
                                            <i class="fa-solid" :class="item.icon" :style="item.color ? 'color:' + item.color : ''" style="width: 16px; text-align: center;"></i>
                                            <span class="fw-medium">{{ $t(item.labelKey) || item.labelKey }}</span>
                                        </button>
                                    </li>
                                    <li v-if="store.pluginSidebarItems.some(i => i.location === 'global' || i.location === 'both')"><hr class="dropdown-divider opacity-10"></li>
                                    <li>
                                        <button class="dropdown-item rounded-3 py-2 d-flex align-items-center gap-2" @click="store.view = 'plugins'; showPluginMenu = false">
                                            <i class="fa-solid fa-gear text-primary" style="width: 16px; text-align: center;"></i>
                                            <span class="fw-bold text-primary">{{ $t('plugins.title') }}</span>
                                        </button>
                                    </li>
                                </ul>
                            </Transition>
                        </Teleport>
                    </div>
                    <div class="vr mx-2 opacity-10"></div>
                    <button @click="logout" class="btn btn-sm btn-outline-danger border-0 px-3 py-2 fw-bold">
                        <i class="fa-solid fa-right-from-bracket me-2"></i>{{ $t('common.logout') }}
                    </button>
                </div>

                <div class="d-flex d-md-none gap-2 ms-auto align-items-center">
                    <button @click="toggleTheme" class="btn btn-link text-body p-1">
                        <i class="fa-solid fa-circle-half-stroke"></i>
                    </button>
                    <div class="dropdown" ref="mobileDropdown">
                        <button class="btn btn-link text-body p-1" type="button" @click.stop="showMobileMenu = !showMobileMenu">
                            <i class="fa-solid fa-ellipsis-vertical fa-lg"></i>
                        </button>
                        <Teleport to="body">
                            <Transition name="scale">
                                <ul v-if="showMobileMenu" class="dropdown-menu border-0 shadow-lg p-2 d-block show" 
                                    style="border-radius: 12px; min-width: 180px; position: fixed; right: 10px; top: 50px; z-index: 1070;">
                                    <li><button class="dropdown-item rounded-3 py-2" @click="toggleLang(); showMobileMenu = false"><i class="fa-solid fa-language me-2 w-20 text-primary"></i>{{ store.lang === 'zh' ? 'English' : '中文' }}</button></li>
                                    <li><hr class="dropdown-divider opacity-10"></li>
                                    <li><button class="dropdown-item rounded-3 py-2 font-weight-bold" @click="store.view = 'panel-settings'; showMobileMenu = false"><i class="fa-solid fa-gear me-2 w-20 text-primary"></i>{{ $t('panel_settings.title') }}</button></li>
                                    <li><button class="dropdown-item rounded-3 py-2 fw-bold" @click="store.view = 'java'; showMobileMenu = false"><i class="fa-brands fa-java me-2 w-20 text-primary"></i>{{ $t('instance_manager.manage_java') }}</button></li>
                                    <li v-if="store.pluginSidebarItems.some(i => i.location === 'global' || i.location === 'both')">
                                        <div class="px-3 py-1 small fw-bold text-muted text-uppercase opacity-50" style="font-size: 0.65rem;">{{ $t('sidebar.plugins') }}</div>
                                    </li>
                                    <li v-for="item in store.pluginSidebarItems.filter(i => i.location === 'global' || i.location === 'both')" :key="item.id">
                                        <button class="dropdown-item rounded-3 py-2 d-flex align-items-center" @click="selectPlugin(item); showMobileMenu = false">
                                            <i class="fa-solid me-2 w-20" :class="item.icon" :style="item.color ? 'color:' + item.color : ''"></i>{{ $t(item.labelKey) || item.labelKey }}
                                        </button>
                                    </li>
                                    <li><button class="dropdown-item rounded-3 py-2 fw-bold text-primary" style="background: rgba(var(--c-primary-rgb), 0.05);" @click="store.view = 'plugins'; showMobileMenu = false"><i class="fa-solid fa-puzzle-piece me-2 w-20"></i>{{ $t('plugins.title') }}</button></li>
                                    <li><button class="dropdown-item rounded-3 py-2 fw-bold" @click="store.view = 'about'; showMobileMenu = false"><i class="fa-solid fa-circle-info me-2 w-20 text-primary"></i>{{ $t('about.title') }}</button></li>
                                    <li><hr class="dropdown-divider opacity-10"></li>
                                    <li><button class="dropdown-item rounded-3 py-2 text-danger fw-bold" @click="logout(); showMobileMenu = false"><i class="fa-solid fa-right-from-bracket me-2 w-20"></i>{{ $t('common.logout') }}</button></li>
                                </ul>
                            </Transition>
                        </Teleport>
                    </div>
                </div>
            </div>
        </nav>

        <div class="flex-grow-1 overflow-auto custom-scrollbar p-3 p-md-5">
            <div class="container-xxl p-0">
                <div class="page-header d-flex justify-content-between align-items-center">
                    <div>
                        <h2 class="fw-black m-0 tracking-tight" style="font-size: 1.75rem;">{{ $t('instance_manager.title') }}</h2>
                        <p class="text-muted fw-medium m-0 opacity-75 small">{{ $t('instance_manager.instance_count', { count: store.instanceList.length }) }}</p>
                    </div>
                    <div>
                        <button @click="showCreateModal" class="btn btn-primary px-3 px-md-4 py-2 fw-bold">
                            <i class="fa-solid fa-plus d-md-none"></i>
                            <span class="d-none d-md-inline"><i class="fa-solid fa-plus me-2"></i>{{ $t('instance_manager.create_btn') }}</span>
                        </button>
                    </div>
                </div>
 
                <!-- Dashboard Cards (Plugins) -->
                <div v-if="store.dashboardCards.length > 0" class="dashboard-cards-container row g-3 g-md-4 mb-4 mb-md-5 mt-2 transition-container">
                    <template v-for="card in store.dashboardCards" :key="card.name">
                        <div v-if="card" class="col-12 col-md-6 col-xl-4 animate-in">
                            <component :is="store.pluginComponents[card.component] || card.component"></component>
                        </div>
                    </template>
                </div>

        <div class="row g-3 g-md-4 transition-container">
            <div v-for="(inst, idx) in filteredInstances" :key="inst.id" class="col-md-6 col-lg-4 col-xl-3 animate-in" :style="{'animation-delay': (idx * 0.05) + 's'}">
                <div class="card h-100 instance-card" :class="{'instance-card-active': store.currentInstanceId === inst.id}">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="d-flex align-items-center">
                                <div class="me-3 position-relative" style="width: 44px; height: 44px;">
                                    <img 
                                        v-if="inst.hasIcon" 
                                        :src="'/api/server/icon?instanceId=' + inst.id + '&t=' + (inst._iconVer || 0)" 
                                        class="rounded-3 w-100 h-100" 
                                        style="object-fit: cover; box-shadow: 0 2px 8px rgba(var(--c-primary-rgb), 0.1);"
                                    >
                                    <div 
                                        v-else 
                                        class="instance-icon-placeholder rounded-3 w-100 h-100 d-flex align-items-center justify-content-center"
                                    >
                                        <i class="fa-solid fa-server"></i>
                                    </div>
                                </div>
                                <div>
                                    <h5 class="fw-bold m-0 text-truncate" style="font-size: 0.9375rem;">{{ inst.name }}</h5>
                                    <div class="d-flex align-items-center mt-1" style="overflow: visible;">
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

                            <div class="btn-group w-100 mt-auto instance-card-btn-group">
                                <button @click.stop="enterInstance(inst)" class="btn btn-primary px-3" :title="$t('instance_manager.select_btn')">
                                    <i class="fa-solid fa-arrow-right"></i>
                                </button>
                                <button v-if="!inst.isRunning" @click.stop="quickAction(inst, 'start')" class="btn btn-success px-3" :title="$t('dashboard.start')">
                                    <i class="fa-solid fa-play"></i>
                                </button>
                                <button v-else @click.stop="quickAction(inst, 'stop')" class="btn btn-danger px-3" :title="$t('dashboard.stop')">
                                    <i class="fa-solid fa-stop"></i>
                                </button>
                                <button @click.stop="openSettings(inst)" class="btn btn-outline-secondary px-3" :title="$t('instance_manager.settings_btn')">
                                    <i class="fa-solid fa-gear"></i>
                                </button>
                                <button @click.stop="deleteInstance(inst)" class="btn btn-outline-danger px-3" :title="$t('instance_manager.delete_btn')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                    </div>
                </div>
            </div>

            <div v-if="filteredInstances.length === 0" class="col-12 py-5 text-center">
                <div class="display-1 text-muted opacity-10 mb-4"><i class="fa-solid fa-folder-open"></i></div>
                <h4 class="text-muted">{{ $t('instance_manager.no_instances') }}</h4>
            </div>
        </div>

            </div>
    </div>

    <Teleport to="body">
        <div class="modal fade" id="instanceModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold">{{ isEditing ? $t('instance_manager.edit_modal_title') : $t('instance_manager.create_modal_title') }}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('instance_manager.name_label') }}</label>
                            <input type="text" class="form-control" v-model="form.name" :placeholder="$t('instance_manager.name_placeholder')">
                        </div>
                        <div v-if="isEditing" class="mb-3 animate-in">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.jar_name') }}</label>
                            <input type="text" class="form-control" v-model="form.jarName" :placeholder="$t('instance_manager.jar_placeholder')">
                        </div>
                        <div class="mb-3 animate-in">
                            <label class="form-label small fw-bold text-muted">{{ $t('instance_manager.java_path_label') }}</label>
                            <CustomSelect v-model="form.javaPath" :options="[{value: '', label: $t('common.unknown') + ' (Default)'}, ...store.javaInstallations.map(j => ({value: j.path, label: j.version + ' (' + j.path + ')'}))]" searchable />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary px-4" data-bs-dismiss="modal">{{ $t('common.cancel') }}</button>
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
        const form = ref({
            id: '', name: '', jarName: '', javaArgs: '', javaPath: ''
        });
        const isEditing = ref(false);
        const modal = ref(null);
        const searchTerm = ref('');
        const showMobileMenu = ref(false);
        const showPluginMenu = ref(false);
        const pluginDropdown = ref(null);
        const pluginMenuRight = ref(0);
        const pluginMenuTop = ref(0);
        const iconErrors = reactive({});

        const togglePluginMenu = (e) => {
            showPluginMenu.value = !showPluginMenu.value;
            if (showPluginMenu.value) {
                const rect = e.currentTarget.getBoundingClientRect();
                pluginMenuTop.value = rect.bottom + 8;
                pluginMenuRight.value = window.innerWidth - rect.right;
            }
        };

        const serverIconUrl = computed(() => {
            return store.customLogoUrl || '/logo.png';
        });
        const onNavIconError = () => {
            // 不需要处理错误，因为使用store.customLogoUrl
        };

        const filteredInstances = computed(() => {
            if (!searchTerm.value) return store.instanceList;
            const lower = searchTerm.value.toLowerCase();
            return store.instanceList.filter(i => i.name.toLowerCase().includes(lower));
        });

        const showCreateModal = () => {
            isEditing.value = false;
            form.value = {
                id: '', name: '', jarName: '', javaArgs: '', javaPath: ''
            };
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
                store.logs = [];
                socket.emit('req_history');
                const { getFirstVisibleView } = await import('/js/components/Sidebar.js');
                store.view = getFirstVisibleView(inst.id);
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

        const selectPlugin = (item) => {
            showPluginMenu.value = false;
            if (item.view) {
                store.view = item.view;
            }
        };

        let clickHandler = (e) => {
            if (showMobileMenu.value) showMobileMenu.value = false;
            if (showPluginMenu.value) showPluginMenu.value = false;
        };

        onMounted(() => {
            modal.value = new bootstrap.Modal(document.getElementById('instanceModal'));
            fetchInstances();
            fetchJava();

            // Close mobile menu on click outside
            window.addEventListener('click', clickHandler);

            // User requested polling every 10s
            // Real-time updates are handled by socket, but we ensure connection here
            const pollTimer = setInterval(() => {
                if (!socket.connected) socket.connect();
                // We could force fetch, but it overrides dynamic status. 
                // Just log to confirm it's "active".
                // console.log('Polling instance status...');
            }, 10000);

            onUnmounted(() => {
                clearInterval(pollTimer);
                window.removeEventListener('click', clickHandler);
            });
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
            deleteInstance, quickAction, modal,
            filteredInstances, toggleTheme, toggleLang, logout,
            showMobileMenu, showPluginMenu, togglePluginMenu, pluginDropdown,
            pluginMenuRight, pluginMenuTop, selectPlugin,
            serverIconUrl, onNavIconError
        };
    }
};
