import { ref, reactive, watch, onMounted, computed } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';

const BUILTIN_ITEMS = [
    { id: 'dashboard', view: 'dashboard', icon: 'fa-terminal', labelKey: 'sidebar.dashboard' },
    { id: 'properties', view: 'properties', icon: 'fa-sliders', labelKey: 'sidebar.settings' },
    { id: 'mods', view: 'mods', icon: 'fa-microchip', labelKey: 'sidebar.mods' },
    { id: 'modrinth', view: 'modrinth', icon: 'fa-cloud-arrow-down', labelKey: 'sidebar.modrinth' },
    { id: 'files', view: 'files', icon: 'fa-folder-open', labelKey: 'sidebar.files' },
    { id: 'backups', view: 'backups', icon: 'fa-clock-rotate-left', labelKey: 'sidebar.backups' },
    { id: 'players', view: 'players', icon: 'fa-users', labelKey: 'sidebar.players' }
];

const loadSidebarConfig = (instanceId) => {
    try {
        const raw = localStorage.getItem(`sidebar_config_${instanceId}`);
        if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { hiddenItems: [], order: [] };
};

const saveSidebarConfig = (instanceId, config) => {
    localStorage.setItem(`sidebar_config_${instanceId}`, JSON.stringify(config));
};

export const getFirstVisibleView = (instanceId) => {
    const config = loadSidebarConfig(instanceId);
    const pluginItems = (store.pluginSidebarItems || [])
        .filter(i => i.location === 'instance' || i.location === 'both')
        .map(i => ({ id: i.id, view: i.view }));
    const allItems = [...BUILTIN_ITEMS, ...pluginItems];
    let ordered;
    if (config.order && config.order.length > 0) {
        const itemMap = {};
        allItems.forEach(i => itemMap[i.id] = i);
        ordered = config.order.map(id => itemMap[id]).filter(Boolean);
        allItems.forEach(i => { if (!config.order.includes(i.id)) ordered.push(i); });
    } else {
        ordered = [...allItems];
    }
    const visible = ordered.filter(i => !(config.hiddenItems || []).includes(i.id));
    return visible.length > 0 ? visible[0].view : 'dashboard';
};

export default {
    template: `
    <div class="sidebar d-flex flex-column h-100 overflow-hidden">
        <div class="p-4 pb-3 flex-shrink-0">
            <h5 class="fw-bold d-flex align-items-center m-0 text-truncate tracking-tight" style="font-size: 0.9375rem;">
                <img v-if="hasIcon" :src="'/api/server/icon?instanceId=' + store.currentInstanceId + '&t=' + store.serverIconVersion" class="me-3 rounded-circle" width="32" height="32" style="object-fit: cover; box-shadow: 0 2px 8px rgba(var(--c-primary-rgb), 0.12);">
                <img v-else-if="store.customLogoUrl" :src="store.customLogoUrl" alt="Logo" class="me-3" style="width: 32px; height: 32px; object-fit: contain;">
                <img v-else src="/logo.png" alt="Logo" class="me-3" style="width: 32px; height: 32px; object-fit: contain;">
                <span>{{ currentInstance ? currentInstance.name : 'MC Panel' }}</span>
            </h5>
        </div>

        <div class="flex-grow-1 overflow-auto custom-scrollbar px-3 pt-2">
            <nav class="nav flex-column mb-3">
                <template v-for="item in visibleItems" :key="item.id">
                    <a v-if="item.isPlugin" class="nav-link sidebar-item" :class="{active: store.view === item.view}" @click="selectView(item.view)">
                        <i class="fa-solid" :class="item.icon" :style="item.color ? 'color:' + item.color : ''"></i> {{ $t(item.labelKey) || item.labelKey }}
                    </a>
                    <a v-else class="nav-link sidebar-item" :class="{active: store.view === item.view}" @click="selectView(item.view)">
                        <i class="fa-solid" :class="item.icon"></i> {{ $t(item.labelKey) }}
                    </a>
                </template>
            </nav>

            <div v-if="store.consoleInfoPosition === 'sidebar'" class="px-1 animate-in">
                <div class="stat-card mb-3 shadow-none overflow-hidden" style="border-radius: 12px;">
                    <div class="stat-card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                             <span class="small fw-bold text-muted text-uppercase letter-spacing-1" style="font-size: 0.625rem;">{{ $t('dashboard.server_info') }}</span>
                             <span class="badge rounded-pill" style="font-size: 9px;" :class="store.isRunning?'bg-success':'bg-danger'">{{ store.isRunning ? 'ON' : 'OFF' }}</span>
                        </div>
                        <div v-if="store.stats && store.stats.mc" class="d-flex align-items-center mb-1">
                             <h4 class="m-0 fw-bold me-2" style="font-size: 1.25rem;">{{ store.stats.mc.online }}</h4>
                             <span class="text-muted small">/ {{ store.stats.mc.maxPlayers }}</span>
                        </div>
                        <div v-if="store.stats && store.stats.mc" class="progress" style="height: 3px; border-radius: 2px;">
                            <div class="progress-bar bg-success" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div>
                        </div>
                    </div>
                </div>

                <div class="stat-card mb-3 shadow-none overflow-hidden" style="border-radius: 12px;">
                    <div class="stat-card-body p-3">
                        <div class="mb-3">
                            <div class="d-flex justify-content-between small mb-1 fw-bold" style="font-size: 0.75rem;">
                                <span>CPU</span>
                                <span class="text-muted">{{ store.stats.cpu }}%</span>
                            </div>
                            <div class="progress" style="height: 3px; border-radius: 2px;">
                                <div class="progress-bar" :style="{width: store.stats.cpu + '%'}"></div>
                            </div>
                        </div>
                        <div>
                            <div class="d-flex justify-content-between small mb-1 fw-bold" style="font-size: 0.75rem;">
                                <span>MEM</span>
                                <span class="text-muted">{{ store.stats.mem.percentage }}%</span>
                            </div>
                            <div class="progress" style="height: 3px; border-radius: 2px;">
                                <div class="progress-bar bg-warning" :style="{width: store.stats.mem.percentage + '%'}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="p-3 border-top flex-shrink-0" style="border-color: var(--c-border-subtle) !important;">
             <div class="px-1 d-flex gap-2">
                <a class="nav-link p-2 d-flex align-items-center justify-content-center text-primary small flex-grow-1" @click="backToInstances" style="cursor: pointer; font-weight: 600; background: var(--c-primary-glow); border-radius: 10px; border: 1px solid rgba(var(--c-primary-rgb), 0.1);">
                    <i class="fa-solid fa-chevron-left me-2"></i>{{ $t('instance_manager.back_to_list') }}
                </a>
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-2" @click="showCustomize = true" :title="$t('sidebar.customize')">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
        </div>

        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showCustomize" class="modal-backdrop fade show" style="z-index: 2060; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);" @click="showCustomize = false"></div>
            </Transition>
            <Transition name="scale">
                <div v-if="showCustomize" class="modal show d-block" style="z-index: 2070;">
                    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" style="max-width: 420px;">
                        <div class="modal-content shadow-lg border-0 rounded-4" style="background: var(--c-surface);">
                            <div class="modal-header border-0 py-3 px-4">
                                <h5 class="modal-title fw-bold"><i class="fa-solid fa-gear me-2"></i>{{ $t('sidebar.customize') }}</h5>
                                <button type="button" class="btn-close" @click="showCustomize = false"></button>
                            </div>
                            <div class="modal-body px-4 py-2">
                                <p class="text-muted small mb-3">{{ $t('sidebar.customize_desc') }}</p>
                                <div class="d-flex flex-column gap-1">
                                    <div v-for="(item, idx) in editItems" :key="item.id"
                                         class="d-flex align-items-center gap-2 p-2 rounded-3 sidebar-drag-item"
                                         :class="{'opacity-50': !item.visible, 'sidebar-drag-over': dragOverIdx === idx}"
                                         draggable="true"
                                         @dragstart="onDragStart(idx, $event)"
                                         @dragover.prevent="onDragOver(idx)"
                                         @dragend="onDragEnd"
                                         @drop="onDrop(idx)"
                                         style="background: var(--c-surface-elevated); cursor: grab;">
                                        <i class="fa-solid fa-grip-vertical text-muted flex-shrink-0" style="font-size: 0.7rem; cursor: grab;"></i>
                                        <i class="fa-solid flex-shrink-0" :class="item.icon" :style="item.color ? 'color:' + item.color : ''" style="width: 1rem; text-align: center;"></i>
                                        <span class="small fw-bold flex-grow-1 text-truncate">{{ item.isPlugin ? ($t(item.labelKey) || item.labelKey) : $t(item.labelKey) }}</span>
                                        <div class="form-check form-switch ms-auto mb-0">
                                            <input class="form-check-input" type="checkbox" v-model="item.visible" style="cursor: pointer;">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer border-0 px-4 py-3">
                                <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" @click="resetConfig">{{ $t('sidebar.reset') }}</button>
                                <button class="btn btn-sm btn-primary rounded-pill px-3" @click="applyConfig">{{ $t('common.save') }}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
    `,
    setup(props, { emit }) {
        const hasIcon = ref(false);
        const showCustomize = ref(false);
        const editItems = ref([]);
        const configState = reactive({ hiddenItems: [], order: [] });
        const dragIdx = ref(null);
        const dragOverIdx = ref(null);

        const currentInstance = computed(() => {
            return store.instanceList.find(i => i.id === store.currentInstanceId);
        });

        const allItems = computed(() => {
            const pluginItems = store.pluginSidebarItems
                .filter(i => i.location === 'instance' || i.location === 'both')
                .map(i => ({ id: i.id, view: i.view, icon: i.icon, labelKey: i.labelKey, color: i.color, isPlugin: true }));
            return [...BUILTIN_ITEMS, ...pluginItems];
        });

        const syncConfigFromStorage = () => {
            const raw = loadSidebarConfig(store.currentInstanceId);
            configState.hiddenItems = raw.hiddenItems || [];
            configState.order = raw.order || [];
        };

        const visibleItems = computed(() => {
            const items = allItems.value;
            let ordered;
            if (configState.order && configState.order.length > 0) {
                const itemMap = {};
                items.forEach(i => itemMap[i.id] = i);
                ordered = configState.order.map(id => itemMap[id]).filter(Boolean);
                items.forEach(i => { if (!configState.order.includes(i.id)) ordered.push(i); });
            } else {
                ordered = [...items];
            }
            return ordered.filter(i => {
                if ((configState.hiddenItems || []).includes(i.id)) return false;
                if (i.id === 'backups' && store.stats?.backupStrategy !== 'panel') return false;
                return true;
            });
        });

        const openCustomize = () => {
            const items = allItems.value;
            let ordered;
            if (configState.order && configState.order.length > 0) {
                const itemMap = {};
                items.forEach(i => itemMap[i.id] = i);
                ordered = configState.order.map(id => itemMap[id]).filter(Boolean);
                items.forEach(i => { if (!configState.order.includes(i.id)) ordered.push(i); });
            } else {
                ordered = [...items];
            }
            editItems.value = ordered.map(i => ({
                ...i,
                visible: !(configState.hiddenItems || []).includes(i.id)
            }));
            showCustomize.value = true;
        };

        watch(showCustomize, (v) => { if (v) openCustomize(); });

        const onDragStart = (idx, e) => {
            dragIdx.value = idx;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idx);
        };

        const onDragOver = (idx) => {
            if (dragIdx.value === null || dragIdx.value === idx) return;
            dragOverIdx.value = idx;
        };

        const onDragEnd = () => {
            dragIdx.value = null;
            dragOverIdx.value = null;
        };

        const onDrop = (targetIdx) => {
            if (dragIdx.value === null || dragIdx.value === targetIdx) return;
            const arr = [...editItems.value];
            const [moved] = arr.splice(dragIdx.value, 1);
            arr.splice(targetIdx, 0, moved);
            editItems.value = arr;
            dragIdx.value = null;
            dragOverIdx.value = null;
        };

        const applyConfig = () => {
            const hiddenItems = editItems.value.filter(i => !i.visible).map(i => i.id);
            const order = editItems.value.map(i => i.id);
            configState.hiddenItems = hiddenItems;
            configState.order = order;
            saveSidebarConfig(store.currentInstanceId, { hiddenItems, order });
            showCustomize.value = false;
        };

        const resetConfig = () => {
            localStorage.removeItem(`sidebar_config_${store.currentInstanceId}`);
            configState.hiddenItems = [];
            configState.order = [];
            showCustomize.value = false;
        };

        const checkIcon = async () => {
            if (!store.currentInstanceId) { hasIcon.value = false; return; }
            const img = new Image();
            img.onload = () => hasIcon.value = true;
            img.onerror = () => hasIcon.value = false;
            img.src = `/api/server/icon?instanceId=${store.currentInstanceId}&t=${Date.now()}`;
        };

        watch(() => store.currentInstanceId, () => {
            syncConfigFromStorage();
            checkIcon();
        });
        watch(() => store.serverIconVersion, checkIcon);
        onMounted(() => {
            syncConfigFromStorage();
            checkIcon();
        });

        const selectView = (view) => { store.view = view; emit('close-sidebar'); };
        const backToInstances = () => { store.view = 'instance-manager'; store.currentInstanceId = null; emit('close-sidebar'); };

        return { store, hasIcon, currentInstance, selectView, backToInstances, showCustomize, editItems, visibleItems, applyConfig, resetConfig, onDragStart, onDragOver, onDragEnd, onDrop, dragOverIdx };
    }
};
