/**
 * server.js - v6.0 (Advanced Backups Support)
 */
const axios = require('axios'); // 新增 axios
const cluster = require('cluster');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const fs = require('fs-extra');
const multer = require('multer');
const crypto = require('crypto');
const os = require('os');
const si = require('systeminformation');
const PropertiesReader = require('properties-reader');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const APP_VERSION = '1.7.0';
const APP_CODENAME = 'Advanced Backups Support';
const MODRINTH_UA = `CloudSpeak/MC-Panel/${APP_VERSION} (henvei@cloudspeak.com)`;

// --- 配置区域 ---
// detect if running in compressed environment (pkg or caxa)
let BASE_DIR = process.cwd();
const isNode = path.basename(process.execPath).toLowerCase().startsWith('node');

// In modern caxa, process.execPath points to the EXTRACTED node binary inside /tmp/caxa/.
// argv also only contains extracted paths. The original wrapper path is lost.
// Strategy:
//   1. Detect caxa by checking if execPath contains '/caxa/applications/'
//   2. Extract the executable name from the extraction path pattern:
//      /tmp/caxa/applications/<executable-name>/<hash>/<version>/node
//   3. Resolve it against process.cwd() (the directory where user ran the command)
let APP_EXECUTABLE = null;

const _isDaemon = process.argv.includes('--daemon');
if (_isDaemon || !isNode) {
    console.log(`DEBUG PATHS:`);
    console.log(`  execPath: ${process.execPath}`);
    console.log(`  argv: ${JSON.stringify(process.argv)}`);
    console.log(`  cwd: ${process.cwd()}`);
}

