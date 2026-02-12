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

const APP_VERSION = '1.6.0';
const APP_CODENAME = 'Advanced Backups Support';
const MODRINTH_UA = `CloudSpeak/MC-Panel/${APP_VERSION} (henvei@cloudspeak.com)`;

// --- 配置区域 ---
// detect if running in compressed environment (pkg or caxa)
let BASE_DIR = process.cwd();
const isNode = path.basename(process.execPath).toLowerCase().startsWith('node');

// In modern caxa, process.execPath might point to the temporary node binary.
// We try to find the actual executable path that the user ran.
if (!isNode) {
    // Directly running the wrapper
    BASE_DIR = path.dirname(process.execPath);
} else {
    // Scanning argv for the original executable (especially for caxa)
    // We look for a path that is NOT node and NOT a .js file
    for (const arg of process.argv) {
        if (!arg) continue;
        const base = path.basename(arg).toLowerCase();
        const isJs = base.endsWith('.js') || base.endsWith('.cjs') || base.endsWith('.mjs');
        const isNodeBin = base.startsWith('node');

        // On Linux, binaries often have no extension. On Windows they have .exe.
        // We look for an absolute path that is not node or a script.
        if (path.isAbsolute(arg) && !isNodeBin && !isJs) {
            BASE_DIR = path.dirname(arg);
            console.log(`Detected Standalone Executable: ${arg}`);
            break;
        }
    }
}
// Fallback: If still pointing to temp dir (unlikely for BASE_DIR unless wrapper was in temp), user might be running normally.

