import { ref, reactive, onMounted, watch } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

// ... (CONFIG_GROUPS 保持不变，可以复制之前的) ...
const CONFIG_GROUPS = [
    { title: '基础设置', items: [{ key: 'config.advancedbackups.enabled', label: '启用自动备份', type: 'boolean' }, { key: 'config.advancedbackups.type', label: '备份类型', type: 'select', options: ['zip', 'differential', 'incremental'] }, { key: 'config.advancedbackups.activity', label: '仅活动时备份', type: 'boolean' }, { key: 'config.advancedbackups.save', label: '备份前保存', type: 'boolean' }] },
    { title: '计划与频率', items: [{ key: 'config.advancedbackups.frequency.min', label: '最小间隔(小时)', type: 'number', step: 0.1 }, { key: 'config.advancedbackups.frequency.max', label: '最大间隔(小时)', type: 'number', step: 0.5 }, { key: 'config.advancedbackups.frequency.uptime', label: '使用运行时间', type: 'boolean' }, { key: 'config.advancedbackups.frequency.schedule', label: '定时计划', type: 'text' }] },
    { title: '清理策略', items: [{ key: 'config.advancedbackups.purge.size', label: '最大占用(GB)', type: 'number' }, { key: 'config.advancedbackups.purge.days', label: '保留天数', type: 'number' }, { key: 'config.advancedbackups.purge.count', label: '保留数量', type: 'number' }] },
    { title: '高级选项', items: [{ key: 'config.advancedbackups.zips.compression', label: '压缩等级', type: 'range', min: 1, max: 9 }, { key: 'config.advancedbackups.buffer', label: 'Buffer', type: 'number' }, { key: 'config.advancedbackups.path', label: '备份路径', type: 'text' }, { key: 'config.advancedbackups.blacklist', label: '黑名单', type: 'text' }] }
];

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>备份管理</h3>
            <div v-if="currentTab === 'list'">
                <button class="btn btn-primary" @click="createBackup" :disabled="!store.isRunning"><i class="fa-solid fa-plus-circle me-2"></i>创建在线备份</button>
            </div>
            <div v-if="currentTab === 'config'" class="btn-group">
                <button class="btn btn-outline-secondary" @click="toggleEditMode"><i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i> {{editMode==='gui'?'文本模式':'图形模式'}}</button>
                <button class="btn btn-success" @click="saveConfig"><i class="fa-solid fa-save me-2"></i>保存配置</button>
            </div>
        </div>

        <ul class="nav nav-tabs mb-3">
            <li class="nav-item"><a class="nav-link" :class="{active: currentTab==='list'}" @click="currentTab='list'">备份列表</a></li>
            <li class="nav-item"><a class="nav-link" :class="{active: currentTab==='config'}" @click="currentTab='config'">模组配置</a></li>
        </ul>

        <div v-if="currentTab === 'list'">
            <div class="alert alert-info py-2 small"><i class="fa-solid fa-circle-info me-2"></i>回档会自动停止服务器并融合备份。</div>
            <div class="card shadow-sm">
                <table class="table table-hover align-middle mb-0">
                    <thead><tr><th>文件名</th><th>类型</th><th>时间</th><th>大小</th><th>操作</th></tr></thead>
                    <tbody>
                        <tr v-for="b in backupList" :key="b.name">
                            <td>{{ b.name }}</td>
                            <td><span class="badge" :class="b.type==='full'?'bg-success':'bg-info'">{{ b.type==='full'?'全量':'差量' }}</span><span v-if="b.folder==='snapshots'" class="badge bg-secondary ms-1">快照</span></td>
                            <td class="small text-muted">{{ new Date(b.mtime).toLocaleString() }}</td>
                            <td class="small">{{ (b.size/1024/1024).toFixed(1) }} MB</td>
                            <td><button class="btn btn-sm btn-outline-danger" @click="askRestore(b)">回档</button></td>
                        </tr>
                        <tr v-if="!backupList.length"><td colspan="5" class="text-center text-muted py-3">暂无备份</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div v-if="currentTab === 'config'">
            <div v-if="editMode === 'gui'" class="row g-4">
                <div class="col-md-6" v-for="(group, idx) in CONFIG_GROUPS" :key="idx">
                    <div class="card h-100 border-secondary bg-dark">
                        <div class="card-header bg-body-tertiary fw-bold">{{ group.title }}</div>
                        <div class="card-body">
                            <div v-for="item in group.items" :key="item.key" class="mb-3">
                                <div v-if="item.type === 'boolean'" class="form-check form-switch d-flex justify-content-between"><label class="form-check-label">{{ item.label }}</label><input class="form-check-input" type="checkbox" v-model="formModel[item.key]"></div>
                                <div v-else-if="item.type === 'select'"><label class="form-label small text-muted">{{ item.label }}</label><select class="form-select form-select-sm" v-model="formModel[item.key]"><option v-for="opt in item.options" :value="opt">{{ opt }}</option></select></div>
                                <div v-else-if="item.type === 'range'"><label class="form-label small text-muted d-flex justify-content-between"><span>{{ item.label }}</span><span class="text-primary">{{ formModel[item.key] }}</span></label><input type="range" class="form-range" :min="item.min" :max="item.max" v-model="formModel[item.key]"></div>
                                <div v-else><label class="form-label small text-muted">{{ item.label }}</label><input :type="item.type" class="form-control form-control-sm" v-model="formModel[item.key]" :step="item.step"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="h-100"><textarea class="form-control bg-dark text-light border-secondary" style="font-family: monospace; height: 65vh;" v-model="rawContent"></textarea></div>
        </div>
    </div>
    `,
    setup() {
        const currentTab = ref('list');
        const editMode = ref('gui');
        const backupList = ref([]);
        const rawContent = ref('');
        const formModel = reactive({});
        const CONFIG_PATH = 'config/AdvancedBackups.properties';

        const parseProperties = (text) => {
            const lines = text.split('\n');
            lines.forEach(line => {
                const cleanLine = line.trim();
                if (cleanLine && !cleanLine.startsWith('#')) {
                    const [key, ...valParts] = cleanLine.split('=');
                    const val = valParts.join('=').trim();
                    if (key) {
                        const cleanKey = key.trim();
                        if (val === 'true') formModel[cleanKey] = true;
                        else if (val === 'false') formModel[cleanKey] = false;
                        else if (!isNaN(val) && val !== '') formModel[cleanKey] = Number(val);
                        else formModel[cleanKey] = val;
                    }
                }
            });
        };

        const stringifyProperties = (originalText, model) => {
            let lines = originalText.split('\n');
            return lines.map(line => {
                const cleanLine = line.trim();
                if (cleanLine && !cleanLine.startsWith('#') && cleanLine.includes('=')) {
                    const key = cleanLine.split('=')[0].trim();
                    if (model[key] !== undefined) return `${key}=${model[key]}`;
                }
                return line;
            }).join('\n');
        };

        const loadBackups = async () => { try { const res = await api.get('/api/backups/list'); backupList.value = res.data; } catch(e) {} };
        const loadConfig = async () => { try { const res = await api.get(`/api/files/content?path=${CONFIG_PATH}`); rawContent.value = res.data.content; parseProperties(rawContent.value); } catch(e) { rawContent.value = '# Error'; } };
        const saveConfig = async () => {
            let content = rawContent.value;
            if (editMode.value === 'gui') { content = stringifyProperties(rawContent.value, formModel); rawContent.value = content; }
            try { await api.post('/api/files/save', { filepath: CONFIG_PATH, content }); showToast('保存成功'); } catch(e) { showToast('保存失败', 'danger'); }
        };
        const createBackup = async () => { await api.post('/api/backups/create'); showToast('指令已发送'); setTimeout(loadBackups, 3000); };
        const toggleEditMode = () => { if (editMode.value === 'text') parseProperties(rawContent.value); editMode.value = editMode.value === 'gui' ? 'text' : 'gui'; };

        const askRestore = (b) => {
            openModal({
                title: '确认回档', message: `确定要回滚到 [${b.name}] 吗？服务器将自动停止。`, 
                callback: async () => {
                    // 初始化进度条
                    store.task.visible = true;
                    store.task.title = '正在回档';
                    store.task.percent = 0;
                    store.task.message = '正在发送请求...';
                    store.task.subMessage = '请勿关闭页面';
                    
                    try {
                        await api.post('/api/backups/restore', { filename: b.name, folder: b.folder, type: b.type });
                        // 成功的回调会通过 socket 'restore_completed' 触发
                    } catch(e) { 
                        store.task.visible = false;
                        showToast('请求失败: ' + (e.response?.data?.error || e.message), 'danger'); 
                    }
                }
            });
        };

        watch(currentTab, (val) => { if (val === 'list') loadBackups(); if (val === 'config') loadConfig(); });
        onMounted(loadBackups);

        return { store, currentTab, editMode, backupList, rawContent, formModel, CONFIG_GROUPS, loadBackups, createBackup, askRestore, saveConfig, toggleEditMode };
    }
};