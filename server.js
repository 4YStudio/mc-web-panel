/**
 * server.js - v6.0 (Advanced Backups Support)
 */
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
const os = require('os');
const si = require('systeminformation');
const PropertiesReader = require('properties-reader');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose(); // 新增

// --- 配置区域 ---
const PORT = 3000;
const MC_DIR = path.join(__dirname, 'mc_server');
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.join(DATA_DIR, 'panel.log');
const SERVER_PROPERTIES = path.join(MC_DIR, 'server.properties');
const JAR_NAME = 'fabric-server-launch.jar';
const JAVA_ARGS = ['-Xms1G', '-Xmx4G'];
const EASYAUTH_DIR = path.join(MC_DIR, 'EasyAuth');
const EASYAUTH_DB = path.join(EASYAUTH_DIR, 'easyauth.db');
const EASYAUTH_CONFIG_DIR = path.join(MC_DIR, 'config', 'EasyAuth');
const VOICECHAT_CONFIG_DIR = path.join(MC_DIR, 'config', 'voicechat'); // 新增 Voicechat 路径

// 备份相关路径
const BACKUP_ROOT = path.join(MC_DIR, 'backups');
const BACKUP_DIFF_DIR = path.join(BACKUP_ROOT, 'world', 'differential');
const BACKUP_SNAP_DIR = path.join(BACKUP_ROOT, 'world', 'snapshots');
const WORLD_DIR = path.join(MC_DIR, 'world');

const upload = multer({ dest: path.join(os.tmpdir(), 'mc-uploads') });

fs.ensureDirSync(MC_DIR);
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(path.join(MC_DIR, 'mods'));

