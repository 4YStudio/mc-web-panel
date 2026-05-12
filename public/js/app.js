import { createApp, watch, onMounted, ref, computed, markRaw } from '/js/vue.esm-browser.js';
import { store } from './store.js';
import { api } from './api.js';
import { toasts, removeToast, modalData, confirmModalAction, initModal, showToast } from './utils.js';

// 导入所有组件
import Login from './components/Login.js';
import Sidebar from './components/Sidebar.js?v=1.5.0';
import Dashboard from './components/Dashboard.js';
import ModsManager from './components/ModsManager.js';
import FileManager from './components/FileManager.js';
import PlayerManager from './components/PlayerManager.js';
import BackupManager from './components/BackupManager.js';
import PluginManager from './components/PluginManager.js';
import ProgressModal from './components/ProgressModal.js';
import ServerPropertiesManager from './components/ServerPropertiesManager.js';
import Avatar from './components/Avatar.js';
import PanelSettings from './components/PanelSettings.js';
import ModrinthBrowser from './components/ModrinthBrowser.js';
import About from './components/About.js?v=1.5.0';
import JavaManager from './components/JavaManager.js';
import InstanceManager from './components/InstanceManager.js';
import PluginDevGuide from './components/PluginDevGuide.js';
import CustomSelect from './components/CustomSelect.js';
import { createI18n, messages } from './i18n.js?v=1.5.0';
import { socket } from './socket.js';

