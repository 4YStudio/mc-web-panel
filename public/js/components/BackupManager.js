import { ref, reactive, onMounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, uploadFileWithChunk, isLargeFile } from '../utils.js';

export default {
    template: `
    <div class="animate-in">
        <div class="page-header d-flex justify-content-between align-items-center">
            <h3 class="m-0 fw-bold">{{ $t('plugins.mc-panel-plugin-backup.map_backup.title') }}</h3>
            <div class="d-flex align-items-center gap-2">
                <button v-if="currentTab === 'config'" class="btn btn-sm btn-outline-secondary rounded-pill px-2 px-md-3 fw-bold" @click="toggleEditMode">
                    <i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i>
                    <span class="d-none d-md-inline ms-1">{{ editMode==='gui' ? $t('common.text_mode') : $t('common.gui_mode') }}</span>
                </button>
                <button v-if="currentTab === 'list'" class="btn btn-outline-secondary btn-sm rounded-pill px-3 shadow-sm fw-bold me-2" @click="triggerImport" :title="$t('plugins.mc-panel-plugin-backup.backups.import')">
                    <i class="fa-solid fa-file-import me-md-1"></i>
                    <span class="d-none d-md-inline">{{ $t('plugins.mc-panel-plugin-backup.backups.import') }}</span>
                </button>
                <input type="file" ref="importInput" class="d-none" accept=".zip" @change="handleImport">
                <button v-if="currentTab === 'list'" class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm fw-bold" @click="askCreateBackup" :title="$t('plugins.mc-panel-plugin-backup.map_backup.manual_backup')">
                    <i class="fa-solid fa-plus-circle me-md-1"></i>
                    <span class="d-none d-md-inline">{{ $t('plugins.mc-panel-plugin-backup.map_backup.manual_backup') }}</span>
                </button>
                <button v-if="currentTab === 'config'" class="btn btn-success btn-sm rounded-pill px-3 shadow-sm fw-bold me-2" @click="saveConfig" :title="$t('common.save')">
                    <i class="fa-solid fa-save me-md-1"></i>
                    <span class="d-none d-md-inline">{{ $t('common.save') }}</span>
                </button>
            </div>
        </div>

        <ul class="nav nav-tabs mb-3 border-0 bg-body-tertiary p-1 rounded-pill d-inline-flex" style="font-size: 0.85rem;">
            <li class="nav-item">
                <a class="nav-link border-0 rounded-pill px-3 py-1 cursor-pointer" :class="{active: currentTab==='list', 'bg-primary text-white shadow-sm': currentTab==='list'}" @click="currentTab='list'">{{ $t('plugins.mc-panel-plugin-backup.backups.list_title') }}</a>
            </li>
            <li class="nav-item">
                <a class="nav-link border-0 rounded-pill px-3 py-1 cursor-pointer" :class="{active: currentTab==='config', 'bg-primary text-white shadow-sm': currentTab==='config'}" @click="currentTab='config'">{{ $t('plugins.mc-panel-plugin-backup.backups.config') }}</a>
            </li>
        </ul>

        <Transition name="fade" mode="out-in">
            <div v-if="currentTab === 'list'" key="list">
                <div class="alert alert-info py-2 px-3 small mb-3">
                    <i class="fa-solid fa-circle-info me-2"></i>
                    {{ $t('plugins.mc-panel-plugin-backup.map_backup.panel_tips') }}
                </div>
                <div class="card overflow-hidden">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="bg-body-tertiary">
                                <tr class="small text-uppercase text-muted fw-bold">
                                    <th class="px-3">{{ $t('common.name') }}</th>
                                    <th>{{ $t('common.status') }}</th>
                                    <th>{{ $t('common.note') }}</th>
                                    <th class="d-none d-md-table-cell">{{ $t('common.time') }}</th>
                                    <th class="d-none d-sm-table-cell">{{ $t('common.size') }}</th>
                                    <th class="text-end px-3">{{ $t('common.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="b in backupList" :key="b.name" class="animate-in">
                                    <td class="px-3 fw-bold small">
                                        <div class="d-flex align-items-center">
                                            <i v-if="b.locked" class="fa-solid fa-lock text-warning me-2 small" :title="$t('common.locked')"></i>
                                            <span class="text-truncate" style="max-width: 150px;">{{ b.name }}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span v-if="b.type === 'auto'" class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill py-1" style="font-size: 0.7rem;">
                                            {{ $t('plugins.mc-panel-plugin-backup.backups.type_auto') }}
                                        </span>
                                        <span v-else-if="b.type === 'full'" class="badge bg-success-subtle text-success border border-success-subtle rounded-pill py-1" style="font-size: 0.7rem;">
                                            {{ $t('plugins.mc-panel-plugin-backup.backups.type_manual') }}
                                        </span>
                                        <span v-else class="badge bg-info-subtle text-info border border-info-subtle rounded-pill py-1" style="font-size: 0.7rem;">
                                            {{ $t('plugins.mc-panel-plugin-backup.backups.type_diff') }}
                                        </span>
                                    </td>
                                    <td class="small">
                                        <div class="d-flex align-items-center">
                                            <span class="text-muted text-truncate" style="max-width: 120px;">{{ b.note || '-' }}</span>
                                            <button class="btn btn-link btn-xs p-0 ms-1 opacity-50 hover-opacity-100" @click="askEditNote(b)"><i class="fa-solid fa-pen-to-square"></i></button>
                                        </div>
                                    </td>
                                    <td class="small text-muted d-none d-md-table-cell">{{ new Date(b.mtime).toLocaleString() }}</td>
                                    <td class="small d-none d-sm-table-cell">{{ (b.size/1024/1024).toFixed(1) }} MB</td>
                                    <td class="text-end px-3">
                                        <div class="d-flex justify-content-end gap-1">
                                            <button class="btn btn-xs btn-outline-warning border-0" @click="toggleLock(b)" :title="b.locked ? $t('common.unlock') : $t('common.lock')">
                                                <i class="fa-solid" :class="b.locked ? 'fa-lock-open' : 'fa-lock'"></i>
                                            </button>
                                            <button class="btn btn-xs btn-outline-success border-0" @click="downloadBackup(b)" :title="$t('common.download')">
                                                <i class="fa-solid fa-download"></i>
                                            </button>
                                            <button class="btn btn-xs btn-outline-info border-0" @click="askClone(b)" :title="$t('plugins.mc-panel-plugin-backup.backups.clone')">
                                                <i class="fa-solid fa-copy"></i>
                                            </button>
                                            <button class="btn btn-xs btn-outline-primary border-0" @click="askRestore(b)" :title="$t('plugins.mc-panel-plugin-backup.backups.restore')"><i class="fa-solid fa-clock-rotate-left"></i></button>
                                            <button class="btn btn-xs btn-outline-danger border-0" @click="askDelete(b)" :disabled="b.locked" :title="$t('common.delete')"><i class="fa-solid fa-trash"></i></button>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="!backupList.length">
                                    <td colspan="6" class="text-center text-muted py-5">
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
                        <div class="col-md-8 mx-auto">
                            <div class="card">
                                <div class="card-header bg-body-tertiary fw-bold border-0 py-2 px-3 small text-uppercase text-muted">{{ $t('plugins.mc-panel-plugin-backup.map_backup.title') }} - {{ $t('plugins.mc-panel-plugin-backup.backups.config') }}</div>
                                <div class="card-body p-4">
                                    <div class="form-check form-switch mb-4 d-flex justify-content-between p-0">
                                        <label class="form-check-label fw-bold text-muted">{{ $t('plugins.mc-panel-plugin-backup.map_backup.auto_enabled') }}</label>
                                        <input class="form-check-input ms-0" type="checkbox" v-model="panelConfig.autoBackupEnabled">
                                    </div>
                                    <div v-if="panelConfig.autoBackupEnabled" class="animate-in">
                                        <div class="mb-4">
                                            <label class="form-label small fw-bold text-muted mb-2">{{ $t('plugins.mc-panel-plugin-backup.map_backup.mode') }}</label>
                                            <div class="row g-2">
                                                <div class="col-6">
                                                    <button class="btn btn-sm w-100 rounded-pill fw-bold" :class="panelConfig.autoBackupMode === 'interval' ? 'btn-primary' : 'btn-outline-secondary'" @click="panelConfig.autoBackupMode = 'interval'">{{ $t('plugins.mc-panel-plugin-backup.map_backup.mode_interval') }}</button>
                                                </div>
                                                <div class="col-6">
                                                    <button class="btn btn-sm w-100 rounded-pill fw-bold" :class="panelConfig.autoBackupMode === 'schedule' ? 'btn-primary' : 'btn-outline-secondary'" @click="panelConfig.autoBackupMode = 'schedule'">{{ $t('plugins.mc-panel-plugin-backup.map_backup.mode_schedule') }}</button>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="panelConfig.autoBackupMode === 'interval'" class="row g-3 mb-4">
                                            <div class="col-6">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('plugins.mc-panel-plugin-backup.map_backup.interval_hours') }}</label>
                                                <input type="number" class="form-control border-0 bg-body-tertiary" v-model="panelConfig.autoBackupIntervalHours" min="0">
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('plugins.mc-panel-plugin-backup.map_backup.interval_minutes') }}</label>
                                                <input type="number" class="form-control border-0 bg-body-tertiary" v-model="panelConfig.autoBackupIntervalMinutes" min="0" max="59">
                                            </div>
                                        </div>

                                        <div v-else class="row g-3 mb-4">
                                            <div class="col-6">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('plugins.mc-panel-plugin-backup.map_backup.schedule_time') }}</label>
                                                <input type="time" class="form-control border-0 bg-body-tertiary" v-model="panelConfig.autoBackupScheduleTime">
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('plugins.mc-panel-plugin-backup.map_backup.schedule_days') }}</label>
                                                <input type="number" class="form-control border-0 bg-body-tertiary" v-model="panelConfig.autoBackupScheduleDays" min="1">
                                            </div>
                                        </div>

                                        <div class="mb-4">
                                            <label class="form-label small fw-bold text-muted mb-1">{{ $t('plugins.mc-panel-plugin-backup.map_backup.max_count') }}</label>
                                            <input type="number" class="form-control border-0 bg-body-tertiary" v-model="panelConfig.maxBackupCount" min="1">
                                        </div>

                                        <div class="form-check form-switch mb-3 d-flex justify-content-between p-0 border-top pt-3">
                                            <label class="form-check-label small fw-bold text-muted">{{ $t('plugins.mc-panel-plugin-backup.map_backup.only_if_online') }}</label>
                                            <input class="form-check-input ms-0" type="checkbox" v-model="panelConfig.autoBackupOnlyIfPlayersOnline">
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
        const panelConfig = reactive({
            autoBackupEnabled: store.stats?.autoBackupEnabled || false,
            autoBackupMode: store.stats?.autoBackupMode || 'interval',
            autoBackupIntervalHours: store.stats?.autoBackupIntervalHours || 12,
            autoBackupIntervalMinutes: store.stats?.autoBackupIntervalMinutes || 0,
            autoBackupScheduleTime: store.stats?.autoBackupScheduleTime || "03:00",
            autoBackupScheduleDays: store.stats?.autoBackupScheduleDays || 1,
            autoBackupOnlyIfPlayersOnline: store.stats?.autoBackupOnlyIfPlayersOnline || false,
            maxBackupCount: store.stats?.maxBackupCount || 10
        });
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;
        const isSaving = ref(false);

        const syncPanelConfig = () => {
            const stats = store.stats;
            if (stats) {
                panelConfig.autoBackupEnabled = !!stats.autoBackupEnabled;
                panelConfig.autoBackupMode = stats.autoBackupMode || 'interval';
                panelConfig.autoBackupIntervalHours = stats.autoBackupIntervalHours !== undefined ? stats.autoBackupIntervalHours : (stats.autoBackupInterval || 12);
                panelConfig.autoBackupIntervalMinutes = stats.autoBackupIntervalMinutes || 0;
                panelConfig.autoBackupScheduleTime = stats.autoBackupScheduleTime || "03:00";
                panelConfig.autoBackupScheduleDays = stats.autoBackupScheduleDays || 1;
                panelConfig.autoBackupOnlyIfPlayersOnline = !!stats.autoBackupOnlyIfPlayersOnline;
                panelConfig.maxBackupCount = stats.maxBackupCount || 10;
            }
        };

        const loadBackups = async () => {
            try {
                const res = await api.get('/api/backups/panel/list');
                backupList.value = res.data;
            } catch (e) { }
        };

        const saveConfig = async () => {
            isSaving.value = true;
            if (editMode.value === 'text') {
                try {
                    const parsed = JSON.parse(rawContent.value);
                    Object.assign(panelConfig, parsed);
                } catch (e) {
                    showToast('JSON 格式错误', 'danger');
                    isSaving.value = false;
                    return;
                }
            }
            try {
                await api.post('/api/instances/update', {
                    id: store.currentInstanceId,
                    autoBackupEnabled: panelConfig.autoBackupEnabled,
                    autoBackupMode: panelConfig.autoBackupMode,
                    autoBackupIntervalHours: panelConfig.autoBackupIntervalHours,
                    autoBackupIntervalMinutes: panelConfig.autoBackupIntervalMinutes,
                    autoBackupScheduleTime: panelConfig.autoBackupScheduleTime,
                    autoBackupScheduleDays: panelConfig.autoBackupScheduleDays,
                    autoBackupOnlyIfPlayersOnline: panelConfig.autoBackupOnlyIfPlayersOnline,
                    maxBackupCount: panelConfig.maxBackupCount
                });
                showToast($t('common.success'));
            } catch (e) {
                showToast($t('common.error'), 'danger');
            } finally {
                setTimeout(() => isSaving.value = false, 1000);
            }
        };

        const createBackup = async (note = '') => {
            await api.post('/api/backups/panel/create', { note });
            showToast($t('common.success'));
            setTimeout(loadBackups, 3000);
        };

        const askCreateBackup = () => {
            openModal({
                title: $t('plugins.mc-panel-plugin-backup.map_backup.manual_backup'),
                message: $t('plugins.mc-panel-plugin-backup.backups.prompt_note'),
                mode: 'input',
                placeholder: 'e.g. Before installing new mod',
                callback: (val) => createBackup(val)
            });
        };

        const toggleLock = async (b) => {
            try {
                await api.post('/api/backups/panel/update', { filename: b.name, locked: !b.locked });
                b.locked = !b.locked;
                showToast($t('common.success'));
            } catch (e) { showToast(e.message, 'danger'); }
        };

        const askEditNote = (b) => {
            openModal({
                title: $t('common.edit_note'),
                message: $t('plugins.mc-panel-plugin-backup.backups.prompt_note'),
                mode: 'input',
                inputValue: b.note,
                callback: async (val) => {
                    try {
                        await api.post('/api/backups/panel/update', { filename: b.name, note: val });
                        b.note = val;
                        showToast($t('common.success'));
                    } catch (e) { showToast(e.message, 'danger'); }
                }
            });
        };

        const downloadBackup = (b) => {
            window.open(`/api/backups/panel/download?filename=${encodeURIComponent(b.name)}&instanceId=${store.currentInstanceId}`, '_blank');
        };

        const toggleEditMode = () => {
            if (editMode.value === 'gui') {
                rawContent.value = JSON.stringify(panelConfig, null, 2);
            } else {
                try {
                    const parsed = JSON.parse(rawContent.value);
                    Object.assign(panelConfig, parsed);
                } catch (e) {
                    showToast('JSON 格式错误', 'danger');
                    return;
                }
            }
            editMode.value = editMode.value === 'gui' ? 'text' : 'gui';
        };

        const askRestore = (b) => {
            openModal({
                title: $t('plugins.mc-panel-plugin-backup.map_backup.one_click_restore'),
                message: $t('plugins.mc-panel-plugin-backup.map_backup.restore_confirm'),
                callback: async () => {
                    store.task.visible = true;
                    store.task.title = $t('plugins.mc-panel-plugin-backup.backups.progress_restoring');
                    store.task.percent = 0;
                    store.task.message = $t('common.loading');
                    store.task.subMessage = '...';
                    try {
                        await api.post('/api/backups/restore', { filename: b.name, folder: b.folder, type: b.type });
                    } catch (e) {
                        store.task.visible = false;
                        showToast((e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        const askDelete = (b) => {
            openModal({
                title: $t('plugins.mc-panel-plugin-backup.backups.confirm_delete_title'),
                message: $t('plugins.mc-panel-plugin-backup.backups.confirm_delete_msg', { name: b.name }),
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

        const triggerImport = () => {
            const el = document.querySelector('input[type="file"][ref="importInput"]') || proxy.$refs.importInput;
            if (el) el.click();
        };
        const handleImport = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                if (isLargeFile(file)) {
                    await uploadFileWithChunk('/api/backups/panel/import-chunk', file, { instanceId: store.currentInstanceId });
                } else {
                    const fd = new FormData();
                    fd.append('backup', file);
                    fd.append('instanceId', store.currentInstanceId);
                    await api.post('/api/backups/panel/import', fd);
                }
                showToast($t('common.success'));
                loadBackups();
            } catch (err) {
                showToast(err.message, 'danger');
            }
            e.target.value = '';
        };
        const askClone = (b) => {
             openModal({
                title: $t('plugins.mc-panel-plugin-backup.backups.clone'),
                message: '克隆该备份为新备份',
                mode: 'input',
                placeholder: '新名称 (留空自动生成)',
                callback: async (val) => {
                    try {
                        await api.post('/api/backups/panel/clone', { filename: b.name, newName: val });
                        showToast($t('common.success'));
                        loadBackups();
                    } catch (e) { showToast(e.message, 'danger'); }
                }
            });
        };

        watch(currentTab, (val) => {
            if (val === 'list') loadBackups();
            if (val === 'config') syncPanelConfig();
        });

        onMounted(() => {
            loadBackups();
            syncPanelConfig();
        });

        return {
            store, currentTab, editMode, backupList, rawContent, panelConfig,
            loadBackups, askCreateBackup, askRestore, askDelete, saveConfig, toggleEditMode,
            toggleLock, askEditNote, downloadBackup,
            triggerImport, handleImport, askClone
        };
    }
};
