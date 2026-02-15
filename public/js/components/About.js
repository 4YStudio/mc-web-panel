import { computed, ref } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column overflow-hidden">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-shrink-0">
            <div class="d-flex align-items-center">
                <button @click="store.view = 'instance-manager'" class="btn-back me-3">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <h3 class="fw-black m-0 tracking-tight">
                    <i class="fa-solid fa-circle-info me-2 text-primary"></i>{{ $t('about.title') }}
                </h3>
            </div>
        </div>

        <div class="flex-grow-1 overflow-auto custom-scrollbar">
            <div class="container-fluid">
                <div class="row justify-content-center">
                    <div class="col-lg-8 mx-auto">
                        <div class="card shadow rounded-3 border-0">
                            <div class="card-body text-center p-5">
                                <img src="logo.png" class="mb-4" width="80" height="80" alt="Logo">
                                
                                <h2 class="fw-bold mb-3">{{ $t('about.title') }}</h2>
                                <p class="lead mb-4">{{ $t('about.version') }}: v{{ appVersion }}</p>
                                
                                <p class="text-muted mb-4">
                                    {{ $t('about.description') }}
                                </p>
                                
                                <div class="d-grid gap-2 d-sm-flex justify-content-sm-center">
                                    <a href="https://github.com/4YStudio/mc-web-panel" target="_blank" class="btn btn-outline-secondary btn-lg px-4 gap-3">
                                        <i class="fa-brands fa-github"></i> {{ $t('about.source') }}
                                    </a>
                                </div>
                                
                                <div class="d-grid gap-2 d-sm-flex justify-content-sm-center mt-3">
                                    <button @click="checkUpdate" class="btn btn-outline-primary btn-lg px-4 gap-3" :disabled="checking">
                                        <i class="fa-solid fa-rotate" :class="{'fa-spin': checking}"></i> 
                                        {{ checking ? $t('about.checking') : $t('about.check_update') }}
                                    </button>
                                </div>

                                <div v-if="updateInfo" class="mt-4 alert" :class="updateInfo.hasUpdate ? 'alert-success' : 'alert-secondary'">
                                    <h5 class="alert-heading">
                                        <i class="fa-solid" :class="updateInfo.hasUpdate ? 'fa-gift' : 'fa-check-circle'"></i>
                                        {{ updateInfo.hasUpdate ? $t('about.update_available') : $t('about.latest_version') }}
                                    </h5>
                                    <div class="mb-0" v-if="updateInfo.hasUpdate">
                                        <p>{{ $t('about.new_version') }}: <strong>{{ updateInfo.latestVersion }}</strong></p>
                                        <div class="d-flex justify-content-center gap-2 mt-2">
                                            <button @click="startUpdate" class="btn btn-success" :disabled="store.task.visible">
                                                <i class="fa-solid fa-download me-1"></i> {{ $t('about.update_now') }}
                                            </button>
                                            <a :href="updateInfo.url" target="_blank" class="btn btn-outline-success">{{ $t('about.download') }}</a>
                                        </div>
                                    </div>
                                    <p class="mb-0" v-else>
                                        {{ $t('about.current_is_latest') }} 
                                        <span class="badge bg-success">v{{ updateInfo.latestVersion }}</span>
                                    </p>
                                </div>
                                
                                <hr class="my-4">
                                
                                <div class="text-muted small">
                                    <p class="mb-1">&copy; 2025 MC Web Panel. All rights reserved.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const checking = ref(false);
        const updateInfo = ref(null);
        const appVersion = ref('...');

        const getVersion = async () => {
            try {
                const { data } = await api.get('/api/system/version');
                appVersion.value = data.version;
            } catch (e) {
                appVersion.value = 'Unknown';
            }
        };

        const checkUpdate = async () => {
            checking.value = true;
            updateInfo.value = null;
            try {
                const { data } = await api.get('/api/system/update_check');
                updateInfo.value = data;
            } catch (e) {
                console.error(e);
                showToast('检查更新失败: ' + (e.response?.data?.error || e.message), 'danger');
            } finally {
                checking.value = false;
            }
        };

        const startUpdate = async () => {
            // Show the progress modal BEFORE starting the request
            // Socket handlers in app.js will update progress during download
            store.task.visible = true;
            store.task.title = '系统更新';
            store.task.message = '正在请求更新...';
            store.task.percent = 0;

            // Setup cancellation
            store.task.canCancel = true;
            store.task.onCancel = async () => {
                try {
                    store.task.message = '正在取消...';
                    await api.post('/api/system/update/cancel');
                } catch (e) {
                    console.error('Cancel failed', e);
                }
            };

            try {
                await api.post('/api/system/update');
                // Don't set state here — socket events have already updated it
            } catch (e) {
                store.task.visible = false;
                showToast('启动更新失败: ' + (e.response?.data?.error || e.message), 'danger');
            }
        };

        // Initial fetch
        getVersion();

        return { store, checkUpdate, checking, updateInfo, appVersion, ref, startUpdate };
    }
};
