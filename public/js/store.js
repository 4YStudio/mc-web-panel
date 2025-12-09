import { reactive } from '/js/vue.esm-browser.js';

export const store = reactive({
    auth: { loggedIn: false, isSetup: true, qrCode: '', secret: '', token: '' },
    lang: 'zh', // 默认语言
    // 在线玩家列表
    onlinePlayers: [],
    // 系统状态
    stats: { cpu: 0, mem: { total: 0, used: 0, percentage: 0 }, mc: { online: 0, maxPlayers: 20, port: '-', motd: '-' } },
    isRunning: false,
    hasBackupMod: false,
    logs: [],
    view: 'dashboard',
    isRunning: false,
    hasBackupMod: false,
    hasEasyAuth: false, // 新增：是否显示 EasyAuth 菜单
    hasVoicechat: false, // 新增：是否显示 Voicechat 菜单

    // --- 新增：全局任务进度状态 ---
    task: {
        visible: false,      // 是否显示弹窗
        title: '',           // 标题
        message: '',         // 主消息
        subMessage: '',      // 副消息 (如 10MB/100MB)
        percent: 0           // 进度百分比 0-100
    }
});