const MC_DIR = path.join(BASE_DIR, 'mc_server');
const DATA_DIR = path.join(BASE_DIR, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.join(DATA_DIR, 'panel.log');
const SERVER_PROPERTIES = path.join(MC_DIR, 'server.properties');

console.log(`DEBUG PATHS:`);
console.log(`  execPath: ${process.execPath}`);
console.log(`  argv[0]: ${process.argv[0]}`);
console.log(`  Determined BASE_DIR: ${BASE_DIR}`);
const EASYAUTH_DIR = path.join(MC_DIR, 'EasyAuth');
const EASYAUTH_DB = path.join(EASYAUTH_DIR, 'easyauth.db');
const EASYAUTH_CONFIG_DIR = path.join(MC_DIR, 'config', 'EasyAuth');
const VOICECHAT_CONFIG_DIR = path.join(MC_DIR, 'config', 'voicechat');

// 备份相关路径
const BACKUP_ROOT = path.join(MC_DIR, 'backups');
const BACKUP_DIFF_DIR = path.join(BACKUP_ROOT, 'world', 'differential');
const BACKUP_SNAP_DIR = path.join(BACKUP_ROOT, 'world', 'snapshots');
const WORLD_DIR = path.join(MC_DIR, 'world');

if (cluster.isPrimary) {
    console.log(`Master ${process.pid} is running`);

    const forkWorker = () => {
        const worker = cluster.fork();
        worker.on('exit', (code, signal) => {
            if (code === 100) {
                console.log('Worker requested restart. Restarting...');
                forkWorker();
            } else {
                console.log(`Worker stopped with code ${code || signal}`);
                process.exit(code || 0);
            }
        });
    };

    forkWorker();

    // Handle signals to kill worker gracefully
    const cleanup = () => {
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
        process.exit();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

} else {
    // Worker Process Logic
    const upload = multer({ dest: path.join(os.tmpdir(), 'mc-uploads') });

    console.log(`Initializing Data Directories...`);
    console.log(`  MC_DIR: ${MC_DIR}`);
    console.log(`  DATA_DIR: ${DATA_DIR}`);
    fs.ensureDirSync(MC_DIR);
    fs.ensureDirSync(DATA_DIR);
    fs.ensureDirSync(path.join(MC_DIR, 'mods'));

    // 默认配置
    const DEFAULT_CONFIG = {
        secret: '', // Initial secret is empty
        isSetup: false,
        port: 3000,
        defaultLang: 'zh',
        theme: 'auto',
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

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    let mcProcess = null;
    let onlinePlayers = new Set();
    let MAX_LOG_HISTORY = appConfig.maxLogHistory || 1000;
    let logHistory = [];
    let globalJavaVersion = '';
    let detectedVersion = { mc: 'Unknown', loader: 'Unknown' };

    // Helper: Check Java Version
    const checkJavaVersion = async (javaPath) => {
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

    const appendLog = (msg) => {
        logHistory.push(msg);
        if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();
        io.emit('console', msg);
        fs.appendFile(LOG_FILE, msg, () => { });
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
        socket.on('req_history', () => socket.emit('console_history', logHistory));
    });

    // --- 监控 ---
    setInterval(async () => {
        if (io.engine.clientsCount > 0) {
            try {
                const load = await si.currentLoad();
                const mem = await si.mem();

                let versionInfo = { mc: 'Unknown', loader: 'Unknown' };
                try {
                    const vFile = path.join(MC_DIR, 'server-version.json');
                    if (fs.existsSync(vFile)) {
                        const vData = await fs.readJson(vFile);
                        versionInfo = { mc: vData.gameVersion, loader: vData.loaderVersion };
                    } else if (detectedVersion.mc !== 'Unknown') {
                        versionInfo = detectedVersion;
                    }
                } catch (e) { }

                let serverInfo = { port: '25565', maxPlayers: '20', motd: 'Loading...' };
                const hasBackupMod = fs.existsSync(BACKUP_ROOT);
                const hasEasyAuth = fs.existsSync(EASYAUTH_DIR) && fs.existsSync(EASYAUTH_DB);
                const hasVoicechat = fs.existsSync(VOICECHAT_CONFIG_DIR);

                if (fs.existsSync(SERVER_PROPERTIES)) {
                    try {
                        const props = PropertiesReader(SERVER_PROPERTIES);
                        serverInfo.port = props.get('server-port') || '25565';
                        serverInfo.maxPlayers = props.get('max-players') || '20';
                        serverInfo.motd = props.get('motd') || 'Minecraft Server';
                    } catch (e) { }
                }

                // Check Java version occasionally or just check once?
                // For simplicity, we can check it in the loop but it might spawn too many processes.
                // Better: Cache it?
                // Actually, let's just assume checking it every monitorInterval (2s) is okay if efficient, OR better: check routinely.
                // But avoid spawning 'java -version' every 2s.
                // Let's create a cached variable outside.

                io.emit('system_stats', {
                    cpu: load.currentLoad.toFixed(1),
                    mem: { total: (mem.total / 1024 / 1024 / 1024).toFixed(1), used: (mem.active / 1024 / 1024 / 1024).toFixed(1), percentage: ((mem.active / mem.total) * 100).toFixed(1) },
                    mc: { port: serverInfo.port, maxPlayers: serverInfo.maxPlayers, motd: serverInfo.motd, online: onlinePlayers.size },
                    version: versionInfo,
                    hasBackupMod: hasBackupMod,
                    hasEasyAuth: hasEasyAuth,
                    hasVoicechat: hasVoicechat,
                    isSetup: fs.readdirSync(MC_DIR).length > 2,
                    javaVersion: globalJavaVersion || 'Checking...'
                });
            } catch (e) { }
        }
    }, appConfig.monitorInterval);

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
    app.get('/api/easyauth/users', requireAuth, async (req, res) => {
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
    app.post('/api/easyauth/delete', requireAuth, async (req, res) => {
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
                if (mcProcess) mcProcess.stdin.write(`kick ${username} 您的认证已被重置\n`);
                appendLog(`[EasyAuth] 管理员注销了玩家: ${username}\n`);
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
    app.get('/api/easyauth/configs', requireAuth, async (req, res) => {
        try {
            if (!fs.existsSync(EASYAUTH_CONFIG_DIR)) return res.json([]);
            const files = await fs.readdir(EASYAUTH_CONFIG_DIR);
            const confFiles = files.filter(f => f.endsWith('.conf') || f.endsWith('.json'));
            res.json(confFiles);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    // 4. 修改玩家密码 (新增)
    app.post('/api/easyauth/password', requireAuth, async (req, res) => {
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
                // 可选：踢出玩家强制重新登录
                if (mcProcess) mcProcess.stdin.write(`kick ${username} 管理员修改了您的密码，请使用新密码重新登录\n`);
                appendLog(`[EasyAuth] 管理员修改了玩家 ${username} 的密码\n`);
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
    // 5. Voicechat Config API (新增)
    app.get('/api/voicechat/config', requireAuth, async (req, res) => {
        const vcPropFile = path.join(VOICECHAT_CONFIG_DIR, 'voicechat-server.properties');
        try {
            if (!fs.existsSync(vcPropFile)) {
                // 如果目录存在但文件不存在，尝试创建一个空的或返回空
                if (fs.existsSync(VOICECHAT_CONFIG_DIR)) return res.json({ content: '' });
                return res.status(404).json({ error: '配置文件不存在' });
            }
            const content = await fs.readFile(vcPropFile, 'utf8');
            res.json({ content });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/voicechat/save', requireAuth, async (req, res) => {
        const vcPropFile = path.join(VOICECHAT_CONFIG_DIR, 'voicechat-server.properties');
        try {
            if (!fs.existsSync(VOICECHAT_CONFIG_DIR)) fs.ensureDirSync(VOICECHAT_CONFIG_DIR);
            await fs.writeFile(vcPropFile, req.body.content);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- 备份管理 API (新增) ---

    // 1. 获取备份列表
    app.get('/api/backups/list', requireAuth, async (req, res) => {
        try {
            const backups = [];

            const scanDir = async (dir, type) => {
                if (fs.existsSync(dir)) {
                    const files = await fs.readdir(dir);
                    for (const file of files) {
                        if (file.endsWith('.zip')) {
                            const stat = await fs.stat(path.join(dir, file));
                            // 解析文件名: backup_2025-10-25_14-06-05-full.zip
                            const isPartial = file.includes('partial');
                            backups.push({
                                name: file,
                                path: path.join(dir, file), // 绝对路径
                                folder: type, // 'differential' or 'snapshots'
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

            // 按时间倒序排列
            backups.sort((a, b) => b.mtime - a.mtime);
            res.json(backups);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 2. 创建备份 (通过发送命令)
    app.post('/api/backups/create', requireAuth, (req, res) => {
        if (!mcProcess) return res.json({ success: false, message: '服务器未运行，无法创建在线备份' });
        mcProcess.stdin.write('backup start\n');
        appendLog('> backup start\n');
        res.json({ success: true, message: '备份指令已发送' });
    });

    // 3. 还原备份
    app.post('/api/backups/restore', requireAuth, async (req, res) => {
        const { filename, folder, type } = req.body;

        // 发送进度辅助函数
        const sendProgress = (step, total, msg) => {
            io.emit('restore_progress', {
                percent: Math.round((step / total) * 100),
                message: msg
            });
        };

        if (mcProcess) {
            mcProcess.stdin.write('stop\n');
            appendLog('[系统] 正在停止服务器以进行回档...\n');
            sendProgress(10, 100, '正在停止服务器...');

            let checks = 0;
            while (mcProcess && checks < 30) {
                await new Promise(r => setTimeout(r, 1000));
                checks++;
            }
            if (mcProcess) return res.status(500).json({ error: '服务器无法停止，请手动停止' });
        }

        try {
            const targetZipPath = path.join(folder === 'differential' ? BACKUP_DIFF_DIR : BACKUP_SNAP_DIR, filename);
            if (!fs.existsSync(targetZipPath)) return res.status(404).json({ error: '备份文件不存在' });

            sendProgress(30, 100, '正在备份当前地图...');

            if (fs.existsSync(WORLD_DIR)) {
                const backupName = `world_bak_${Date.now()}`;
                await fs.rename(WORLD_DIR, path.join(MC_DIR, backupName));
                appendLog(`[系统] 已将当前存档重命名为 ${backupName}\n`);
            }

            await fs.ensureDir(WORLD_DIR);

            // 确定解压列表
            const filesToUnzip = [];
            if (type === 'partial' && folder === 'differential') {
                const allFiles = await fs.readdir(BACKUP_DIFF_DIR);
                const fullBackups = allFiles.filter(f => f.includes('full') && f.endsWith('.zip')).sort();
                // 简单的字符串比较找前面的全量包
                let baseBackup = null;
                for (const fb of fullBackups) {
                    if (fb < filename) baseBackup = fb; else break;
                }
                if (baseBackup) filesToUnzip.push(path.join(BACKUP_DIFF_DIR, baseBackup));
            }
            filesToUnzip.push(targetZipPath);

            // 解压
            const totalSteps = filesToUnzip.length;
            for (let i = 0; i < totalSteps; i++) {
                const zipPath = filesToUnzip[i];
                const currentProgress = 50 + Math.round(((i + 1) / totalSteps) * 40); // 50% -> 90%

                sendProgress(currentProgress, 100, `正在解压 (${i + 1}/${totalSteps}): ${path.basename(zipPath)}`);
                appendLog(`[系统] 解压中: ${path.basename(zipPath)}...\n`);

                const zip = new AdmZip(zipPath);
                zip.extractAllTo(WORLD_DIR, true);
            }

            sendProgress(100, 100, '回档完成');
            appendLog(`[系统] 回档完成！请启动服务器。\n`);

            setTimeout(() => io.emit('restore_completed'), 1000);
            res.json({ success: true });

        } catch (e) {
            console.error(e);
            appendLog(`[错误] 回档失败: ${e.message}\n`);
            io.emit('restore_error', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    // 4. 删除备份
    app.post('/api/backups/delete', requireAuth, async (req, res) => {
        const { filename, folder } = req.body;
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
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
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
    app.get('/api/panel/jars', requireAuth, (req, res) => {
        try {
            const files = fs.readdirSync(MC_DIR);
            const jars = files.filter(f => f.toLowerCase().endsWith('.jar'));
            res.json(jars);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- 5. Setup API ---
    app.get('/api/setup/status', requireAuth, (req, res) => {
        try {
            const files = fs.readdirSync(MC_DIR);
            // If directory is mostly empty (ignoring mods or just properties), consider it not setup
            const isSetup = files.length > 2 && (fs.existsSync(path.join(MC_DIR, appConfig.jarName)) || fs.existsSync(path.join(MC_DIR, 'server.jar')));
            res.json({ isSetup });
        } catch (e) {
            res.json({ isSetup: false });
        }
    });

    app.post('/api/setup/reinstall', requireAuth, async (req, res) => {
        try {
            // 1. 停止服务器 (如果运行中)
            if (mcProcess) {
                mcProcess.kill();
                mcProcess = null;
                io.emit('status', false);
            }

            // 2. 删除目录内容
            const files = fs.readdirSync(MC_DIR);
            for (const f of files) {
                await fs.remove(path.join(MC_DIR, f));
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

    app.post('/api/setup/install', requireAuth, async (req, res) => {
        const { gameVersion, loaderVersion } = req.body;
        if (!gameVersion || !loaderVersion) return res.status(400).json({ error: 'Missing version info' });

        const installerUrl = `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/1.0.1/server/jar`;
        const targetJar = path.join(MC_DIR, appConfig.jarName);
        const versionFile = path.join(MC_DIR, 'server-version.json');
        const eulaFile = path.join(MC_DIR, 'eula.txt');

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

                appendLog(`Installed Fabric Server (${gameVersion} / ${loaderVersion})`);
            });

            writer.on('error', (err) => {
                console.error('Download failed', err);
                appendLog('Installation failed: ' + err.message);
            });

        } catch (e) {
            console.error(e);
            appendLog('Installation error: ' + e.message);
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

    app.post('/api/mods/modrinth/download', requireAuth, async (req, res) => {
        const { url, filename } = req.body;
        if (!url || !filename) return res.status(400).json({ error: 'URL and filename required' });

        const dest = path.join(MC_DIR, 'mods', filename);
        appendLog(`Installing mod: ${filename}...`);

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
            appendLog('Installation error: ' + e.message);
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

    app.get('/api/mods/local/list', requireAuth, async (req, res) => {
        const modsDir = path.join(MC_DIR, 'mods');
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

    app.get('/api/mods/local/metadata', requireAuth, async (req, res) => {
        const { file } = req.query;
        if (!file) return res.status(400).json({ error: 'File name required' });

        const modsDir = path.join(MC_DIR, 'mods');
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
            const { port, defaultLang, theme, jarName, javaArgs, sessionTimeout, maxLogHistory, monitorInterval, javaPath, aiEndpoint, aiKey, aiModel } = req.body;

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
        try { isSetup = fs.readdirSync(MC_DIR).length > 2; } catch (e) { }
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
    app.get('/api/server/status', requireAuth, (req, res) => res.json({ running: !!mcProcess, onlinePlayers: Array.from(onlinePlayers) }));

    // Server Icon API
    app.get('/api/server/icon', (req, res) => {
        const iconPath = path.join(MC_DIR, 'server-icon.png');
        if (fs.existsSync(iconPath)) res.sendFile(iconPath);
        else res.status(404).send('No icon');
    });
    app.post('/api/server/icon', requireAuth, upload.single('icon'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file' });
            await fs.move(req.file.path, path.join(MC_DIR, 'server-icon.png'), { overwrite: true });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.delete('/api/server/icon', requireAuth, async (req, res) => {
        try {
            await fs.remove(path.join(MC_DIR, 'server-icon.png'));
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/server/start', requireAuth, async (req, res) => {
        if (mcProcess) return res.json({ message: '已运行' });

        const javaVer = await checkJavaVersion(appConfig.javaPath);
        if (javaVer === 'Not Installed') {
            appendLog(`[错误] Java 未找到: ${appConfig.javaPath}\n`);
            return res.json({ success: false, message: 'Java 未安装或路径错误' });
        }

        const eulaPath = path.join(MC_DIR, 'eula.txt');
        try { if (!await fs.pathExists(eulaPath) || !(await fs.readFile(eulaPath, 'utf8')).includes('eula=true')) await fs.writeFile(eulaPath, 'eula=true'); } catch (e) { }

        onlinePlayers.clear();
        appendLog('[系统] --- 正在启动服务器 ---\n');
        appendLog(`[系统] 使用 Java: ${appConfig.javaPath} (版本: ${javaVer})\n`);

        try {
            mcProcess = spawn(appConfig.javaPath, [...appConfig.javaArgs, '-jar', appConfig.jarName, 'nogui'], { cwd: MC_DIR });

            mcProcess.stdout.on('data', (data) => {
                const line = data.toString();
                appendLog(line);
                const join = line.match(/:\s(\w+)\sjoined the game/);
                if (join) { onlinePlayers.add(join[1]); io.emit('players_update', Array.from(onlinePlayers)); }
                const leave = line.match(/:\s(\w+)\sleft the game/);
                if (leave) { onlinePlayers.delete(leave[1]); io.emit('players_update', Array.from(onlinePlayers)); }

                // Auto-detect Version
                if (detectedVersion.mc === 'Unknown') {
                    // Vanilla: Starting minecraft server version 1.20.1
                    const vanillaMatch = line.match(/Starting minecraft server version (\S+)/);
                    if (vanillaMatch) detectedVersion.mc = vanillaMatch[1];

                    // Fabric: Loading Minecraft 1.20.1 with Fabric Loader 0.14.21
                    const fabricMatch = line.match(/Loading Minecraft (\S+) with Fabric Loader (\S+)/);
                    if (fabricMatch) {
                        detectedVersion.mc = fabricMatch[1];
                        detectedVersion.loader = fabricMatch[2];
                    }
                }
            });

            mcProcess.stderr.on('data', d => appendLog(d.toString()));

            mcProcess.on('error', (err) => {
                appendLog(`[严重错误] 启动失败: ${err.message}\n`);
                io.emit('status', false);
                mcProcess = null;
            });

            mcProcess.on('close', (code) => {
                appendLog(`[系统] --- 服务器已停止 (Code ${code}) ---\n`);
                io.emit('status', false);
                onlinePlayers.clear();
                io.emit('players_update', []);
                mcProcess = null;
            });

            io.emit('status', true);
            res.json({ success: true });
        } catch (e) {
            appendLog(`[错误] 启动异常: ${e.message}\n`);
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/api/server/stop', requireAuth, (req, res) => { if (mcProcess) mcProcess.stdin.write('stop\n'); res.json({ success: true }); });
    app.post('/api/server/command', requireAuth, (req, res) => { if (mcProcess) { mcProcess.stdin.write(req.body.command + '\n'); appendLog(`> ${req.body.command}\n`); } res.json({ success: true }); });

    // 文件管理
    app.get('/api/files/list', requireAuth, async (req, res) => {
        const targetPath = path.join(MC_DIR, req.query.path || '');
        if (!targetPath.startsWith(MC_DIR)) return res.status(403).send('Denied');
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

    app.post('/api/files/upload', requireAuth, upload.array('files'), async (req, res) => {
        const targetDir = req.body.path ? path.join(MC_DIR, req.body.path) : MC_DIR;
        if (!targetDir.startsWith(MC_DIR)) return res.status(403).json({ error: 'Access Denied' });
        try {
            for (const file of req.files) await fs.move(file.path, path.join(targetDir, fixFileName(file.originalname)), { overwrite: true });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/operate', requireAuth, async (req, res) => {
        const { action, sources, destination, compressName } = req.body;
        const destPath = destination ? path.join(MC_DIR, destination) : MC_DIR;
        if (!destPath.startsWith(MC_DIR)) return res.status(403).json({ error: 'Access Denied' });

        try {
            if (action === 'delete') {
                for (const src of sources) {
                    const p = path.join(MC_DIR, src);
                    if (!p.startsWith(MC_DIR)) throw new Error('Access Denied');
                    await fs.remove(p);
                }
            }
            else if (action === 'move' || action === 'copy') {
                for (const src of sources) {
                    const srcPath = path.join(MC_DIR, src);
                    if (!srcPath.startsWith(MC_DIR)) throw new Error('Access Denied');

                    const finalDest = path.join(destPath, path.basename(src));
                    if (!finalDest.startsWith(MC_DIR)) throw new Error('Access Denied');

                    if (action === 'move') await fs.move(srcPath, finalDest, { overwrite: true });
                    else await fs.copy(srcPath, finalDest, { overwrite: true });
                }
            }
            else if (action === 'compress') {
                const archive = archiver('zip', { zlib: { level: 9 } });
                const output = fs.createWriteStream(path.join(destPath, compressName || `archive_${Date.now()}.zip`));
                archive.pipe(output);
                for (const src of sources) {
                    const srcPath = path.join(MC_DIR, src);
                    if (!srcPath.startsWith(MC_DIR)) continue;
                    if ((await fs.stat(srcPath)).isDirectory()) archive.directory(srcPath, path.basename(srcPath));
                    else archive.file(srcPath, { name: path.basename(srcPath) });
                }
                await archive.finalize();
            }
            else if (action === 'disable') {
                for (const src of sources) {
                    const p = path.join(MC_DIR, src);
                    if (!p.startsWith(MC_DIR)) continue;
                    if (!src.endsWith('.disabled')) await fs.rename(p, p + '.disabled');
                }
            }
            else if (action === 'enable') {
                for (const src of sources) {
                    if (src.endsWith('.disabled')) {
                        const newPath = src.slice(0, -9);
                        const p = path.join(MC_DIR, src);
                        const np = path.join(MC_DIR, newPath);
                        if (!p.startsWith(MC_DIR) || !np.startsWith(MC_DIR)) continue;

                        await fs.rename(p, np);
                    }
                }
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/rename', requireAuth, async (req, res) => {
        const { oldPath, newPath } = req.body;
        const op = path.join(MC_DIR, oldPath);
        const np = path.join(MC_DIR, newPath);
        if (!op.startsWith(MC_DIR) || !np.startsWith(MC_DIR)) return res.status(403).json({ error: 'Access Denied' });

        try {
            await fs.rename(op, np);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/mkdir', requireAuth, async (req, res) => {
        const targetPath = path.join(MC_DIR, req.body.path);
        if (!targetPath.startsWith(MC_DIR)) return res.status(403).json({ error: 'Denied' });
        try { await fs.ensureDir(targetPath); res.json({ success: true }); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/create', requireAuth, async (req, res) => {
        const targetPath = path.join(MC_DIR, req.body.path);
        if (!targetPath.startsWith(MC_DIR)) return res.status(403).json({ error: 'Denied' });
        try {
            if (await fs.pathExists(targetPath)) return res.status(400).json({ error: 'File exists' });
            await fs.outputFile(targetPath, '');
            res.json({ success: true });
        }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/files/download', requireAuth, async (req, res) => {
        const filePath = path.join(MC_DIR, req.query.path);
        if (!filePath.startsWith(MC_DIR)) return res.status(403).send('Denied');
        if (fs.existsSync(filePath)) res.download(filePath); else res.status(404).send('Not Found');
    });
    app.get('/api/files/content', requireAuth, async (req, res) => {
        try {
            const filepath = path.join(MC_DIR, req.query.path);
            if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
            res.json({ content: await fs.readFile(filepath, 'utf8') });
        } catch (e) { res.status(500).send('Err'); }
    });
    app.post('/api/files/save', requireAuth, async (req, res) => { try { await fs.writeFile(path.join(MC_DIR, req.body.filepath), req.body.content); res.json({ success: true }); } catch (e) { res.status(500).send('Err'); } });

    app.get('/api/lists/:type', requireAuth, async (req, res) => { try { res.json(await fs.readJson(path.join(MC_DIR, `${req.params.type}.json`))); } catch (e) { res.json([]); } });
    app.post('/api/lists/:type', requireAuth, async (req, res) => {
        try {
            const f = path.join(MC_DIR, `${req.params.type}.json`);
            if (!f.startsWith(MC_DIR)) return res.status(403).json({ error: 'Denied' });
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

    app.get('/api/system/version', (req, res) => {
        res.json({ version: APP_VERSION });
    });

    server.listen(appConfig.port, () => console.log(`MC Panel v${APP_VERSION} running on http://localhost:${appConfig.port}`));
}