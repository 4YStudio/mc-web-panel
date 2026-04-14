import { ref, reactive, computed, onMounted, onUnmounted, getCurrentInstance, watch, nextTick } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column animate-in overflow-hidden">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-3 mb-md-4 px-1 flex-shrink-0">
            <div class="d-flex align-items-center overflow-hidden">
                <button @click="store.view = 'instance-manager'" class="btn-back me-3">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <h3 class="m-0 fw-bold d-flex align-items-center text-truncate">
                    <i class="fa-solid fa-network-wired me-2 me-md-3 text-primary d-none d-md-inline"></i>
                    <span>{{ $t('frp.title') }}</span>
                </h3>
            </div>
            <div class="d-flex gap-2 align-items-center">
                <button v-if="status.installed" class="btn btn-sm btn-outline-primary fw-bold rounded-pill px-3" @click="openReleasesModal" style="font-size: 0.75rem;">
                    <i class="fa-solid fa-rotate me-1"></i>{{ $t('frp.switch_version') }}
                </button>
                <button class="btn btn-sm btn-primary fw-bold rounded-pill px-3 shadow-sm" @click="createNewConfig" :disabled="!status.installed" style="font-size: 0.75rem;">
                    <i class="fa-solid fa-plus me-1"></i>{{ $t('frp.new_config') }}
                </button>
            </div>
        </div>

        <div class="overflow-auto custom-scrollbar px-1 px-md-3 pb-4 flex-grow-1">

            <!-- 顶部状态横栏 -->
            <div class="card border-0 shadow-sm mb-3 mb-md-4 overflow-hidden" style="border-radius: 16px;">
                <div class="card-body p-0">
                    <div class="d-flex align-items-stretch flex-wrap">
                        <!-- 安装状态区 -->
                        <div class="d-flex align-items-center gap-3 px-3 px-md-4 py-3 flex-grow-1" style="min-width: 220px;">
                            <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                                 :class="status.installed ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'"
                                 style="width: 44px; height: 44px; border-radius: 12px !important;">
                                <i class="fa-solid" :class="status.installed ? 'fa-check-circle' : 'fa-cloud-arrow-down'" style="font-size: 1.2rem;"></i>
                            </div>
                            <div v-if="status.installed" class="overflow-hidden">
                                <div class="fw-bold text-truncate">frpc <span class="text-primary">v{{ status.version }}</span></div>
                                <div class="text-muted" style="font-size: 0.7rem;">{{ status.installedAt ? new Date(status.installedAt).toLocaleString() : '' }}</div>
                            </div>
                            <div v-else>
                                <div class="fw-bold text-muted">{{ $t('frp.not_installed') }}</div>
                                <button class="btn btn-primary btn-sm fw-bold rounded-pill px-3 mt-1" @click="openReleasesModal" style="font-size: 0.72rem;">
                                    <i class="fa-solid fa-download me-1"></i>{{ $t('frp.install') }}
                                </button>
                            </div>
                        </div>

                        <!-- 分隔线 + 统计 -->
                        <div v-if="status.installed" class="d-none d-md-flex align-items-center border-start" style="padding: 0 1.5rem;">
                            <div class="text-center">
                                <div class="fw-bold fs-5 text-primary">{{ configs.length }}</div>
                                <div class="text-muted" style="font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.5px;">{{ $t('frp.config_list') }}</div>
                            </div>
                        </div>
                        <div v-if="status.installed" class="d-none d-md-flex align-items-center border-start" style="padding: 0 1.5rem;">
                            <div class="text-center">
                                <div class="fw-bold fs-5" :class="runningCount > 0 ? 'text-success' : 'text-secondary'">{{ runningCount }}</div>
                                <div class="text-muted" style="font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.5px;">{{ $t('frp.running') }}</div>
                            </div>
                        </div>

                        <!-- 卸载按钮区 -->
                        <div v-if="status.installed" class="d-flex align-items-center ms-auto px-3 px-md-4">
                            <button class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold" @click="askUninstall" style="font-size: 0.72rem;">
                                <i class="fa-solid fa-trash me-1"></i>{{ $t('frp.uninstall') }}
                            </button>
                        </div>
                    </div>

                    <!-- 安装进度条 -->
                    <Transition name="fade">
                        <div v-if="activeInstall" class="border-top px-3 px-md-4 py-2 bg-body-tertiary">
                            <div class="d-flex align-items-center gap-2">
                                <span class="spinner-border spinner-border-sm text-primary" style="width: 12px; height: 12px;"></span>
                                <div class="flex-grow-1">
                                    <div class="modern-progress" style="height: 6px;">
                                        <div class="modern-progress-bar" :style="{width: (activeInstall.percent || 0) + '%'}"></div>
                                    </div>
                                </div>
                                <span class="text-muted text-nowrap" style="font-size: 0.7rem;" v-if="formattedSpeed">{{ formattedSpeed }}</span>
                                <span class="text-muted text-nowrap" style="font-size: 0.7rem;">{{ activeInstall.message }}</span>
                                <button class="btn btn-sm btn-link text-danger p-0 ms-1" @click="cancelInstall" :title="$t('common.cancel')">
                                    <i class="fa-solid fa-times-circle"></i>
                                </button>
                            </div>
                        </div>
                    </Transition>
                </div>
            </div>

            <!-- 配置网格 -->
            <div v-if="status.installed">
                <!-- 空状态 -->
                <div v-if="configs.length === 0" class="card border-0 shadow-sm text-center py-5" style="border-radius: 16px;">
                    <div class="card-body">
                        <div class="rounded-circle bg-primary-subtle mx-auto d-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                            <i class="fa-solid fa-route text-primary" style="font-size: 1.5rem;"></i>
                        </div>
                        <div class="fw-bold mb-1">{{ $t('frp.no_configs') }}</div>
                        <div class="text-muted small mb-3">{{ $t('frp.no_configs_hint') }}</div>
                        <button class="btn btn-primary fw-bold rounded-pill px-4 shadow-sm" @click="createNewConfig">
                            <i class="fa-solid fa-plus me-2"></i>{{ $t('frp.new_config') }}
                        </button>
                    </div>
                </div>

                <!-- 配置卡片列表 -->
                <div v-else class="row g-3">
                    <div v-for="cfg in configs" :key="cfg.id" class="col-md-6 col-lg-4">
                        <div class="card border-0 shadow-sm h-100 frp-config-card" style="border-radius: 16px; cursor: pointer;" @click="editConfig(cfg)">
                            <!-- 卡片顶部色带 -->
                            <div class="card-body p-3 p-md-4">
                                <div class="d-flex align-items-start justify-content-between mb-3">
                                    <div class="d-flex align-items-center gap-2 overflow-hidden">
                                        <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                                             :class="cfg.running ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'"
                                             style="width: 36px; height: 36px; border-radius: 10px !important;">
                                            <i class="fa-solid" :class="cfg.running ? 'fa-tower-broadcast' : 'fa-plug'" style="font-size: 0.9rem;"></i>
                                        </div>
                                        <div class="overflow-hidden">
                                            <div class="fw-bold text-truncate">{{ cfg.name }}</div>
                                            <div class="d-flex align-items-center gap-1" style="font-size: 0.7rem;">
                                                <span class="status-indicator" :class="cfg.running ? 'bg-success' : 'bg-secondary'" style="width: 6px; height: 6px;"></span>
                                                <span :class="cfg.running ? 'text-success' : 'text-muted'">{{ cfg.running ? $t('frp.running') : $t('frp.stopped') }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- 创建时间 -->
                                <div class="text-muted mb-3" style="font-size: 0.68rem;">
                                    <i class="fa-regular fa-clock me-1"></i>{{ cfg.createdAt ? new Date(cfg.createdAt).toLocaleDateString() : '' }}
                                </div>

                                <!-- 操作按钮 -->
                                <div class="d-flex gap-2 frp-config-card-actions" @click.stop>
                                    <button v-if="!cfg.running" class="btn btn-success btn-sm flex-grow-1 fw-bold" @click.stop="startConfig(cfg)" style="border-radius: 10px; font-size: 0.75rem;">
                                        <i class="fa-solid fa-play me-1"></i>{{ $t('frp.start') }}
                                    </button>
                                    <button v-else class="btn btn-danger btn-sm flex-grow-1 fw-bold" @click.stop="stopConfig(cfg)" style="border-radius: 10px; font-size: 0.75rem;">
                                        <i class="fa-solid fa-stop me-1"></i>{{ $t('frp.stop') }}
                                    </button>
                                    <button v-if="cfg.running" class="btn btn-outline-warning btn-sm fw-bold px-2" @click.stop="restartConfig(cfg)" style="border-radius: 10px; font-size: 0.75rem;" :title="$t('frp.restart')">
                                        <i class="fa-solid fa-rotate"></i>
                                    </button>
                                    <button v-if="cfg.running" class="btn btn-outline-secondary btn-sm fw-bold px-2" @click.stop="viewLogsFromCard(cfg)" style="border-radius: 10px; font-size: 0.75rem;" :title="$t('frp.logs')">
                                        <i class="fa-solid fa-terminal"></i>
                                    </button>
                                    <button class="btn btn-outline-danger btn-sm fw-bold px-2 border-0" @click.stop="deleteConfig(cfg)" style="border-radius: 10px; font-size: 0.75rem;" :title="$t('common.delete')">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 日志面板 -->
                <Transition name="fade">
                    <div v-if="selectedLogConfigId" class="card border-0 shadow-sm mt-3 mt-md-4" style="border-radius: 16px;">
                        <div class="card-header bg-body-tertiary border-0 fw-bold py-2 px-3 px-md-4 d-flex justify-content-between align-items-center" style="border-radius: 16px 16px 0 0;">
                            <span class="small text-uppercase text-muted">
                                <i class="fa-solid fa-terminal me-2"></i>{{ $t('frp.logs') }}
                                <span class="badge bg-primary-subtle text-primary rounded-pill ms-1" style="font-size: 0.65rem;">{{ selectedLogConfigName }}</span>
                            </span>
                            <button class="btn btn-sm btn-link text-muted p-0" @click="selectedLogConfigId = null" :title="$t('common.cancel')">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                        <div ref="logContainer" class="card-body p-0 overflow-auto custom-scrollbar font-monospace bg-dark text-success-emphasis"
                             style="max-height: 300px; font-size: 0.75rem; border-radius: 0 0 16px 16px;">
                            <div v-if="logs.length === 0" class="text-center text-muted py-4 small">
                                {{ $t('common.no_data') }}
                            </div>
                            <div v-else class="p-3">
                                <div v-for="(line, i) in logs" :key="i" class="text-light" style="line-height: 1.6; word-break: break-all;">{{ line }}</div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>

        <!-- 版本管理器对话框 -->
        <Teleport to="body">
            <div class="modal fade" id="frpReleasesModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
                    <div class="modal-content border-0 shadow-lg" style="border-radius: 16px;">
                        <div class="modal-header border-0 pb-0 pt-4 px-4">
                            <h5 class="modal-title fw-bold"><i class="fa-solid fa-cloud-arrow-down me-2 text-primary"></i>{{ $t('frp.version_manager') }}</h5>
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-link text-primary p-0" @click="fetchReleases" :disabled="loadingReleases" :title="$t('common.refresh')">
                                    <i class="fa-solid fa-rotate" :class="{'fa-spin': loadingReleases}"></i>
                                </button>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                        </div>
                        <div class="modal-body p-0">
                            <div v-if="loadingReleases" class="text-center py-5">
                                <div class="spinner-border text-primary" role="status"></div>
                                <div class="small text-muted mt-2">{{ $t('frp.fetch_releases') }}</div>
                            </div>
                            <div v-else-if="releases.length === 0" class="text-center text-muted py-5 small">
                                <i class="fa-solid fa-ghost fa-2x mb-2 opacity-25 d-block"></i>
                                {{ $t('frp.no_releases') }}
                            </div>
                            <div v-else class="table-responsive">
                                <table class="table table-hover mb-0 align-middle">
                                    <tbody>
                                        <tr v-for="r in releases" :key="r.version">
                                            <td style="width: 40px;" class="text-center px-2 px-md-3">
                                                <div class="rounded-circle bg-warning-subtle text-warning d-inline-flex align-items-center justify-content-center" style="width: 30px; height: 30px;">
                                                    <i class="fa-solid fa-code-branch" style="font-size: 0.8rem;"></i>
                                                </div>
                                            </td>
                                            <td>
                                                <div class="fw-bold small">v{{ r.version }}
                                                    <span v-if="r === releases[0]" class="badge bg-success-subtle text-success border border-success-subtle rounded-pill ms-1" style="font-size: 9px;">{{ $t('frp.latest') }}</span>
                                                </div>
                                                <div class="text-muted" style="font-size: 0.7rem;">{{ new Date(r.publishedAt).toLocaleDateString() }}</div>
                                            </td>
                                            <td class="text-muted small d-none d-sm-table-cell">{{ (r.size / 1024 / 1024).toFixed(1) }} MB</td>
                                            <td class="text-end px-2 px-md-3">
                                                <button v-if="isInstalled(r.version)" class="btn btn-xs btn-success py-1 px-2 fw-bold" disabled style="font-size: 0.7rem;">
                                                    <i class="fa-solid fa-check me-1"></i><span class="d-none d-sm-inline">{{ $t('frp.installed') }}</span>
                                                </button>
                                                <button v-else-if="activeInstall" class="btn btn-xs btn-secondary py-1 px-2 fw-bold" disabled style="font-size: 0.7rem;">
                                                    <span class="spinner-border spinner-border-sm" style="width: 10px; height: 10px;"></span>
                                                </button>
                                                <button v-else class="btn btn-xs btn-outline-primary py-1 px-2 fw-bold" @click="installVersion(r)" style="font-size: 0.7rem;">
                                                    <i class="fa-solid fa-download me-1"></i>{{ $t('frp.install') }}
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- 配置编辑对话框 -->
        <Teleport to="body">
            <div class="modal fade" id="frpConfigModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content border-0 shadow-lg" style="border-radius: 16px;">
                        <div class="modal-header border-0 pb-0 pt-4 px-4">
                            <h5 class="modal-title fw-bold">
                                <i class="fa-solid fa-file-code me-2 text-info"></i>
                                {{ editingConfig.id ? $t('frp.edit_config') : $t('frp.new_config') }}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body px-4 pb-0">
                            <!-- 配置名称 -->
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">{{ $t('frp.config_name') }}</label>
                                <input type="text" class="form-control" v-model="editingConfig.name" :placeholder="$t('frp.config_name_placeholder')">
                            </div>

                            <!-- 模式切换 -->
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <span class="fw-bold small text-muted text-uppercase"><i class="fa-solid fa-sliders me-1"></i>{{ $t('frp.config') }}</span>
                                <div class="form-check form-switch m-0">
                                    <input class="form-check-input" type="checkbox" id="configModeSwitch2" v-model="configFormMode">
                                    <label class="form-check-label small fw-bold" for="configModeSwitch2">{{ configFormMode ? $t('frp.gui_mode') : $t('frp.text_mode') }}</label>
                                </div>
                            </div>

                            <!-- 表单模式 -->
                            <div v-if="configFormMode">
                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('frp.server_addr') }}</label>
                                        <input type="text" class="form-control" v-model="configForm.serverAddr" placeholder="x.x.x.x">
                                        <div class="form-text small opacity-75" style="font-size: 0.7rem;">{{ $t('frp.server_addr_desc') }}</div>
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label small fw-bold text-muted">{{ $t('frp.server_port') }}</label>
                                        <input type="number" class="form-control" v-model.number="configForm.serverPort" placeholder="7000">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label small fw-bold text-muted">{{ $t('frp.auth_token') }}</label>
                                        <input type="password" class="form-control" v-model="configForm.authToken" placeholder="token">
                                    </div>
                                </div>
                                
                                <!-- 隧道列表 -->
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="fw-bold small text-muted text-uppercase"><i class="fa-solid fa-route me-1"></i>{{ $t('frp.tunnels') }}</span>
                                    <button class="btn btn-primary btn-sm fw-bold rounded-pill px-3" @click="addTunnel" style="font-size: 0.75rem;">
                                        <i class="fa-solid fa-plus me-1"></i>{{ $t('frp.add_tunnel') }}
                                    </button>
                                </div>
                                <div v-for="(tunnel, idx) in configForm.tunnels" :key="idx" class="card bg-body-tertiary border-0 mb-2" style="border-radius: 12px;">
                                    <div class="card-body p-3">
                                        <div class="row g-2 align-items-end">
                                            <div class="col-md-2">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('frp.tunnel_name') }}</label>
                                                <input type="text" class="form-control form-control-sm" v-model="tunnel.name" :placeholder="'tunnel-' + idx">
                                            </div>
                                            <div class="col-md-2">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('frp.tunnel_type') }}</label>
                                                <select class="form-select form-select-sm" v-model="tunnel.type">
                                                    <option value="tcp">TCP</option>
                                                    <option value="udp">UDP</option>
                                                </select>
                                            </div>
                                            <div class="col-md-2">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('frp.local_ip') }}</label>
                                                <input type="text" class="form-control form-control-sm" v-model="tunnel.localIP" placeholder="127.0.0.1">
                                            </div>
                                            <div class="col-md-2">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('frp.local_port') }}</label>
                                                <input type="number" class="form-control form-control-sm" v-model.number="tunnel.localPort" placeholder="25565">
                                            </div>
                                            <div class="col-md-2">
                                                <label class="form-label small fw-bold text-muted mb-1">{{ $t('frp.remote_port') }}</label>
                                                <input type="number" class="form-control form-control-sm" v-model.number="tunnel.remotePort" placeholder="25565">
                                            </div>
                                            <div class="col-md-2 text-end">
                                                <button class="btn btn-sm btn-outline-danger border-0" @click="removeTunnel(idx)" :title="$t('common.delete')">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div v-if="configForm.tunnels.length === 0" class="text-center text-muted py-3 small">
                                    <i class="fa-solid fa-route opacity-25 d-block mb-1" style="font-size: 1.5rem;"></i>
                                    {{ $t('frp.no_tunnels') }}
                                </div>
                            </div>
                            <!-- 文本模式 -->
                            <div v-else>
                                <textarea class="form-control font-monospace" v-model="editingConfig.configRaw" rows="14"
                                          style="font-size: 0.8rem; resize: vertical; border-radius: 12px;"
                                          :placeholder="configPlaceholder"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer border-0 p-4 pt-3 d-flex justify-content-between">
                            <button v-if="editingConfig.id" class="btn btn-sm btn-outline-secondary rounded-pill px-3" @click="viewLogs(editingConfig)">
                                <i class="fa-solid fa-terminal me-1"></i>{{ $t('frp.logs') }}
                            </button>
                            <div v-else></div>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">{{ $t('common.cancel') }}</button>
                                <button type="button" class="btn btn-primary px-4 fw-bold" @click="saveConfig" :disabled="savingConfig">
                                    <span v-if="savingConfig" class="spinner-border spinner-border-sm me-1"></span>
                                    {{ $t('common.save') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
    `,
    setup() {
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const status = reactive({ installed: false, version: null, installedAt: null });
        const configs = ref([]);
        const releases = ref([]);
        const loadingReleases = ref(false);
        const activeInstall = ref(null);
        const savingConfig = ref(false);
        const configFormMode = ref(true);
        const logs = ref([]);
        const logContainer = ref(null);
        const selectedLogConfigId = ref(null);
        let releasesModal = null;
        let configModal = null;

        const editingConfig = reactive({
            id: null,
            name: '',
            configRaw: ''
        });

        const configForm = reactive({
            serverAddr: '',
            serverPort: 7000,
            authToken: '',
            tunnels: []
        });

        const configPlaceholder = `serverAddr = "x.x.x.x"
serverPort = 7000

auth.method = "token"
auth.token = "your_token"

[[proxies]]
name = "minecraft"
type = "tcp"
localIP = "127.0.0.1"
localPort = 25565
remotePort = 25565`;

        const formattedSpeed = computed(() => {
            const speed = activeInstall.value?.speed;
            if (!speed || speed <= 0) return '';
            if (speed >= 1024 * 1024) return (speed / 1024 / 1024).toFixed(2) + ' MB/s';
            return (speed / 1024).toFixed(0) + ' KB/s';
        });

        const selectedLogConfigName = computed(() => {
            const cfg = configs.value.find(c => c.id === selectedLogConfigId.value);
            return cfg ? cfg.name : '';
        });

        const runningCount = computed(() => {
            return configs.value.filter(c => c.running).length;
        });

        // --- Config form <-> TOML conversion ---
        const formToToml = () => {
            let toml = `serverAddr = "${configForm.serverAddr}"\nserverPort = ${configForm.serverPort}\n`;
            if (configForm.authToken) {
                toml += `\nauth.method = "token"\nauth.token = "${configForm.authToken}"\n`;
            }
            for (const t of configForm.tunnels) {
                toml += `\n[[proxies]]\nname = "${t.name || 'tunnel'}"\ntype = "${t.type || 'tcp'}"\nlocalIP = "${t.localIP || '127.0.0.1'}"\nlocalPort = ${t.localPort || 25565}\nremotePort = ${t.remotePort || 25565}\n`;
            }
            return toml;
        };

        const tomlToForm = (raw) => {
            if (!raw) {
                configForm.serverAddr = '';
                configForm.serverPort = 7000;
                configForm.authToken = '';
                configForm.tunnels = [];
                return;
            }
            try {
                const lines = raw.split('\n');
                configForm.serverAddr = '';
                configForm.serverPort = 7000;
                configForm.authToken = '';
                configForm.tunnels = [];

                let currentTunnel = null;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('#') || trimmed === '') continue;

                    if (trimmed === '[[proxies]]') {
                        if (currentTunnel) configForm.tunnels.push(currentTunnel);
                        currentTunnel = { name: '', type: 'tcp', localIP: '127.0.0.1', localPort: 25565, remotePort: 25565 };
                        continue;
                    }

                    const match = trimmed.match(/^([a-zA-Z_.]+)\s*=\s*(.+)$/);
                    if (!match) continue;
                    const key = match[1].trim();
                    let val = match[2].trim().replace(/^"(.*)"$/, '$1');

                    if (key === 'serverAddr') configForm.serverAddr = val;
                    else if (key === 'serverPort') configForm.serverPort = parseInt(val) || 7000;
                    else if (key === 'auth.token') configForm.authToken = val;
                    else if (currentTunnel) {
                        if (key === 'name') currentTunnel.name = val;
                        else if (key === 'type') currentTunnel.type = val;
                        else if (key === 'localIP') currentTunnel.localIP = val;
                        else if (key === 'localPort') currentTunnel.localPort = parseInt(val) || 25565;
                        else if (key === 'remotePort') currentTunnel.remotePort = parseInt(val) || 25565;
                    }
                }
                if (currentTunnel) configForm.tunnels.push(currentTunnel);
            } catch (e) {
                console.warn('Failed to parse TOML to form:', e);
            }
        };

        const addTunnel = () => {
            configForm.tunnels.push({
                name: 'minecraft-' + configForm.tunnels.length,
                type: 'tcp',
                localIP: '127.0.0.1',
                localPort: 25565,
                remotePort: 25565
            });
        };
        const removeTunnel = (idx) => { configForm.tunnels.splice(idx, 1); };

        // Sync between modes
        watch(configFormMode, (isForm) => {
            if (isForm) {
                tomlToForm(editingConfig.configRaw);
            } else {
                editingConfig.configRaw = formToToml();
            }
        });

        // --- API calls ---
        const loadStatus = async () => {
            try {
                const res = await api.get('/api/frp/status');
                status.installed = res.data.installed;
                status.version = res.data.version;
                status.installedAt = res.data.installedAt;
                configs.value = res.data.configs || [];
            } catch (e) { }
        };

        const fetchReleases = async () => {
            loadingReleases.value = true;
            try {
                const res = await api.get('/api/frp/releases');
                releases.value = res.data.releases || [];
            } catch (e) {
                showToast($t('frp.no_releases'), 'danger');
            } finally {
                loadingReleases.value = false;
            }
        };

        const isInstalled = (version) => {
            return status.installed && status.version && (status.version === version || status.version.includes(version));
        };

        const installVersion = async (r) => {
            if (activeInstall.value) return;
            try {
                await api.post('/api/frp/install', { version: r.version, downloadUrl: r.downloadUrl });
            } catch (e) {
                showToast(e.response?.data?.error || $t('common.error'), 'danger');
            }
        };

        const cancelInstall = async () => {
            try { await api.post('/api/frp/install/cancel'); } catch (e) { }
        };

        const askUninstall = () => {
            openModal({
                title: $t('frp.uninstall'),
                message: $t('frp.uninstall_confirm'),
                callback: async () => {
                    try {
                        await api.post('/api/frp/uninstall');
                        showToast($t('common.success'));
                        loadStatus();
                    } catch (e) {
                        showToast(e.response?.data?.error || $t('common.error'), 'danger');
                    }
                }
            });
        };

        const openReleasesModal = () => {
            if (!releasesModal) {
                releasesModal = new bootstrap.Modal(document.getElementById('frpReleasesModal'));
            }
            releasesModal.show();
            if (releases.value.length === 0) fetchReleases();
        };

        // --- Config management ---
        const createNewConfig = () => {
            editingConfig.id = null;
            editingConfig.name = '';
            editingConfig.configRaw = '';
            configFormMode.value = true;
            tomlToForm('');
            openConfigModal();
        };

        const editConfig = async (cfg) => {
            try {
                const res = await api.get('/api/frp/configs/' + cfg.id);
                editingConfig.id = res.data.id;
                editingConfig.name = res.data.name;
                editingConfig.configRaw = res.data.config || '';
                configFormMode.value = true;
                tomlToForm(editingConfig.configRaw);
                openConfigModal();
            } catch (e) {
                showToast(e.response?.data?.error || $t('common.error'), 'danger');
            }
        };

        const openConfigModal = () => {
            if (!configModal) {
                configModal = new bootstrap.Modal(document.getElementById('frpConfigModal'));
            }
            configModal.show();
        };

        const saveConfig = async () => {
            if (!editingConfig.name) {
                showToast($t('frp.config_name_required'), 'warning');
                return;
            }
            savingConfig.value = true;
            try {
                const toml = configFormMode.value ? formToToml() : editingConfig.configRaw;
                await api.post('/api/frp/configs', {
                    id: editingConfig.id || undefined,
                    name: editingConfig.name,
                    config: toml
                });
                showToast($t('frp.config_saved'), 'success');
                configModal.hide();
                loadStatus();
            } catch (e) {
                showToast(e.response?.data?.error || $t('common.error'), 'danger');
            } finally {
                savingConfig.value = false;
            }
        };

        const deleteConfig = (cfg) => {
            openModal({
                title: $t('common.delete'),
                message: $t('frp.delete_config_confirm', { name: cfg.name }),
                callback: async () => {
                    try {
                        await api.post('/api/frp/configs/delete', { id: cfg.id });
                        showToast($t('common.success'));
                        loadStatus();
                        if (selectedLogConfigId.value === cfg.id) selectedLogConfigId.value = null;
                    } catch (e) {
                        showToast(e.response?.data?.error || $t('common.error'), 'danger');
                    }
                }
            });
        };

        // --- Process control ---
        const startConfig = async (cfg) => {
            try {
                await api.post('/api/frp/start', { configId: cfg.id });
                showToast($t('frp.started_success'), 'success');
                cfg.running = true;
                selectedLogConfigId.value = cfg.id;
                loadLogs(cfg.id);
            } catch (e) {
                showToast(e.response?.data?.error || $t('frp.start_fail'), 'danger');
            }
        };

        const stopConfig = async (cfg) => {
            try {
                await api.post('/api/frp/stop', { configId: cfg.id });
                showToast($t('frp.stopped_success'), 'success');
            } catch (e) {
                showToast(e.response?.data?.error || $t('common.error'), 'danger');
            }
        };

        const restartConfig = async (cfg) => {
            try {
                await api.post('/api/frp/restart', { configId: cfg.id });
                showToast($t('frp.started_success'), 'success');
                selectedLogConfigId.value = cfg.id;
                loadLogs(cfg.id);
            } catch (e) {
                showToast(e.response?.data?.error || $t('common.error'), 'danger');
            }
        };

        const viewLogs = (cfg) => {
            selectedLogConfigId.value = cfg.id;
            loadLogs(cfg.id);
            configModal.hide();
        };

        const viewLogsFromCard = (cfg) => {
            selectedLogConfigId.value = cfg.id;
            loadLogs(cfg.id);
        };

        const loadLogs = async (configId) => {
            try {
                const res = await api.get('/api/frp/logs/' + configId);
                logs.value = res.data.logs || [];
                scrollLogsToBottom();
            } catch (e) { }
        };

        const scrollLogsToBottom = () => {
            nextTick(() => {
                if (logContainer.value) {
                    logContainer.value.scrollTop = logContainer.value.scrollHeight;
                }
            });
        };

        // Socket listeners
        let socket = null;
        onMounted(async () => {
            loadStatus();

            try {
                const { io: ioClient } = await import('/socket.io/socket.io.esm.min.js');
                socket = ioClient();

                socket.on('frp_install_progress', (data) => {
                    activeInstall.value = data;
                    if (data.step === 'done') {
                        showToast(data.message, 'success');
                        loadStatus();
                        setTimeout(() => { activeInstall.value = null; }, 2000);
                    } else if (data.step === 'error') {
                        if (data.message !== '已取消') showToast(data.message, 'danger');
                        setTimeout(() => { activeInstall.value = null; }, 3000);
                    }
                });

                socket.on('frp_log', (data) => {
                    if (data.configId === selectedLogConfigId.value) {
                        logs.value.push(data.line);
                        if (logs.value.length > 500) logs.value.shift();
                        scrollLogsToBottom();
                    }
                });

                socket.on('frp_status', (data) => {
                    const cfg = configs.value.find(c => c.id === data.configId);
                    if (cfg) cfg.running = data.running;
                });
            } catch (e) {
                console.warn('Socket not available for FRP', e);
            }
        });

        onUnmounted(() => {
            if (socket) {
                socket.off('frp_install_progress');
                socket.off('frp_log');
                socket.off('frp_status');
            }
        });

        return {
            store, status, configs, releases, loadingReleases, activeInstall, formattedSpeed,
            savingConfig, configFormMode, configForm, configPlaceholder,
            editingConfig, logs, logContainer, selectedLogConfigId, selectedLogConfigName,
            runningCount,
            fetchReleases, installVersion, cancelInstall, isInstalled, askUninstall,
            openReleasesModal, createNewConfig, editConfig, saveConfig, deleteConfig,
            addTunnel, removeTunnel,
            startConfig, stopConfig, restartConfig, viewLogs, viewLogsFromCard
        };
    }
};
