import { ref, onMounted, computed, watch } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';
import { store } from '../store.js';
import { createI18n } from '../i18n.js';

export default {
    template: `
    <div class="card border-0 shadow-sm animate-in">
        <div class="card-body p-5">
            <div class="text-center mb-5">
                <div class="display-1 text-primary mb-3"><i class="fa-solid fa-cube"></i></div>
                <h2 class="fw-bold">{{ $t('setup.welcome') }}</h2>
                <p class="text-muted">{{ $t('setup.desc') }}</p>
            </div>

            <div v-if="loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-3 text-muted">{{ loadingText }}</p>
            </div>

            <div v-else class="row justify-content-center">
                <div class="col-md-8 col-lg-6">
                    <!-- Step 1: MC Version -->
                    <div class="mb-4">
                        <label class="form-label fw-bold">{{ $t('setup.select_mc') }}</label>
                        <select class="form-select form-select-lg" v-model="selectedMc" @change="fetchLoaders">
                            <option value="">{{ $t('setup.choose') }}</option>
                            <option v-for="v in mcVersions" :key="v" :value="v">{{ v }}</option>
                        </select>
                    </div>

                     <!-- Step 2: Loader Version -->
                    <div class="mb-4" v-if="selectedMc">
                        <label class="form-label fw-bold">{{ $t('setup.select_loader') }}</label>
                        <select class="form-select form-select-lg" v-model="selectedLoader">
                            <option value="">{{ $t('setup.choose') }}</option>
                            <option v-for="v in loaderVersions" :key="v" :value="v">{{ v }}</option>
                        </select>
                    </div>

                    <!-- Step 3: Install -->
                    <div class="d-grid" v-if="selectedMc && selectedLoader">
                        <button class="btn btn-primary btn-lg" @click="install" :disabled="installing">
                             <span v-if="installing" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                             {{ installing ? $t('setup.installing') : $t('setup.install') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup(props, { emit }) {
        const t = createI18n(store);
        const mcVersions = ref([]);
        const loaderVersions = ref([]);
        const selectedMc = ref('');
        const selectedLoader = ref('');
        const loading = ref(true);
        const loadingText = computed(() => t('setup.loading_versions'));
        const installing = ref(false);

        const fetchMc = async () => {
            try {
                const res = await api.get('/api/setup/versions/mc');
                mcVersions.value = res.data;
                loading.value = false;
            } catch (e) {
                showToast(t('setup.fetch_fail_mc'), 'danger');
            }
        };

        const fetchLoaders = async () => {
            if (!selectedMc.value) return;
            loaderVersions.value = [];
            selectedLoader.value = '';
            try {
                const res = await api.get(`/api/setup/versions/loader/${selectedMc.value}`);
                loaderVersions.value = res.data;
                if (res.data.length > 0) selectedLoader.value = res.data[0];
            } catch (e) {
                showToast(t('setup.fetch_fail_loader'), 'danger');
            }
        };

        const install = async () => {
            installing.value = true;
            try {
                await api.post('/api/setup/install', {
                    gameVersion: selectedMc.value,
                    loaderVersion: selectedLoader.value
                });
                showToast(t('setup.install_start_toast'), 'info');

                let checks = 0;
                const interval = setInterval(async () => {
                    checks++;
                    try {
                        const res = await api.get('/api/setup/status');
                        if (res.data.isSetup) {
                            clearInterval(interval);
                            installing.value = false;
                            emit('setup-complete');
                            showToast(t('setup.install_success_toast'), 'success');
                        }
                    } catch (e) { }
                    if (checks > 120) {
                        clearInterval(interval);
                        installing.value = false;
                        showToast(t('setup.install_timeout_toast'), 'warning');
                    }
                }, 2000);

            } catch (e) {
                installing.value = false;
                showToast(t('setup.install_fail_toast'), 'danger');
            }
        };

        onMounted(fetchMc);

        return {
            mcVersions, loaderVersions, selectedMc, selectedLoader,
            loading, loadingText, installing,
            fetchLoaders, install
        };
    }
};
