import { reactive } from '/js/vue.esm-browser.js';

export const store = reactive({
    auth: { loggedIn: false, isSetup: false, qrCode: '', secret: '', token: '' },
    isSetup: false, // Added root property for Setup Wizard
    lang: 'zh', // 默认语言
    // 在线玩家列表
    onlinePlayers: [],
    // 系统状态
    stats: { cpu: 0, mem: { total: 0, used: 0, percentage: 0 }, mc: { online: 0, maxPlayers: 20, port: '-', motd: '-' } },
    isRunning: false,
    hasBackupMod: false,
    hasEasyAuth: false,
    hasVoicechat: false,
    logs: [],
    view: 'instance-manager', // Default view to instance manager
    prevView: 'instance-manager', // Track previous view for back buttons
    consoleInfoPosition: 'top', // 'top', 'sidebar', 'hide'

    currentInstanceId: null, // ID of the currently managed instance
    instanceList: [],       // List of all instances
    javaInstallations: [],  // List of installed Java versions

    customLogoUrl: '',      // Custom logo URL from appearance settings
    customBgUrl: '',        // Custom background image URL from appearance settings

    // --- 新增：全局任务进度状态 ---
    task: {
        visible: false,
        title: '',
        message: '',
        subMessage: '',
        percent: 0,
        speed: 0
    },

    // --- 插件系统 ---
    pluginSidebarItems: [],
    pluginComponents: {},
    dashboardCards: []
});