import { ref, reactive, onMounted, onUnmounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column overflow-hidden">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-shrink-0">
            <div class="d-flex align-items-center">
                <button @click="store.view = 'instance-manager'" class="btn-back me-3">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <h3 class="fw-black m-0 tracking-tight">
                    <i class="fa-brands fa-java me-2 text-danger"></i>{{ $t('java.title') }}
                </h3>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary fw-bold px-3" @click="detectSystemJava" :disabled="detecting" style="border-radius: 10px;">
                    <span v-if="detecting" class="spinner-border spinner-border-sm me-1"></span>
                    <i v-else class="fa-solid fa-magnifying-glass me-1"></i>{{ $t('java.detect_system') }}
                </button>
                <button class="btn btn-primary fw-bold px-3 shadow-sm" @click="showAddLocal = !showAddLocal" style="border-radius: 10px;">
                    <i class="fa-solid fa-folder-plus me-1"></i>{{ $t('java.add_local') }}
                </button>
            </div>
        </div>

        <!-- 添加本地 Java 面板 -->
        <Transition name="fade">
            <div v-if="showAddLocal" class="card mb-3 border-primary-subtle flex-shrink-0 animate-in">
                <div class="card-body p-3">
                    <div class="input-group">
                        <span class="input-group-text"><i class="fa-solid fa-terminal"></i></span>
                        <input type="text" class="form-control" v-model="localJavaPath" :placeholder="$t('java.local_path_placeholder')" @keydown.enter="addLocalJava">
                        <button class="btn btn-primary" @click="addLocalJava" :disabled="addingLocal || !localJavaPath">
                            <span v-if="addingLocal" class="spinner-border spinner-border-sm"></span>
                            <span v-else>{{ $t('common.confirm') }}</span>
                        </button>
                    </div>
                    <div class="form-text small mt-1">{{ $t('java.local_path_desc') }}</div>
                </div>
            </div>
        </Transition>

        <!-- 已安装列表 -->
        <div class="card shadow-sm mb-3 flex-shrink-0">
            <div class="card-header bg-body-tertiary d-flex justify-content-between align-items-center py-2 border-0">
                <span class="fw-bold small text-uppercase text-muted"><i class="fa-solid fa-check-circle me-2 text-success"></i>{{ $t('java.installed') }}</span>
                <span class="badge bg-body-secondary text-muted rounded-pill">{{ installed.length }}</span>
            </div>
            <div class="card-body p-0">
                <div v-if="loadingInstalled" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-primary"></div>
                </div>
                <div v-else-if="installed.length === 0" class="text-center text-muted py-4 small">
                    <i class="fa-solid fa-inbox fa-2x mb-2 opacity-25 d-block"></i>
                    {{ $t('java.no_installed') }}
                </div>
                <table v-else class="table table-hover mb-0 align-middle">
                    <tbody>
                        <tr v-for="j in installed" :key="j.id" class="animate-in">
                            <td style="width: 50px;" class="text-center">
                                <div class="rounded-circle d-inline-flex align-items-center justify-content-center" 
                                     style="width: 36px; height: 36px;" 
                                     :class="j.source === 'local' ? 'bg-info-subtle text-info' : 'bg-danger-subtle text-danger'">
                                    <i :class="j.source === 'local' ? 'fa-solid fa-folder' : 'fa-brands fa-java'" class="fa-lg"></i>
                                </div>
                            </td>
                            <td>
                                <div class="fw-bold">Java {{ j.featureVersion }}</div>
                                <div class="small text-muted font-monospace">{{ j.version }}</div>
                            </td>
                            <td>
                                <span class="badge rounded-pill px-2 py-1" :class="j.source === 'local' ? 'bg-info-subtle text-info border border-info-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'">
                                    {{ j.vendor || j.source }}
                                </span>
                            </td>
                            <td class="text-muted small d-none d-lg-table-cell font-monospace text-truncate" style="max-width: 250px;" :title="j.javaPath">{{ j.javaPath }}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-danger border-0" @click="removeJava(j)" :title="$t('common.delete')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 在线安装 -->
        <div class="card shadow-sm d-flex flex-column" style="flex: 1; min-height: 0;">
            <div class="card-header bg-body-tertiary d-flex justify-content-between align-items-center py-2 border-0">
                <span class="fw-bold small text-uppercase text-muted"><i class="fa-solid fa-cloud-arrow-down me-2 text-primary"></i>{{ $t('java.online_install') }}</span>
                <div class="d-flex align-items-center gap-2">
                    <select class="form-select form-select-sm border-0 bg-body" style="width: auto;" v-model="selectedSource" @change="fetchAvailable">
                        <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                    <button class="btn btn-sm btn-link text-primary p-0" @click="fetchAvailable" :disabled="loadingAvailable" :title="$t('common.refresh')">
                        <i class="fa-solid fa-rotate" :class="{'fa-spin': loadingAvailable}"></i>
                    </button>
                </div>
            </div>
            <div class="card-body p-0 overflow-auto custom-scrollbar" style="flex: 1; min-height: 0;">
                <div v-if="loadingAvailable" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <div class="small text-muted mt-2">{{ $t('java.fetching') }}</div>
                </div>
                <div v-else-if="available.length === 0" class="text-center text-muted py-5 small">
                    <i class="fa-solid fa-cloud-exclamation fa-2x mb-2 opacity-25 d-block"></i>
                    {{ $t('java.no_available') }}
                </div>
                <table v-else class="table table-hover mb-0 align-middle">
                    <tbody>
                        <tr v-for="j in available" :key="j.featureVersion">
                            <td style="width: 50px;" class="text-center">
                                <div class="rounded-circle bg-warning-subtle text-warning d-inline-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
                                    <span class="fw-bold">{{ j.featureVersion }}</span>
                                </div>
                            </td>
                            <td>
                                <div class="fw-bold">Java {{ j.featureVersion }}
                                    <span v-if="[8,11,17,21].includes(j.featureVersion)" class="badge bg-success-subtle text-success border border-success-subtle rounded-pill ms-1" style="font-size: 10px;">LTS</span>
                                </div>
                                <div class="small text-muted font-monospace">{{ j.version }}</div>
                            </td>
                            <td class="text-muted small">{{ (j.size / 1024 / 1024).toFixed(0) }} MB</td>
                            <td class="text-end">
                                <button v-if="isInstalled(j.featureVersion)" class="btn btn-sm btn-success" disabled>
                                    <i class="fa-solid fa-check me-1"></i>{{ $t('java.already_installed') }}
                                </button>
                                <button v-else-if="installing[j.featureVersion]" class="btn btn-sm btn-primary" disabled>
                                    <span class="spinner-border spinner-border-sm me-1"></span>
                                    {{ installProgress[j.featureVersion]?.percent || 0 }}%
                                </button>
                                <button v-else class="btn btn-sm btn-outline-primary" @click="installJava(j)">
                                    <i class="fa-solid fa-download me-1"></i>{{ $t('java.install') }}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 安装进度条 -->
            <Transition name="fade">
                <div v-if="activeInstall" class="card-footer bg-body-tertiary py-2 border-0 flex-shrink-0">
                    <div class="d-flex align-items-center gap-2">
                        <span class="spinner-border spinner-border-sm text-primary"></span>
                        <div class="flex-grow-1">
                            <div class="modern-progress">
                                <div class="modern-progress-bar" :style="{width: (activeInstall.percent || 0) + '%'}"></div>
                            </div>
                        </div>
                        <span class="small text-muted text-nowrap">{{ activeInstall.message }}</span>
                        <button class="btn btn-sm btn-link text-danger p-0 ms-2" @click="cancelInstall" :title="$t('common.cancel')" :disabled="cancelling">
                            <i class="fa-solid fa-times-circle"></i>
                        </button>
                    </div>
                </div>
            </Transition>
        </div>
    </div>
    `,
    setup() {
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const installed = ref([]);
        const available = ref([]);
        const sources = ref([]);
        const selectedSource = ref('adoptium');
        const loadingInstalled = ref(false);
        const loadingAvailable = ref(false);
        const detecting = ref(false);
        const showAddLocal = ref(false);
        const localJavaPath = ref('');
        const addingLocal = ref(false);
        const installing = reactive({});
        const installProgress = reactive({});

        const activeInstall = ref(null);
        const cancelling = ref(false);

        const cancelInstall = async () => {
            if (!activeInstall.value) return;
            cancelling.value = true;
            try {
                await api.post('/api/java/install/cancel', { featureVersion: activeInstall.value.featureVersion });
            } catch (e) {
                showToast($t('common.error'), 'danger');
            } finally {
                cancelling.value = false;
            }
        };


        const loadInstalled = async () => {
            loadingInstalled.value = true;
            try {
                const res = await api.get('/api/java/installed');
                installed.value = res.data;
            } catch (e) {
                showToast($t('common.error'), 'danger');
            } finally {
                loadingInstalled.value = false;
            }
        };

        const loadSources = async () => {
            try {
                const res = await api.get('/api/java/sources');
                sources.value = res.data;
            } catch (e) { }
        };

        const fetchAvailable = async () => {
            loadingAvailable.value = true;
            try {
                const res = await api.get(`/api/java/available?source=${selectedSource.value}`);
                available.value = res.data.results || [];
            } catch (e) {
                showToast($t('java.fetch_fail'), 'danger');
            } finally {
                loadingAvailable.value = false;
            }
        };

        const isInstalled = (fv) => installed.value.some(i => i.featureVersion === fv);

        const installJava = async (j) => {
            if (activeInstall.value) {
                showToast($t('java.task_running'), 'warning');
                return;
            }
            installing[j.featureVersion] = true;
            installProgress[j.featureVersion] = { percent: 0, message: '准备中...' };
            try {
                await api.post('/api/java/install', {
                    featureVersion: j.featureVersion,
                    downloadUrl: j.downloadUrl,
                    version: j.version,
                    source: selectedSource.value
                });
            } catch (e) {
                showToast(e.response?.data?.error || $t('common.error'), 'danger');
                delete installing[j.featureVersion];
            }
        };

        const removeJava = (j) => {
            openModal({
                title: $t('common.delete'),
                message: $t('java.confirm_remove', { name: `Java ${j.featureVersion} (${j.version})` }),
                callback: async () => {
                    try {
                        await api.post('/api/java/remove', { id: j.id });
                        showToast($t('common.success'));
                        loadInstalled();
                    } catch (e) {
                        showToast(e.response?.data?.error || $t('common.error'), 'danger');
                    }
                }
            });
        };

        const addLocalJava = async () => {
            if (!localJavaPath.value) return;
            addingLocal.value = true;
            try {
                const res = await api.post('/api/java/add-local', { javaPath: localJavaPath.value });
                showToast($t('common.success') + ` (${res.data.version})`);
                localJavaPath.value = '';
                showAddLocal.value = false;
                loadInstalled();
            } catch (e) {
                showToast(e.response?.data?.error || $t('common.error'), 'danger');
            } finally {
                addingLocal.value = false;
            }
        };

        const detectSystemJava = async () => {
            detecting.value = true;
            try {
                const res = await api.get('/api/java/detect');
                if (res.data.version === 'Not Installed') {
                    showToast($t('java.system_not_found'), 'warning');
                } else {
                    openModal({
                        title: $t('java.detect_system'),
                        message: `${$t('java.system_found')}: <strong>${res.data.version}</strong><br><code>${res.data.path}</code><br><br>${$t('java.add_to_list')}`,
                        callback: async () => {
                            try {
                                await api.post('/api/java/add-local', { javaPath: res.data.path });
                                showToast($t('common.success'));
                                loadInstalled();
                            } catch (e) {
                                showToast(e.response?.data?.error || $t('common.error'), 'danger');
                            }
                        }
                    });
                }
            } catch (e) {
                showToast($t('common.error'), 'danger');
            } finally {
                detecting.value = false;
            }
        };

        // Listen for install progress via socket
        let socket = null;
        onMounted(async () => {
            loadInstalled();
            loadSources();
            fetchAvailable();

            // Dynamic import socket.io
            try {
                const { io: ioClient } = await import('/socket.io/socket.io.esm.min.js');
                socket = ioClient();
                socket.on('java_install_progress', (data) => {
                    installProgress[data.featureVersion] = data;
                    activeInstall.value = data;

                    if (data.step === 'done') {
                        delete installing[data.featureVersion];
                        showToast(data.message, 'success');
                        loadInstalled();
                        setTimeout(() => { activeInstall.value = null; }, 2000);
                    } else if (data.step === 'error') {
                        delete installing[data.featureVersion];
                        if (data.message === '已取消') {
                            showToast(data.message, 'info');
                        } else {
                            showToast(data.message, 'danger');
                        }
                        setTimeout(() => { activeInstall.value = null; }, 3000);
                    }
                });
            } catch (e) {
                console.warn('Socket not available for Java progress', e);
            }
        });

        onUnmounted(() => {
            if (socket) {
                socket.off('java_install_progress');
            }
        });

        return {
            store,
            installed, available, sources, selectedSource,
            loadingInstalled, loadingAvailable, detecting,
            showAddLocal, localJavaPath, addingLocal,
            installing, installProgress, activeInstall, cancelling,
            loadInstalled, fetchAvailable, installJava, removeJava,
            addLocalJava, detectSystemJava, isInstalled, cancelInstall
        };
    }
};
