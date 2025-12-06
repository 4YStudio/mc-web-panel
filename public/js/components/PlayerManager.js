import { ref, onMounted } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';
import Avatar from './Avatar.js';

export default {
    components: { Avatar },
    template: `
    <div>
        <h3>玩家管理</h3>
        
        <div class="card mb-4 border-primary">
            <div class="card-header bg-primary-subtle fw-bold">在线玩家 ({{ store.onlinePlayers.length }})</div>
            <div class="card-body">
                <div v-if="store.onlinePlayers.length === 0" class="text-center text-muted py-3">当前没有玩家在线</div>
                <div class="d-flex flex-wrap gap-3">
                    <div v-for="p in store.onlinePlayers" class="card shadow-sm" style="width: 220px;">
                        <div class="card-body text-center p-3">
                            <avatar :player="p" :size="64" class="mb-2 shadow-sm"></avatar>
                            <h5 class="card-title">{{ p }}</h5>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary dropdown-toggle w-100" data-bs-toggle="dropdown">操作</button>
                                <ul class="dropdown-menu w-100 shadow">
                                    <li><a class="dropdown-item player-action-item" @click="askTeleport(p)">传送玩家</a></li>
                                    <li><a class="dropdown-item player-action-item" @click="askGamemode(p)">切换游戏模式</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item player-action-item" @click="sendCmd('clear ' + p)">清空背包</a></li>
                                    <li><a class="dropdown-item player-action-item text-danger" @click="sendCmd('kill ' + p)">击杀玩家</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item player-action-item text-danger" @click="sendCmd('kick ' + p)">踢出游戏</a></li>
                                    <li><a class="dropdown-item player-action-item text-danger" @click="sendCmd('ban ' + p)">封禁玩家</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <ul class="nav nav-tabs card-header-tabs">
                    <li class="nav-item"><a class="nav-link" :class="{active: listType==='whitelist'}" @click="listType='whitelist'; loadLists()">白名单</a></li>
                    <li class="nav-item"><a class="nav-link" :class="{active: listType==='ops'}" @click="listType='ops'; loadLists()">管理员(OP)</a></li>
                    <li class="nav-item"><a class="nav-link" :class="{active: listType==='banned-players'}" @click="listType='banned-players'; loadLists()">黑名单</a></li>
                </ul>
            </div>
            <div class="card-body">
                <div class="input-group mb-3">
                    <input type="text" class="form-control" v-model="newPlayerName" placeholder="玩家名称">
                    <button class="btn btn-outline-success" @click="modifyList('add')"><i class="fa-solid fa-plus"></i> 添加</button>
                </div>
                <ul class="list-group">
                    <li v-for="p in listData" class="list-group-item d-flex justify-content-between align-items-center">
                        <span class="d-flex align-items-center">
                            <avatar :player="p.name || p" :size="24" class="me-2"></avatar> 
                            {{ p.name || p }}
                        </span>
                        <button class="btn btn-sm btn-outline-danger" @click="removeListUser(p.name||p)">移除</button>
                    </li>
                    <li v-if="listData.length===0" class="list-group-item text-muted text-center">列表为空</li>
                </ul>
            </div>
        </div>
    </div>
    `,
    setup() {
        const listType = ref('whitelist');
        const listData = ref([]);
        const newPlayerName = ref('');

        const sendCmd = async (c) => { await api.post('/api/server/command', { command: c }); showToast('已发送'); };

        const loadLists = async () => {
            try {
                const res = await api.get(`/api/lists/${listType.value}`);
                listData.value = res.data;
            } catch(e) {}
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
            title: `传送 ${player}`, message: '输入坐标 (x y z) 或 目标玩家:', mode: 'input', inputValue: '~ ~ ~',
            callback: (val) => sendCmd(`tp ${player} ${val}`)
        });
        const askGamemode = (player) => openModal({
            title: `修改模式 ${player}`, message: '选择模式:', mode: 'select', inputValue: 'survival',
            options: [{ label: '生存', value: 'survival' }, { label: '创造', value: 'creative' }, { label: '冒险', value: 'adventure' }, { label: '旁观', value: 'spectator' }],
            callback: (val) => sendCmd(`gamemode ${val} ${player}`)
        });

        // 挂载时刷新一次列表
        onMounted(() => {
            sendCmd('list');
            loadLists();
        });

        return { store, listType, listData, newPlayerName, loadLists, modifyList, removeListUser, sendCmd, askTeleport, askGamemode };
    }
};