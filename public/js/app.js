import { createApp, watch, onMounted, ref } from '/js/vue.esm-browser.js';
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
import ProgressModal from './components/ProgressModal.js';
import EasyAuthManager from './components/EasyAuthManager.js';
import ServerPropertiesManager from './components/ServerPropertiesManager.js';
import Avatar from './components/Avatar.js';
import VoicechatManager from './components/VoicechatManager.js';
import PanelSettings from './components/PanelSettings.js';
import ModrinthBrowser from './components/ModrinthBrowser.js';
import About from './components/About.js?v=1.5.0';
import JavaManager from './components/JavaManager.js';
import InstanceManager from './components/InstanceManager.js';
import { createI18n } from './i18n.js?v=1.5.0';
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
        EasyAuthManager,
        ServerPropertiesManager,
        Avatar,
        VoicechatManager,
        PanelSettings,
        ModrinthBrowser,
        About,
        JavaManager,
        InstanceManager
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
            } catch (e) { console.error('Failed to sync config:', e); }
        };

        const postLogin = () => {
            syncConfig();
            api.get('/api/server/status').then(res => store.isRunning = res.data.running);

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
                store.stats = d;
                store.hasBackupMod = d.hasBackupMod;
                store.hasEasyAuth = d.hasEasyAuth;
                store.hasVoicechat = d.hasVoicechat;
                store.isSetup = d.isSetup;
            });

            // 回档进度监听
            socket.on('restore_progress', (data) => {
                store.task.visible = true;
                store.task.title = '系统回档中';
                store.task.percent = data.percent;
                store.task.message = data.message;
                store.task.subMessage = data.percent + '%';
            });
            socket.on('restore_completed', () => {
                store.task.percent = 100;
                store.task.message = '回档成功！';
                setTimeout(() => {
                    store.task.visible = false;
                    showToast('回档流程结束');
                }, 1000);
            });
            socket.on('restore_error', (msg) => {
                store.task.visible = false;
                showToast('回档出错: ' + msg, 'danger');
            });

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
                    });
                    socket.on(`players_update:${newId}`, p => store.onlinePlayers = p);
                }
            });

            // Initial fetch
            api.get('/api/instances/list').then(res => store.instanceList = res.data);
            socket.on('instances_update', list => store.instanceList = list);
        };

        watch(() => store.auth.loggedIn, (val) => {
            if (val) postLogin();
        });

        onMounted(() => {
            init();
            initModal(); // 初始化 Bootstrap Modal
            if (store.auth.loggedIn) postLogin();
        });

        return {
            store,
            toasts,
            removeToast,
            modalData,
            confirmModalAction,
            sidebarOpen
        };
    }
});

app.config.globalProperties.$t = createI18n(store);
app.mount('#app');