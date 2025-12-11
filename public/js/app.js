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
import About from './components/About.js?v=1.5.0';
import { createI18n } from './i18n.js?v=1.5.0';

const socket = io();

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
        VoicechatManager,
        PanelSettings,
        About
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
                store.auth.isSetup = data.isSetup;
                store.isSetup = data.isSetup; // Update root property
                store.auth.loggedIn = data.authenticated;
                if (!store.auth.isSetup || !store.isSetup) {
                    const qr = await api.get('/api/auth/qr');
                    store.auth.qrCode = qr.data.qr;
                    store.auth.secret = qr.data.secret;
                }
            } catch (e) { console.error(e); }
        };

        const postLogin = () => {
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
                store.isSetup = d.isSetup; // Sync dynamic setup state
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