let appConfig = fs.existsSync(CONFIG_FILE) ? fs.readJsonSync(CONFIG_FILE) : { secret: authenticator.generateSecret(), isSetup: false };
if (!fs.existsSync(CONFIG_FILE)) fs.writeJsonSync(CONFIG_FILE, appConfig);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let mcProcess = null;
let onlinePlayers = new Set();
const MAX_LOG_HISTORY = 1000;
let logHistory = [];

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

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(session({
    secret: 'mc-panel-secret-v6',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const requireAuth = (req, res, next) => {
    if (req.session.authenticated) return next();
    res.status(401).json({ error: '未授权' });
};

const fixFileName = (name) => Buffer.from(name, 'latin1').toString('utf8');

// --- Socket ---
io.on('connection', (socket) => {
    socket.on('req_history', () => socket.emit('console_history', logHistory));
});

// --- 监控 ---
setInterval(async () => {
    if (io.engine.clientsCount > 0) {
        try {
            const load = await si.currentLoad();
            const mem = await si.mem();
            let serverInfo = { port: '25565', maxPlayers: '20', motd: 'Loading...' };
            // 检测是否有备份插件文件夹
            const hasBackupMod = fs.existsSync(BACKUP_ROOT);
            const hasEasyAuth = fs.existsSync(EASYAUTH_DIR) && fs.existsSync(EASYAUTH_DB);
            const hasVoicechat = fs.existsSync(VOICECHAT_CONFIG_DIR); // 新增 check

            if (fs.existsSync(SERVER_PROPERTIES)) {
                try {
                    const props = PropertiesReader(SERVER_PROPERTIES);
                    serverInfo.port = props.get('server-port') || '25565';
                    serverInfo.maxPlayers = props.get('max-players') || '20';
                    serverInfo.motd = props.get('motd') || 'Minecraft Server';
                } catch (e) { }
            }
            io.emit('system_stats', {
                cpu: load.currentLoad.toFixed(1),
                mem: { total: (mem.total / 1024 / 1024 / 1024).toFixed(1), used: (mem.active / 1024 / 1024 / 1024).toFixed(1), percentage: ((mem.active / mem.total) * 100).toFixed(1) },
                mc: { port: serverInfo.port, maxPlayers: serverInfo.maxPlayers, motd: serverInfo.motd, online: onlinePlayers.size },
                hasBackupMod: hasBackupMod, // 通知前端显示备份菜单
                hasEasyAuth: hasEasyAuth, // 通知前端显示 EasyAuth 菜单
                hasVoicechat: hasVoicechat // 通知前端显示 Voicechat 菜单
            });
        } catch (e) { }
    }
}, 2000);


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

// --- 原有 API (保持不变) ---
app.get('/api/auth/check', (req, res) => res.json({ isSetup: appConfig.isSetup, authenticated: !!req.session.authenticated }));
app.get('/api/auth/qr', (req, res) => QRCode.toDataURL(authenticator.keyuri('Admin', 'MC-Panel', appConfig.secret), (err, url) => res.json({ qr: url, secret: appConfig.secret })));
app.post('/api/auth/login', (req, res) => {
    if (authenticator.check(req.body.token, appConfig.secret)) {
        req.session.authenticated = true;
        if (!appConfig.isSetup) { appConfig.isSetup = true; fs.writeJsonSync(CONFIG_FILE, appConfig); }
        res.json({ success: true });
    } else res.json({ success: false });
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
    const eulaPath = path.join(MC_DIR, 'eula.txt');
    try { if (!await fs.pathExists(eulaPath) || !(await fs.readFile(eulaPath, 'utf8')).includes('eula=true')) await fs.writeFile(eulaPath, 'eula=true'); } catch (e) { }
    onlinePlayers.clear();
    appendLog('[系统] --- 正在启动服务器 ---\n');
    mcProcess = spawn('java', [...JAVA_ARGS, '-jar', JAR_NAME, 'nogui'], { cwd: MC_DIR });
    mcProcess.stdout.on('data', (data) => {
        const line = data.toString();
        appendLog(line);
        const join = line.match(/:\s(\w+)\sjoined the game/);
        if (join) { onlinePlayers.add(join[1]); io.emit('players_update', Array.from(onlinePlayers)); }
        const leave = line.match(/:\s(\w+)\sleft the game/);
        if (leave) { onlinePlayers.delete(leave[1]); io.emit('players_update', Array.from(onlinePlayers)); }
    });
    mcProcess.stderr.on('data', d => appendLog(d.toString()));
    mcProcess.on('close', (code) => {
        appendLog(`[系统] --- 服务器已停止 (Code ${code}) ---\n`);
        io.emit('status', false);
        onlinePlayers.clear();
        io.emit('players_update', []);
        mcProcess = null;
    });
    io.emit('status', true);
    res.json({ success: true });
});
app.post('/api/server/stop', requireAuth, (req, res) => { if (mcProcess) mcProcess.stdin.write('stop\n'); res.json({ success: true }); });
app.post('/api/server/command', requireAuth, (req, res) => { if (mcProcess) { mcProcess.stdin.write(req.body.command + '\n'); appendLog(`> ${req.body.command}\n`); } res.json({ success: true }); });

// 文件管理
app.get('/api/files/list', requireAuth, async (req, res) => {
    const targetPath = path.join(MC_DIR, req.query.path || '');
    if (!targetPath.startsWith(MC_DIR)) return res.status(403).send('Denied');
    try {
        if (!fs.existsSync(targetPath)) fs.ensureDirSync(targetPath);
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

app.post('/api/files/upload', requireAuth, upload.array('files'), async (req, res) => {
    const targetDir = req.body.path ? path.join(MC_DIR, req.body.path) : MC_DIR;
    try {
        for (const file of req.files) await fs.move(file.path, path.join(targetDir, fixFileName(file.originalname)), { overwrite: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/files/operate', requireAuth, async (req, res) => {
    const { action, sources, destination, compressName } = req.body;
    const destPath = destination ? path.join(MC_DIR, destination) : MC_DIR;
    try {
        if (action === 'delete') for (const src of sources) await fs.remove(path.join(MC_DIR, src));
        else if (action === 'move' || action === 'copy') {
            for (const src of sources) {
                const srcPath = path.join(MC_DIR, src);
                const finalDest = path.join(destPath, path.basename(src));
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
                if ((await fs.stat(srcPath)).isDirectory()) archive.directory(srcPath, path.basename(srcPath));
                else archive.file(srcPath, { name: path.basename(srcPath) });
            }
            await archive.finalize();
        }
        else if (action === 'disable') for (const src of sources) if (!src.endsWith('.disabled')) await fs.rename(path.join(MC_DIR, src), path.join(MC_DIR, src) + '.disabled');
        else if (action === 'enable') for (const src of sources) if (src.endsWith('.disabled')) await fs.rename(path.join(MC_DIR, src), path.join(MC_DIR, src).replace('.disabled', ''));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/files/download', requireAuth, async (req, res) => {
    const filePath = path.join(MC_DIR, req.query.path);
    if (!filePath.startsWith(MC_DIR)) return res.status(403).send('Denied');
    if (fs.existsSync(filePath)) res.download(filePath); else res.status(404).send('Not Found');
});
app.get('/api/files/content', requireAuth, async (req, res) => { try { res.json({ content: await fs.readFile(path.join(MC_DIR, req.query.path), 'utf8') }); } catch (e) { res.status(500).send('Err'); } });
app.post('/api/files/save', requireAuth, async (req, res) => { try { await fs.writeFile(path.join(MC_DIR, req.body.filepath), req.body.content); res.json({ success: true }); } catch (e) { res.status(500).send('Err'); } });

app.get('/api/lists/:type', requireAuth, async (req, res) => { try { res.json(await fs.readJson(path.join(MC_DIR, `${req.params.type}.json`))); } catch (e) { res.json([]); } });

server.listen(PORT, () => console.log(`MC Panel v6.0 running on http://localhost:${PORT}`));