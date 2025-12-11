import { computed, ref } from '/js/vue.esm-browser.js';
import { store } from '../store.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';

export default {
    template: `
    <div class="container-fluid p-4">
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
                            <!-- 
                            <a href="#" class="btn btn-primary btn-lg px-4 gap-3">
                                <i class="fa-solid fa-globe"></i> {{ $t('about.website') }}
                            </a>
                            -->
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
                            <p class="mb-0" v-if="updateInfo.hasUpdate">
                                {{ $t('about.new_version') }}: <strong>{{ updateInfo.latestVersion }}</strong>
                                <br>
                                <a :href="updateInfo.url" target="_blank" class="btn btn-sm btn-success mt-2">{{ $t('about.download') }}</a>
                            </p>
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
                let latestVersion;
                let htmlUrl = 'https://github.com/4YStudio/mc-web-panel/releases';

                try {
                    // Try GitHub API first
                    const response = await fetch('https://api.github.com/repos/4YStudio/mc-web-panel/releases/latest');
                    if (response.status === 403) throw new Error('Rate Limited');
                    if (!response.ok) throw new Error('Network Error');

                    const data = await response.json();
                    latestVersion = data.tag_name.replace(/^v/i, '');
                    htmlUrl = data.html_url;
                } catch (e) {
                    if (e.message === 'Rate Limited') {
                        // Fallback to raw package.json from main branch
                        console.log('GitHub API Limited, trying raw content...');
                        const rawRes = await fetch('https://raw.githubusercontent.com/4YStudio/mc-web-panel/main/package.json');
                        if (!rawRes.ok) throw e; // Propagate original error if fallback fails
                        const rawData = await rawRes.json();
                        latestVersion = rawData.version;
                    } else {
                        throw e;
                    }
                }

                const currentVersion = appVersion.value;

                const isNewer = (v1, v2) => {
                    if (!v1 || !v2) return false;
                    const p1 = v1.split('.').map(Number);
                    const p2 = v2.split('.').map(Number);
                    for (let i = 0; i < 3; i++) {
                        if (p1[i] > p2[i]) return true;
                        if (p1[i] < p2[i]) return false;
                    }
                    return false;
                };

                updateInfo.value = {
                    hasUpdate: isNewer(latestVersion, currentVersion),
                    latestVersion,
                    currentVersion,
                    url: htmlUrl
                };

            } catch (e) {
                console.error(e);
                if (e.message === 'Rate Limited') {
                    showToast('GitHub API 速率限制，请稍后再试或直接访问 GitHub 查看。', 'warning');
                } else {
                    showToast('检查更新失败: ' + e.message, 'danger');
                }
            } finally {
                checking.value = false;
            }
        };

        // Initial fetch
        getVersion();

        return { store, checkUpdate, checking, updateInfo, appVersion, ref };
    }
};
