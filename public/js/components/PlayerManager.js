import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from '/js/vue.esm-browser.js';
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

        <div class="card mb-4 border-primary">
            <div class="card-header bg-primary-subtle fw-bold d-flex justify-content-between align-items-center">
                <span><i class="fa-solid fa-signal me-2"></i>{{ $t('players.online_players') }}</span>
                <span class="badge bg-primary fs-6">{{ filteredOnline.length }}{{ store.onlinePlayers.length !== filteredOnline.length ? ' / ' + store.onlinePlayers.length : '' }}</span>
            </div>
            <div class="card-body p-0">
                <div class="px-3 pt-3 pb-2">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-body-tertiary border-end-0"><i class="fa-solid fa-search text-muted"></i></span>
                        <input type="text" class="form-control border-start-0" :placeholder="$t('players.search_player')" v-model="onlineFilter">
                    </div>
                </div>
                <div v-if="store.onlinePlayers.length === 0" class="text-center text-muted py-4">
                    <i class="fa-solid fa-user-slash fa-2x mb-2 opacity-25"></i>
                    <div>{{ $t('players.no_online') }}</div>
                </div>
                <div v-else class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th style="width:40px;"></th>
                                <th>{{ $t('players.player_name') }}</th>
                                <th class="text-end" style="width:1%; white-space:nowrap;">{{ $t('common.actions') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="p in filteredOnline" :key="p">
                                <td><avatar :player="p" :size="28"></avatar></td>
                                <td class="fw-bold">{{ p }}</td>
                                <td class="text-end">
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-primary" @click="askTeleport(p)" :title="$t('players.teleport')">
                                            <i class="fa-solid fa-location-dot"></i>
                                        </button>
                                        <button class="btn btn-outline-info" @click="askGamemode(p)" :title="$t('players.gamemode')">
                                            <i class="fa-solid fa-gamepad"></i>
                                        </button>
                                        <button class="btn btn-outline-warning" @click="sendCmd('clear ' + p)" :title="$t('players.clear_inv')">
                                            <i class="fa-solid fa-broom"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" @click="sendCmd('kill ' + p)" :title="$t('players.kill')">
                                            <i class="fa-solid fa-skull"></i>
                                        </button>
                                        <button class="btn btn-outline-secondary" @click="sendCmd('kick ' + p)" :title="$t('players.kick')">
                                            <i class="fa-solid fa-right-from-bracket"></i>
                                        </button>
                                        <button class="btn btn-outline-dark" @click="sendCmd('ban ' + p)" :title="$t('players.ban')">
                                            <i class="fa-solid fa-gavel"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
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
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th style="width:40px;"></th>
                                <th>{{ $t('players.player_name') }}</th>
                                <th v-if="listType==='banned-players'" class="d-none d-md-table-cell">{{ $t('players.reason') }}</th>
                                <th v-if="listType==='banned-players'" class="d-none d-md-table-cell">{{ $t('players.expires') }}</th>
                                <th style="width:80px;" class="text-end">{{ $t('common.actions') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="p in filteredList" :key="p.name || p">
                                <td><avatar :player="p.name || p" :size="28"></avatar></td>
                                <td class="fw-bold">{{ p.name || p }}</td>
                                <td v-if="listType==='banned-players'" class="d-none d-md-table-cell small text-muted">{{ p.reason || '-' }}</td>
                                <td v-if="listType==='banned-players'" class="d-none d-md-table-cell small text-muted">{{ p.expires === 'forever' ? $t('players.permanent') : (p.expires || '-') }}</td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-outline-danger" @click="removeListUser(p.name||p)" :title="$t('common.remove')">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="filteredList.length === 0">
                                <td :colspan="listType==='banned-players' ? 5 : 3" class="text-center text-muted py-3">{{ $t('players.empty') }}</td>
                            </tr>
                        </tbody>
                    </table>
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

        const sendCmd = async (c) => {
            if (!store.isRunning) {
                showToast('common.server_offline', 'warning');
                return;
            }
            await api.post('/api/server/command', { command: c });
            showToast($t('common.success'));
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

        onMounted(() => {
            sendCmd('list');
            loadLists();
        });

        return {
            store, listType, listData, newPlayerName, loadLists, modifyList, removeListUser,
            sendCmd, askTeleport, askGamemode, onlineFilter, listFilter,
            filteredOnline, filteredList
        };
    }
};