// --- Method 1: Detect caxa environment from extraction path ---
const caxaMatch = process.execPath.match(/[\/\\]caxa[\/\\]applications[\/\\]([^\/\\]+)[\/\\]/);
if (caxaMatch) {
    const exeName = caxaMatch[1]; // e.g. "mc-web-panel-linux-x64"
    const candidate = path.join(process.cwd(), exeName);
    console.log(`  Detected caxa environment, executable name: ${exeName}`);
    console.log(`  Looking for wrapper at: ${candidate}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        APP_EXECUTABLE = candidate;
        if (_isDaemon || !isNode) console.log(`  Found caxa wrapper: ${APP_EXECUTABLE}`);
    }
}

// --- Method 2: Non-caxa standalone (e.g. pkg) ---
if (!APP_EXECUTABLE && !isNode) {
    APP_EXECUTABLE = process.execPath;
}

// --- Method 3: Scan argv as fallback ---
if (!APP_EXECUTABLE) {
    for (const arg of process.argv) {
        if (!arg) continue;
        const base = path.basename(arg).toLowerCase();
        const isJs = base.endsWith('.js') || base.endsWith('.cjs') || base.endsWith('.mjs');
        const isNodeBin = base.startsWith('node');
        if (!isNodeBin && !isJs) {
            try {
                const fullPath = path.resolve(arg);
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    APP_EXECUTABLE = fullPath;
                    console.log(`  Detected Standalone Executable via argv: ${fullPath}`);
                    break;
                }
            } catch (e) { }
        }
    }
}

if (APP_EXECUTABLE) {
    BASE_DIR = path.dirname(APP_EXECUTABLE);
}

const DATA_DIR = path.join(BASE_DIR, 'data');
const INSTANCES_DIR = path.join(BASE_DIR, 'instances');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.join(DATA_DIR, 'panel.log');

// --- 多实例迁移与初始化 ---
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(INSTANCES_DIR);

const loadInstances = () => {
    try {
        if (fs.existsSync(INSTANCES_FILE)) return fs.readJsonSync(INSTANCES_FILE);
    } catch (e) { }
    return { instances: [], activeInstanceId: null };
};

const saveInstances = (data) => {
    fs.writeJsonSync(INSTANCES_FILE, data, { spaces: 2 });
};

// 默认配置
const DEFAULT_CONFIG = {
    secret: '', // Initial secret is empty
    isSetup: false,
    port: 3000,
    defaultLang: 'zh',
    theme: 'auto',
    consoleInfoPosition: 'top',
    jarName: 'fabric-server-launch.jar',
    javaArgs: ['-Xms1G', '-Xmx4G'],
    sessionTimeout: 7,
    maxLogHistory: 1000,
    monitorInterval: 2000,
    javaPath: 'java',
    sessionSecret: ''
};

let appConfig = fs.existsSync(CONFIG_FILE) ? { ...DEFAULT_CONFIG, ...fs.readJsonSync(CONFIG_FILE) } : { ...DEFAULT_CONFIG };

// 如果没有 sessionSecret，生成并根据情况保存
if (!appConfig.sessionSecret) {
    appConfig.sessionSecret = authenticator.generateSecret() + '_' + Date.now();
}

// 立即保存配置文件 (如果不存在)
if (!fs.existsSync(CONFIG_FILE)) {
    fs.ensureDirSync(DATA_DIR);
    fs.writeJsonSync(CONFIG_FILE, appConfig, { spaces: 2 });
}

// 迁移逻辑: mc_server -> instances/default
const MC_DIR_LEGACY = path.join(BASE_DIR, 'mc_server');
if (fs.existsSync(MC_DIR_LEGACY) && fs.statSync(MC_DIR_LEGACY).isDirectory()) {
    const defaultInstanceDir = path.join(INSTANCES_DIR, 'default');
    if (!fs.existsSync(defaultInstanceDir)) {
        console.log('检测到旧版服务器目录，正在迁移至实例 "default"...');
        try {
            fs.moveSync(MC_DIR_LEGACY, defaultInstanceDir);
            let instData = loadInstances();
            if (!instData.instances.find(i => i.id === 'default')) {
                instData.instances.push({
                    id: 'default',
                    name: '默认服务器',
                    dir: 'instances/default',
                    jarName: appConfig.jarName,
                    javaArgs: appConfig.javaArgs,
                    javaPath: appConfig.javaPath,
                    createdAt: new Date().toISOString()
                });
                instData.activeInstanceId = 'default';
                saveInstances(instData);
            }
            console.log('✅ 迁移完成。');
        } catch (e) {
            console.error('❌ 迁移失败:', e.message);
        }
    }
}

// 确保至少有一个实例
let instanceConfig = loadInstances();
if (instanceConfig.instances.length === 0) {
    const defaultDir = path.join(INSTANCES_DIR, 'default');
    fs.ensureDirSync(defaultDir);
    instanceConfig.instances.push({
        id: 'default',
        name: '默认服务器',
        dir: 'instances/default',
        jarName: appConfig.jarName,
        javaArgs: appConfig.javaArgs,
        javaPath: appConfig.javaPath,
        createdAt: new Date().toISOString()
    });
    instanceConfig.activeInstanceId = 'default';
    saveInstances(instanceConfig);
}
// -----------------------
// PID 文件
const PID_FILE = path.join(DATA_DIR, 'panel.pid');

// Helper: 从 argv 中过滤出用户传入的命令（排除 node / .js / caxa 路径）
const getUserArgs = () => {
    return process.argv.filter(arg => {
        if (!arg) return false;
        const b = path.basename(arg).toLowerCase();
        if (b.startsWith('node')) return false;
        if (b.endsWith('.js') || b.endsWith('.cjs') || b.endsWith('.mjs')) return false;
        // Skip the executable itself
        if (APP_EXECUTABLE && path.resolve(arg) === APP_EXECUTABLE) return false;
        // Skip caxa temp paths
        if (arg.includes('/caxa/') || arg.includes('\\caxa\\')) return false;
        return true;
    });
};

// Helper: 检查 PID 是否存活
const isPidAlive = (pid) => {
    try { process.kill(pid, 0); return true; } catch (e) { return false; }
};

// Helper: 读取 PID
const readPid = () => {
    try {
        if (fs.existsSync(PID_FILE)) {
            const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
            if (pid && !isNaN(pid)) return pid;
        }
    } catch (e) { }
    return null;
};

// Helper: 写入 PID
const writePid = () => {
    fs.ensureDirSync(DATA_DIR);
    fs.writeFileSync(PID_FILE, String(process.pid));
};

// Helper: 清理 PID
const cleanPid = () => {
    try { if (fs.existsSync(PID_FILE)) fs.removeSync(PID_FILE); } catch (e) { }
};

// --- CLI 命令解析 ---
const userArgs = getUserArgs();
const command = (userArgs[0] || '').toLowerCase();

// 不需要启动面板的命令：host / reset / stop / restart / help
if (command === 'host') {
    const newPort = parseInt(userArgs[1], 10);
    if (!newPort || newPort < 1024 || newPort > 65535) {
        console.log('用法: ./mc-web-panel host <端口号>');
        console.log('端口范围: 1024 - 65535');
        process.exit(1);
    }
    fs.ensureDirSync(DATA_DIR);
    let config = fs.existsSync(CONFIG_FILE) ? fs.readJsonSync(CONFIG_FILE) : {};
    config.port = newPort;
    fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
    console.log(`✅ 面板端口已更改为 ${newPort}`);
    console.log('如果面板正在运行，请执行 restart 使其生效。');
    process.exit(0);
}

if (command === 'reset') {
    fs.ensureDirSync(DATA_DIR);
    let config = fs.existsSync(CONFIG_FILE) ? fs.readJsonSync(CONFIG_FILE) : {};
    const newSecret = authenticator.generateSecret();
    config.secret = newSecret;
    fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
    const otpauth = authenticator.keyuri('Admin', 'MC-Panel', newSecret);
    console.log('✅ 2FA 密钥已重置！');
    console.log('');
    console.log(`  新密钥: ${newSecret}`);
    console.log(`  OTPAuth URI: ${otpauth}`);
    console.log('');
    console.log('请使用 Google Authenticator 或其他 TOTP 应用扫描以上信息。');
    process.exit(0);
}

if (command === 'stop') {
    const pid = readPid();
    if (!pid) {
        console.log('面板未在运行（未找到 PID 文件）。');
        process.exit(0);
    }
    if (!isPidAlive(pid)) {
        console.log(`PID ${pid} 已不存在，清理残留文件...`);
        cleanPid();
        process.exit(0);
    }
    console.log(`正在停止面板 (PID: ${pid})...`);
    try {
        process.kill(pid, 'SIGTERM');
        let waited = 0;
        const check = () => {
            if (!isPidAlive(pid)) {
                cleanPid();
                console.log('✅ 面板已停止。');
                process.exit(0);
            }
            waited += 500;
            if (waited > 10000) {
                console.log('⚠️ 进程未响应，强制终止...');
                try { process.kill(pid, 'SIGKILL'); } catch (e) { }
                cleanPid();
                process.exit(0);
            }
            setTimeout(check, 500);
        };
        setTimeout(check, 500);
    } catch (e) {
        console.error('停止失败:', e.message);
        cleanPid();
        process.exit(1);
    }
    return;
} else if (command === 'restart') {
    const pid = readPid();
    if (pid && isPidAlive(pid)) {
        console.log(`正在停止面板 (PID: ${pid})...`);
        try { process.kill(pid, 'SIGTERM'); } catch (e) { }
        // Wait for it to die then start
        let waited = 0;
        const check = () => {
            if (!isPidAlive(pid) || waited > 10000) {
                if (waited > 10000) {
                    try { process.kill(pid, 'SIGKILL'); } catch (e) { }
                }
                cleanPid();
                console.log('旧进程已停止，正在启动...');
                doStart();
            } else {
                waited += 500;
                setTimeout(check, 500);
            }
        };
        setTimeout(check, 500);
        return;
    } else {
        console.log('面板未在运行，直接启动...');
        doStart();
    }
} else if (command === 'help' || command === '--help' || command === '-h') {
    const name = APP_EXECUTABLE ? path.basename(APP_EXECUTABLE) : 'mc-web-panel';
    console.log(`MC Web Panel v${APP_VERSION}`);
    console.log('');
    console.log('用法:');
    console.log(`  ./${name} [命令]`);
    console.log('');
    console.log('命令:');
    console.log('  start          启动面板（后台运行，默认）');
    console.log('  stop           停止面板');
    console.log('  restart        重启面板');
    console.log('  host <端口>    修改面板端口');
    console.log('  reset          重置 2FA 密钥');
    console.log('  help           显示帮助');
    process.exit(0);
} else {
    // start 命令（默认行为）
    doStart();
}

function doStart() {
    if (_isDaemon) return;
    if (!APP_EXECUTABLE) {
        // 开发环境，直接前台运行
        console.log('开发环境，前台启动面板...');
        return; // 继续执行后续 cluster 逻辑
    }
    const existingPid = readPid();
    if (existingPid && isPidAlive(existingPid)) {
        console.log(`面板已在运行 (PID: ${existingPid})。如需重启请使用 restart 命令。`);
        process.exit(0);
    }
    if (existingPid) cleanPid(); // stale PID file
    // 以 daemon 模式后台启动
    const child = spawn(APP_EXECUTABLE, ['--daemon'], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(APP_EXECUTABLE)
    });
    child.on('error', (err) => {
        console.error('启动失败:', err.message);
        process.exit(1);
    });
    child.unref();
    console.log(`✅ 面板已在后台启动 (PID: ${child.pid})`);
    console.log(`   访问地址: http://localhost:${(fs.existsSync(CONFIG_FILE) ? fs.readJsonSync(CONFIG_FILE).port : null) || 3000}`);
    console.log(`   停止: ./${path.basename(APP_EXECUTABLE)} stop`);
    process.exit(0);
}



// 如果是 start 命令或无参数，决定是否后台启动
if (command === 'start' || command === '') {
    if (command === 'start' || (APP_EXECUTABLE && !userArgs.includes('--daemon'))) {
        // 非 daemon 模式 → 后台启动
        doStart();
        // doStart() 会 process.exit(0) 除非是开发环境
    }
    // --daemon 或开发环境 → 继续执行 cluster 逻辑
}

// --- 以下为面板实际运行逻辑 ---
if (cluster.isPrimary) {
    writePid();
    console.log(`Master ${process.pid} is running`);

    let restartingMaster = false;

    const forkWorker = () => {
        const worker = cluster.fork();
        worker.on('exit', (code, signal) => {
            if (restartingMaster) return; // Don't fork during restart_master
            if (code === 100) {
                console.log('Worker requested restart. Restarting...');
                forkWorker();
            } else {
                console.log(`Worker stopped with code ${code || signal}`);
                cleanPid();
                process.exit(code || 0);
            }
        });

        worker.on('message', (msg) => {
            if (msg.type === 'restart_master') {
                restartingMaster = true;
                console.log('Received restart_master signal. Restarting entire panel...');
                if (APP_EXECUTABLE) {
                    const { spawn } = require('child_process');
                    const spawnCwd = path.dirname(APP_EXECUTABLE);
                    console.log(`Spawning new process: ${APP_EXECUTABLE} in ${spawnCwd}`);
                    cleanPid();
                    const child = spawn(APP_EXECUTABLE, ['--daemon'], {
                        detached: true,
                        stdio: 'ignore',
                        cwd: spawnCwd
                    });
                    child.on('error', (err) => {
                        console.error('Failed to spawn new process:', err);
                    });
                    child.unref();
                    setTimeout(() => process.exit(0), 500);
                } else {
                    process.exit(0);
                }
            }
        });
    };

    forkWorker();

    // Handle signals to kill worker gracefully
    const cleanup = () => {
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
        cleanPid();
        process.exit();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

} else {
    // Worker Process Logic
    const upload = multer({ dest: path.join(os.tmpdir(), 'mc-uploads') });

    console.log(`Initializing Data Directories...`);
    console.log(`  INSTANCES_DIR: ${INSTANCES_DIR}`);
    console.log(`  DATA_DIR: ${DATA_DIR}`);
    fs.ensureDirSync(INSTANCES_DIR);
    fs.ensureDirSync(DATA_DIR);

    // (Moved to top level)
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    const instancesState = new Map(); // Store runtime state for each instance

    const getOrCreateInstanceState = (instanceId) => {
        if (!instancesState.has(instanceId)) {
            instancesState.set(instanceId, {
                process: null,
                onlinePlayers: new Set(),
                logHistory: [],
                detectedVersion: { mc: 'Unknown', loader: 'Unknown' }
            });
        }
        return instancesState.get(instanceId);
    };

    const getInstanceDir = (instanceId) => {
        const inst = instanceConfig.instances.find(i => i.id === instanceId);
        return inst ? path.join(BASE_DIR, inst.dir) : null;
    };

    const withInstance = (req, res, next) => {
        const instanceId = (req.query && req.query.instanceId) || (req.body && req.body.instanceId) || instanceConfig.activeInstanceId || 'default';
        const instDir = getInstanceDir(instanceId);
        if (!instDir) return res.status(404).json({ error: '实例不存在' });

        req.instanceId = instanceId;
        req.instDir = instDir;
        req.instState = getOrCreateInstanceState(instanceId);
        next();
    };

    // Initialize all existing instances state
    instanceConfig.instances.forEach(inst => getOrCreateInstanceState(inst.id));

    let MAX_LOG_HISTORY = appConfig.maxLogHistory || 1000;
    let globalJavaVersion = '';

    // Helper: Resolve Java Binary Path (appends bin/java if needed)
    const resolveJavaPath = (inputPath) => {
        if (!inputPath) return '';
        try {
            if (fs.existsSync(inputPath) && fs.statSync(inputPath).isFile()) return inputPath;
            const binJava = path.join(inputPath, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
            if (fs.existsSync(binJava)) return binJava;
        } catch (e) { }
        return inputPath;
    };

    // Helper: Check Java Version
    const checkJavaVersion = async (rawPath) => {
        const javaPath = resolveJavaPath(rawPath);
        return new Promise((resolve) => {
            const process = spawn(javaPath, ['-version']);
            let output = '';
            process.stderr.on('data', (d) => output += d.toString());
            process.on('error', () => resolve('Not Installed'));
            process.on('close', () => {
                const match = output.match(/version "([^"]+)"/) || output.match(/version (\S+)/);
                resolve(match ? match[1] : 'Unknown');
            });
        });
    };

    // Periodic Java Version Check
    const updateJavaVersion = async () => {
        globalJavaVersion = await checkJavaVersion(appConfig.javaPath);
    };
    updateJavaVersion(); // Initial check
    setInterval(updateJavaVersion, 60000); // Check every minute

    if (fs.existsSync(LOG_FILE)) {
        try {
            const data = fs.readFileSync(LOG_FILE, 'utf8');
            const lines = data.slice(-50000).split('\n');
            logHistory = lines.slice(-MAX_LOG_HISTORY);
        } catch (e) { }
    }

    const appendLog = (instanceId, msg) => {
        const state = getOrCreateInstanceState(instanceId);
        state.logHistory.push(msg);
        if (state.logHistory.length > MAX_LOG_HISTORY) state.logHistory.shift();

        // Emit to instance-specific channel
        io.emit(`console:${instanceId}`, msg);
        // For backward compatibility with single-instance frontend (temp) 
        if (instanceId === instanceConfig.activeInstanceId) io.emit('console', msg);

        const instDir = getInstanceDir(instanceId);
        if (instDir) {
            fs.appendFile(path.join(instDir, 'panel.log'), msg, () => { });
        }
    };

    app.use(express.static(path.join(__dirname, 'public')));
    app.use(bodyParser.json());
    app.use(session({
        secret: appConfig.sessionSecret,
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: appConfig.sessionTimeout * 24 * 60 * 60 * 1000 }
    }));

    const requireAuth = (req, res, next) => {
        if (req.session.authenticated) return next();
        res.status(401).json({ error: '未授权' });
    };

    io.on('connection', (socket) => {
        socket.on('req_history', (instanceId) => {
            const id = instanceId || instanceConfig.activeInstanceId;
            const state = getOrCreateInstanceState(id);
            socket.emit(instanceId ? `console_history:${instanceId}` : 'console_history', state.logHistory);
        });
    });

    // --- 监控 ---
    setInterval(async () => {
        if (io.engine.clientsCount > 0) {
            try {
                const load = await si.currentLoad();
                const mem = await si.mem();
                const systemStats = {
                    cpu: load.currentLoad.toFixed(1),
                    mem: {
                        total: (mem.total / 1024 / 1024 / 1024).toFixed(1),
                        used: (mem.active / 1024 / 1024 / 1024).toFixed(1),
                        percentage: ((mem.active / mem.total) * 100).toFixed(1)
                    }
                };

                const allInstancesStatus = [];

                for (const inst of instanceConfig.instances) {
                    const state = getOrCreateInstanceState(inst.id);
                    const instDir = getInstanceDir(inst.id);

                    let versionInfo = { mc: 'Unknown', loader: 'Unknown' };
                    let serverInfo = { port: '25565', maxPlayers: '20', motd: 'Loading...' };
                    let hasBackupMod = false, hasEasyAuth = false, hasVoicechat = false;
                    let isSetup = false;
                    let hasIcon = false;

                    if (instDir && fs.existsSync(instDir)) {
                        const dirEntries = fs.readdirSync(instDir);
                        isSetup = dirEntries.length > 2;

                        // Version
                        try {
                            const vFile = path.join(instDir, 'server-version.json');
                            if (fs.existsSync(vFile)) {
                                const vData = await fs.readJson(vFile);
                                versionInfo = { mc: vData.gameVersion, loader: vData.loaderVersion };
                            } else if (state.detectedVersion.mc !== 'Unknown') {
                                versionInfo = state.detectedVersion;
                            }
                        } catch (e) { }

                        // Properties
                        const propsFile = path.join(instDir, 'server.properties');
                        if (fs.existsSync(propsFile)) {
                            try {
                                const props = PropertiesReader(propsFile);
                                serverInfo.port = props.get('server-port') || '25565';
                                serverInfo.maxPlayers = props.get('max-players') || '20';
                                serverInfo.motd = props.get('motd') || 'Minecraft Server';
                            } catch (e) { }
                        }

                        // Mods
                        const modsDir = path.join(instDir, 'mods');
                        if (fs.existsSync(modsDir)) {
                            try {
                                const modFiles = fs.readdirSync(modsDir).map(f => f.toLowerCase());
                                hasBackupMod = modFiles.some(f => f.includes('advancedbackups') || f.includes('advanced-backups') || f.includes('advanced_backups'));
                                hasEasyAuth = modFiles.some(f => f.includes('easyauth') || f.includes('easy-auth') || f.includes('easy_auth'));
                                hasVoicechat = modFiles.some(f => f.includes('voicechat') || f.includes('voice-chat') || f.includes('voice_chat'));
                            } catch (e) { }
                        }
                        // Check for icon
                        const iconFile = path.join(instDir, 'server-icon.png');
                        hasIcon = fs.existsSync(iconFile);

                    }

                    const instStatus = {
                        id: inst.id,
                        name: inst.name,
                        isRunning: !!state.process,
                        onlinePlayers: state.onlinePlayers.size,
                        maxPlayers: serverInfo.maxPlayers,
                        port: serverInfo.port,
                        motd: serverInfo.motd,
                        version: versionInfo,
                        jarName: inst.jarName,
                        javaArgs: inst.javaArgs,
                        javaPath: inst.javaPath,
                        hasBackupMod, hasEasyAuth, hasVoicechat,
                        isSetup,
                        hasIcon
                    };
                    allInstancesStatus.push(instStatus);

                    // Emit per-instance status
                    io.emit(`status:${inst.id}`, instStatus);
                }

                // Global update for instance manager
                io.emit('instances_update', allInstancesStatus);

                // Backward compatibility: emit system_stats based on active instance
                const activeId = instanceConfig.activeInstanceId || 'default';
                const activeStatus = allInstancesStatus.find(s => s.id === activeId) || allInstancesStatus[0];

                io.emit('system_stats', {
                    ...systemStats,
                    mc: { port: activeStatus.port, maxPlayers: activeStatus.maxPlayers, motd: activeStatus.motd, online: activeStatus.onlinePlayers },
                    version: activeStatus.version,
                    hasBackupMod: activeStatus.hasBackupMod,
                    hasEasyAuth: activeStatus.hasEasyAuth,
                    hasVoicechat: activeStatus.hasVoicechat,
                    isSetup: activeStatus.isSetup,
                    javaVersion: globalJavaVersion || 'Checking...',
                    isRunning: activeStatus.isRunning
                });

            } catch (e) { console.error('Monitor loop error:', e); }
        }
    }, appConfig.monitorInterval);

    // --- 多实例管理 API ---
    app.get('/api/instances/list', requireAuth, (req, res) => {
        res.json(instanceConfig.instances);
    });

    app.post('/api/instances/create', requireAuth, async (req, res) => {
        const { name, jarName, javaArgs, javaPath } = req.body;
        if (!name) return res.status(400).json({ error: '实例名称不能为空' });

        const id = crypto.randomBytes(4).toString('hex');
        const dir = `instances/${id}`;
        const absDir = path.join(BASE_DIR, dir);

        try {
            fs.ensureDirSync(absDir);
            instanceConfig.instances.push({
                id, name, dir,
                jarName: jarName || appConfig.jarName,
                javaArgs: javaArgs || appConfig.javaArgs,
                javaPath: javaPath || appConfig.javaPath,
                createdAt: new Date().toISOString()
            });
            saveInstances(instanceConfig);
            getOrCreateInstanceState(id); // 初始化状态
            res.json({ success: true, instance: { id, name } });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/instances/update', requireAuth, (req, res) => {
        const { id, name, jarName, javaArgs, javaPath } = req.body;
        const inst = instanceConfig.instances.find(i => i.id === id);
        if (!inst) return res.status(404).json({ error: '实例不存在' });

        if (name) inst.name = name;
        if (jarName) inst.jarName = jarName;
        if (javaArgs) inst.javaArgs = javaArgs;
        if (javaPath) inst.javaPath = javaPath;

        saveInstances(instanceConfig);
        res.json({ success: true });
    });

    app.post('/api/instances/select', requireAuth, (req, res) => {
        const { id } = req.body;
        if (!instanceConfig.instances.find(i => i.id === id)) return res.status(404).json({ error: '实例不存在' });
        instanceConfig.activeInstanceId = id;
        saveInstances(instanceConfig);
        res.json({ success: true });
    });

    app.post('/api/instances/rename', requireAuth, (req, res) => {
        const { id, name } = req.body;
        const inst = instanceConfig.instances.find(i => i.id === id);
        if (!inst) return res.status(404).json({ error: '实例不存在' });
        inst.name = name;
        saveInstances(instanceConfig);
        res.json({ success: true });
    });

    app.post('/api/instances/delete', requireAuth, async (req, res) => {
        const { id } = req.body;
        if (instanceConfig.instances.length <= 1) {
            return res.status(400).json({ error: '无法删除最后一个实例' });
        }

        const index = instanceConfig.instances.findIndex(i => i.id === id);
        if (index === -1) return res.status(404).json({ error: '实例不存在' });

        const state = instancesState.get(id);
        if (state && state.process) return res.status(400).json({ error: '服务器运行中，请先停止' });

        try {
            const inst = instanceConfig.instances[index];
            const absDir = path.join(BASE_DIR, inst.dir);
            await fs.remove(absDir);
            instanceConfig.instances.splice(index, 1);
            if (instanceConfig.activeInstanceId === id) {
                instanceConfig.activeInstanceId = instanceConfig.instances[0]?.id || null;
            }
            saveInstances(instanceConfig);
            instancesState.delete(id);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- Java 版本管理 API ---
    const JAVA_DIR = path.join(DATA_DIR, 'java');
    const JAVA_INSTALLED_FILE = path.join(JAVA_DIR, 'installed.json');
    fs.ensureDirSync(JAVA_DIR);

    // Track active downloads for cancellation
    const activeDownloads = new Map(); // key: featureVersion or 'system_update', value: AbortController

    const readJavaInstalled = () => {
        try { return fs.readJsonSync(JAVA_INSTALLED_FILE); } catch (e) { return { installations: [] }; }
    };
    const writeJavaInstalled = (data) => {
        fs.writeJsonSync(JAVA_INSTALLED_FILE, data, { spaces: 2 });
    };

    // Adoptium API base URLs for different mirrors
    const ADOPTIUM_SOURCES = {
        adoptium: 'https://api.adoptium.net/v3',
        tuna: 'https://mirrors.tuna.tsinghua.edu.cn/Adoptium',
        aliyun: 'https://mirrors.aliyun.com/adoptium'
    };

    // GET /api/java/installed — 已安装的 Java 列表
    app.get('/api/java/installed', requireAuth, (req, res) => {
        const data = readJavaInstalled();
        res.json(data.installations);
    });

    // GET /api/java/available?source=adoptium — 可用 Java 版本
    app.get('/api/java/available', requireAuth, async (req, res) => {
        try {
            const source = req.query.source || 'adoptium';
            const baseUrl = ADOPTIUM_SOURCES[source] || ADOPTIUM_SOURCES.adoptium;
            const arch = os.arch() === 'x64' ? 'x64' : os.arch() === 'arm64' ? 'aarch64' : os.arch();
            const osType = process.platform === 'linux' ? 'linux' : process.platform === 'darwin' ? 'mac' : 'windows';

            // Get available feature versions (LTS: 8, 11, 17, 21)
            const featureVersions = [8, 11, 17, 21, 22];
            const results = [];

            for (const fv of featureVersions) {
                try {
                    const url = `${baseUrl}/assets/latest/${fv}/hotspot?architecture=${arch}&os=${osType}&image_type=jre`;
                    const resp = await axios.get(url, { timeout: 15000 });
                    if (resp.data && resp.data.length > 0) {
                        const asset = resp.data[0];
                        results.push({
                            featureVersion: fv,
                            version: asset.version?.openjdk_version || asset.version?.semver || `${fv}`,
                            releaseName: asset.release_name,
                            downloadUrl: asset.binary?.package?.link,
                            size: asset.binary?.package?.size || 0,
                            checksum: asset.binary?.package?.checksum
                        });
                    }
                } catch (e) {
                    // Skip unavailable versions
                    console.log(`[Java] Version ${fv} not available from ${source}: ${e.message}`);
                }
            }

            res.json({ source, results });
        } catch (e) {
            res.status(500).json({ error: '获取可用版本失败: ' + e.message });
        }
    });

    // POST /api/java/install — 下载并安装 Java
    app.post('/api/java/install', requireAuth, async (req, res) => {
        const { featureVersion, downloadUrl, version, source } = req.body;
        if (!downloadUrl || !featureVersion) return res.status(400).json({ error: '参数不完整' });

        const id = `temurin-${featureVersion}-jre`;
        const installDir = path.join(JAVA_DIR, id);

        // Check if already installed
        const data = readJavaInstalled();
        if (data.installations.find(i => i.id === id)) {
            return res.status(400).json({ error: `Java ${featureVersion} 已安装` });
        }

        res.json({ success: true, message: '开始下载...' });

        const controller = new AbortController();
        activeDownloads.set(`java-${featureVersion}`, controller);

        // Download in background with progress
        try {
            fs.ensureDirSync(installDir);
            const tmpFile = path.join(JAVA_DIR, `${id}.tar.gz`);

            io.emit('java_install_progress', { featureVersion, step: 'downloading', percent: 0, message: '正在下载...' });

            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream',
                timeout: 600000, // 10 min timeout
                signal: controller.signal
            });

            const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;

            const writer = fs.createWriteStream(tmpFile);
            response.data.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                    const percent = Math.round((downloadedBytes / totalBytes) * 80); // 80% for download
                    io.emit('java_install_progress', {
                        featureVersion, step: 'downloading', percent,
                        message: `下载中... ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB`
                    });
                }
            });
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            io.emit('java_install_progress', { featureVersion, step: 'extracting', percent: 85, message: '正在解压...' });

            // Extract
            const { execSync } = require('child_process');
            if (process.platform === 'win32') {
                // Windows: use tar (available since Win10 1803)
                execSync(`tar -xzf "${tmpFile}" -C "${installDir}" --strip-components=1`, { timeout: 120000 });
            } else {
                execSync(`tar -xzf "${tmpFile}" -C "${installDir}" --strip-components=1`, { timeout: 120000 });
            }

            // Clean up archive
            await fs.remove(tmpFile);

            // Detect java binary path
            const javaBin = process.platform === 'win32'
                ? path.join(installDir, 'bin', 'java.exe')
                : path.join(installDir, 'bin', 'java');

            // Make executable on unix
            if (process.platform !== 'win32') {
                try { execSync(`chmod +x "${javaBin}"`); } catch (e) { }
            }

            // Verify
            const detectedVer = await checkJavaVersion(javaBin);

            // Save to installed.json
            data.installations.push({
                id,
                version: detectedVer !== 'Not Installed' ? detectedVer : (version || `${featureVersion}`),
                vendor: 'Eclipse Temurin',
                featureVersion,
                path: installDir,
                javaPath: javaBin,
                source: source || 'adoptium',
                installedAt: new Date().toISOString()
            });
            writeJavaInstalled(data);

            io.emit('java_install_progress', { featureVersion, step: 'done', percent: 100, message: `安装完成! (${detectedVer})` });

        } catch (e) {
            if (axios.isCancel(e)) {
                console.log(`[Java Install] Cancelled: ${featureVersion}`);
                io.emit('java_install_progress', { featureVersion, step: 'error', percent: 0, message: '已取消' });
            } else {
                console.error('[Java Install Error]', e);
                io.emit('java_install_progress', { featureVersion, step: 'error', percent: 0, message: '安装失败: ' + e.message });
            }
            // Cleanup on failure or cancel
            try { await fs.remove(installDir); } catch (cleanErr) { }
            try { await fs.remove(path.join(JAVA_DIR, `${id}.tar.gz`)); } catch (cleanErr) { }
        } finally {
            activeDownloads.delete(`java-${featureVersion}`);
        }
    });

    // POST /api/java/install/cancel
    app.post('/api/java/install/cancel', requireAuth, (req, res) => {
        const { featureVersion } = req.body;
        const key = `java-${featureVersion}`;
        if (activeDownloads.has(key)) {
            activeDownloads.get(key).abort();
            activeDownloads.delete(key);
            res.json({ success: true, message: '已取消' });
        } else {
            res.status(404).json({ error: '没有正在进行的任务' });
        }
    });

    // POST /api/java/remove — 删除已安装的 Java
    app.post('/api/java/remove', requireAuth, async (req, res) => {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: '参数不完整' });

        const data = readJavaInstalled();
        const idx = data.installations.findIndex(i => i.id === id);
        if (idx === -1) return res.status(404).json({ error: '未找到该 Java 版本' });

        const installation = data.installations[idx];

        // Prevent removal if in use (check later for multi-instance)
        try {
            await fs.remove(installation.path);
        } catch (e) {
            return res.status(500).json({ error: '删除目录失败: ' + e.message });
        }

        data.installations.splice(idx, 1);
        writeJavaInstalled(data);
        res.json({ success: true });
    });

    // POST /api/java/add-local — 添加本地 Java 路径
    app.post('/api/java/add-local', requireAuth, async (req, res) => {
        const { javaPath: localPath } = req.body;
        if (!localPath) return res.status(400).json({ error: '参数不完整' });

        const detectedVer = await checkJavaVersion(localPath);
        if (detectedVer === 'Not Installed') {
            return res.status(400).json({ error: '指定路径无法运行 Java: ' + localPath });
        }

        // Parse feature version from detected version
        const fvMatch = detectedVer.match(/^(\d+)/);
        const featureVersion = fvMatch ? parseInt(fvMatch[1]) : 0;

        const id = `local-${Date.now()}`;
        const data = readJavaInstalled();

        // Prevent duplicate paths
        if (data.installations.find(i => i.javaPath === localPath)) {
            return res.status(400).json({ error: '该路径已添加' });
        }

        data.installations.push({
            id,
            version: detectedVer,
            vendor: 'Local',
            featureVersion,
            path: path.dirname(path.dirname(localPath)), // assume bin/java
            javaPath: localPath,
            source: 'local',
            installedAt: new Date().toISOString()
        });
        writeJavaInstalled(data);
        res.json({ success: true, version: detectedVer });
    });

    // GET /api/java/detect — 检测系统 Java
    app.get('/api/java/detect', requireAuth, async (req, res) => {
        const systemVer = await checkJavaVersion('java');
        const { execSync } = require('child_process');
        let systemPath = '';
        try {
            systemPath = execSync('which java 2>/dev/null || where java 2>nul', { encoding: 'utf8' }).trim().split('\n')[0];
        } catch (e) { }
        res.json({ version: systemVer, path: systemPath });
    });

    // GET /api/java/sources — 获取可用下载源列表
    app.get('/api/java/sources', requireAuth, (req, res) => {
        res.json([
            { id: 'adoptium', name: 'Adoptium (Official)', url: ADOPTIUM_SOURCES.adoptium },
            { id: 'tuna', name: '清华大学镜像', url: ADOPTIUM_SOURCES.tuna },
            { id: 'aliyun', name: '阿里云镜像', url: ADOPTIUM_SOURCES.aliyun }
        ]);
    });

    // --- EasyAuth 管理 API (sqlite3 兼容版 - 修复表名) ---

    const dbHelper = {
        open: (path, mode) => {
            return new Promise((resolve, reject) => {
                const db = new sqlite3.Database(path, mode, (err) => {
                    if (err) reject(err);
                    else resolve(db);
                });
            });
        },
        all: (db, sql, params = []) => {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        },
        run: (db, sql, params = []) => {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        },
        close: (db) => {
            return new Promise((resolve, reject) => {
                db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    };

    // 1. 获取玩家列表 (智能适配版)
    app.get('/api/easyauth/users', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const EASYAUTH_DB = path.join(instDir, 'config', 'EasyAuth', 'players.db');
        if (!fs.existsSync(EASYAUTH_DB)) return res.json([]);

        let db;
        try {
            db = await dbHelper.open(EASYAUTH_DB, sqlite3.OPEN_READONLY);

            // 1. 确定表名
            const tables = await dbHelper.all(db, "SELECT name FROM sqlite_master WHERE type='table'");
            const tableNames = tables.map(t => t.name);

            let tableName = '';
            if (tableNames.includes('easyauth')) tableName = 'easyauth';
            else if (tableNames.includes('users')) tableName = 'users';
            else if (tableNames.includes('auth_users')) tableName = 'auth_users';
            else throw new Error(`未找到已知表. 现有: [${tableNames.join(', ')}]`);

            // 2. 探测列结构 (PRAGMA table_info)
            const columnsData = await dbHelper.all(db, `PRAGMA table_info(${tableName})`);
            const columns = columnsData.map(c => c.name);
            console.log(`[EasyAuth Debug] 表名: ${tableName}, 列: [${columns.join(', ')}]`);

            // 3. 动态构建查询字段
            // 适配 name/username
            const nameCol = columns.includes('username') ? 'username' : (columns.includes('name') ? 'name' : null);
            // 适配 id/uuid
            const idCol = columns.includes('id') ? 'id' : (columns.includes('uuid') ? 'uuid' : null);
            // 适配 is_registered (如果没有这列，则手动返回 1)
            const regCol = columns.includes('is_registered') ? 'is_registered' : '1 as is_registered';

            if (!nameCol) throw new Error(`无法识别用户名字段，现有列: ${columns.join(', ')}`);

            // 构造 SQL: SELECT id, username as username, is_registered FROM table
            // 使用 'as username' 确保前端收到的 JSON key 始终是 username
            const sql = `SELECT ${idCol || "'' as id"}, ${nameCol} as username, ${regCol} FROM ${tableName}`;

            const users = await dbHelper.all(db, sql);
            res.json(users);

        } catch (e) {
            console.error('[EasyAuth Error]', e);
            res.status(500).json({ error: 'DB读取失败: ' + e.message });
        } finally {
            if (db) await dbHelper.close(db);
        }
    });

    // 2. 删除玩家 (注销 - 智能适配版)
    app.post('/api/easyauth/delete', requireAuth, withInstance, async (req, res) => {
        const { instDir, instState, instanceId } = req;
        const EASYAUTH_DB = path.join(instDir, 'config', 'EasyAuth', 'players.db');
        const { username } = req.body;
        if (!fs.existsSync(EASYAUTH_DB)) return res.status(404).json({ error: '数据库不存在' });

        let db;
        try {
            db = await dbHelper.open(EASYAUTH_DB, sqlite3.OPEN_READWRITE);

            // 1. 确定表名
            const tables = await dbHelper.all(db, "SELECT name FROM sqlite_master WHERE type='table'");
            const tableNames = tables.map(t => t.name);
            let tableName = '';
            if (tableNames.includes('easyauth')) tableName = 'easyauth';
            else if (tableNames.includes('users')) tableName = 'users';
            else if (tableNames.includes('auth_users')) tableName = 'auth_users';
            else throw new Error('未找到用户表');

            // 2. 探测列名 (确定是 username 还是 name)
            const columnsData = await dbHelper.all(db, `PRAGMA table_info(${tableName})`);
            const columns = columnsData.map(c => c.name);
            const nameCol = columns.includes('username') ? 'username' : (columns.includes('name') ? 'name' : null);

            if (!nameCol) throw new Error('无法识别用户名字段');

            // 3. 执行删除 (使用检测到的列名)
            const result = await dbHelper.run(db, `DELETE FROM ${tableName} WHERE ${nameCol} = ?`, [username]);

            if (result.changes > 0) {
                if (instState.process) instState.process.stdin.write(`kick ${username} 您的认证已被重置\n`);
                appendLog(instanceId, `[EasyAuth] 管理员注销了玩家: ${username}\n`);
                res.json({ success: true });
            } else {
                res.json({ success: false, message: '玩家不存在' });
            }
        } catch (e) {
            console.error('[EasyAuth Delete Error]', e);
            res.status(500).json({ error: '操作失败: ' + e.message });
        } finally {
            if (db) await dbHelper.close(db);
        }
    });

    // 3. 获取配置文件列表 (保持不变)
    app.get('/api/easyauth/configs', requireAuth, withInstance, async (req, res) => {
        const EASYAUTH_CONFIG_DIR = path.join(req.instDir, 'config', 'EasyAuth');
        try {
            if (!fs.existsSync(EASYAUTH_CONFIG_DIR)) return res.json([]);
            const files = await fs.readdir(EASYAUTH_CONFIG_DIR);
            const confFiles = files.filter(f => f.endsWith('.conf') || f.endsWith('.json'));
            res.json(confFiles);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    // 4. 修改玩家密码 (新增)
    app.post('/api/easyauth/password', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const EASYAUTH_DB = path.join(instDir, 'config', 'EasyAuth', 'players.db');
        const { username, password } = req.body;
        if (!password || password.length < 3) return res.status(400).json({ error: '密码太短' });
        if (!fs.existsSync(EASYAUTH_DB)) return res.status(404).json({ error: '数据库不存在' });

        let db;
        try {
            db = await dbHelper.open(EASYAUTH_DB, sqlite3.OPEN_READWRITE);

            // 1. 再次检测表名 (确保兼容性)
            const tables = await dbHelper.all(db, "SELECT name FROM sqlite_master WHERE type='table'");
            const tableNames = tables.map(t => t.name);

            let tableName = '';
            if (tableNames.includes('easyauth')) tableName = 'easyauth';
            else if (tableNames.includes('users')) tableName = 'users';
            else if (tableNames.includes('auth_users')) tableName = 'auth_users';
            else throw new Error('未找到用户表');

            // 2. 探测列名 (适配 username 或 name)
            const columnsData = await dbHelper.all(db, `PRAGMA table_info(${tableName})`);
            const columns = columnsData.map(c => c.name);
            const nameCol = columns.includes('username') ? 'username' : (columns.includes('name') ? 'name' : null);
            if (!nameCol) throw new Error('无法识别用户名字段');

            // 3. 生成 BCrypt 哈希密码
            // Salt rounds 默认为 10，这是 EasyAuth 的标准
            const hashedPassword = await bcrypt.hash(password, 10);

            // 4. 更新数据库
            const result = await dbHelper.run(db, `UPDATE ${tableName} SET password = ? WHERE ${nameCol} = ?`, [hashedPassword, username]);

            if (result.changes > 0) {
                if (instState.process) instState.process.stdin.write(`kick ${username} 管理员修改了您的密码，请使用新密码重新登录\n`);
                appendLog(instanceId, `[EasyAuth] 管理员修改了玩家 ${username} 的密码\n`);
                res.json({ success: true });
            } else {
                res.json({ success: false, message: '玩家不存在或未更新' });
            }
        } catch (e) {
            console.error('[EasyAuth Password Error]', e);
            res.status(500).json({ error: '修改失败: ' + e.message });
        } finally {
            if (db) await dbHelper.close(db);
        }
    });
    // 5. Voicechat Config API
    app.get('/api/voicechat/config', requireAuth, withInstance, async (req, res) => {
        const VOICECHAT_DIR = path.join(req.instDir, 'config', 'voicechat');
        const vcPropFile = path.join(VOICECHAT_DIR, 'voicechat-server.properties');
        try {
            if (!fs.existsSync(vcPropFile)) {
                if (fs.existsSync(VOICECHAT_DIR)) return res.json({ content: '' });
                return res.status(404).json({ error: '配置文件不存在' });
            }
            const content = await fs.readFile(vcPropFile, 'utf8');
            res.json({ content });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/voicechat/save', requireAuth, withInstance, async (req, res) => {
        const VOICECHAT_DIR = path.join(req.instDir, 'config', 'voicechat');
        const vcPropFile = path.join(VOICECHAT_DIR, 'voicechat-server.properties');
        try {
            if (!fs.existsSync(VOICECHAT_DIR)) fs.ensureDirSync(VOICECHAT_DIR);
            await fs.writeFile(vcPropFile, req.body.content);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- 备份管理 API ---

    // 1. 获取备份列表
    app.get('/api/backups/list', requireAuth, withInstance, async (req, res) => {
        const BACKUP_DIFF_DIR = path.join(req.instDir, 'backups', 'differential');
        const BACKUP_SNAP_DIR = path.join(req.instDir, 'backups', 'snapshots');
        try {
            const backups = [];
            const scanDir = async (dir, type) => {
                if (fs.existsSync(dir)) {
                    const files = await fs.readdir(dir);
                    for (const file of files) {
                        if (file.endsWith('.zip')) {
                            const stat = await fs.stat(path.join(dir, file));
                            const isPartial = file.includes('partial');
                            backups.push({
                                name: file,
                                path: path.join(dir, file),
                                folder: type,
                                size: stat.size,
                                mtime: stat.mtime,
                                type: isPartial ? 'partial' : 'full'
                            });
                        }
                    }
                }
            };

            await scanDir(BACKUP_DIFF_DIR, 'differential');
            await scanDir(BACKUP_SNAP_DIR, 'snapshots');
            backups.sort((a, b) => b.mtime - a.mtime);
            res.json(backups);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // 2. 创建备份
    app.post('/api/backups/create', requireAuth, withInstance, (req, res) => {
        const { instState, instanceId } = req;
        if (!instState.process) return res.json({ success: false, message: '服务器未运行，无法创建在线备份' });
        instState.process.stdin.write('backup start\n');
        appendLog(instanceId, '> backup start\n');
        res.json({ success: true, message: '备份指令已发送' });
    });

    // 3. 还原备份
    app.post('/api/backups/restore', requireAuth, withInstance, async (req, res) => {
        const { instState, instDir, instanceId } = req;
        const { filename, folder, type } = req.body;
        const BACKUP_DIFF_DIR = path.join(instDir, 'backups', 'differential');
        const BACKUP_SNAP_DIR = path.join(instDir, 'backups', 'snapshots');
        const WORLD_DIR = path.join(instDir, 'world');

        const sendProgress = (step, total, msg) => {
            io.emit(`restore_progress:${instanceId}`, {
                percent: Math.round((step / total) * 100),
                message: msg
            });
        };

        if (instState.process) {
            instState.process.stdin.write('stop\n');
            appendLog(instanceId, '[系统] 正在停止服务器以进行回档...\n');
            sendProgress(10, 100, '正在停止服务器...');

            let checks = 0;
            while (instState.process && checks < 30) {
                await new Promise(r => setTimeout(r, 1000));
                checks++;
            }
            if (instState.process) return res.status(500).json({ error: '服务器无法停止，请手动停止' });
        }

        try {
            const targetZipPath = path.join(folder === 'differential' ? BACKUP_DIFF_DIR : BACKUP_SNAP_DIR, filename);
            if (!fs.existsSync(targetZipPath)) return res.status(404).json({ error: '备份文件不存在' });

            sendProgress(30, 100, '正在备份当前地图...');
            if (fs.existsSync(WORLD_DIR)) {
                const backupName = `world_bak_${Date.now()}`;
                await fs.rename(WORLD_DIR, path.join(instDir, backupName));
                appendLog(instanceId, `[系统] 已将当前存档重命名为 ${backupName}\n`);
            }
            await fs.ensureDir(WORLD_DIR);

            const filesToUnzip = [];
            if (type === 'partial' && folder === 'differential') {
                const allFiles = await fs.readdir(BACKUP_DIFF_DIR);
                const fullBackups = allFiles.filter(f => f.includes('full') && f.endsWith('.zip')).sort();
                let baseBackup = null;
                for (const fb of fullBackups) {
                    if (fb < filename) baseBackup = fb; else break;
                }
                if (baseBackup) filesToUnzip.push(path.join(BACKUP_DIFF_DIR, baseBackup));
            }
            filesToUnzip.push(targetZipPath);

            const totalSteps = filesToUnzip.length;
            for (let i = 0; i < totalSteps; i++) {
                const zipPath = filesToUnzip[i];
                const currentProgress = 50 + Math.round(((i + 1) / totalSteps) * 40);
                sendProgress(currentProgress, 100, `正在解压 (${i + 1}/${totalSteps}): ${path.basename(zipPath)}`);
                appendLog(instanceId, `[系统] 解压中: ${path.basename(zipPath)}...\n`);
                const zip = new AdmZip(zipPath);
                zip.extractAllTo(WORLD_DIR, true);
            }

            sendProgress(100, 100, '回档完成');
            appendLog(instanceId, `[系统] 回档完成！请启动服务器。\n`);
            setTimeout(() => io.emit(`restore_completed:${instanceId}`), 1000);
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            appendLog(instanceId, `[错误] 回档失败: ${e.message}\n`);
            io.emit(`restore_error:${instanceId}`, e.message);
            res.status(500).json({ error: e.message });
        }
    });

    // 4. 删除备份
    app.post('/api/backups/delete', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const { filename, folder } = req.body;
        const BACKUP_DIFF_DIR = path.join(instDir, 'backups', 'differential');
        const BACKUP_SNAP_DIR = path.join(instDir, 'backups', 'snapshots');
        try {
            const targetPath = path.join(folder === 'differential' ? BACKUP_DIFF_DIR : BACKUP_SNAP_DIR, filename);
            const resolvedPath = path.resolve(targetPath);
            if (!resolvedPath.startsWith(path.resolve(BACKUP_DIFF_DIR)) && !resolvedPath.startsWith(path.resolve(BACKUP_SNAP_DIR))) {
                return res.status(403).json({ error: 'Access Denied' });
            }
            if (fs.existsSync(targetPath)) {
                await fs.remove(targetPath);
                res.json({ success: true });
            } else {
                res.status(404).json({ error: '备份文件不存在' });
            }
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- 面板设置 API (新增) ---

    // 1. 获取面板配置
    app.get('/api/panel/config', requireAuth, (req, res) => {
        try {
            // 返回配置,但脱敏处理 secret
            const config = { ...appConfig };
            if (config.secret) {
                config.secret = config.secret.substring(0, 4) + '****' + config.secret.substring(config.secret.length - 4);
            }
            // sessionSecret 不返回给前端，或者是脱敏返回
            if (config.sessionSecret) {
                config.sessionSecret = '***HIDDEN***';
            }
            res.json(config);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 2. 获取可用 JAR 文件列表
    app.get('/api/panel/jars', requireAuth, withInstance, (req, res) => {
        try {
            const files = fs.readdirSync(req.instDir);
            const jars = files.filter(f => f.toLowerCase().endsWith('.jar'));
            res.json(jars);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- 5. Setup API ---
    app.get('/api/setup/status', requireAuth, withInstance, (req, res) => {
        const { instDir } = req;
        try {
            const files = fs.readdirSync(instDir);
            const isSetup = files.length > 2 && (fs.existsSync(path.join(instDir, appConfig.jarName)) || fs.existsSync(path.join(instDir, 'server.jar')));
            res.json({ isSetup });
        } catch (e) {
            res.json({ isSetup: false });
        }
    });

    app.post('/api/setup/reinstall', requireAuth, withInstance, async (req, res) => {
        const { instDir, instState, instanceId } = req;
        try {
            if (instState.process) {
                instState.process.kill();
                instState.process = null;
                io.emit(`status:${instanceId}`, { isRunning: false });
            }

            const files = fs.readdirSync(instDir);
            for (const f of files) {
                await fs.remove(path.join(instDir, f));
            }

            // 3. 更新配置
            appConfig.isSetup = false;
            fs.writeJsonSync(CONFIG_FILE, appConfig, { spaces: 2 });

            io.emit('system_stats', { isSetup: false });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/setup/versions/mc', requireAuth, async (req, res) => {
        try {
            const resp = await axios.get('https://meta.fabricmc.net/v2/versions/game');
            // Filter stable releases or just return all
            const stable = resp.data.filter(v => v.stable).map(v => v.version);
            res.json(stable);
        } catch (e) { res.status(500).json({ error: 'Failed to fetch MC versions' }); }
    });

    app.get('/api/setup/versions/loader/:gameVersion', requireAuth, async (req, res) => {
        try {
            const resp = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${req.params.gameVersion}`);
            // Return unique loader versions
            const loaders = [...new Set(resp.data.map(v => v.loader.version))];
            res.json(loaders);
        } catch (e) { res.status(500).json({ error: 'Failed to fetch Fabric versions' }); }
    });

    app.post('/api/setup/install', requireAuth, withInstance, async (req, res) => {
        const { instDir, instanceId } = req;
        const { gameVersion, loaderVersion } = req.body;
        if (!gameVersion || !loaderVersion) return res.status(400).json({ error: 'Missing version info' });

        const installerUrl = `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/1.0.1/server/jar`;
        const targetJar = path.join(instDir, appConfig.jarName);
        const versionFile = path.join(instDir, 'server-version.json');
        const eulaFile = path.join(instDir, 'eula.txt');

        console.log(`Installing Fabric Server: MC ${gameVersion}, Loader ${loaderVersion}`);
        res.json({ success: true, message: 'Installation started' }); // Async response

        try {
            const writer = fs.createWriteStream(targetJar);
            const response = await axios({
                url: installerUrl,
                method: 'GET',
                responseType: 'stream'
            });

            response.data.pipe(writer);

            writer.on('finish', () => {
                console.log('Download complete.');
                // Write version info
                fs.writeJsonSync(versionFile, { gameVersion, loaderVersion, installDate: new Date() });
                // Auto accept EULA
                fs.writeFileSync(eulaFile, 'eula=true\n');

                appendLog(instanceId, `Installed Fabric Server (${gameVersion} / ${loaderVersion})`);
            });

            writer.on('error', (err) => {
                console.error('Download failed', err);
                appendLog('Installation failed: ' + err.message);
            });

        } catch (e) {
            console.error(e);
            appendLog(instanceId, 'Installation error: ' + e.message);
        }
    });

    // Modrinth API / AI Translate
    app.get('/api/mods/modrinth/search', requireAuth, async (req, res) => {
        const { q, facets, offset, limit, index } = req.query;
        console.log(`[Modrinth Search] q=${q}, facets=${facets}, index=${index}`);
        try {
            const params = { query: q, limit: limit || 20, offset: offset || 0 };
            if (facets) params.facets = facets;
            if (index) params.index = index;

            const response = await axios.get('https://api.modrinth.com/v2/search', {
                params,
                headers: { 'User-Agent': MODRINTH_UA }
            });
            res.json(response.data);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/mods/modrinth/versions', requireAuth, async (req, res) => {
        try {
            const response = await axios.get('https://api.modrinth.com/v2/tag/game_version', {
                headers: { 'User-Agent': MODRINTH_UA }
            });
            res.json(response.data);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/mods/modrinth/project/:id', requireAuth, async (req, res) => {
        try {
            const [project, versions] = await Promise.all([
                axios.get(`https://api.modrinth.com/v2/project/${req.params.id}`, { headers: { 'User-Agent': MODRINTH_UA } }),
                axios.get(`https://api.modrinth.com/v2/project/${req.params.id}/version`, { headers: { 'User-Agent': MODRINTH_UA } })
            ]);
            res.json({ project: project.data, versions: versions.data });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/mods/modrinth/download', requireAuth, withInstance, async (req, res) => {
        const { instDir, instanceId } = req;
        const { url, filename } = req.body;
        if (!url || !filename) return res.status(400).json({ error: 'URL and filename required' });

        const dest = path.join(instDir, 'mods', filename);
        appendLog(instanceId, `Installing mod: ${filename}...`);

        try {
            const response = await axios.get(url, { responseType: 'stream' });
            const writer = fs.createWriteStream(dest);
            response.data.pipe(writer);

            writer.on('finish', () => {
                appendLog(`Successfully installed ${filename}`);
                res.json({ success: true });
            });

            writer.on('error', (err) => {
                console.error('Download failed', err);
                appendLog('Installation failed: ' + err.message);
                res.status(500).json({ error: err.message });
            });

        } catch (e) {
            console.error(e);
            appendLog(instanceId, 'Installation error: ' + e.message);
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/ai/translate', requireAuth, async (req, res) => {
        const { text, targetLang = 'Chinese' } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });
        if (!appConfig.aiKey || !appConfig.aiEndpoint) {
            return res.status(400).json({ error: 'AI_NOT_CONFIGURED', message: 'AI is not configured in Panel Settings' });
        }

        try {
            const endpoint = appConfig.aiEndpoint.endsWith('/') ? appConfig.aiEndpoint : appConfig.aiEndpoint + '/';
            const response = await axios.post(`${endpoint}chat/completions`, {
                model: appConfig.aiModel,
                messages: [
                    { role: 'system', content: `You are a professional translator specializing in Minecraft and software. Translate the following English text to ${targetLang}. Preserve Markdown if present. Only return the translated text.` },
                    { role: 'user', content: text }
                ],
                temperature: 0.3
            }, {
                headers: {
                    'Authorization': `Bearer ${appConfig.aiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const translated = response.data.choices[0]?.message?.content?.trim();
            res.json({ translated });
        } catch (e) {
            console.error('AI Translate error:', e.response?.data || e.message);
            res.status(500).json({
                error: 'AI_TRANSLATE_FAILED',
                message: e.response?.data?.error?.message || e.message
            });
        }
    });

    app.post('/api/panel/ai/test', requireAuth, async (req, res) => {
        const { aiEndpoint, aiKey, aiModel } = req.body;
        if (!aiEndpoint || !aiModel) return res.status(400).json({ error: 'Endpoint and Model required' });

        try {
            const endpoint = aiEndpoint.endsWith('/') ? aiEndpoint : aiEndpoint + '/';
            const response = await axios.post(`${endpoint}chat/completions`, {
                model: aiModel,
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 5
            }, {
                headers: {
                    'Authorization': `Bearer ${aiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            if (response.data.choices) {
                res.json({ success: true });
            } else {
                res.status(500).json({ error: 'Invalid response from AI provider' });
            }
        } catch (e) {
            res.status(500).json({ error: e.response?.data?.error?.message || e.message });
        }
    });


    // --- 本地模组增强 ---
    const modMetadataCache = new Map();
    const fileHashCache = new Map(); // filename:mtime:size -> hash

    const getFileHash = (filePath) => {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha1');
            const stream = fs.createReadStream(filePath);
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    };

    app.get('/api/mods/local/list', requireAuth, withInstance, async (req, res) => {
        const modsDir = path.join(req.instDir, 'mods');
        try {
            if (!fs.existsSync(modsDir)) {
                return res.json([]);
            }

            const files = await fs.readdir(modsDir);
            const jarFiles = files.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));

            const results = [];
            for (const file of jarFiles) {
                const filePath = path.join(modsDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    const cacheKey = `${file}:${stats.mtime.getTime()}:${stats.size}`;
                    const hash = fileHashCache.get(cacheKey);

                    results.push({
                        name: file,
                        size: stats.size,
                        mtime: stats.mtime,
                        isDisabled: file.endsWith('.disabled'),
                        hash: hash || null,
                        metadata: hash ? (modMetadataCache.get(hash) || null) : null
                    });
                } catch (err) {
                    console.error(`[Mods] Error stat file ${file}:`, err.message);
                }
            }

            res.json(results);
        } catch (e) {
            console.error('[Mods] Local mod list error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/mods/local/metadata', requireAuth, withInstance, async (req, res) => {
        const { file } = req.query;
        if (!file) return res.status(400).json({ error: 'File name required' });

        const modsDir = path.join(req.instDir, 'mods');
        const filePath = path.join(modsDir, file);

        try {
            if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

            const stats = await fs.stat(filePath);
            const cacheKey = `${file}:${stats.mtime.getTime()}:${stats.size}`;
            let hash = fileHashCache.get(cacheKey);

            if (!hash) {
                hash = await getFileHash(filePath);
                fileHashCache.set(cacheKey, hash);
            }

            let metadata = modMetadataCache.get(hash);

            if (!metadata) {
                try {
                    const response = await axios.post('https://api.modrinth.com/v2/version_files', {
                        hashes: [hash],
                        algorithm: 'sha1'
                    }, {
                        headers: { 'User-Agent': MODRINTH_UA },
                        timeout: 5000
                    });

                    const metaMap = response.data;
                    if (metaMap[hash]) {
                        const version = metaMap[hash];
                        const projectRes = await axios.get(`https://api.modrinth.com/v2/project/${version.project_id}`, {
                            headers: { 'User-Agent': MODRINTH_UA },
                            timeout: 3000
                        });
                        metadata = {
                            title: projectRes.data.title,
                            icon_url: projectRes.data.icon_url,
                            version: version.version_number,
                            project_id: version.project_id
                        };
                        modMetadataCache.set(hash, metadata);
                    }
                } catch (e) {
                    console.error(`[Mods] Modrinth lookup failed for ${file}:`, e.message);
                }
            }

            res.json({ hash, metadata });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 2. 保存面板配置
    app.post('/api/panel/config', requireAuth, async (req, res) => {
        try {
            const { port, defaultLang, theme, consoleInfoPosition, jarName, javaArgs, sessionTimeout, maxLogHistory, monitorInterval, javaPath, aiEndpoint, aiKey, aiModel } = req.body;

            // 验证配置
            if (port && (port < 1024 || port > 65535)) {
                return res.status(400).json({ error: '端口必须在 1024-65535 之间' });
            }
            if (defaultLang && !['zh', 'en'].includes(defaultLang)) {
                return res.status(400).json({ error: '语言必须是 zh 或 en' });
            }
            if (theme && !['light', 'dark', 'auto'].includes(theme)) {
                return res.status(400).json({ error: '主题必须是 light, dark 或 auto' });
            }
            if (jarName && !jarName.endsWith('.jar')) {
                return res.status(400).json({ error: 'JAR文件名必须以 .jar 结尾' });
            }
            if (sessionTimeout && (sessionTimeout < 1 || sessionTimeout > 365)) {
                return res.status(400).json({ error: '会话超时必须在 1-365 天之间' });
            }
            if (maxLogHistory && (maxLogHistory < 100 || maxLogHistory > 10000)) {
                return res.status(400).json({ error: '日志历史条数必须在 100-10000 之间' });
            }
            if (monitorInterval && (monitorInterval < 1000 || monitorInterval > 10000)) {
                return res.status(400).json({ error: '监控刷新间隔必须在 1000-10000ms 之间' });
            }
            if (consoleInfoPosition && !['top', 'sidebar', 'hide'].includes(consoleInfoPosition)) {
                return res.status(400).json({ error: '无效的控制台信息展示位置' });
            }

            // 更新配置
            if (port !== undefined) appConfig.port = port;
            if (defaultLang !== undefined) appConfig.defaultLang = defaultLang;
            if (theme !== undefined) appConfig.theme = theme;
            if (jarName !== undefined) appConfig.jarName = jarName;
            if (javaArgs !== undefined) appConfig.javaArgs = javaArgs;
            if (sessionTimeout !== undefined) appConfig.sessionTimeout = sessionTimeout;
            if (maxLogHistory !== undefined) appConfig.maxLogHistory = maxLogHistory;
            if (monitorInterval !== undefined) appConfig.monitorInterval = monitorInterval;
            if (javaPath !== undefined) appConfig.javaPath = javaPath;
            if (aiEndpoint !== undefined) appConfig.aiEndpoint = aiEndpoint;
            if (aiKey !== undefined) appConfig.aiKey = aiKey;
            if (aiModel !== undefined) appConfig.aiModel = aiModel;
            if (consoleInfoPosition !== undefined) appConfig.consoleInfoPosition = consoleInfoPosition;

            // 保存到文件
            await fs.writeJson(CONFIG_FILE, appConfig, { spaces: 2 });

            res.json({ success: true, message: '配置已保存,需要重启面板才能生效' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 3. 重置 2FA
    app.get('/api/panel/2fa/generate', requireAuth, async (req, res) => {
        try {
            const secret = authenticator.generateSecret();
            const otpauth = authenticator.keyuri('Admin', 'MC-Panel', secret);
            QRCode.toDataURL(otpauth, (err, qr) => {
                if (err) throw err;
                res.json({ secret, qr });
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/panel/2fa/verify', requireAuth, async (req, res) => {
        const { secret, token } = req.body;
        try {
            if (!authenticator.check(token, secret)) return res.status(400).json({ error: 'Invalid Code' });
            appConfig.secret = secret;
            await fs.writeJson(CONFIG_FILE, appConfig, { spaces: 2 });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // 4. 重启面板
    // 4. 重启面板
    app.post('/api/panel/restart', requireAuth, (req, res) => {
        res.json({ success: true, message: '面板正在重启...' });
        setTimeout(() => {
            // Exit with 100 to signal master to restart this worker
            process.exit(100);
        }, 1000);
    });

    // --- 原有 API (保持不变) ---
    app.get('/api/auth/check', (req, res) => {
        let isSetup = false;
        try {
            const instId = instanceConfig.activeInstanceId || 'default';
            const instDir = getInstanceDir(instId);
            isSetup = fs.readdirSync(instDir).length > 2;
        } catch (e) { }
        res.json({
            isSetup,
            authenticated: !!req.session.authenticated,
            has2FA: !!appConfig.secret
        });
    });
    app.get('/api/auth/qr', (req, res) => {
        // If no secret is set, generate a temporary one for the session
        let secret = appConfig.secret;
        if (!secret) {
            if (!req.session.tempSecret) req.session.tempSecret = authenticator.generateSecret();
            secret = req.session.tempSecret;
        }
        QRCode.toDataURL(authenticator.keyuri('Admin', 'MC-Panel', secret), (err, url) => {
            res.json({ qr: url, secret: secret });
        });
    });

    app.post('/api/auth/login', (req, res) => {
        const { token } = req.body;
        let secret = appConfig.secret;
        let isFirstSetup = false;

        if (!secret && req.session.tempSecret) {
            secret = req.session.tempSecret;
            isFirstSetup = true;
        }

        if (secret && authenticator.check(token, secret)) {
            req.session.authenticated = true;
            if (isFirstSetup) {
                appConfig.secret = secret;
                appConfig.isSetup = true;
                fs.writeJsonSync(CONFIG_FILE, appConfig, { spaces: 2 });
                delete req.session.tempSecret;
            } else if (!appConfig.isSetup) {
                appConfig.isSetup = true;
                fs.writeJsonSync(CONFIG_FILE, appConfig, { spaces: 2 });
            }
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    });
    app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

    // 服务器控制
    app.get('/api/server/status', requireAuth, withInstance, (req, res) => res.json({ running: !!req.instState.process, onlinePlayers: Array.from(req.instState.onlinePlayers) }));

    // Server Icon API
    app.get('/api/server/icon', withInstance, (req, res) => {
        const iconPath = path.join(req.instDir, 'server-icon.png');
        if (fs.existsSync(iconPath)) res.sendFile(iconPath);
        else res.status(404).send('No icon');
    });
    app.post('/api/server/icon', requireAuth, withInstance, upload.single('icon'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file' });
            await fs.move(req.file.path, path.join(req.instDir, 'server-icon.png'), { overwrite: true });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.delete('/api/server/icon', requireAuth, withInstance, async (req, res) => {
        try {
            await fs.remove(path.join(req.instDir, 'server-icon.png'));
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });


    app.post('/api/server/start', requireAuth, withInstance, async (req, res) => {
        const { instState, instDir, instanceId } = req;
        if (instState.process) return res.json({ message: '已运行' });

        const instConf = instanceConfig.instances.find(i => i.id === instanceId);
        const rawJavaPath = instConf.javaPath || appConfig.javaPath;
        const javaPath = resolveJavaPath(rawJavaPath);
        const javaArgs = instConf.javaArgs || appConfig.javaArgs;
        const jarName = instConf.jarName || appConfig.jarName;

        const javaVer = await checkJavaVersion(javaPath);
        if (javaVer === 'Not Installed') {
            appendLog(instanceId, `[错误] Java 未找到: ${javaPath}\n`);
            return res.json({ success: false, message: `Java 未安装或二进制文件未找到: ${javaPath}` });
        }

        const eulaPath = path.join(instDir, 'eula.txt');
        try { if (!await fs.pathExists(eulaPath) || !(await fs.readFile(eulaPath, 'utf8')).includes('eula=true')) await fs.writeFile(eulaPath, 'eula=true'); } catch (e) { }

        instState.onlinePlayers.clear();
        appendLog(instanceId, '[系统] --- 正在启动服务器 ---\n');
        appendLog(instanceId, `[系统] 使用 Java: ${javaPath} (版本: ${javaVer})\n`);

        try {
            instState.process = spawn(javaPath, [...javaArgs, '-jar', jarName, 'nogui'], { cwd: instDir });

            instState.process.stdout.on('data', (data) => {
                const line = data.toString();
                appendLog(instanceId, line);
                const join = line.match(/:\s(\w+)\sjoined the game/);
                if (join) {
                    instState.onlinePlayers.add(join[1]);
                    io.emit(`players_update:${instanceId}`, Array.from(instState.onlinePlayers));
                }
                const leave = line.match(/:\s(\w+)\sleft the game/);
                if (leave) {
                    instState.onlinePlayers.delete(leave[1]);
                    io.emit(`players_update:${instanceId}`, Array.from(instState.onlinePlayers));
                }

                // Auto-detect Version
                if (instState.detectedVersion.mc === 'Unknown') {
                    const vanillaMatch = line.match(/Starting minecraft server version (\S+)/);
                    if (vanillaMatch) instState.detectedVersion.mc = vanillaMatch[1];
                    const fabricMatch = line.match(/Loading Minecraft (\S+) with Fabric Loader (\S+)/);
                    if (fabricMatch) {
                        instState.detectedVersion.mc = fabricMatch[1];
                        instState.detectedVersion.loader = fabricMatch[2];
                    }
                }
            });

            instState.process.stderr.on('data', d => appendLog(instanceId, d.toString()));

            instState.process.on('error', (err) => {
                appendLog(instanceId, `[严重错误] 启动失败: ${err.message}\n`);
                io.emit(`status:${instanceId}`, { isRunning: false });
                instState.process = null;
            });

            instState.process.on('close', (code) => {
                appendLog(instanceId, `[系统] --- 服务器已停止 (Code ${code}) ---\n`);
                io.emit(`status:${instanceId}`, { isRunning: false });
                instState.onlinePlayers.clear();
                io.emit(`players_update:${instanceId}`, []);
                instState.process = null;
            });

            io.emit(`status:${instanceId}`, { isRunning: true });
            res.json({ success: true });
        } catch (e) {
            appendLog(instanceId, `[错误] 启动异常: ${e.message}\n`);
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/api/server/stop', requireAuth, withInstance, (req, res) => {
        if (req.instState.process) req.instState.process.stdin.write('stop\n');
        res.json({ success: true });
    });
    app.post('/api/server/command', requireAuth, withInstance, (req, res) => {
        if (req.instState.process) {
            req.instState.process.stdin.write(req.body.command + '\n');
            appendLog(req.instanceId, `> ${req.body.command}\n`);
        }
        res.json({ success: true });
    });

    // 文件管理
    app.get('/api/files/list', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const targetPath = path.join(instDir, req.query.path || '');
        if (!targetPath.startsWith(instDir)) return res.status(403).send('Denied');
        try {
            if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Folder not found' });
            const files = await fs.readdir(targetPath);
            const fileStats = await Promise.all(files.map(async f => {
                try {
                    const stat = await fs.stat(path.join(targetPath, f));
                    return { name: f, isDir: stat.isDirectory(), size: stat.size, isDisabled: f.endsWith('.disabled'), mtime: stat.mtime };
                } catch (e) { return null; }
            }));
            res.json(fileStats.filter(f => f));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });


    // Helper: Fix Multer filename encoding
    const fixFileName = (name) => Buffer.from(name, 'latin1').toString('utf8');

    app.post('/api/files/upload', requireAuth, withInstance, upload.array('files'), async (req, res) => {
        const { instDir } = req;
        const targetDir = req.body.path ? path.join(instDir, req.body.path) : instDir;
        if (!targetDir.startsWith(instDir)) return res.status(403).json({ error: 'Access Denied' });
        try {
            for (const file of req.files) await fs.move(file.path, path.join(targetDir, fixFileName(file.originalname)), { overwrite: true });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/operate', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const { action, sources, destination, compressName } = req.body;
        const destPath = destination ? path.join(instDir, destination) : instDir;
        if (!destPath.startsWith(instDir)) return res.status(403).json({ error: 'Access Denied' });

        try {
            if (action === 'delete') {
                for (const src of sources) {
                    const p = path.join(instDir, src);
                    if (!p.startsWith(instDir)) throw new Error('Access Denied');
                    await fs.remove(p);
                }
            }
            else if (action === 'move' || action === 'copy') {
                for (const src of sources) {
                    const srcPath = path.join(instDir, src);
                    if (!srcPath.startsWith(instDir)) throw new Error('Access Denied');

                    const finalDest = path.join(destPath, path.basename(src));
                    if (!finalDest.startsWith(instDir)) throw new Error('Access Denied');

                    if (action === 'move') await fs.move(srcPath, finalDest, { overwrite: true });
                    else await fs.copy(srcPath, finalDest, { overwrite: true });
                }
            }
            else if (action === 'compress') {
                const archive = archiver('zip', { zlib: { level: 9 } });
                const output = fs.createWriteStream(path.join(destPath, compressName || `archive_${Date.now()}.zip`));
                archive.pipe(output);
                for (const src of sources) {
                    const srcPath = path.join(instDir, src);
                    if (!srcPath.startsWith(instDir)) continue;
                    if ((await fs.stat(srcPath)).isDirectory()) archive.directory(srcPath, path.basename(srcPath));
                    else archive.file(srcPath, { name: path.basename(srcPath) });
                }
                await archive.finalize();
            }
            else if (action === 'disable') {
                for (const src of sources) {
                    const p = path.join(instDir, src);
                    if (!p.startsWith(instDir)) continue;
                    if (!src.endsWith('.disabled')) await fs.rename(p, p + '.disabled');
                }
            }
            else if (action === 'enable') {
                for (const src of sources) {
                    if (src.endsWith('.disabled')) {
                        const newPath = src.slice(0, -9);
                        const p = path.join(instDir, src);
                        const np = path.join(instDir, newPath);
                        if (!p.startsWith(instDir) || !np.startsWith(instDir)) continue;

                        await fs.rename(p, np);
                    }
                }
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/rename', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const { oldPath, newPath } = req.body;
        const op = path.join(instDir, oldPath);
        const np = path.join(instDir, newPath);
        if (!op.startsWith(instDir) || !np.startsWith(instDir)) return res.status(403).json({ error: 'Access Denied' });

        try {
            await fs.rename(op, np);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/mkdir', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const targetPath = path.join(instDir, req.body.path);
        if (!targetPath.startsWith(instDir)) return res.status(403).json({ error: 'Denied' });
        try { await fs.ensureDir(targetPath); res.json({ success: true }); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/create', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const targetPath = path.join(instDir, req.body.path);
        if (!targetPath.startsWith(instDir)) return res.status(403).json({ error: 'Denied' });
        try {
            if (await fs.pathExists(targetPath)) return res.status(400).json({ error: 'File exists' });
            await fs.outputFile(targetPath, '');
            res.json({ success: true });
        }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/files/download', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        const filePath = path.join(instDir, req.query.path);
        if (!filePath.startsWith(instDir)) return res.status(403).send('Denied');
        if (fs.existsSync(filePath)) res.download(filePath); else res.status(404).send('Not Found');
    });
    app.get('/api/files/content', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const filepath = path.join(instDir, req.query.path);
            if (!filepath.startsWith(instDir)) return res.status(403).send('Denied');
            if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
            res.json({ content: await fs.readFile(filepath, 'utf8') });
        } catch (e) { res.status(500).send('Err'); }
    });
    app.post('/api/files/save', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const filepath = path.join(instDir, req.body.filepath);
            if (!filepath.startsWith(instDir)) return res.status(403).send('Denied');
            await fs.writeFile(filepath, req.body.content);
            res.json({ success: true });
        } catch (e) { res.status(500).send('Err'); }
    });

    app.get('/api/lists/:type', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        try { res.json(await fs.readJson(path.join(instDir, `${req.params.type}.json`))); } catch (e) { res.json([]); }
    });
    app.post('/api/lists/:type', requireAuth, withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const f = path.join(instDir, `${req.params.type}.json`);
            if (!f.startsWith(instDir)) return res.status(403).json({ error: 'Denied' });
            await fs.writeJson(f, req.body, { spaces: 2 });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/system/update_check', requireAuth, async (req, res) => {
        try {
            const currentVersion = require('./package.json').version;
            // Fetch GitHub Releases
            const gh = await axios.get('https://api.github.com/repos/4YStudio/mc-web-panel/releases/latest', {
                headers: { 'User-Agent': 'MC-Web-Panel' },
                timeout: 5000
            });
            const latestTag = gh.data.tag_name; // e.g. "v1.5.1"
            const latestVersion = latestTag.replace(/^v/, '');

            // Simple semver comparison (assuming x.y.z)
            const isNewer = (v1, v2) => {
                const p1 = v1.split('.').map(Number);
                const p2 = v2.split('.').map(Number);
                for (let i = 0; i < 3; i++) {
                    if (p1[i] > p2[i]) return true;
                    if (p1[i] < p2[i]) return false;
                }
                return false;
            };

            res.json({
                hasUpdate: isNewer(latestVersion, currentVersion),
                latestVersion,
                currentVersion,
                url: gh.data.html_url,
                body: gh.data.body
            });
        } catch (e) {
            console.error('Update check failed:', e.message);
            res.status(500).json({ error: 'Failed to check updates' });
        }
    });

    app.post('/api/system/update', requireAuth, async (req, res) => {
        try {
            if (!APP_EXECUTABLE) {
                return res.status(400).json({ error: '未检测到独立运行环境，无法自动更新' });
            }

            // 1. 获取最新版本信息
            const gh = await axios.get('https://api.github.com/repos/4YStudio/mc-web-panel/releases/latest', {
                headers: { 'User-Agent': 'MC-Web-Panel' },
                timeout: 5000
            });

            const arch = process.arch === 'x64' ? 'linux-x64' : 'linux-arm64';
            const assetName = `mc-web-panel-${arch}`;
            const asset = gh.data.assets.find(a => a.name === assetName);

            if (!asset) {
                return res.status(404).json({ error: `未找到对应架构 ( ${arch} ) 的发布文件` });
            }

            const downloadUrl = asset.browser_download_url;
            const newExePath = APP_EXECUTABLE + '.new';
            const oldExePath = APP_EXECUTABLE + '.old';

            console.log(`[Update] Downloading ${assetName} from ${downloadUrl}...`);
            io.emit('update_status', { step: 'downloading', message: '正在下载新版本...' });

            const controller = new AbortController();
            activeDownloads.set('system_update', controller);

            const writer = fs.createWriteStream(newExePath);
            const response = await axios({
                url: downloadUrl,
                method: 'GET',
                responseType: 'stream',
                signal: controller.signal
            });

            // 追踪进度
            const totalLength = parseInt(response.headers['content-length'], 10);
            let downloadedLength = 0;

            response.data.on('data', (chunk) => {
                downloadedLength += chunk.length;
                const progress = Math.round((downloadedLength / totalLength) * 100);
                io.emit('update_progress', { progress });
            });

            response.data.pipe(writer);

            writer.on('finish', async () => {
                try {
                    console.log('[Update] Download complete. Applying update...');
                    io.emit('update_status', { step: 'applying', message: '正在应用更新...' });

                    // 给予执行权限
                    await fs.chmod(newExePath, '755');

                    // 备份旧版本
                    if (await fs.pathExists(oldExePath)) await fs.remove(oldExePath);
                    await fs.move(APP_EXECUTABLE, oldExePath);

                    // 替换为新版本
                    await fs.move(newExePath, APP_EXECUTABLE);

                    console.log('[Update] Update applied. Restarting...');
                    io.emit('update_status', { step: 'restarting', message: '更新成功，正在重启面板...' });

                    setTimeout(() => {
                        // 重启逻辑：Master 会捕捉 100 信号并重启 Worker
                        // 但是为了完全应用新版本（如果是 caxa 打包），建议整个流程由外部（如 systemd）重启
                        // 这里的 process.exit(100) 只会让 Master 重启 Worker。
                        // 如果是 caxa，Master 进程的代码是固定的。
                        // 这里我们选择直接退出 Master，让外部重启（如果支持）。
                        // 或者触发 Master 重启。
                        process.send({ type: 'restart_master' }); // 我们需要在主进程处理这个
                        process.exit(100);
                    }, 2000);

                    res.json({ success: true, message: '更新已下载并应用，正在重启...' });
                } catch (err) {
                    console.error('[Update] Error applying update:', err);
                    io.emit('update_status', { step: 'error', message: '应用更新失败: ' + err.message });
                    // 尝试恢复
                    if (await fs.pathExists(oldExePath) && !await fs.pathExists(APP_EXECUTABLE)) {
                        await fs.move(oldExePath, APP_EXECUTABLE);
                    }
                }
            });

            writer.on('error', (err) => {
                // If it's an abort error, it might not be caught here if the stream is destroyed?
                // Actually axios signal abort handling usually throws during request or destroys stream.
                console.error('[Update] Download error:', err);
                if (err.message === 'Aborted') return; // Handled in catch block ideally, but stream error might differ
                io.emit('update_status', { step: 'error', message: '下载失败: ' + err.message });
            });

        } catch (e) {
            if (axios.isCancel(e)) {
                console.log('[Update] Cancelled by user');
                io.emit('update_status', { step: 'error', message: '更新已取消' });
            } else {
                console.error('[Update] Error:', e);
                io.emit('update_status', { step: 'error', message: '更新失败: ' + e.message });
            }
            // Cleanup
            try { if (await fs.pathExists(APP_EXECUTABLE + '.new')) await fs.remove(APP_EXECUTABLE + '.new'); } catch (err) { }
        } finally {
            activeDownloads.delete('system_update');
        }
    });

    // POST /api/system/update/cancel
    app.post('/api/system/update/cancel', requireAuth, (req, res) => {
        if (activeDownloads.has('system_update')) {
            activeDownloads.get('system_update').abort();
            activeDownloads.delete('system_update');
            res.json({ success: true, message: '已取消' });
        } else {
            res.status(404).json({ error: '没有正在进行的更新' });
        }
    });

    app.get('/api/system/version', (req, res) => {
        res.json({ version: APP_VERSION });
    });

    server.listen(appConfig.port, () => console.log(`MC Panel v${APP_VERSION} running on http://localhost:${appConfig.port}`));
}