const app = createApp({
    // 注册组件 (Vue 会自动处理 ProgressModal -> <progress-modal> 的映射)
    components: {
        Login,
        Sidebar,
        Dashboard,
        ModsManager,
        FileManager,
        PlayerManager,
        BackupManager,
        ProgressModal,
        ServerPropertiesManager,
        Avatar,
        PanelSettings,
        ModrinthBrowser,
        About,
        JavaManager,
        InstanceManager,
        PluginManager,
        PluginDevGuide,
        CustomSelect
    },
    setup() {
        const sidebarOpen = ref(false);

        const init = async () => {
            // Theme Init using localStorage
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-bs-theme', savedTheme);

            // Language Init
            const savedLang = localStorage.getItem('lang') || 'zh';
            store.lang = savedLang;

            loadAppearanceImages();

            try {
                const appearanceRes = await api.get('/api/appearance/config');
                if (appearanceRes.data) {
                    applyAppearance(appearanceRes.data);
                }
            } catch (_) { }

            try {
                const { data } = await api.get('/api/auth/check');
                store.auth.isSetup = data.has2FA;
                store.isSetup = data.isSetup;
                store.auth.loggedIn = data.authenticated;
                if (!data.has2FA) {
                    const qr = await api.get('/api/auth/qr');
                    store.auth.qrCode = qr.data.qr;
                    store.auth.secret = qr.data.secret;
                }

                if (store.auth.loggedIn) {
                    syncConfig();
                }
            } catch (e) { console.error(e); }
        };

        const syncConfig = async () => {
            try {
                const configRes = await api.get('/api/panel/config');
                if (configRes.data && configRes.data.consoleInfoPosition) {
                    store.consoleInfoPosition = configRes.data.consoleInfoPosition;
                }
                if (configRes.data && configRes.data.appearance) {
                    applyAppearance(configRes.data.appearance);
                }
            } catch (e) { console.error('Failed to sync config:', e); }
        };

        const loadPlugins = async () => {
            try {
                const [sidebarRes, componentsRes, dashboardCardsRes, translationsRes] = await Promise.all([
                    api.get('/api/plugins/sidebar-items'),
                    api.get('/api/plugins/components'),
                    api.get('/api/plugins/dashboard-cards'),
                    api.get('/api/plugins/translations')
                ]);

                if (translationsRes.data) {
                    // Merge plugin translations into global messages
                    for (const [lang, data] of Object.entries(translationsRes.data)) {
                        if (messages[lang]) {
                            if (!messages[lang].plugins) messages[lang].plugins = {};
                            Object.assign(messages[lang].plugins, data.plugins);
                        }
                    }
                }

                if (sidebarRes.data) {
                    store.pluginSidebarItems = sidebarRes.data;
                }

                if (dashboardCardsRes.data) {
                    store.dashboardCards = dashboardCardsRes.data;
                }

                if (componentsRes.data) {
                    for (const [compName, compInfo] of Object.entries(componentsRes.data)) {
                        try {
                            // Use a cache-busting timestamp for hot-reloading components
                            const module = await import(`/api/plugins/${compInfo.pluginId}/component/${compName}?t=${Date.now()}`);
                            if (module.default) {
                                // Store the actual component object in the store
                                // Use markRaw to avoid Vue performance warnings about reactive components
                                store.pluginComponents[compName] = markRaw(module.default);
                            }
                        } catch (e) {
                            console.error(`Failed to load plugin component ${compName}:`, e);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load plugins:', e);
            }
        };

        window.loadPlugins = loadPlugins;

        const applyAppearance = (appearance) => {
            const root = document.documentElement;
            if (appearance.sidebarOpacity !== undefined) {
                root.style.setProperty('--app-sidebar-opacity', appearance.sidebarOpacity);
            }
            if (appearance.contentOpacity !== undefined) {
                root.style.setProperty('--app-content-opacity', appearance.contentOpacity);
            }
            if (appearance.cardOpacity !== undefined) {
                root.style.setProperty('--app-card-opacity', appearance.cardOpacity);
            }
            if (appearance.loginOpacity !== undefined) {
                root.style.setProperty('--app-login-opacity', appearance.loginOpacity);
            }
            if (appearance.instanceOpacity !== undefined) {
                root.style.setProperty('--app-instance-opacity', appearance.instanceOpacity);
            }
        };

        const loadAppearanceImages = async () => {
            try {
                await api.get('/api/appearance/logo');
                store.customLogoUrl = '/api/appearance/logo?t=' + Date.now();
                const favicon = document.querySelector("link[rel*='icon']") || document.createElement('link');
                favicon.type = 'image/x-icon';
                favicon.rel = 'icon';
                favicon.href = store.customLogoUrl;
                document.getElementsByTagName('head')[0].appendChild(favicon);
            } catch (_) { }
            try {
                await api.get('/api/appearance/background');
                store.customBgUrl = '/api/appearance/background?t=' + Date.now();
                document.documentElement.style.setProperty('--app-bg-image', `url(${store.customBgUrl})`);
                document.body.classList.add('has-bg-image');
            } catch (_) { }
        };

        const postLogin = () => {
            syncConfig();
            loadAppearanceImages();
            api.get('/api/server/status').then(res => store.isRunning = res.data.running);

            // Load plugins
            loadPlugins();

            // Socket 监听
            socket.emit('req_history');
            socket.on('console_history', history => store.logs = history);
            socket.on('console', l => {
                store.logs.push(l);
                if (store.logs.length > 1000) store.logs.shift();
            });
            socket.on('status', s => store.isRunning = s);
            socket.on('players_update', p => store.onlinePlayers = p);
            socket.on('system_stats', d => {
                // Partial update to preserve mc stats and instance-specific settings if missing in update
                if (d.mc) {
                    Object.assign(store.stats, d);
                } else {
                    // Preserve existing mc stats if backend didn't send them
                    const oldMc = store.stats.mc;
                    Object.assign(store.stats, d);
                    store.stats.mc = oldMc;
                }
                if (d.hasBackupMod !== undefined) store.hasBackupMod = d.hasBackupMod;
                if (d.hasEasyAuth !== undefined) store.hasEasyAuth = d.hasEasyAuth;
                if (d.hasVoicechat !== undefined) store.hasVoicechat = d.hasVoicechat;
                if (d.isSetup !== undefined) store.isSetup = d.isSetup;
            });

            // 回档进度监听
            socket.on('restore_progress', (data) => {
                store.task.visible = true;
                store.task.title = '系统回档中';
                store.task.percent = data.percent;
                store.task.message = data.message;
                store.task.subMessage = data.percent + '%';
            });

            const handleRestoreProgress = (data) => {
                store.task.visible = true;
                store.task.title = '系统回档中';
                store.task.percent = data.percent;
                store.task.message = data.message;
                store.task.subMessage = data.percent + '%';
            };
            const handleRestoreCompleted = () => {
                store.task.percent = 100;
                store.task.message = '回档成功！';
                setTimeout(() => {
                    store.task.visible = false;
                    showToast('回档流程结束');
                }, 1000);
            };
            const handleRestoreError = (msg) => {
                store.task.visible = false;
                showToast('回档出错: ' + msg, 'danger');
            };

            socket.on('restore_completed', handleRestoreCompleted);
            socket.on('restore_error', handleRestoreError);

            // 更新进度监听
            let autoRefreshPoll = null;
            const startAutoRefreshPoll = () => {
                if (autoRefreshPoll) return; // already polling
                store.task.percent = 100;
                store.task.message = '更新完成，等待面板重启...';
                autoRefreshPoll = setInterval(async () => {
                    try {
                        const resp = await fetch('/', { method: 'HEAD', cache: 'no-store' });
                        if (resp.ok) {
                            clearInterval(autoRefreshPoll);
                            autoRefreshPoll = null;
                            location.reload();
                        }
                    } catch (e) { /* server still down */ }
                }, 2000);
            };

            socket.on('update_status', (data) => {
                store.task.visible = true;
                store.task.title = '系统更新';
                store.task.message = data.message;
                if (data.step === 'error') {
                    showToast(data.message, 'danger');
                    // Reset cancellation
                    store.task.canCancel = false;
                    store.task.onCancel = null;
                    setTimeout(() => store.task.visible = false, 3000);
                }
                if (data.step === 'restarting') {
                    store.task.canCancel = false;
                    store.task.onCancel = null;
                    startAutoRefreshPoll();
                }
            });
            socket.on('update_progress', (data) => {
                store.task.percent = data.progress;
                store.task.subMessage = data.progress + '%';
                store.task.speed = data.speed || 0;
            });

            // Fallback: if socket disconnects during an update, start auto-refresh poll
            socket.on('disconnect', () => {
                if (store.task.visible && store.task.title === '系统更新') {
                    startAutoRefreshPoll();
                }
            });

            // Instance-specific Socket Switching
            watch(() => store.currentInstanceId, (newId, oldId) => {
                if (oldId) {
                    socket.off(`console:${oldId}`);
                    socket.off(`status:${oldId}`);
                    socket.off(`players_update:${oldId}`);
                }
                if (newId) {
                    store.logs = [];
                    socket.emit('req_history', { instanceId: newId });
                    socket.on(`console:${newId}`, l => {
                        store.logs.push(l);
                        if (store.logs.length > 1000) store.logs.shift();
                    });
                    socket.on(`status:${newId}`, s => {
                        store.isRunning = s.isRunning;
                        // Update other properties from s
                        store.hasBackupMod = s.hasBackupMod;
                        store.hasEasyAuth = s.hasEasyAuth;
                        store.hasVoicechat = s.hasVoicechat;
                        store.stats.mc.port = s.port;
                        store.stats.mc.maxPlayers = s.maxPlayers;
                        store.stats.mc.motd = s.motd;
                        store.stats.version = s.version;
                        store.stats.backupStrategy = s.backupStrategy;
                        store.stats.autoBackupEnabled = s.autoBackupEnabled;
                        store.stats.autoBackupInterval = s.autoBackupInterval;
                        store.stats.maxBackupCount = s.maxBackupCount;
                    });
                    socket.on(`players_update:${newId}`, p => store.onlinePlayers = p);
                    socket.on(`restore_progress:${newId}`, handleRestoreProgress);
                    socket.on(`restore_completed:${newId}`, handleRestoreCompleted);
                    socket.on(`restore_error:${newId}`, handleRestoreError);
                }
            });

            // Initial fetch
            api.get('/api/instances/list').then(res => store.instanceList = res.data);
            socket.on('instances_update', list => store.instanceList = list);
        };

        watch(() => store.auth.loggedIn, (val) => {
            if (val) postLogin();
        });

        watch(() => store.view, (newView, oldView) => {
            if (newView !== oldView && oldView) {
                store.prevView = oldView;
            }
        });

        onMounted(() => {
            init();
            initModal(); // 初始化 Bootstrap Modal
            if (store.auth.loggedIn) postLogin();
        });

        const isPluginView = computed(() => {
            return store.pluginSidebarItems.some(item => item.view === store.view);
        });

        const pluginViewComponent = computed(() => {
            const item = store.pluginSidebarItems.find(item => item.view === store.view);
            if (!item) return null;
            // Return the component object from our store
            return store.pluginComponents[item.view] || item.view;
        });

        return {
            store,
            toasts,
            removeToast,
            modalData,
            confirmModalAction,
            sidebarOpen,
            isPluginView,
            pluginViewComponent
        };
    }
});

app.component('CustomSelect', CustomSelect);

app.config.globalProperties.$t = createI18n(store);
app.mount('#app');