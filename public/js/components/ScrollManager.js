import { ref, reactive, onMounted, computed, watch, nextTick } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';

export default {
    name: 'ScrollManager',
    template: `
    <div class="animate-fade">
        <!-- 页面顶部 Header -->
        <div class="page-header d-flex justify-content-between align-items-center mb-4">
            <div class="d-flex align-items-center">
                <button @click="store.view = store.prevView || 'dashboard'" class="btn-back me-3">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div>
                    <h3 class="m-0 fw-bold d-flex align-items-center">
                        <i class="fa-solid fa-scroll me-2 me-md-3 text-primary" style="color: #8b5cf6 !important;"></i>
                        <span>{{ $t('scrolls.title') || '卷轴管理' }}</span>
                        <span v-if="currentInstanceName" class="badge rounded-pill ms-2 text-white shadow-sm" style="background: rgba(139, 92, 246, 0.85); font-size: 0.72rem; font-weight: 500;">
                            <i class="fa-solid fa-cube me-1"></i>{{ currentInstanceName }}
                        </span>
                    </h3>
                    <p class="text-muted mb-0 mt-1 small d-none d-md-block">{{ $t('scrolls.description') || '管理和配置自动化脚本卷轴，通过控制台事件与指令注入实现游戏自动化' }}</p>
                </div>
            </div>
            <div class="d-flex gap-2">
                <a href="/scrolls-guide/" target="_blank" class="btn btn-outline-primary rounded-pill px-3 px-md-4">
                    <i class="fa-solid fa-book"></i><span class="d-none d-md-inline ms-1">{{ $t('scrolls.guide_button') || '开发文档' }}</span>
                </a>
                <button class="btn btn-primary rounded-pill px-3 px-md-4 fw-bold shadow-sm" @click="openInstallModal">
                    <i class="fa-solid fa-plus-circle"></i><span class="d-none d-md-inline ms-1">{{ $t('scrolls.install') || '安装卷轴' }}</span>
                </button>
            </div>
        </div>

        <!-- 卷轴列表视图 -->
        <div class="scroll-list-view mt-3">
            <div v-if="loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <div class="text-muted mt-2 small">{{ $t('common.loading') }}</div>
            </div>
            <div v-else>
                <div v-if="scrolls.length > 0" class="row g-3">
                    <template v-for="(scroll, idx) in scrolls" :key="scroll.id">
                        <div v-if="scroll" class="col-md-6 col-lg-4 stagger-item" :style="{'animation-delay': (idx * 0.05) + 's'}">
                            <div class="card h-100 plugin-card border-secondary shadow-sm" style="border-radius: 16px; transition: all 0.3s ease; background-color: var(--c-surface) !important;">
                                <div class="card-body p-3 p-md-4 d-flex flex-column h-100">
                                    <div class="d-flex align-items-start justify-content-between mb-3">
                                        <div class="d-flex align-items-center gap-3">
                                            <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                                                 :style="{background: (scroll.color || '#8b5cf6') + '18', color: scroll.color || '#8b5cf6', width: '44px', height: '44px', borderRadius: '12px'}">
                                                <i class="fa-solid" :class="scroll.icon || 'fa-scroll'" style="font-size: 1.1rem;"></i>
                                            </div>
                                            <div>
                                                <div class="fw-bold text-truncate" style="max-width: 140px;">{{ localize(scroll.name) }}</div>
                                                <div class="text-muted" style="font-size: 0.72rem;">v{{ scroll.version || '1.0.0' }} · {{ scroll.author || '4YStudio' }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <p class="text-muted small mb-3" style="line-height: 1.5; height: 3em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                                        {{ localize(scroll.description) || '暂无描述' }}
                                    </p>

                                    <!-- 分类标签 -->
                                    <div v-if="scroll.category" class="mb-3 d-flex flex-wrap gap-1">
                                        <span class="badge rounded-pill px-2 py-1" style="font-size: 0.62rem; background: var(--c-surface-elevated, #f0f0f0); color: var(--c-text-secondary, #666); border: 1px solid var(--c-border, #ddd);">
                                            {{ getCategoryLabel(scroll.category) }}
                                        </span>
                                    </div>

                                    <!-- 错误提示 -->
                                    <div v-if="scroll.error" class="mb-2 p-2 rounded-3" style="background: rgba(220,53,69,0.08); border: 1px solid rgba(220,53,69,0.2);">
                                        <div class="d-flex align-items-start gap-2">
                                            <i class="fa-solid fa-circle-exclamation text-danger flex-shrink-0 mt-1" style="font-size: 0.7rem;"></i>
                                            <div class="small text-danger" style="font-size: 0.7rem; line-height: 1.4; word-break: break-all;">{{ scroll.error }}</div>
                                        </div>
                                    </div>

                                    <!-- Hover Swap 交互容器 -->
                                    <div class="card-hover-swap-container position-relative mt-auto pt-2" style="height: 38px;">
                                        <!-- 常态信息层 (非悬停时显示) -->
                                        <div class="card-info-view w-100 h-100 d-flex align-items-center justify-content-between">
                                            <div class="d-flex align-items-center gap-2">
                                                <span class="status-indicator" :class="scroll.error ? 'bg-danger' : (scroll.enabled && scroll.active ? 'bg-success' : 'bg-secondary')" style="width: 6px; height: 6px;"></span>
                                                <span class="small" :class="scroll.error ? 'text-danger' : (scroll.enabled && scroll.active ? 'text-success' : 'text-muted')">
                                                    {{ scroll.error ? ($t('scrolls.error') || '错误') : (scroll.enabled && scroll.active ? ($t('scrolls.running') || '运行中') : ($t('scrolls.stopped') || '已停止')) }}
                                                </span>
                                            </div>
                                            <div class="small text-muted font-monospace" style="font-size: 0.65rem;">
                                                本地卷轴 / Local
                                            </div>
                                        </div>

                                        <!-- 动作按钮层 (悬停时滑升显示) -->
                                        <div class="card-action-view w-100 h-100 d-flex align-items-center justify-content-end">
                                            <div class="d-flex gap-2 align-items-center">
                                                <button v-if="hasConfigSchema(scroll)" class="btn btn-sm btn-outline-info px-2 py-0" @click="openConfigModal(scroll)" style="font-size: 0.72rem; border-radius: 8px;" :title="$t('scrolls.settings') || '配置'">
                                                    <i class="fa-solid fa-gear"></i>
                                                </button>
                                                <div class="form-check form-switch m-0 me-1">
                                                    <input class="form-check-input cursor-pointer" type="checkbox" :checked="scroll.enabled"
                                                        @change="toggleScroll(scroll)" :disabled="toggling === scroll.id">
                                                </div>
                                                <button class="btn btn-sm btn-outline-secondary px-2 py-0" @click="exportScroll(scroll)" style="font-size: 0.72rem; border-radius: 8px;" :title="$t('scrolls.export') || '导出'">
                                                    <i class="fa-solid fa-download"></i>
                                                </button>
                                                <button class="btn btn-sm btn-outline-danger px-2 py-0" @click="askUninstall(scroll)" style="font-size: 0.72rem; border-radius: 8px;" :title="$t('scrolls.delete') || '删除'">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
                <div v-else class="text-center py-5">
                    <i class="fa-solid fa-scroll d-block mb-3 opacity-25" style="font-size: 3rem; color: #8b5cf6;"></i>
                    <p class="text-muted mb-0">{{ $t('scrolls.no_scrolls') || '暂无已安装卷轴' }}</p>
                    <p class="text-muted small">{{ $t('scrolls.no_scrolls_hint') || '可以从卷轴市场下载 ZIP 压缩包或自制脚本后上传安装' }}</p>
                </div>
            </div>
        </div>

        <!-- 模态框: 安装卷轴 (ZIP 上传与市场引导) -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div class="modal fade show" v-if="showInstallModal" style="display: block; z-index: 1050;">
                    <div class="modal-backdrop fade show" @click="closeInstallModal" style="z-index: -1;"></div>
                    <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                        <div class="modal-content border-0 shadow-lg overflow-hidden" style="border-radius: 20px; background-color: var(--c-surface); color: var(--c-text-primary);">
                            <div class="modal-header border-0 pb-0 pt-4 px-4">
                                <h5 class="modal-title fw-bold d-flex align-items-center">
                                    <i class="fa-solid fa-plus-circle me-2 text-primary" style="color: #8b5cf6 !important;"></i>
                                    <span>{{ $t('scrolls.install') || '安装卷轴' }}</span>
                                </h5>
                                <button type="button" class="btn-close" @click="closeInstallModal"></button>
                            </div>
                            <div class="modal-body px-4 py-4">
                                <!-- 引导卡片：前往官方卷轴市场 -->
                                <div class="p-3 rounded-4 mb-4 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
                                     style="background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2);">
                                    <div class="d-flex align-items-center gap-2.5">
                                        <div class="p-2 rounded-3 bg-white bg-opacity-10 d-flex align-items-center justify-content-center" style="color: #8b5cf6;">
                                            <i class="fa-solid fa-store fa-lg"></i>
                                        </div>
                                        <div>
                                            <div class="fw-bold small" style="color: #8b5cf6;">发现更多官方与社区卷轴？</div>
                                            <div class="text-muted small" style="font-size: 0.75rem;">访问 GitHub 托管的官方卷轴市场，免费浏览下载扫地姬、防沉迷、快速天亮等丰富脚本。</div>
                                        </div>
                                    </div>
                                    <a href="/scrolls-market.html" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 flex-shrink-0 fw-bold">
                                        <span>{{ $t('scrolls.market_link') || '前往卷轴市场' }}</span>
                                        <i class="fa-solid fa-arrow-up-right-from-square ms-1" style="font-size: 0.72rem;"></i>
                                    </a>
                                </div>

                                <!-- 上传 ZIP -->
                                <div class="mb-4 text-center">
                                    <div class="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                                         style="width: 64px; height: 64px; background: rgba(139, 92, 246, 0.12); color: #8b5cf6;">
                                        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.5rem;"></i>
                                    </div>
                                    <p class="text-muted small px-3">{{ $t('scrolls.upload_desc') || '请上传 .zip 格式的卷轴包。卷轴将被上传并自动解压部署。' }}</p>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('scrolls.install_file_label') || '选择卷轴 ZIP 文件' }}</label>
                                    <div class="input-group">
                                        <input type="file" class="form-control" ref="installFileInput" accept=".zip" @change="handleFileChange" style="border-radius: 12px;">
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer border-0 pt-0 pb-4 px-4">
                                <button type="button" class="btn btn-outline-secondary rounded-pill px-4" @click="closeInstallModal" :disabled="installing">
                                    {{ $t('common.cancel') }}
                                </button>
                                <button type="button" class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" :disabled="!hasFile || installing" @click="startUpload">
                                    <span v-if="installing" class="spinner-border spinner-border-sm me-1"></span>
                                    <i v-else class="fa-solid fa-upload me-1"></i>
                                    <span>{{ installing ? ($t('common.installing') || '正在安装...') : ($t('common.install') || '开始安装') }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- 模态框: 配置参数 Schema Modal -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div class="modal fade show" v-if="showConfigModal" style="display: block; z-index: 1050;">
                    <div class="modal-backdrop fade show" @click="showConfigModal = false" style="z-index: -1;"></div>
                    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content border-0 shadow-lg" style="border-radius: 20px; background-color: var(--c-surface); color: var(--c-text-primary);">
                            <div class="modal-header border-0 pb-0 pt-4 px-4">
                                <h5 class="modal-title fw-bold d-flex align-items-center gap-2">
                                    <i class="fa-solid fa-sliders" style="color: #8b5cf6;"></i>
                                    <span>{{ $t('scrolls.settings') || '配置卷轴' }}: {{ localize(currentScroll?.name) }}</span>
                                </h5>
                                <button type="button" class="btn-close" @click="showConfigModal = false"></button>
                            </div>
                            <div class="modal-body px-4 py-4">
                                <form @submit.prevent="saveScrollConfig">
                                    <div v-for="field in currentSchemaFields" :key="field.key" class="mb-3">
                                        <label class="form-label small fw-bold mb-1">{{ field.title || field.label || field.key }}</label>
                                        <div v-if="field.description" class="form-text small mb-1 text-muted" style="font-size: 0.75rem;">
                                            {{ field.description }}
                                        </div>
                                        
                                        <!-- 文本输入 -->
                                        <input v-if="field.type === 'string'" type="text"
                                               class="form-control form-control-sm rounded-3"
                                               v-model="configFormData[field.key]" />
                                        
                                        <!-- 数值输入 -->
                                        <input v-else-if="field.type === 'number'" type="number"
                                               class="form-control form-control-sm rounded-3"
                                               :min="field.min" :max="field.max"
                                               v-model.number="configFormData[field.key]" />
                                        
                                        <!-- 开关切换 -->
                                        <div v-else-if="field.type === 'boolean'" class="form-check form-switch mt-1">
                                            <input class="form-check-input cursor-pointer" type="checkbox" role="switch"
                                                   v-model="configFormData[field.key]" />
                                        </div>

                                        <!-- 下拉选择 -->
                                        <select v-else-if="field.type === 'select'" class="form-select form-select-sm rounded-3"
                                                v-model="configFormData[field.key]">
                                            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
                                                {{ opt.label || opt.value }}
                                            </option>
                                        </select>
                                    </div>
                                    <div class="d-flex justify-content-end gap-2 mt-4">
                                        <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-4" @click="showConfigModal = false">
                                            {{ $t('common.cancel') || '取消' }}
                                        </button>
                                        <button type="submit" class="btn btn-sm btn-primary rounded-pill px-4 fw-bold shadow-sm" :disabled="savingConfig">
                                            <i class="fa-solid" :class="savingConfig ? 'fa-spinner fa-spin' : 'fa-check'"></i>
                                            <span class="ms-1">{{ $t('common.save') || '保存' }}</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- 模态框: 删除确认 Modal -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div class="modal fade show" v-if="showUninstallConfirm" style="display: block; z-index: 1050;">
                    <div class="modal-backdrop fade show" @click="showUninstallConfirm = false" style="z-index: -1;"></div>
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content border-0 shadow-lg" style="border-radius: 20px; background-color: var(--c-surface); color: var(--c-text-primary);">
                            <div class="modal-body p-4 text-center">
                                <div class="rounded-circle bg-danger bg-opacity-10 text-danger mx-auto d-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                                    <i class="fa-solid fa-trash-can fa-2x"></i>
                                </div>
                                <h5 class="fw-bold mb-2">{{ $t('scrolls.delete_title') || '卸载卷轴' }}</h5>
                                <p class="text-muted small mb-4">
                                    {{ $t('scrolls.delete_confirm', { name: localize(scrollToUninstall?.name) }) }}
                                </p>
                                <div class="d-flex justify-content-center gap-2">
                                    <button class="btn btn-outline-secondary rounded-pill px-4" @click="showUninstallConfirm = false">
                                        {{ $t('common.cancel') }}
                                    </button>
                                    <button class="btn btn-danger rounded-pill px-4 fw-bold shadow-sm" @click="confirmUninstall">
                                        {{ $t('common.delete') }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
    `,
    setup() {
        const loading = ref(false);
        const scrolls = ref([]);
        const toggling = ref(null);

        // 安装弹窗
        const showInstallModal = ref(false);
        const installFileInput = ref(null);
        const hasFile = ref(false);
        const installing = ref(false);

        // 配置弹窗
        const showConfigModal = ref(false);
        const currentScroll = ref(null);
        const configFormData = reactive({});
        const savingConfig = ref(false);

        // 卸载弹窗
        const showUninstallConfirm = ref(false);
        const scrollToUninstall = ref(null);

        function localize(val) {
            if (!val) return '';
            if (typeof val === 'object') {
                return val[store.lang] || val['zh'] || val['en'] || Object.values(val)[0] || '';
            }
            return String(val);
        }

        function getCategoryLabel(cat) {
            const map = {
                tools: '系统运维',
                interactive: '玩家互动',
                utility: '实用工具'
            };
            return map[cat] || cat || '通用';
        }

        const fetchScrolls = async () => {
            loading.value = true;
            try {
                const res = await api.get('/api/scrolls');
                scrolls.value = res.data.scrolls || [];
            } catch (err) {
                showToast(err.response?.data?.error || '获取卷轴列表失败', 'error');
            } finally {
                loading.value = false;
            }
        };

        const toggleScroll = async (scroll) => {
            const original = scroll.enabled;
            scroll.enabled = !original;
            toggling.value = scroll.id;
            try {
                const res = await api.post('/api/scrolls/' + scroll.id + '/toggle', { enabled: scroll.enabled });
                scroll.enabled = res.data.enabled;
                scroll.active = res.data.enabled;
                showToast((scroll.enabled ? '已启用' : '已禁用') + '卷轴「' + localize(scroll.name) + '」', 'success');
            } catch (err) {
                scroll.enabled = original;
                showToast(err.response?.data?.error || '切换状态失败', 'error');
            } finally {
                toggling.value = null;
            }
        };

        const hasConfigSchema = (scroll) => {
            if (!scroll || !scroll.configSchema) return false;
            if (Array.isArray(scroll.configSchema)) return scroll.configSchema.length > 0;
            return Object.keys(scroll.configSchema).length > 0;
        };

        const currentSchemaFields = computed(() => {
            if (!currentScroll.value || !currentScroll.value.configSchema) return [];
            const schema = currentScroll.value.configSchema;
            if (Array.isArray(schema)) return schema;
            return Object.entries(schema).map(([key, item]) => ({
                key,
                title: item.title || item.label || key,
                description: item.description || '',
                type: item.type || 'string',
                default: item.default,
                min: item.min,
                max: item.max,
                options: item.options || []
            }));
        });

        const openConfigModal = (scroll) => {
            currentScroll.value = scroll;
            Object.keys(configFormData).forEach(k => delete configFormData[k]);
            
            const schema = currentSchemaFields.value;
            const savedConfig = scroll.config || {};
            
            schema.forEach(field => {
                if (savedConfig[field.key] !== undefined) {
                    configFormData[field.key] = savedConfig[field.key];
                } else if (field.default !== undefined) {
                    configFormData[field.key] = field.default;
                } else {
                    configFormData[field.key] = field.type === 'boolean' ? false : (field.type === 'number' ? 0 : '');
                }
            });

            showConfigModal.value = true;
        };

        const saveScrollConfig = async () => {
            if (!currentScroll.value) return;
            savingConfig.value = true;
            try {
                const res = await api.post('/api/scrolls/' + currentScroll.value.id + '/config', {
                    config: { ...configFormData }
                });
                currentScroll.value.config = res.data.config;
                showToast('配置保存成功并已即时热生效！', 'success');
                showConfigModal.value = false;
            } catch (err) {
                showToast(err.response?.data?.error || '保存配置失败', 'error');
            } finally {
                savingConfig.value = false;
            }
        };

        const exportScroll = (scroll) => {
            window.open('/api/scrolls/' + scroll.id + '/export', '_blank');
        };

        const askUninstall = (scroll) => {
            scrollToUninstall.value = scroll;
            showUninstallConfirm.value = true;
        };

        const confirmUninstall = async () => {
            if (!scrollToUninstall.value) return;
            try {
                await api.post('/api/scrolls/' + scrollToUninstall.value.id + '/delete');
                showToast('卷轴「' + localize(scrollToUninstall.value.name) + '」已删除', 'success');
                showUninstallConfirm.value = false;
                scrollToUninstall.value = null;
                await fetchScrolls();
            } catch (err) {
                showToast(err.response?.data?.error || '删除卷轴失败', 'error');
            }
        };

        const openInstallModal = () => {
            hasFile.value = false;
            showInstallModal.value = true;
        };

        const closeInstallModal = () => {
            if (installing.value) return;
            showInstallModal.value = false;
            hasFile.value = false;
        };

        const handleFileChange = (e) => {
            hasFile.value = !!e.target.files[0];
        };

        const startUpload = async () => {
            const file = installFileInput.value?.files[0];
            if (!file) return;

            installing.value = true;
            const formData = new FormData();
            formData.append('scroll', file);

            try {
                const res = await api.post('/api/scrolls/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('卷轴安装成功！', 'success');
                closeInstallModal();
                await fetchScrolls();
            } catch (err) {
                showToast(err.response?.data?.error || '上传安装失败', 'error');
            } finally {
                installing.value = false;
            }
        };

        const currentInstanceName = computed(() => {
            const inst = store.instanceList?.find(i => i.id === store.currentInstanceId);
            return inst ? inst.name : (store.currentInstanceId || '');
        });

        watch(() => store.currentInstanceId, (newId) => {
            if (newId) fetchScrolls();
        });

        onMounted(() => {
            fetchScrolls();
        });

        return {
            loading,
            scrolls,
            toggling,
            localize,
            getCategoryLabel,
            fetchScrolls,
            toggleScroll,
            hasConfigSchema,
            openConfigModal,
            showConfigModal,
            currentScroll,
            currentSchemaFields,
            configFormData,
            savingConfig,
            saveScrollConfig,
            exportScroll,
            askUninstall,
            showUninstallConfirm,
            scrollToUninstall,
            confirmUninstall,
            openInstallModal,
            closeInstallModal,
            showInstallModal,
            installFileInput,
            hasFile,
            installing,
            handleFileChange,
            startUpload,
            currentInstanceName,
            store
        };
    }
};
