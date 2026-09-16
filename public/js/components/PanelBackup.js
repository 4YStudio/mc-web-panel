import { ref, reactive, onMounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, isLargeFile, uploadFileWithChunk, waitForPanel } from '../utils.js';

export default {
    template: `
    <div class="animate-in">
        <div class="page-header d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <div class="d-flex align-items-center">
                <button @click="store.view = store.prevView || 'instance-manager'" class="btn btn-outline-secondary btn-sm rounded-circle me-3 flex-shrink-0" style="width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center;" title="返回">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div>
                    <h3 class="m-0 fw-bold d-flex align-items-center text-nowrap">
                        <i class="fa-solid fa-box-archive me-2 me-md-3 text-warning"></i>
                        <span>{{ $t('panel_backup.title') || '面板全局备份' }}</span>
                    </h3>
                    <p class="text-muted mb-0 mt-1 small d-none d-sm-block">{{ $t('panel_backup.description') || '管理整个面板的数据备份、系统配置、Java环境及实例归档' }}</p>
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary btn-sm rounded-pill fw-bold" @click="loadGlobalBackups" :disabled="loading" :title="$t('common.refresh') || '刷新'">
                    <i class="fa-solid fa-rotate-right" :class="{'fa-spin': loading, 'me-sm-1': true}"></i><span class="d-none d-sm-inline">{{ $t('common.refresh') || '刷新' }}</span>
                </button>
                <button class="btn btn-outline-warning btn-sm rounded-pill fw-bold" @click="triggerRestoreImport" :disabled="saving" :title="$t('panel_backup.import_btn') || '导入备份'">
                    <i class="fa-solid fa-file-import me-0 me-sm-1"></i><span class="d-none d-sm-inline">{{ $t('panel_backup.import_btn') || '导入备份' }}</span>
                </button>
                <button class="btn btn-warning btn-sm rounded-pill fw-bold text-dark" @click="askCreateGlobalBackup" :disabled="saving" :title="$t('panel_backup.create_btn') || '创建全局备份'">
                    <i class="fa-solid fa-plus me-0 me-sm-1"></i><span class="d-none d-sm-inline">{{ $t('panel_backup.create_btn') || '创建全局备份' }}</span>
                </button>
                <input type="file" ref="restoreInput" class="d-none" accept=".zip" @change="handleRestoreImport">
            </div>
        </div>

        <div class="card border-0 shadow-sm overflow-hidden" style="border-radius: 16px;">
            <!-- Desktop Table View -->
            <div class="table-responsive d-none d-md-block">
                <table class="table table-hover align-middle mb-0">
                    <thead class="bg-body-tertiary">
                        <tr class="small text-uppercase text-muted fw-bold">
                            <th class="px-3 px-md-4 py-3">{{ $t('common.name') }}</th>
                            <th>{{ $t('common.size') }}</th>
                            <th>{{ $t('common.time') }}</th>
                            <th>{{ $t('panel_backup.backup_content') || '包含内容' }}</th>
                            <th class="text-end px-3 px-md-4">{{ $t('common.actions') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="b in globalBackups" :key="b.name">
                            <td class="px-3 px-md-4 py-3">
                                <div class="fw-bold small text-body d-flex align-items-center gap-2">
                                    <i class="fa-solid fa-file-zipper text-warning flex-shrink-0"></i>
                                    <span class="text-truncate" style="max-width: 220px;" :title="b.name">{{ b.name }}</span>
                                </div>
                                <div class="text-muted mt-1" style="font-size: 0.75rem;">{{ b.note || '-' }}</div>
                            </td>
                            <td class="small fw-semibold text-nowrap">{{ (b.size/1024/1024).toFixed(1) }} MB</td>
                            <td class="small text-muted text-nowrap">{{ new Date(b.mtime).toLocaleString() }}</td>
                            <td>
                                <div class="d-flex flex-wrap gap-1">
                                    <span v-if="b.options?.configs !== false" class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25" style="font-size: 0.7rem;">
                                        <i class="fa-solid fa-gear me-1"></i>{{ $t('panel_backup.opt_config') || '配置' }}
                                    </span>
                                    <span v-if="b.options?.java && (b.options.java === true || b.options.java.length)" class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25" style="font-size: 0.7rem;">
                                        <i class="fa-brands fa-java me-1"></i>Java ({{ Array.isArray(b.options.java) ? b.options.java.length : '全部' }})
                                    </span>
                                    <span v-if="b.options?.instances && (b.options.instances === true || b.options.instances.length)" class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25" style="font-size: 0.7rem;">
                                        <i class="fa-solid fa-server me-1"></i>实例 ({{ Array.isArray(b.options.instances) ? b.options.instances.length : '全部' }})
                                    </span>
                                </div>
                            </td>
                            <td class="text-end px-3 px-md-4">
                                <div class="d-flex justify-content-end gap-1">
                                    <button class="btn btn-sm btn-outline-success border-0 rounded-circle" style="width: 32px; height: 32px; padding: 0;" @click="downloadGlobalBackup(b)" :title="$t('common.download')">
                                        <i class="fa-solid fa-download"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-warning border-0 rounded-circle" style="width: 32px; height: 32px; padding: 0;" @click="askRestoreGlobalBackup(b)" :title="$t('panel_backup.restore_btn') || '回档此备份'">
                                        <i class="fa-solid fa-clock-rotate-left"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger border-0 rounded-circle" style="width: 32px; height: 32px; padding: 0;" @click="deleteGlobalBackup(b)" :title="$t('common.delete')">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="!globalBackups.length && !loading">
                            <td colspan="5" class="text-center text-muted py-5 small">
                                <i class="fa-solid fa-box-open d-block mb-2 opacity-25" style="font-size: 2.5rem;"></i>
                                {{ $t('common.no_data') || '暂无全局备份记录' }}
                            </td>
                        </tr>
                        <tr v-if="loading">
                            <td colspan="5" class="text-center py-5">
                                <div class="spinner-border spinner-border-sm text-warning me-2"></div>
                                <span class="small text-muted">{{ $t('common.loading') || '正在加载备份列表...' }}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Mobile Card View -->
            <div class="d-md-none p-2.5 d-flex flex-column gap-2.5">
                <div v-if="loading" class="text-center py-5">
                    <div class="spinner-border spinner-border-sm text-warning me-2"></div>
                    <span class="small text-muted">{{ $t('common.loading') || '正在加载备份列表...' }}</span>
                </div>
                <div v-else-if="!globalBackups.length" class="text-center text-muted py-5 small">
                    <i class="fa-solid fa-box-open d-block mb-2 opacity-25" style="font-size: 2.5rem;"></i>
                    {{ $t('common.no_data') || '暂无全局备份记录' }}
                </div>
                <div v-else v-for="b in globalBackups" :key="b.name" class="card border rounded-3 p-3 shadow-sm bg-body">
                    <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div class="d-flex align-items-center gap-2 min-w-0">
                            <i class="fa-solid fa-file-zipper text-warning flex-shrink-0 fa-lg"></i>
                            <span class="fw-bold small text-truncate" :title="b.name">{{ b.name }}</span>
                        </div>
                        <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 flex-shrink-0" style="font-size: 0.72rem;">
                            {{ (b.size/1024/1024).toFixed(1) }} MB
                        </span>
                    </div>
                    <div v-if="b.note" class="text-muted small mb-2" style="font-size: 0.75rem;">
                        {{ b.note }}
                    </div>
                    <div class="d-flex flex-wrap gap-1 mb-2">
                        <span v-if="b.options?.configs !== false" class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25" style="font-size: 0.65rem;">
                            <i class="fa-solid fa-gear me-1"></i>{{ $t('panel_backup.opt_config') || '配置' }}
                        </span>
                        <span v-if="b.options?.java && (b.options.java === true || b.options.java.length)" class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25" style="font-size: 0.65rem;">
                            <i class="fa-brands fa-java me-1"></i>Java ({{ Array.isArray(b.options.java) ? b.options.java.length : '全部' }})
                        </span>
                        <span v-if="b.options?.instances && (b.options.instances === true || b.options.instances.length)" class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25" style="font-size: 0.65rem;">
                            <i class="fa-solid fa-server me-1"></i>实例 ({{ Array.isArray(b.options.instances) ? b.options.instances.length : '全部' }})
                        </span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                        <div class="text-muted" style="font-size: 0.72rem;">
                            <i class="fa-regular fa-clock me-1"></i>{{ new Date(b.mtime).toLocaleDateString() }}
                        </div>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-success border-0 rounded-circle" style="width: 32px; height: 32px; padding: 0;" @click="downloadGlobalBackup(b)" :title="$t('common.download')">
                                <i class="fa-solid fa-download"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning border-0 rounded-circle" style="width: 32px; height: 32px; padding: 0;" @click="askRestoreGlobalBackup(b)" :title="$t('panel_backup.restore_btn') || '回档此备份'">
                                <i class="fa-solid fa-clock-rotate-left"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger border-0 rounded-circle" style="width: 32px; height: 32px; padding: 0;" @click="deleteGlobalBackup(b)" :title="$t('common.delete')">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;
        const apiBase = '/api/panel/backups';

        const loading = ref(false);
        const saving = ref(false);
        const globalBackups = ref([]);
        const instances = ref([]);
        const javaList = ref([]);
        const restoreInput = ref(null);

        const loadGlobalBackups = async () => {
            try {
                loading.value = true;
                const res = await api.get(`${apiBase}/list`);
                globalBackups.value = res.data;
            } catch (e) {
                showToast(e.response?.data?.error || e.message, 'danger');
            } finally {
                loading.value = false;
            }
        };

        const loadInstances = async () => {
            try {
                const res = await api.get('/api/instances/list');
                const raw = res.data?.instances || res.data;
                instances.value = Array.isArray(raw) ? raw : (store.instanceList || []);
            } catch (e) {
                instances.value = store.instanceList || [];
            }
        };

        const loadJavaList = async () => {
            try {
                const res = await api.get('/api/java/installed');
                const raw = res.data?.installations || res.data;
                javaList.value = Array.isArray(raw) ? raw : (store.javaInstallations || []);
            } catch (e) {
                javaList.value = store.javaInstallations || [];
            }
        };

        const triggerRestoreImport = () => restoreInput.value.click();

        const handleRestoreImport = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            saving.value = true;
            try {
                let filename;
                if (isLargeFile(file)) {
                    store.task.visible = true;
                    store.task.title = $t('panel_backup.uploading') || '正在上传备份文件...';
                    store.task.percent = 0;
                    store.task.message = file.name;
                    const chunkResult = await uploadFileWithChunk(file, {
                        initUrl: `${apiBase}/import-chunk/init`,
                        uploadUrl: `${apiBase}/import-chunk/upload`,
                        completeUrl: `${apiBase}/import-chunk/complete`,
                        cancelUrl: `${apiBase}/import-chunk/cancel`,
                        onProgress: (bytesDone, bytesTotal, chunkNum, totalChunks) => {
                            store.task.percent = Math.round((bytesDone * 100) / bytesTotal);
                            store.task.subMessage = `${chunkNum} / ${totalChunks}`;
                        }
                    });
                    filename = chunkResult.filename;
                    setTimeout(() => { store.task.visible = false; }, 500);
                } else {
                    const formData = new FormData();
                    formData.append('backup', file);
                    showToast($t('panel_backup.uploading') || '正在上传备份文件...', 'info');
                    const uploadRes = await api.post(`${apiBase}/import`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    filename = uploadRes.data.filename;
                }

                showToast($t('panel_backup.import_success') || '备份导入成功！', 'success');
                await loadGlobalBackups();

                // 询问是否直接执行回档
                openModal({
                    title: $t('panel_backup.restore_title') || '系统回档与恢复',
                    message: `<div class="mb-3">${$t('panel_backup.ask_restore_now', { name: filename }) || `备份文件 <strong>${filename}</strong> 导入成功！是否立即回档至此备份？`}</div><div class="alert alert-warning small mb-0"><i class="fa-solid fa-triangle-exclamation me-1"></i>回档将会安全停止所有实例并覆盖现有配置与数据，面板将自动重启。</div>`,
                    callback: async () => {
                        try {
                            showToast($t('panel_backup.restoring') || '正在启动回档流程...', 'info');
                            await api.post(`${apiBase}/restore`, { filename });
                            waitForPanel(location.href, 60000);
                        } catch (err) {
                            showToast(err.response?.data?.error || err.message, 'danger');
                        }
                    }
                });

            } catch (e) {
                store.task.visible = false;
                showToast(e.response?.data?.error || e.message, 'danger');
            } finally {
                saving.value = false;
                e.target.value = '';
            }
        };

        const askCreateGlobalBackup = async () => {
            if (!instances.value || !instances.value.length) {
                await loadInstances();
            }
            if (!javaList.value || !javaList.value.length) {
                await loadJavaList();
            }

            const instList = (Array.isArray(instances.value) && instances.value.length)
                ? instances.value
                : (Array.isArray(store.instanceList) && store.instanceList.length ? store.instanceList : []);

            const javaArr = Array.isArray(javaList.value)
                ? javaList.value
                : (Array.isArray(store.javaInstallations) ? store.javaInstallations : []);
            const managedJava = javaArr.filter(j => j && j.source !== 'local');

            const instanceListHtml = instList.length ? `
                <div class="mt-2 p-2 bg-body-tertiary rounded small" style="max-height: 160px; overflow-y: auto;">
                    ${instList.map(i => `
                        <div class="form-check mb-1">
                            <input class="form-check-input check-inst-item" type="checkbox" value="${i.id}" id="check-inst-${i.id}" checked>
                            <label class="form-check-label text-truncate d-inline-block" style="max-width: 90%;" for="check-inst-${i.id}">${i.name} <span class="opacity-50 font-monospace">(${i.id})</span></label>
                        </div>
                    `).join('')}
                </div>
            ` : `<div class="small text-muted py-2">${$t('panel_backup.no_instances') || '暂无已创建的实例'}</div>`;

            const javaListHtml = managedJava.length ? `
                <div class="mt-2 p-2 bg-body-tertiary rounded small" style="max-height: 160px; overflow-y: auto;">
                    ${managedJava.map(j => `
                        <div class="form-check mb-1">
                            <input class="form-check-input check-java-item" type="checkbox" value="${j.id}" id="check-java-${j.id}" checked>
                            <label class="form-check-label text-truncate d-inline-block" style="max-width: 90%;" for="check-java-${j.id}">Java ${j.featureVersion || ''} <span class="opacity-50 font-monospace">(${j.id})</span></label>
                        </div>
                    `).join('')}
                </div>
            ` : `<div class="small text-muted py-2">${$t('panel_backup.no_java') || '暂无通过面板安装的 Java 环境'}</div>`;

            openModal({
                title: $t('panel_backup.create_btn') || '创建全局备份',
                message: `
                    <div class="mb-3">
                        <label class="form-label small fw-bold text-muted">${$t('panel_backup.prompt_note') || '备份备注（可选）'}</label>
                        <input type="text" id="backup-note" class="form-control form-control-sm" placeholder="如：升级系统前完整备份">
                    </div>
                    <div class="small fw-bold text-muted mb-2">${$t('panel_backup.backup_include') || '选择备份内容'}</div>
                    <div class="form-check small mb-2">
                        <input class="form-check-input" type="checkbox" id="check-configs" checked>
                        <label class="form-check-label fw-bold" for="check-configs">${$t('panel_backup.backup_configs') || '系统与面板核心配置文件 (data/*.json)'}</label>
                    </div>
                    
                    <div class="mt-3">
                        <div class="form-check small mb-1">
                            <input class="form-check-input" type="checkbox" id="check-java-all" checked onchange="document.querySelectorAll('.check-java-item').forEach(i=>i.checked=this.checked)">
                            <label class="form-check-label fw-bold" for="check-java-all">${$t('panel_backup.backup_java') || '已安装的 Java 环境'}</label>
                        </div>
                        ${javaListHtml}
                    </div>

                    <div class="mt-3">
                        <div class="form-check small mb-1">
                            <input class="form-check-input" type="checkbox" id="check-inst-all" checked onchange="document.querySelectorAll('.check-inst-item').forEach(i=>i.checked=this.checked)">
                            <label class="form-check-label fw-bold" for="check-inst-all">${$t('panel_backup.backup_instances') || 'Minecraft 实例数据'}</label>
                        </div>
                        ${instanceListHtml}
                    </div>
                `,
                callback: async () => {
                    const note = document.getElementById('backup-note')?.value || '';
                    const configs = !!document.getElementById('check-configs')?.checked;
                    
                    const javaItems = Array.from(document.querySelectorAll('.check-java-item:checked')).map(i => i.value);
                    const instItems = Array.from(document.querySelectorAll('.check-inst-item:checked')).map(i => i.value);
                    
                    const options = {
                        configs,
                        java: javaItems,
                        instances: instItems
                    };

                    try {
                        showToast($t('common.processing') || '正在创建备份，请稍候...', 'info');
                        await api.post(`${apiBase}/create`, { note, options });
                        showToast($t('common.success') || '备份创建成功！', 'success');
                        await loadGlobalBackups();
                    } catch (e) {
                        showToast(e.response?.data?.error || e.message, 'danger');
                    }
                }
            });
        };

        const downloadGlobalBackup = (b) => {
            window.open(`${apiBase}/download?filename=${encodeURIComponent(b.name)}`, '_blank');
        };

        const askRestoreGlobalBackup = (b) => {
            openModal({
                title: $t('panel_backup.restore_title') || '系统回档与恢复',
                message: `<div class="mb-3">${$t('panel_backup.restore_confirm', { name: b.name }) || `确定要将系统回档至 <strong>${b.name}</strong> 吗？`}</div><div class="alert alert-danger small mb-0"><i class="fa-solid fa-triangle-exclamation me-1"></i>回档将会安全停止所有正在运行的实例，并覆盖现有的面板数据与实例目录，面板将自动重启。请确认已做好准备！</div>`,
                callback: async () => {
                    try {
                        showToast($t('panel_backup.restoring') || '正在启动回档流程...', 'info');
                        await api.post(`${apiBase}/restore`, { filename: b.name });
                        waitForPanel(location.href, 60000);
                    } catch (e) {
                        showToast(e.response?.data?.error || e.message, 'danger');
                    }
                }
            });
        };

        const deleteGlobalBackup = (b) => {
            openModal({
                title: $t('common.delete') || '删除备份',
                message: $t('panel_backup.confirm_delete_msg', { name: b.name }) || `确定要永久删除备份归档 <strong>${b.name}</strong> 吗？此操作不可逆。`,
                callback: async () => {
                    try {
                        await api.post(`${apiBase}/delete`, { filename: b.name });
                        showToast($t('common.success') || '删除成功', 'success');
                        await loadGlobalBackups();
                    } catch (e) {
                        showToast(e.response?.data?.error || e.message, 'danger');
                    }
                }
            });
        };

        onMounted(() => {
            loadGlobalBackups();
            loadInstances();
            loadJavaList();
        });

        return {
            store, loading, saving, globalBackups, loadGlobalBackups,
            askCreateGlobalBackup, downloadGlobalBackup, askRestoreGlobalBackup, deleteGlobalBackup,
            restoreInput, triggerRestoreImport, handleRestoreImport
        };
    }
};
