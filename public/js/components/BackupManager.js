import { ref, reactive, onMounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

// 这里为了简单，配置项的 label 暂时保留硬编码或需要后端提供 i18n key。
// 假设用户接受配置项本身是技术性的英文或中文。在此演示中，主要汉化界面元素。
const CONFIG_GROUPS = [
    { titleKey: 'backups.config_groups.basic', items: [{ key: 'config.advancedbackups.enabled', labelKey: 'backups.config_labels.enabled', type: 'boolean' }, { key: 'config.advancedbackups.type', labelKey: 'backups.config_labels.type', type: 'select', options: ['zip', 'differential', 'incremental'] }, { key: 'config.advancedbackups.activity', labelKey: 'backups.config_labels.activity', type: 'boolean' }, { key: 'config.advancedbackups.save', labelKey: 'backups.config_labels.save', type: 'boolean' }] },
    { titleKey: 'backups.config_groups.schedule', items: [{ key: 'config.advancedbackups.frequency.min', labelKey: 'backups.config_labels.freq_min', type: 'number', step: 0.1 }, { key: 'config.advancedbackups.frequency.max', labelKey: 'backups.config_labels.freq_max', type: 'number', step: 0.5 }, { key: 'config.advancedbackups.frequency.uptime', labelKey: 'backups.config_labels.freq_uptime', type: 'boolean' }, { key: 'config.advancedbackups.frequency.schedule', labelKey: 'backups.config_labels.freq_schedule', type: 'text' }] },
    { titleKey: 'backups.config_groups.purge', items: [{ key: 'config.advancedbackups.purge.size', labelKey: 'backups.config_labels.purge_size', type: 'number' }, { key: 'config.advancedbackups.purge.days', labelKey: 'backups.config_labels.purge_days', type: 'number' }, { key: 'config.advancedbackups.purge.count', labelKey: 'backups.config_labels.purge_count', type: 'number' }] },
    { titleKey: 'backups.config_groups.advanced', items: [{ key: 'config.advancedbackups.zips.compression', labelKey: 'backups.config_labels.compression', type: 'range', min: 1, max: 9 }, { key: 'config.advancedbackups.buffer', labelKey: 'backups.config_labels.buffer', type: 'number' }, { key: 'config.advancedbackups.path', labelKey: 'backups.config_labels.path', type: 'text' }, { key: 'config.advancedbackups.blacklist', labelKey: 'backups.config_labels.blacklist', type: 'text' }] }
];

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3 mb-md-4">
            <h3 class="m-0 fw-bold">{{ $t('sidebar.backups') }}</h3>
            <div v-if="currentTab === 'list'">
                <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm fw-bold" @click="createBackup" :disabled="!store.isRunning">
                    <i class="fa-solid fa-plus-circle me-1"></i><span class="d-none d-sm-inline">{{ $t('backups.create_snap') }}</span><span class="d-inline d-sm-none">Backup</span>
                </button>
            </div>
            <div v-if="currentTab === 'config'" class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-2 px-md-3 fw-bold" @click="toggleEditMode">
                    <i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i>
                    <span class="d-none d-md-inline ms-1">{{editMode==='gui'?$t('common.text_mode'):$t('common.gui_mode')}}</span>
                </button>
                <button class="btn btn-success btn-sm rounded-pill px-3 shadow-sm fw-bold" @click="saveConfig">
                    <i class="fa-solid fa-save me-1"></i>{{ $t('common.save') }}
                </button>
            </div>
        </div>

        <ul class="nav nav-tabs mb-3 border-0 bg-body-tertiary p-1 rounded-pill d-inline-flex" style="font-size: 0.85rem;">
            <li class="nav-item">
                <a class="nav-link border-0 rounded-pill px-3 py-1 cursor-pointer" :class="{active: currentTab==='list', 'bg-primary text-white shadow-sm': currentTab==='list'}" @click="currentTab='list'">{{ $t('backups.list_title') }}</a>
            </li>
            <li class="nav-item">
                <a class="nav-link border-0 rounded-pill px-3 py-1 cursor-pointer" :class="{active: currentTab==='config', 'bg-primary text-white shadow-sm': currentTab==='config'}" @click="currentTab='config'">{{ $t('backups.config') }}</a>
            </li>
        </ul>

        <Transition name="fade" mode="out-in">
            <div v-if="currentTab === 'list'" key="list">
                <div class="alert alert-info py-2 px-3 small border-0 shadow-sm mb-3" style="border-radius: 12px;">
                    <i class="fa-solid fa-circle-info me-2"></i>{{ $t('backups.tips') }}
                </div>
                <div class="card shadow-sm border-0 overflow-hidden" style="border-radius: 16px;">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="bg-body-tertiary">
                                <tr class="small text-uppercase text-muted fw-bold">
                                    <th class="px-3">{{ $t('common.name') }}</th>
                                    <th>{{ $t('common.status') }}</th>
                                    <th class="d-none d-md-table-cell">{{ $t('common.time') }}</th>
                                    <th class="d-none d-sm-table-cell">{{ $t('common.size') }}</th>
                                    <th class="text-end px-3">{{ $t('common.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="b in backupList" :key="b.name" class="animate-in">
                                    <td class="px-3 fw-bold small text-truncate" style="max-width: 150px;">{{ b.name }}</td>
                                    <td>
                                        <span class="badge rounded-pill py-1" :class="b.type==='full'?'bg-success-subtle text-success border border-success-subtle':'bg-info-subtle text-info border border-info-subtle'" style="font-size: 0.7rem;">
                                            {{ b.type==='full' ? $t('backups.type_full') : $t('backups.type_diff') }}
                                        </span>
                                        <span v-if="b.folder==='snapshots'" class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill ms-1" style="font-size: 0.7rem;">Snap</span>
                                        <div class="d-md-none small text-muted mt-1" style="font-size: 0.65rem;">{{ new Date(b.mtime).toLocaleString() }}</div>
                                    </td>
                                    <td class="small text-muted d-none d-md-table-cell">{{ new Date(b.mtime).toLocaleString() }}</td>
                                    <td class="small d-none d-sm-table-cell">{{ (b.size/1024/1024).toFixed(1) }} MB</td>
                                    <td class="text-end px-3">
                                        <div class="d-flex justify-content-end gap-1">
                                            <button class="btn btn-xs btn-outline-primary border-0" @click="askRestore(b)" :title="$t('backups.restore')"><i class="fa-solid fa-clock-rotate-left"></i></button>
                                            <button class="btn btn-xs btn-outline-danger border-0" @click="askDelete(b)" :title="$t('common.delete')"><i class="fa-solid fa-trash"></i></button>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="!backupList.length">
                                    <td colspan="5" class="text-center text-muted py-5">
                                        <i class="fa-solid fa-box-open fa-2x mb-2 opacity-25 d-block"></i>
                                        Empty
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div v-else-if="currentTab === 'config'" key="config">
                <Transition name="fade" mode="out-in">
                    <div v-if="editMode === 'gui'" class="row g-3 g-md-4 overflow-auto custom-scrollbar pb-5" key="gui">
                        <div class="col-md-6" v-for="(group, idx) in CONFIG_GROUPS" :key="idx">
                            <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px;">
                                <div class="card-header bg-body-tertiary fw-bold border-0 py-2 px-3 small text-uppercase text-muted">{{ $t(group.titleKey) }}</div>
                                <div class="card-body p-3">
                                    <div v-for="item in group.items" :key="item.key" class="mb-3">
                                        <div v-if="item.type === 'boolean'" class="form-check form-switch d-flex justify-content-between p-0">
                                            <label class="form-check-label small fw-bold text-muted">{{ $t(item.labelKey) }}</label>
                                            <input class="form-check-input ms-0" type="checkbox" v-model="formModel[item.key]">
                                        </div>
                                        <div v-else-if="item.type === 'select'">
                                            <label class="form-label small fw-bold text-muted mb-1">{{ $t(item.labelKey) }}</label>
                                            <select class="form-select form-select-sm border-0 bg-body-tertiary" v-model="formModel[item.key]">
                                                <option v-for="opt in item.options" :value="opt">{{ opt }}</option>
                                            </select>
                                        </div>
                                        <div v-else-if="item.type === 'range'">
                                            <label class="form-label small fw-bold text-muted mb-1 d-flex justify-content-between">
                                                <span>{{ $t(item.labelKey) }}</span>
                                                <span class="text-primary">{{ formModel[item.key] }}</span>
                                            </label>
                                            <input type="range" class="form-range" :min="item.min" :max="item.max" v-model="formModel[item.key]">
                                        </div>
                                        <div v-else>
                                            <label class="form-label small fw-bold text-muted mb-1">{{ $t(item.labelKey) }}</label>
                                            <input :type="item.type" class="form-control form-control-sm border-0 bg-body-tertiary px-2" v-model="formModel[item.key]" :step="item.step">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="h-100" key="text"><textarea class="form-control bg-body text-body border-secondary" style="font-family: monospace; height: 65vh;" v-model="rawContent"></textarea></div>
                </Transition>
            </div>
        </Transition>
    </div>
    `,
    setup() {
        const currentTab = ref('list');
        const editMode = ref('gui');
        const backupList = ref([]);
        const rawContent = ref('');
        const formModel = reactive({});
        const CONFIG_PATH = 'config/AdvancedBackups.properties';
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

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

        const loadBackups = async () => { try { const res = await api.get('/api/backups/list'); backupList.value = res.data; } catch (e) { } };
        const loadConfig = async () => { try { const res = await api.get(`/api/files/content?path=${CONFIG_PATH}`); rawContent.value = res.data.content; parseProperties(rawContent.value); } catch (e) { rawContent.value = '# Error'; } };
        const saveConfig = async () => {
            let content = rawContent.value;
            if (editMode.value === 'gui') { content = stringifyProperties(rawContent.value, formModel); rawContent.value = content; }
            try { await api.post('/api/files/save', { filepath: CONFIG_PATH, content }); showToast($t('common.success')); } catch (e) { showToast($t('common.error'), 'danger'); }
        };
        const createBackup = async () => { await api.post('/api/backups/create'); showToast($t('common.success')); setTimeout(loadBackups, 3000); };
        const toggleEditMode = () => { if (editMode.value === 'text') parseProperties(rawContent.value); editMode.value = editMode.value === 'gui' ? 'text' : 'gui'; };

        const askRestore = (b) => {
            openModal({
                title: $t('backups.confirm_restore_title'),
                message: $t('backups.confirm_restore_msg', { name: b.name }),
                callback: async () => {
                    // 初始化进度条
                    store.task.visible = true;
                    store.task.title = $t('backups.progress_restoring');
                    store.task.percent = 0;
                    store.task.message = $t('common.loading');
                    store.task.subMessage = '...';

                    try {
                        await api.post('/api/backups/restore', { filename: b.name, folder: b.folder, type: b.type });
                        // 成功的回调会通过 socket 'restore_completed' 触发
                    } catch (e) {
                        store.task.visible = false;
                        showToast((e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        const askDelete = (b) => {
            openModal({
                title: $t('backups.confirm_delete_title'),
                message: $t('backups.confirm_delete_msg', { name: b.name }),
                callback: async () => {
                    try {
                        await api.post('/api/backups/delete', { filename: b.name, folder: b.folder });
                        showToast($t('common.success'));
                        loadBackups();
                    } catch (e) {
                        showToast((e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        watch(currentTab, (val) => { if (val === 'list') loadBackups(); if (val === 'config') loadConfig(); });
        onMounted(loadBackups);

        return { store, currentTab, editMode, backupList, rawContent, formModel, CONFIG_GROUPS, loadBackups, createBackup, askRestore, askDelete, saveConfig, toggleEditMode };
    }
};