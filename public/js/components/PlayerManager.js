import { ref, computed, onMounted, onUnmounted, getCurrentInstance, nextTick } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';
import Avatar from './Avatar.js';

export default {
    components: { Avatar },
    template: `
    <div>
        <div class="page-header d-flex justify-content-between align-items-center">
            <h3 class="m-0 fw-bold"><i class="fa-solid fa-users me-2 text-primary"></i>{{ $t('players.title') }}</h3>
        </div>

        <div class="card mb-4 border-primary" :class="{'player-section-open': activeMenu}" :style="activeMenu ? {position:'relative', zIndex:'1040'} : {}">
            <div class="card-header bg-primary-subtle fw-bold d-flex justify-content-between align-items-center">
                <span><i class="fa-solid fa-signal me-2"></i>{{ $t('players.online_players') }}</span>
                <span class="badge bg-primary fs-6">{{ filteredOnline.length }}{{ store.onlinePlayers.length !== filteredOnline.length ? ' / ' + store.onlinePlayers.length : '' }}</span>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-body-tertiary border-end-0"><i class="fa-solid fa-search text-muted"></i></span>
                        <input type="text" class="form-control border-start-0" :placeholder="$t('players.search_player')" v-model="onlineFilter">
                    </div>
                </div>
                <div v-if="store.onlinePlayers.length === 0" class="text-center text-muted py-4">
                    <i class="fa-solid fa-user-slash fa-2x mb-2 opacity-25"></i>
                    <div>{{ $t('players.no_online') }}</div>
                </div>
                <div v-else class="row g-2">
                    <div v-for="p in filteredOnline" :key="p" class="col-12 col-sm-6 col-lg-4">
                        <div class="card player-card h-100" :class="{'menu-open': activeMenu === p}">
                            <div class="card-body p-2 d-flex align-items-center gap-2">
                                <avatar :player="p" :size="36"></avatar>
                                <div class="flex-grow-1 min-w-0">
                                    <div class="fw-bold text-truncate">{{ p }}</div>
                                    <div v-if="playerPings[p] !== undefined" class="small text-muted d-flex align-items-center gap-1">
                                        <i class="fa-solid fa-wifi" :class="pingClass(playerPings[p])" style="font-size:0.7rem"></i>
                                        <span>{{ playerPings[p] }}ms</span>
                                    </div>
                                </div>
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-outline-secondary border-0" @click.stop="toggleMenu(p)" :title="$t('players.more_actions')">
                                        <i class="fa-solid fa-ellipsis-vertical"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end" :class="{show: activeMenu === p}">
                                        <li><a class="dropdown-item" @click="askTeleport(p)"><i class="fa-solid fa-location-dot me-2 text-primary"></i>{{ $t('players.teleport') }}</a></li>
                                        <li><a class="dropdown-item" @click="askGamemode(p)"><i class="fa-solid fa-gamepad me-2 text-info"></i>{{ $t('players.gamemode') }}</a></li>
                                        <li><a class="dropdown-item" @click="askGiveItem(p)"><i class="fa-solid fa-gift me-2 text-success"></i>{{ $t('players.give_item') }}</a></li>
                                        <li><a class="dropdown-item" @click="askEffect(p)"><i class="fa-solid fa-flask me-2 text-purple"></i>{{ $t('players.effect') }}</a></li>
                                        <li><a class="dropdown-item" @click="askExperience(p)"><i class="fa-solid fa-star me-2 text-warning"></i>{{ $t('players.experience') }}</a></li>
                                        <li><a class="dropdown-item" @click="askTitle(p)"><i class="fa-solid fa-heading me-2 text-indigo"></i>{{ $t('players.title_action') }}</a></li>
                                        <li><a class="dropdown-item" @click="askMessage(p)"><i class="fa-solid fa-envelope me-2 text-cyan"></i>{{ $t('players.message') }}</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item" @click="sendCmd('clear ' + p)"><i class="fa-solid fa-broom me-2 text-warning"></i>{{ $t('players.clear_inv') }}</a></li>
                                        <li><a class="dropdown-item" @click="sendCmd('kill ' + p)"><i class="fa-solid fa-skull me-2 text-danger"></i>{{ $t('players.kill') }}</a></li>
                                        <li><a class="dropdown-item" @click="sendCmd('spawnpoint ' + p)"><i class="fa-solid fa-house me-2 text-secondary"></i>{{ $t('players.spawnpoint') }}</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item" @click="askWhitelist(p, 'add')"><i class="fa-solid fa-shield-halved me-2 text-success"></i>{{ $t('players.whitelist_add') }}</a></li>
                                        <li><a class="dropdown-item" @click="askOp(p)"><i class="fa-solid fa-crown me-2 text-warning"></i>{{ $t('players.op_give') }}</a></li>
                                        <li><a class="dropdown-item" @click="askDeop(p)"><i class="fa-solid fa-crown me-2 text-secondary" style="opacity:0.5"></i>{{ $t('players.op_remove') }}</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item text-warning" @click="sendCmd('kick ' + p)"><i class="fa-solid fa-right-from-bracket me-2"></i>{{ $t('players.kick') }}</a></li>
                                        <li><a class="dropdown-item text-danger" @click="askBan(p)"><i class="fa-solid fa-gavel me-2"></i>{{ $t('players.ban') }}</a></li>
                                        <li><a class="dropdown-item text-danger" @click="askBanIp(p)"><i class="fa-solid fa-network-wired me-2"></i>{{ $t('players.ban_ip') }}</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header bg-body-tertiary py-2 px-3">
                <ul class="nav nav-tabs card-header-tabs flex-nowrap overflow-auto no-scrollbar" style="margin: -0.5rem -0.75rem; padding: 0.5rem 0.75rem;">
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: listType==='whitelist'}" @click="listType='whitelist'; loadLists()">
                            <i class="fa-solid fa-shield-halved me-1"></i>{{ $t('players.whitelist') }}
                            <span v-if="listType==='whitelist'" class="badge bg-secondary ms-1">{{ listData.length }}</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: listType==='ops'}" @click="listType='ops'; loadLists()">
                            <i class="fa-solid fa-crown me-1"></i>{{ $t('players.ops') }}
                            <span v-if="listType==='ops'" class="badge bg-secondary ms-1">{{ listData.length }}</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: listType==='banned-players'}" @click="listType='banned-players'; loadLists()">
                            <i class="fa-solid fa-ban me-1"></i>{{ $t('players.bans') }}
                            <span v-if="listType==='banned-players'" class="badge bg-secondary ms-1">{{ listData.length }}</span>
                        </a>
                    </li>
                </ul>
            </div>
            <div class="card-body">
                <div class="d-flex gap-2 mb-3">
                    <div class="input-group input-group-sm flex-grow-1">
                        <span class="input-group-text bg-body-tertiary border-end-0"><i class="fa-solid fa-search text-muted"></i></span>
                        <input type="text" class="form-control border-start-0" :placeholder="$t('players.search_player')" v-model="listFilter">
                    </div>
                    <div class="input-group input-group-sm" style="max-width: 300px;">
                        <input type="text" class="form-control" v-model="newPlayerName" :placeholder="$t('common.player_name')" @keyup.enter="modifyList('add')">
                        <button class="btn btn-outline-success" @click="modifyList('add')"><i class="fa-solid fa-plus me-1"></i>{{ $t('common.add') }}</button>
                    </div>
                </div>
                <div v-if="filteredList.length === 0" class="text-center text-muted py-3">
                    <i class="fa-solid fa-inbox fa-2x mb-2 opacity-25"></i>
                    <div>{{ $t('players.empty') }}</div>
                </div>
                <div v-else class="row g-2">
                    <div v-for="p in filteredList" :key="p.name || p" class="col-12 col-sm-6 col-lg-4">
                        <div class="card player-card h-100">
                            <div class="card-body p-2 d-flex align-items-center gap-2">
                                <avatar :player="p.name || p" :size="32"></avatar>
                                <div class="flex-grow-1 min-w-0">
                                    <div class="fw-bold text-truncate">{{ p.name || p }}</div>
                                    <div v-if="listType==='banned-players'" class="small text-muted text-truncate">
                                        <span v-if="p.reason">{{ p.reason }}</span>
                                        <span v-else class="opacity-50">-</span>
                                        <span v-if="p.expires" class="ms-1">({{ p.expires === 'forever' ? $t('players.permanent') : p.expires }})</span>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-outline-danger border-0 flex-shrink-0" @click="removeListUser(p.name||p)" :title="$t('common.remove')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const listType = ref('whitelist');
        const listData = ref([]);
        const newPlayerName = ref('');
        const onlineFilter = ref('');
        const listFilter = ref('');
        const activeMenu = ref(null);
        const playerPings = ref({});
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const filteredOnline = computed(() => {
            const f = onlineFilter.value.toLowerCase().trim();
            if (!f) return store.onlinePlayers;
            return store.onlinePlayers.filter(p => p.toLowerCase().includes(f));
        });

        const filteredList = computed(() => {
            const f = listFilter.value.toLowerCase().trim();
            if (!f) return listData.value;
            return listData.value.filter(p => (p.name || p).toLowerCase().includes(f));
        });

        const pingClass = (ping) => {
            if (ping < 50) return 'text-success';
            if (ping < 150) return 'text-warning';
            return 'text-danger';
        };

        const toggleMenu = (player) => {
            activeMenu.value = activeMenu.value === player ? null : player;
        };

        const closeMenu = (e) => {
            if (activeMenu.value && !e.target.closest('.dropdown')) {
                activeMenu.value = null;
            }
        };

        const sendCmd = async (c) => {
            if (!store.isRunning) {
                showToast('common.server_offline', 'warning');
                return;
            }
            await api.post('/api/server/command', { command: c });
            showToast($t('common.success'));
            activeMenu.value = null;
        };

        const loadLists = async () => {
            try {
                const res = await api.get(`/api/lists/${listType.value}`);
                listData.value = res.data;
            } catch (e) { }
        };

        const modifyList = async (action) => {
            if (!newPlayerName.value) return;
            const n = newPlayerName.value;
            const cmd = listType.value === 'whitelist' ? `whitelist ${action} ${n}` :
                listType.value === 'ops' ? (action === 'add' ? `op ${n}` : `deop ${n}`) :
                    (action === 'add' ? `ban ${n}` : `pardon ${n}`);
            await sendCmd(cmd);
            newPlayerName.value = '';
            setTimeout(loadLists, 1000);
        };
        const removeListUser = (n) => { newPlayerName.value = n; modifyList('remove'); };

        const askTeleport = (player) => openModal({
            title: `${$t('players.teleport')} ${player}`, message: 'Coords (x y z) or Player:', mode: 'input', inputValue: '~ ~ ~',
            callback: (val) => sendCmd(`tp ${player} ${val}`)
        });
        const askGamemode = (player) => openModal({
            title: `${$t('players.gamemode')} ${player}`, message: 'Mode:', mode: 'select', inputValue: 'survival',
            options: [{ label: 'Survival', value: 'survival' }, { label: 'Creative', value: 'creative' }, { label: 'Adventure', value: 'adventure' }, { label: 'Spectator', value: 'spectator' }],
            callback: (val) => sendCmd(`gamemode ${val} ${player}`)
        });
        const askGiveItem = (player) => openModal({
            title: `${$t('players.give_item')} ${player}`, message: $t('players.give_item_prompt'), mode: 'input', inputValue: 'minecraft:diamond 1',
            callback: (val) => sendCmd(`give ${player} ${val}`)
        });
        const askEffect = (player) => openModal({
            title: `${$t('players.effect')} ${player}`, message: $t('players.effect_prompt'), mode: 'input', inputValue: 'minecraft:speed 600 1',
            callback: (val) => sendCmd(`effect give ${player} ${val}`)
        });
        const askExperience = (player) => openModal({
            title: `${$t('players.experience')} ${player}`, message: $t('players.experience_prompt'), mode: 'input', inputValue: '100',
            callback: (val) => sendCmd(`experience add ${player} ${val}`)
        });
        const askTitle = (player) => openModal({
            title: `${$t('players.title_action')} ${player}`, message: $t('players.title_prompt'), mode: 'input', inputValue: 'Hello!',
            callback: (val) => sendCmd(`title ${player} title "${val.replace(/"/g, '\\"')}"`)
        });
        const askMessage = (player) => openModal({
            title: `${$t('players.message')} ${player}`, message: $t('players.message_prompt'), mode: 'input', inputValue: '',
            callback: (val) => sendCmd(`msg ${player} ${val}`)
        });
        const askWhitelist = (player, action) => {
            sendCmd(`whitelist ${action} ${player}`);
            setTimeout(loadLists, 1000);
        };
        const askOp = (player) => {
            sendCmd(`op ${player}`);
            setTimeout(loadLists, 1000);
        };
        const askDeop = (player) => {
            sendCmd(`deop ${player}`);
            setTimeout(loadLists, 1000);
        };
        const askBan = (player) => openModal({
            title: `${$t('players.ban')} ${player}`, message: $t('players.ban_reason_prompt'), mode: 'input', inputValue: '',
            placeholder: $t('players.ban_reason_placeholder'),
            callback: (val) => { sendCmd(`ban ${player}${val ? ' ' + val : ''}`); setTimeout(loadLists, 1000); }
        });
        const askBanIp = (player) => openModal({
            title: `${$t('players.ban_ip')} ${player}`, message: $t('players.ban_reason_prompt'), mode: 'input', inputValue: '',
            placeholder: $t('players.ban_reason_placeholder'),
            callback: (val) => { sendCmd(`ban-ip ${player}${val ? ' ' + val : ''}`); setTimeout(loadLists, 1000); }
        });

        const fetchPlayerPings = async () => {
            if (!store.isRunning || store.onlinePlayers.length === 0) return;
            try {
                const res = await api.get('/api/server/player-pings');
                if (res.data && typeof res.data === 'object') {
                    playerPings.value = res.data;
                }
            } catch (e) { }
        };

        let pingInterval = null;

        onMounted(() => {
            sendCmd('list');
            loadLists();
            document.addEventListener('click', closeMenu);
            fetchPlayerPings();
            pingInterval = setInterval(fetchPlayerPings, 5000);
        });

        onUnmounted(() => {
            document.removeEventListener('click', closeMenu);
            if (pingInterval) clearInterval(pingInterval);
        });

        return {
            store, listType, listData, newPlayerName, loadLists, modifyList, removeListUser,
            sendCmd, askTeleport, askGamemode, askGiveItem, askEffect, askExperience,
            askTitle, askMessage, askWhitelist, askOp, askDeop, askBan, askBanIp,
            onlineFilter, listFilter, filteredOnline, filteredList,
            activeMenu, toggleMenu, playerPings, pingClass
        };
    }
};
