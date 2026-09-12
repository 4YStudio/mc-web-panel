/**
 * server.js - v6.0 (Advanced Backups Support)
 */
const axios = require('axios');
const cluster = require('cluster');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const express = require('express');
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
const zlib = require('zlib');
const os = require('os');
const si = require('systeminformation');
const PropertiesReader = require('properties-reader');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const { pipeline } = require('node:stream/promises');
const PluginLoader = require('./plugin-loader');

const APP_VERSION = '2.4.3';
const STARTUP_TIME = Date.now();
const APP_CODENAME = 'Advanced Backups Support';
const MODRINTH_UA = `CloudSpeak/MC-Panel/${APP_VERSION} (henvei@cloudspeak.com)`;

// ==================== NBT Reader for Player Data ====================
class NBTReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }
    readTag() {
        if (this.offset >= this.buffer.length) return { type: 0, name: '', value: null };
        const type = this.buffer[this.offset++];
        if (type === 0) return { type, name: '', value: null };
        const nameLen = this.buffer.readUInt16BE(this.offset);
        this.offset += 2;
        const name = this.buffer.toString('utf8', this.offset, this.offset + nameLen);
        this.offset += nameLen;
        return { type, name, value: this.readValue(type) };
    }
    readValue(type) {
        switch (type) {
            case 1: return this.buffer.readInt8(this.offset++);
            case 2: { const s = this.buffer.readInt16BE(this.offset); this.offset += 2; return s; }
            case 3: { const i = this.buffer.readInt32BE(this.offset); this.offset += 4; return i; }
            case 4: { const l = this.buffer.readBigInt64BE(this.offset); this.offset += 8; return l; }
            case 5: { const f = this.buffer.readFloatBE(this.offset); this.offset += 4; return f; }
            case 6: { const d = this.buffer.readDoubleBE(this.offset); this.offset += 8; return d; }
            case 7: { const baLen = this.buffer.readInt32BE(this.offset); this.offset += 4; const ba = this.buffer.subarray(this.offset, this.offset + baLen); this.offset += baLen; return ba; }
            case 8: { const strLen = this.buffer.readUInt16BE(this.offset); this.offset += 2; const str = this.buffer.toString('utf8', this.offset, this.offset + strLen); this.offset += strLen; return str; }
            case 9: { const elemType = this.buffer[this.offset++]; const listLen = this.buffer.readInt32BE(this.offset); this.offset += 4; const list = []; for (let k = 0; k < listLen; k++) list.push(this.readValue(elemType)); return { type: elemType, value: list }; }
            case 10: { const comp = {}; while (true) { const tag = this.readTag(); if (tag.type === 0) break; comp[tag.name] = tag.value; } return comp; }
            case 11: { const iaLen = this.buffer.readInt32BE(this.offset); this.offset += 4; const ia = []; for (let k = 0; k < iaLen; k++) { ia.push(this.buffer.readInt32BE(this.offset)); this.offset += 4; } return ia; }
            case 12: { const laLen = this.buffer.readInt32BE(this.offset); this.offset += 4; const la = []; for (let k = 0; k < laLen; k++) { la.push(this.buffer.readBigInt64BE(this.offset)); this.offset += 8; } return la; }
            default: return null;
        }
    }
}

function parsePlayerInventory(buffer) {
    try {
        const nbt = new NBTReader(buffer).readTag().value;
        if (!nbt) { console.log('[PlayerInventory] NBT root is null'); return null; }
        // Check all top-level keys for debugging
        const keys = Object.keys(nbt);
        console.log('[PlayerInventory] Top-level NBT keys:', keys.join(', '));

        let inventory = nbt.Inventory;
        if (!inventory) { console.log('[PlayerInventory] No Inventory tag found'); return null; }
        console.log('[PlayerInventory] Inventory type:', typeof inventory, Array.isArray(inventory) ? 'is array' : 'is not array',
            inventory.type !== undefined ? `list type=${inventory.type}` : '',
            inventory.value !== undefined ? `has .value (array=${Array.isArray(inventory.value)}, len=${inventory.value?.length})` : '');

        // Handle both array and {type, value} structures
        let items;
        if (Array.isArray(inventory)) {
            items = inventory;
        } else if (inventory.value && Array.isArray(inventory.value)) {
            items = inventory.value;
        } else {
            console.log('[PlayerInventory] Cannot find items array in Inventory');
            return null;
        }

        console.log('[PlayerInventory] Found', items.length, 'inventory entries');
        if (items.length > 0) {
            console.log('[PlayerInventory] First item type:', typeof items[0], 'keys:', items[0] ? Object.keys(items[0]).join(',') : 'null');
        }

        const result = [];
        for (const item of items) {
            if (!item) continue;
            // item could be a plain object from compound parsing, or {type, value} from list parsing
            const tag = (item.value && typeof item.value === 'object' && !Array.isArray(item.value)) ? item.value : item;
            if (!tag || typeof tag !== 'object') continue;
            const id = tag.id || 'minecraft:air';
            if (id === 'minecraft:air') continue;
            const count = tag.Count || 1;
            // Slot 可能是 byte/int/bigint 类型, 确保返回数字
            const rawSlot = tag.Slot !== undefined ? tag.Slot : -1;
            const slot = typeof rawSlot === 'bigint' ? Number(rawSlot) : Number(rawSlot) || 0;
            const damage = tag.Damage || 0;
            const tagData = tag.tag || null;
            let displayName = null;
            let enchantments = [];
            if (tagData) {
                if (tagData.display && tagData.display.Name) displayName = tagData.display.Name;
                if (tagData.Enchantments && Array.isArray(tagData.Enchantments)) {
                    enchantments = tagData.Enchantments.map(e => ({
                        id: e.id || '',
                        lvl: e.lvl || 0
                    }));
                }
            }
            result.push({ id, count, slot, damage, displayName, enchantments });
        }
        // 调试: 打印装备槽和副手槽信息
        const armorItems = result.filter(i => i.slot >= 100 && i.slot <= 103);
        const offhandItem = result.find(i => i.slot === -106);
        console.log('[PlayerInventory] Parsed', result.length, 'items');
        console.log('[PlayerInventory] Armor slots:', armorItems.map(i => `slot=${i.slot}(type=${typeof i.slot}) id=${i.id}`));
        console.log('[PlayerInventory] Offhand:', offhandItem ? `slot=${offhandItem.slot}(type=${typeof offhandItem.slot}) id=${offhandItem.id}` : 'empty');
        console.log('[PlayerInventory] All slots:', result.map(i => `${i.slot}:${i.id}`).join(', '));
        return result;
    } catch (e) {
        console.error('[PlayerInventory] Parse error:', e.message, e.stack);
        return null;
    }
}

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
    const exeName = caxaMatch[1]; // e.g. "MWP-216-linux-x64"
    console.log(`  Detected caxa environment, executable name: ${exeName}`);
    
    // Try multiple possible locations for the wrapper
    const candidateDirs = [
        process.cwd(),
        ...(process.argv[0] ? [path.dirname(path.resolve(process.argv[0]))] : []),
        ...(process.argv[1] ? [path.dirname(path.resolve(process.argv[1]))] : [])
    ];
    
    // Remove duplicates
    const uniqueDirs = [...new Set(candidateDirs)];
    
    for (const dir of uniqueDirs) {
        const candidate = path.join(dir, exeName);
        console.log(`  Looking for wrapper at: ${candidate}`);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            APP_EXECUTABLE = candidate;
            if (_isDaemon || !isNode) console.log(`  Found caxa wrapper: ${APP_EXECUTABLE}`);
            break;
        }
    }
    
    // If still not found, try scanning argv for any non-js, non-node file
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
                        console.log(`  Found caxa wrapper via argv: ${fullPath}`);
                        break;
                    }
                } catch (e) { }
            }
        }
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

// --- Method 4: Read from persisted path (fallback for post-restart scenarios) ---
if (!APP_EXECUTABLE) {
    try {
        // Try to find DATA_DIR by checking both cwd/data and possible parent paths
        const possibleDataDirs = [
            path.join(process.cwd(), 'data'),
            path.join(BASE_DIR, 'data')
        ];
        for (const dir of possibleDataDirs) {
            const savedPathFile = path.join(dir, 'executable_path.txt');
            if (fs.existsSync(savedPathFile)) {
                const savedPath = fs.readFileSync(savedPathFile, 'utf8').trim();
                if (savedPath && fs.existsSync(savedPath) && fs.statSync(savedPath).isFile()) {
                    APP_EXECUTABLE = savedPath;
                    console.log(`  Recovered APP_EXECUTABLE from saved path: ${APP_EXECUTABLE}`);
                    break;
                }
            }
        }
    } catch (e) { }
}

if (APP_EXECUTABLE) {
    BASE_DIR = path.dirname(APP_EXECUTABLE);
    // Persist for post-restart recovery
    try {
        const dataDir = path.join(BASE_DIR, 'data');
        fs.ensureDirSync(dataDir);
        fs.writeFileSync(path.join(dataDir, 'executable_path.txt'), APP_EXECUTABLE);
    } catch (e) { }
}

const DATA_DIR = path.join(BASE_DIR, 'data');
const INSTANCES_DIR = path.join(BASE_DIR, 'instances');
const GLOBAL_BACKUP_DIR = path.join(BASE_DIR, 'backups', 'global');
const INSTANCES_FILE = path.join(DATA_DIR, 'instances.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOG_FILE = path.join(DATA_DIR, 'panel.log');
const PLUGINS_DIR = path.join(BASE_DIR, 'plugins');

// 保证后台模式与异常退出时致命错误能落盘追踪
const logFatalError = (type, err) => {
    try {
        fs.ensureDirSync(DATA_DIR);
        const msg = `[${new Date().toISOString()}] [FATAL:${type}] ${err?.stack || err?.message || err}\n`;
        fs.appendFileSync(LOG_FILE, msg);
    } catch (_) { }
};
process.on('uncaughtException', (err) => {
    console.error('[FATAL uncaughtException]', err);
    logFatalError('uncaughtException', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Unhandled Rejection]', reason);
    logFatalError('unhandledRejection', reason);
});

const loadUsers = () => {
    try {
        if (fs.existsSync(USERS_FILE)) return fs.readJsonSync(USERS_FILE);
    } catch (e) { }
    return [];
};

const saveUsers = (users) => {
    fs.writeJsonSync(USERS_FILE, users, { spaces: 2 });
};

// --- 多实例迁移与初始化 ---
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(INSTANCES_DIR);
fs.ensureDirSync(GLOBAL_BACKUP_DIR);
fs.ensureDirSync(path.join(DATA_DIR, 'tmp_uploads'));

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
    username: '',
    passwordHash: '',
    passwordSalt: '',
    secret: '',
    isSetup: false,
    port: 3000,
    defaultLang: 'zh',
    theme: 'auto',
    consoleInfoPosition: 'top',
    loaderType: 'fabric',
    jarName: 'fabric-server-launch.jar',
    javaArgs: ['-Xms1G', '-Xmx4G'],
    sessionTimeout: 7,
    maxLogHistory: 1000,
    monitorInterval: 2000,
    javaPath: 'java',
    githubProxy: '',
    sessionSecret: ''
};


// 密码哈希辅助函数
function hashPassword(password, salt) {
    if (!salt) salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

// 登录防爆破与锁定逻辑
const failedAttempts = new Map(); // ip -> { count, lockUntil }

function checkBruteForce(ip) {
    const record = failedAttempts.get(ip);
    if (record && record.lockUntil && Date.now() < record.lockUntil) {
        return {
            locked: true,
            remaining: Math.ceil((record.lockUntil - Date.now()) / 1000)
        };
    }
    return { locked: false };
}

function recordFailedAttempt(ip) {
    let record = failedAttempts.get(ip);
    if (!record) {
        record = { count: 0, lockUntil: 0 };
    }
    record.count++;
    if (record.count >= 5) {
        record.lockUntil = Date.now() + 10 * 60 * 1000; // 锁定10分钟
    }
    failedAttempts.set(ip, record);
}

function resetFailedAttempts(ip) {
    failedAttempts.delete(ip);
}

// 图形验证码生成器 (SVG)
function generateCaptcha() {
    const chars = '23456789abcdefghkmnpqrstuvwxyzABCDEFGHKMNPQRSTUVWXYZ';
    let text = '';
    for (let i = 0; i < 4; i++) {
        text += chars[Math.floor(Math.random() * chars.length)];
    }
    const width = 120;
    const height = 40;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="100%" height="100%" fill="#f3f4f6"/>`;
    for (let i = 0; i < 4; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = Math.random() * width;
        const y2 = Math.random() * height;
        const color = `rgba(${Math.floor(Math.random()*150)},${Math.floor(Math.random()*150)},${Math.floor(Math.random()*150)},0.3)`;
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2"/>`;
    }
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const fontSize = Math.floor(Math.random() * 8) + 22;
        const angle = (Math.random() - 0.5) * 30;
        const x = 15 + i * 25 + Math.random() * 5;
        const y = 28 + (Math.random() - 0.5) * 6;
        const color = `rgb(${Math.floor(Math.random()*150)},${Math.floor(Math.random()*100)},${Math.floor(Math.random()*200)})`;
        svg += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="monospace" font-weight="bold" fill="${color}" transform="rotate(${angle} ${x} ${y})">${char}</text>`;
    }
    svg += `</svg>`;
    return { text: text.toLowerCase(), svg };
}

let appConfig = fs.existsSync(CONFIG_FILE) ? { ...DEFAULT_CONFIG, ...fs.readJsonSync(CONFIG_FILE) } : { ...DEFAULT_CONFIG };

// 生成 sessionSecret 和 cliSecret
if (!appConfig.sessionSecret) {
    appConfig.sessionSecret = authenticator.generateSecret() + '_' + Date.now();
}
if (!appConfig.cliSecret) {
    appConfig.cliSecret = crypto.randomBytes(32).toString('hex');
}

// 立即保存配置文件
if (!fs.existsSync(CONFIG_FILE) || !appConfig.cliSecret) {
    fs.ensureDirSync(DATA_DIR);
    fs.writeJsonSync(CONFIG_FILE, appConfig, { spaces: 2 });
}

function isPathInside(target, base) {
    if (!target || !base) return false;
    const resolvedTarget = path.resolve(target);
    const resolvedBase = path.resolve(base);
    if (process.platform === 'win32') {
        const lowerTarget = resolvedTarget.toLowerCase();
        const lowerBase = resolvedBase.toLowerCase();
        return lowerTarget === lowerBase || lowerTarget.startsWith(lowerBase + path.sep);
    }
    return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep);
}

function nativeHttpGet(urlStr, options = {}) {
    const maxRedirects = options.maxRedirects !== undefined ? options.maxRedirects : 10;
    return new Promise((resolve, reject) => {
        const parsed = new URL(urlStr);
        const mod = parsed.protocol === 'https:' ? https : http;
        const reqOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: options.connectTimeout || 15000,
        };
        const req = mod.request(reqOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, urlStr).href;
                if (maxRedirects > 0) {
                    nativeHttpGet(redirectUrl, { ...options, maxRedirects: maxRedirects - 1 })
                        .then(resolve).catch(reject);
                } else {
                    reject(new Error(`Too many redirects, last status: ${res.statusCode}`));
                }
                return;
            }
            if (res.statusCode >= 400) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode} from ${urlStr}`));
                return;
            }
            resolve(res);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`连接超时: ${urlStr}`)); });
        if (options.signal) {
            options.signal.addEventListener('abort', () => { req.destroy(); reject(new Error('Aborted')); });
        }
        req.end();
    });
}

// GitHub 代理加速
function applyGithubProxy(url) {
    if (!url || typeof url !== 'string') return url;
    if (appConfig.githubProxy && (url.includes('github.com') || url.includes('githubusercontent.com'))) {
        let proxy = appConfig.githubProxy;
        if (!proxy.endsWith('/')) proxy += '/';
        // 防重复叠加检查
        if (url.startsWith(proxy)) return url;
        return proxy + url;
    }
    return url;
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
                    loaderType: 'fabric',
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
    const force = userArgs.includes('--force') || userArgs.includes('-f');
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
    if (force) {
        console.log(`正在强制停止面板 (PID: ${pid})...`);
        try { process.kill(pid, 'SIGKILL'); } catch (e) { }
        cleanPid();
        process.exit(0);
    }
    console.log(`正在停止面板 (PID: ${pid})...`);
    console.log(`提示：如果面板因存在运行中的实例而拒绝关闭，请先关闭实例，或使用 --force 强制关闭`);
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
                console.log('⚠️ 面板可能因存在运行中的实例而拒绝关闭。');
                console.log('   请先在面板中关闭所有运行中的实例，或使用 --force 强制关闭（可能导致数据丢失）');
                process.exit(1);
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
    const force = userArgs.includes('--force') || userArgs.includes('-f');
    const pid = readPid();
    if (pid && isPidAlive(pid)) {
        if (force) {
            console.log(`正在强制停止面板 (PID: ${pid})...`);
            try { process.kill(pid, 'SIGKILL'); } catch (e) { }
            cleanPid();
            console.log('旧进程已停止，正在启动...');
            doStart();
        } else {
            console.log(`正在停止面板 (PID: ${pid})...`);
            console.log(`提示：如果面板因存在运行中的实例而拒绝关闭，请先关闭实例，或使用 --force 强制关闭`);
            try { process.kill(pid, 'SIGTERM'); } catch (e) { }
            let waited = 0;
            const check = () => {
                if (!isPidAlive(pid)) {
                    cleanPid();
                    console.log('旧进程已停止，正在启动...');
                    doStart();
                } else {
                    waited += 500;
                    if (waited > 10000) {
                        console.log('⚠️ 面板可能因存在运行中的实例而拒绝关闭。');
                        console.log('   请先在面板中关闭所有运行中的实例，或使用 --force 强制重启（可能导致数据丢失）');
                        process.exit(1);
                    }
                    setTimeout(check, 500);
                }
            };
            setTimeout(check, 500);
        }
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
    console.log(`  ./${name} [命令] [选项]`);
    console.log('');
    console.log('命令:');
    console.log('  start          启动面板（后台运行，默认）');
    console.log('  stop           停止面板');
    console.log('  restart        重启面板');
    console.log('  host <端口>    修改面板端口');
    console.log('  reset          重置 2FA 密钥');
    console.log('  help           显示帮助');
    console.log('');
    console.log('选项:');
    console.log('  --force, -f    强制停止/重启（跳过运行中实例检查，可能导致数据丢失）');
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
    let logFd = 'ignore';
    try {
        fs.ensureDirSync(DATA_DIR);
        logFd = fs.openSync(LOG_FILE, 'a');
    } catch (_) { }
    const child = spawn(APP_EXECUTABLE, ['--daemon'], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
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
            if (restartingMaster) return;
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
                const executableToRun = msg.newExecutable || APP_EXECUTABLE;
                console.log('Received restart_master signal. Restarting entire panel...');
                if (executableToRun) {
                    const { spawn } = require('child_process');
                    const spawnCwd = path.dirname(executableToRun);
                    const args = process.argv.slice(1).some(arg => arg === 'start') ? ['start'] : ['--daemon'];
                    console.log(`[Restart] Spawning new process: ${executableToRun} with args: ${JSON.stringify(args)}`);
                    console.log(`[Restart] CWD: ${spawnCwd}`);
                    cleanPid();
                    const child = spawn(executableToRun, args, {
                        detached: true,
                        stdio: 'ignore',
                        cwd: spawnCwd
                    });
                    if (child.pid) {
                        console.log(`[Restart] New process spawned with PID: ${child.pid}. Exiting current master...`);
                    }
                    child.on('error', (err) => {
                        console.error('[Restart] Failed to spawn new process:', err);
                    });
                    child.unref();
                    setTimeout(() => process.exit(0), 1000);
                } else {
                    console.log('[Restart] No executable path found, exiting...');
                    process.exit(0);
                }
            } else if (msg.type === 'shutdown_allowed') {
                forceShutdown();
            } else if (msg.type === 'shutdown_blocked') {
                console.log(`\n⚠️  拒绝关闭：存在正在运行的实例（${msg.names}），请先手动关闭所有运行中的实例后再关闭面板`);
                console.log(`   提示：再次按 Ctrl+C 可强制关闭（不推荐，可能导致数据丢失）`);
                shutdownRequested = false;
            }
        });
    };

    forkWorker();

    const cleanup = () => {
        for (const id in cluster.workers) {
            cluster.workers[id].send({ type: 'check_running_before_shutdown' });
        }
    };

    let shutdownRequested = false;
    process.on('SIGINT', () => {
        if (shutdownRequested) {
            for (const id in cluster.workers) cluster.workers[id].kill();
            cleanPid();
            process.exit();
            return;
        }
        shutdownRequested = true;
        cleanup();
    });
    process.on('SIGTERM', () => {
        if (shutdownRequested) {
            for (const id in cluster.workers) cluster.workers[id].kill();
            cleanPid();
            process.exit();
            return;
        }
        shutdownRequested = true;
        cleanup();
    });

    const forceShutdown = () => {
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
        cleanPid();
        process.exit();
    };

} else {
    // Worker Process Logic
    const upload = multer({ dest: path.join(os.tmpdir(), 'mc-uploads') });

    process.on('message', (msg) => {
        if (msg.type === 'check_running_before_shutdown') {
            const runningInstances = instanceConfig.instances.filter(inst => {
                const state = getOrCreateInstanceState(inst.id);
                return state.process !== null;
            });
            if (runningInstances.length > 0) {
                const names = runningInstances.map(i => i.name).join('、');
                console.log(`\n⚠️  拒绝关闭：存在正在运行的实例（${names}），请先手动关闭所有运行中的实例后再关闭面板`);
                console.log(`   提示：再次按 Ctrl+C 可强制关闭（不推荐，可能导致数据丢失）`);
                process.send({ type: 'shutdown_blocked', names });
            } else {
                process.send({ type: 'shutdown_allowed' });
            }
        }
    });

    console.log(`Initializing Data Directories...`);
    console.log(`  INSTANCES_DIR: ${INSTANCES_DIR}`);
    console.log(`  DATA_DIR: ${DATA_DIR}`);
    fs.ensureDirSync(INSTANCES_DIR);
    fs.ensureDirSync(DATA_DIR);

    // (Moved to top level)
    const app = express();
    app.set('trust proxy', true);
    const server = http.createServer(app);
    const io = new Server(server);



    const instancesState = new Map(); // Store runtime state for each instance

    const getOrCreateInstanceState = (instanceId) => {
        if (!instancesState.has(instanceId)) {
            const state = {
                process: null,
                onlinePlayers: new Set(),
                logHistory: [],
                detectedVersion: { mc: 'Unknown', loader: 'Unknown' },
                javaVersion: '',
                stopping: false,
                status: 'stopped'
            };
            const instDir = getInstanceDir(instanceId);
            const logPath = instDir ? path.join(instDir, 'panel.log') : null;
            if (logPath && fs.existsSync(logPath)) {
                try {
                    const data = fs.readFileSync(logPath, 'utf8');
                    const lines = data.slice(-50000).split('\n');
                    state.logHistory = lines.slice(-(appConfig.maxLogHistory || 1000));
                } catch (e) { }
            }
            instancesState.set(instanceId, state);
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

    // Helper: Check if Port is In Use
    const isPortInUse = (port) => {
        return new Promise((resolve) => {
            const net = require('net');
            const tester = net.createServer()
                .once('error', (err) => {
                    if (err.code === 'EADDRINUSE') resolve(true);
                    else resolve(false);
                })
                .once('listening', () => {
                    tester.once('close', () => resolve(false)).close();
                })
                .listen(port);
        });
    };

    // Helper: Download File from URL
    const downloadFile = async (url, dest, instanceId) => {
        try {
            appendLog(instanceId, `[系统] 开始下载预设服务端核心: ${url} ...\n`);
            const writer = fs.createWriteStream(dest);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                headers: { 'User-Agent': MODRINTH_UA }
            });
            
            let downloadedBytes = 0;
            const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
            let lastReportedPercent = -10;
            
            response.data.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                    const percent = Math.floor((downloadedBytes / totalBytes) * 100);
                    if (percent >= lastReportedPercent + 10) {
                        appendLog(instanceId, `[系统] 下载进度: ${percent}%\n`);
                        lastReportedPercent = percent - (percent % 10);
                    }
                }
            });
            
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    appendLog(instanceId, `[系统] 服务端核心下载成功: ${path.basename(dest)} (大小: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB)\n`);
                    resolve();
                });
                writer.on('error', (err) => {
                    appendLog(instanceId, `[系统] 🔴 下载失败: ${err.message}\n`);
                    reject(err);
                });
            });
        } catch (e) {
            appendLog(instanceId, `[系统] 🔴 连接下载源失败: ${e.message}\n`);
            throw e;
        }
    };

    // Helper: Select Best Installed Java Path matching version requirements
    const selectBestJava = (requiredVer) => {
        try {
            const data = readJavaInstalled();
            const installations = data.installations || [];
            const match = installations.find(j => {
                const verStr = (j.version || '').toLowerCase();
                if (requiredVer === 17) {
                    return verStr.includes('17.') || verStr.startsWith('17');
                } else if (requiredVer === 8) {
                    return verStr.includes('1.8.') || verStr.startsWith('8.') || verStr.startsWith('8');
                } else if (requiredVer === 21) {
                    return verStr.includes('21.') || verStr.startsWith('21');
                }
                return false;
            });
            return match ? match.path : '';
        } catch (e) {
            return '';
        }
    };

    // Helper: Trigger registered Webhooks
    const triggerWebhook = async (event, payload) => {
        const urls = appConfig.webhooks || [];
        if (!urls.length) return;
        
        const timestamp = new Date().toISOString();
        const data = {
            event,
            timestamp,
            payload
        };
        
        for (const url of urls) {
            try {
                axios.post(url, data, { timeout: 5000 }).catch(err => {
                    console.error(`[Webhook] Failed to send to ${url}:`, err.message);
                });
            } catch (e) {
                console.error(`[Webhook] Error sending to ${url}:`, e.message);
            }
        }
    };

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

    let scrollEngine = null;

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

        // Notify plugin system's log handlers
        if (pluginLoader.notifyLogHandlers) pluginLoader.notifyLogHandlers(instanceId, msg);
        if (scrollEngine) scrollEngine.handleConsoleLog(instanceId, msg);
    };


    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/dev-guide', (req, res) => res.redirect('https://4ystudio.github.io/mc-web-panel/'));
    app.use('/scrolls-guide', (req, res) => res.redirect('https://4ystudio.github.io/mc-web-panel/scrolls-guide/'));
    app.use('/scrolls-market.html', (req, res) => res.redirect('https://4ystudio.github.io/mc-web-panel/scrolls-market.html'));
    app.use('/scrolls-market', (req, res) => res.redirect('https://4ystudio.github.io/mc-web-panel/scrolls-market.html'));
    app.use('/market.html', (req, res) => res.redirect('https://4ystudio.github.io/mc-web-panel/market.html'));
    app.use('/market', (req, res) => res.redirect('https://4ystudio.github.io/mc-web-panel/market.html'));
    app.use(bodyParser.json());
    app.use(session({
        secret: appConfig.sessionSecret,
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: appConfig.sessionTimeout * 24 * 60 * 60 * 1000 }
    }));

    const requireAuth = (req, res, next) => {
        if (req.session.authenticated) return next();
        const cliSecret = req.headers['x-cli-secret'];
        if (cliSecret && cliSecret === appConfig.cliSecret) {
            return next();
        }
        res.status(401).json({ error: '未授权' });
    };

    const requireAdmin = (req, res, next) => {
        const cliSecret = req.headers['x-cli-secret'];
        if (cliSecret && cliSecret === appConfig.cliSecret) {
            return next();
        }
        if (!req.session.authenticated) {
            return res.status(401).json({ error: '未授权' });
        }
        if (req.session.isSubAccount) {
            return res.status(403).json({ error: '仅限主管理员访问' });
        }
        next();
    };

    const requirePermission = (permission) => {
        return (req, res, next) => {
            const cliSecret = req.headers['x-cli-secret'];
            if (cliSecret && cliSecret === appConfig.cliSecret) {
                return next();
            }
            if (!req.session.authenticated) {
                return res.status(401).json({ error: '未授权' });
            }
            if (!req.session.isSubAccount) {
                return next();
            }
            const permissions = req.session.permissions || [];
            if (permissions.includes(permission)) {
                return next();
            }
            res.status(403).json({ error: '权限不足，无法进行此操作' });
        };
    };

    // --- Plugin System ---
    const pluginLoader = new PluginLoader(app, io, {
        instancesDir: INSTANCES_DIR,
        baseDir: BASE_DIR,
        dataDir: DATA_DIR,
        globalBackupDir: GLOBAL_BACKUP_DIR,
        getConfig: () => appConfig,
        instancesState,
        appendLog,
        pluginsDir: PLUGINS_DIR,
        stateFile: path.join(DATA_DIR, 'plugin-state.json'),
        instanceConfig,
        saveInstances
    });

    // --- Scroll Engine (卷轴系统) ---
    const ScrollEngine = require('./scroll-engine.js');
    scrollEngine = new ScrollEngine({
        projectRoot: BASE_DIR,
        instancesDir: INSTANCES_DIR,
        getInstanceDir,
        getInstances: () => instanceConfig.instances,
        instancesState,
        getActiveInstanceId: () => instanceConfig.activeInstanceId,
        appendLog,
        io
    });
    scrollEngine.init().catch(err => console.error('[ScrollEngine] 初始化异常:', err));
    scrollEngine.registerRoutes(app, requireAuth, withInstance);

    const getPluginPermission = (pluginId) => {
        if (pluginId.includes('backup')) {
            return 'instance.backups';
        }
        if (pluginId.includes('modrinth')) {
            return 'instance.mods';
        }
        return 'panel.plugins';
    };

    const pluginAuthMiddleware = (req, res, next) => {
        const pluginId = req.params.pluginId;
        const permission = getPluginPermission(pluginId);
        if (!req.session.authenticated) {
            return res.status(401).json({ error: '未授权' });
        }
        if (!req.session.isSubAccount) {
            return next();
        }
        const permissions = req.session.permissions || [];
        if (permissions.includes(permission)) {
            return next();
        }
        res.status(403).json({ error: '权限不足，无法进行此操作' });
    };

    pluginLoader.requireAuth = pluginAuthMiddleware;
    pluginLoader.registerMiddleware();

    // Initial discovery and load
    (async () => {
        await pluginLoader.discover();
        await pluginLoader.loadAll();
        console.log('[PluginLoader] All plugins initialized');
    })();

    io.on('connection', (socket) => {
        socket.on('req_history', (instanceId) => {
            const id = (typeof instanceId === 'string' && instanceId) ? instanceId : instanceConfig.activeInstanceId;
            const state = getOrCreateInstanceState(id);
            const channel = (typeof instanceId === 'string' && instanceId) ? `console_history:${instanceId}` : 'console_history';
            socket.emit(channel, state.logHistory);
            // 同步当前在线玩家列表
            const playersChannel = (typeof instanceId === 'string' && instanceId) ? `players_update:${instanceId}` : 'players_update';
            socket.emit(playersChannel, Array.from(state.onlinePlayers));
        });

        socket.on('req_players', (instanceId) => {
            const id = (typeof instanceId === 'string' && instanceId) ? instanceId : instanceConfig.activeInstanceId;
            const state = getOrCreateInstanceState(id);
            const channel = (typeof instanceId === 'string' && instanceId) ? `players_update:${instanceId}` : 'players_update';
            socket.emit(channel, Array.from(state.onlinePlayers));
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

                    const now = Date.now();
                    if (!state.metaCache || (now - state.metaCache.timestamp > 10000)) {
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
                                    if (vData.loaderType) inst.loaderType = vData.loaderType;
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

                            // Mods & Plugins detection
                            const modsDir = path.join(instDir, 'mods');
                            if (fs.existsSync(modsDir)) {
                                try {
                                    const modFiles = fs.readdirSync(modsDir).map(f => f.toLowerCase());
                                    hasBackupMod = modFiles.some(f => f.includes('advancedbackups') || f.includes('advanced-backups') || f.includes('advanced_backups'));
                                    hasEasyAuth = modFiles.some(f => f.includes('easyauth') || f.includes('easy-auth') || f.includes('easy_auth'));
                                    hasVoicechat = modFiles.some(f => f.includes('voicechat') || f.includes('voice-chat') || f.includes('voice_chat'));
                                } catch (e) { }
                            }
                            const serverPluginsDir = path.join(instDir, 'plugins');
                            if (fs.existsSync(serverPluginsDir)) {
                                try {
                                    const pluginFiles = fs.readdirSync(serverPluginsDir).map(f => f.toLowerCase());
                                    if (!hasBackupMod) hasBackupMod = pluginFiles.some(f => f.includes('backup'));
                                    if (!hasEasyAuth) hasEasyAuth = pluginFiles.some(f => f.includes('easyauth') || f.includes('easy-auth') || f.includes('authme'));
                                    if (!hasVoicechat) hasVoicechat = pluginFiles.some(f => f.includes('voicechat') || f.includes('voice-chat') || f.includes('voice_chat'));
                                } catch (e) { }
                            }
                            // Fallback detection from existing config directories
                            if (!hasVoicechat) {
                                hasVoicechat = fs.existsSync(path.join(instDir, 'config', 'voicechat')) ||
                                               fs.existsSync(path.join(instDir, 'plugins', 'voicechat')) ||
                                               fs.existsSync(path.join(instDir, 'config', 'voicechat.properties')) ||
                                               fs.existsSync(path.join(instDir, 'config', 'voicechat-server.properties'));
                            }
                            if (!hasEasyAuth) {
                                hasEasyAuth = fs.existsSync(path.join(instDir, 'EasyAuth')) ||
                                              fs.existsSync(path.join(instDir, 'easyauth')) ||
                                              fs.existsSync(path.join(instDir, 'config', 'EasyAuth')) ||
                                              fs.existsSync(path.join(instDir, 'config', 'easyauth'));
                            }
                            // Check for icon
                            const iconFile = path.join(instDir, 'server-icon.png');
                            hasIcon = fs.existsSync(iconFile);
                        }

                        state.metaCache = {
                            timestamp: now,
                            versionInfo,
                            serverInfo,
                            hasBackupMod,
                            hasEasyAuth,
                            hasVoicechat,
                            isSetup,
                            hasIcon
                        };
                    }

                    const { versionInfo, serverInfo, hasBackupMod, hasEasyAuth, hasVoicechat, isSetup, hasIcon } = state.metaCache;

                    if (!state.process) {
                        state.status = 'stopped';
                    } else if (!state.status) {
                        state.status = 'running';
                    }

                    const instStatus = {
                        id: inst.id,
                        name: inst.name,
                        status: state.status || (state.process ? 'running' : 'stopped'),
                        isRunning: !!state.process,
                        onlinePlayers: state.onlinePlayers.size,
                        onlinePlayerList: Array.from(state.onlinePlayers),
                        maxPlayers: serverInfo.maxPlayers,
                        port: serverInfo.port,
                        motd: serverInfo.motd,
                        version: versionInfo,
                        loaderType: inst.loaderType || 'fabric',
                        jarName: inst.jarName,
                        javaArgs: inst.javaArgs,
                        javaPath: inst.javaPath,
                        backupStrategy: inst.backupStrategy || (hasBackupMod ? 'mod' : 'panel'),
                        autoBackupEnabled: inst.autoBackupEnabled || false,
                        autoBackupMode: inst.autoBackupMode || 'interval',
                        autoBackupInterval: inst.autoBackupInterval || 12,
                        autoBackupIntervalHours: inst.autoBackupIntervalHours || 12,
                        autoBackupIntervalMinutes: inst.autoBackupIntervalMinutes || 0,
                        autoBackupScheduleTime: inst.autoBackupScheduleTime || "03:00",
                        autoBackupScheduleDays: inst.autoBackupScheduleDays || 1,
                        autoBackupOnlyIfPlayersOnline: inst.autoBackupOnlyIfPlayersOnline || false,
                        maxBackupCount: inst.maxBackupCount || 10,
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
                const activeInstState = getOrCreateInstanceState(activeId);
                const activeInst = instanceConfig.instances.find(i => i.id === activeId);

                if (!activeInstState.javaVersion && activeInst) {
                    const rawPath = activeInst.javaPath || appConfig.javaPath;
                    checkJavaVersion(rawPath).then(v => { if (v && v !== 'Not Installed') activeInstState.javaVersion = v; });
                }

                io.emit('system_stats', {
                    ...systemStats,
                    activeInstanceId: activeId,
                    mc: {
                        port: activeStatus.port,
                        maxPlayers: activeStatus.maxPlayers,
                        motd: activeStatus.motd,
                        online: activeStatus.onlinePlayers,
                        onlinePlayerList: Array.from(activeInstState.onlinePlayers)
                    },
                    version: activeStatus.version,
                    loaderType: activeInst ? (activeInst.loaderType || 'fabric') : 'fabric',
                    hasBackupMod: activeStatus.hasBackupMod,
                    hasEasyAuth: activeStatus.hasEasyAuth,
                    hasVoicechat: activeStatus.hasVoicechat,
                    isSetup: activeStatus.isSetup,
                    javaVersion: activeInstState.javaVersion || globalJavaVersion || 'Checking...',
                    isRunning: activeStatus.isRunning,
                    status: activeStatus.status
                });

            } catch (e) { console.error('Monitor loop error:', e); }
        }
    }, appConfig.monitorInterval);

    // --- 多实例管理 API ---
    app.get('/api/instances/list', requireAuth, (req, res) => {
        res.json({ instances: instanceConfig.instances, activeInstanceId: instanceConfig.activeInstanceId });
    });

    app.post('/api/instances/create', requireAdmin, async (req, res) => {
        const { name, jarName, javaArgs, javaPath, loaderType, preset } = req.body;
        if (!name) return res.status(400).json({ error: '实例名称不能为空' });

        const id = crypto.randomBytes(4).toString('hex');
        const dir = `instances/${id}`;
        const absDir = path.join(BASE_DIR, dir);

        let finalJarName = jarName;
        let finalLoaderType = loaderType || appConfig.loaderType || 'fabric';
        let finalJavaPath = javaPath;

        const PRESETS = {
            'vanilla-1.20.4': {
                url: 'https://api.papermc.io/v2/projects/paper/versions/1.20.4/builds/496/downloads/paper-1.20.4-496.jar',
                jarName: 'paper-1.20.4-496.jar',
                loaderType: 'fabric',
                javaVer: 17
            },
            'fabric-1.20.1': {
                url: 'https://meta.fabricmc.net/v2/versions/loader/1.20.1/0.15.11/1.0.1/server/jar',
                jarName: 'fabric-server-mc.1.20.1-loader.0.15.11-launcher.1.0.1.jar',
                loaderType: 'fabric',
                javaVer: 17
            },
            'paper-1.12.2': {
                url: 'https://api.papermc.io/v2/projects/paper/versions/1.12.2/builds/1618/downloads/paper-1.12.2-1618.jar',
                jarName: 'paper-1.12.2-1618.jar',
                loaderType: 'fabric',
                javaVer: 8
            }
        };

        if (preset && PRESETS[preset]) {
            const p = PRESETS[preset];
            finalJarName = p.jarName;
            finalLoaderType = p.loaderType;
            const bestJava = selectBestJava(p.javaVer);
            if (bestJava) {
                finalJavaPath = bestJava;
            }
        }

        try {
            fs.ensureDirSync(absDir);

            // Automatically write eula.txt to accept EULA
            await fs.writeFile(path.join(absDir, 'eula.txt'), 'eula=true');

            // Pre-create server.properties if preset is used
            if (preset) {
                await fs.writeFile(path.join(absDir, 'server.properties'), `server-port=25565\nmotd=A Minecraft Server Created by Setup Wizard\n`);
            }

            instanceConfig.instances.push({
                id, name, dir,
                loaderType: finalLoaderType,
                jarName: finalJarName || appConfig.jarName,
                javaArgs: (javaArgs && javaArgs.length) ? javaArgs : appConfig.javaArgs,
                javaPath: finalJavaPath || appConfig.javaPath,
                backupStrategy: 'panel',
                autoBackupEnabled: false,
                autoBackupInterval: 12,
                maxBackupCount: 10,
                createdAt: new Date().toISOString()
            });
            saveInstances(instanceConfig);
            if (pluginLoader && pluginLoader.emitLifecycleEvent) {
                pluginLoader.emitLifecycleEvent('instanceCreated', {
                    instance: { id, name, dir, loaderType: finalLoaderType }
                });
            }
            const instState = getOrCreateInstanceState(id); // Initialize state
            if (scrollEngine) scrollEngine.loadInstanceScrolls(id).catch(() => {});

            // If preset, start download in background
            if (preset && PRESETS[preset]) {
                const p = PRESETS[preset];
                const dest = path.join(absDir, p.jarName);
                downloadFile(p.url, dest, id).catch(err => {
                    console.error(`Failed to download preset jar for ${id}`, err);
                });
            }

            res.json({ success: true, instance: { id, name } });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/instances/update', requirePermission('instance.properties'), (req, res) => {
        const { id, name, jarName, javaArgs, javaPath, loaderType, backupStrategy, autoBackupEnabled, autoBackupInterval, maxBackupCount,
            autoBackupMode, autoBackupIntervalHours, autoBackupIntervalMinutes, autoBackupScheduleTime, autoBackupScheduleDays, autoBackupOnlyIfPlayersOnline
        } = req.body;
        const inst = instanceConfig.instances.find(i => i.id === id);
        if (!inst) return res.status(404).json({ error: '实例不存在' });

        if (name) inst.name = name;
        if (jarName !== undefined) inst.jarName = jarName;
        if (javaArgs !== undefined) inst.javaArgs = javaArgs;
        if (javaPath !== undefined) inst.javaPath = javaPath;
        if (loaderType !== undefined) inst.loaderType = loaderType;
        if (backupStrategy) {
            inst.backupStrategy = backupStrategy;
            if (backupStrategy !== 'panel') inst.autoBackupEnabled = false;
        }
        if (autoBackupEnabled !== undefined) inst.autoBackupEnabled = autoBackupEnabled;
        if (autoBackupInterval !== undefined) inst.autoBackupInterval = autoBackupInterval;
        if (autoBackupMode !== undefined) inst.autoBackupMode = autoBackupMode;
        if (autoBackupIntervalHours !== undefined) inst.autoBackupIntervalHours = autoBackupIntervalHours;
        if (autoBackupIntervalMinutes !== undefined) inst.autoBackupIntervalMinutes = autoBackupIntervalMinutes;
        if (autoBackupScheduleTime !== undefined) inst.autoBackupScheduleTime = autoBackupScheduleTime;
        if (autoBackupScheduleDays !== undefined) inst.autoBackupScheduleDays = autoBackupScheduleDays;
        if (autoBackupOnlyIfPlayersOnline !== undefined) inst.autoBackupOnlyIfPlayersOnline = autoBackupOnlyIfPlayersOnline;
        if (maxBackupCount !== undefined) inst.maxBackupCount = maxBackupCount;

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

    app.post('/api/instances/rename', requireAdmin, (req, res) => {
        const { id, name } = req.body;
        const inst = instanceConfig.instances.find(i => i.id === id);
        if (!inst) return res.status(404).json({ error: '实例不存在' });
        inst.name = name;
        saveInstances(instanceConfig);
        res.json({ success: true });
    });

    app.post('/api/instances/delete', requireAdmin, async (req, res) => {
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
            if (scrollEngine) scrollEngine.unloadInstance(id);
            if (pluginLoader && pluginLoader.emitLifecycleEvent) {
                pluginLoader.emitLifecycleEvent('instanceDeleted', { instanceId: id });
            }
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
        try {
            const data = fs.readJsonSync(JAVA_INSTALLED_FILE);
            // 自动修正逻辑：修复之前可能被误识别为 Java 1 的 Java 8 (1.8) 等版本
            let changed = false;
            data.installations = data.installations.map(inst => {
                if (inst.featureVersion === 1 && inst.version.startsWith('1.')) {
                    const match = inst.version.match(/^1\.(\d+)/);
                    if (match) {
                        inst.featureVersion = parseInt(match[1]);
                        changed = true;
                    }
                }
                return inst;
            });
            if (changed) {
                console.log('[Java] Fixed legacy Java 1 entries to correct feature versions');
                writeJavaInstalled(data);
            }
            return data;
        } catch (e) { return { installations: [] }; }
    };
    const writeJavaInstalled = (data) => {
        fs.writeJsonSync(JAVA_INSTALLED_FILE, data, { spaces: 2 });
    };

    // Adoptium API base URLs for different mirrors
    const ADOPTIUM_SOURCES = {
        adoptium: 'https://api.adoptium.net/v3',
        tuna: 'https://mirrors.tuna.tsinghua.edu.cn/Adoptium',
        ghproxy: 'ghproxy' // 标记使用 GitHub 代理
    };

    /**
     * 将官方下载地址映射为国内加速或镜像源地址
     */
    const resolveJavaMirrorUrl = (originalUrl, source, featureVersion, arch, osType) => {
        if (!originalUrl || source === 'adoptium') return { url: originalUrl, mirrorUrl: null };

        if (source === 'ghproxy') {
            return { url: applyGithubProxy(originalUrl), mirrorUrl: null };
        }

        if (source === 'tuna' && ADOPTIUM_SOURCES.tuna) {
            try {
                const filename = path.basename(originalUrl);
                const imageType = originalUrl.includes('-jdk_') ? 'jdk' : 'jre';
                const mirrorBase = ADOPTIUM_SOURCES.tuna;
                const mirrorUrl = `${mirrorBase}/${featureVersion}/${imageType}/${arch}/${osType}/${filename}`;
                console.log(`[Java] Mirror URL for v${featureVersion} (${source}): ${mirrorUrl}`);
                return { url: mirrorUrl, mirrorUrl: null };
            } catch (e) {
                console.warn(`[Java] Failed to construct mirror URL: ${e.message}`);
            }
        }

        return { url: applyGithubProxy(originalUrl), mirrorUrl: null };
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

            // Get available feature versions from Adoptium API
            let featureVersions = [8, 11, 17, 21, 22]; // Fallback
            let ltsVersions = [8, 11, 17, 21];
            try {
                const infoUrl = `${ADOPTIUM_SOURCES.adoptium}/info/available_releases`;
                const infoResp = await axios.get(infoUrl, { timeout: 10000, headers: { 'User-Agent': MODRINTH_UA } });
                if (infoResp.data && infoResp.data.available_releases) {
                    featureVersions = infoResp.data.available_releases;
                }
                if (infoResp.data && infoResp.data.available_lts_releases) {
                    ltsVersions = infoResp.data.available_lts_releases;
                }
            } catch (e) {
                console.warn(`[Java] Failed to fetch available releases, using fallback: ${e.message}`);
            }

            // 并行拉取元数据，提高响应速度
            const results = [];
            const fetchVersionData = async (fv) => {
                const tryFetch = async (imageType) => {
                    const url = `${ADOPTIUM_SOURCES.adoptium}/assets/latest/${fv}/hotspot?architecture=${arch}&os=${osType}&image_type=${imageType}`;
                    return await axios.get(url, {
                        timeout: 30000,
                        headers: { 'User-Agent': MODRINTH_UA }
                    });
                };

                try {
                    // 优先尝试 JRE
                    let resp;
                    let typeUsed = 'jre';
                    try {
                        resp = await tryFetch('jre');
                    } catch (e) {
                        if (e.response?.status === 404) {
                            // JRE 不存在，尝试 JDK
                            resp = await tryFetch('jdk');
                            typeUsed = 'jdk';
                        } else {
                            throw e;
                        }
                    }

                    if (resp.data && resp.data.length > 0) {
                        const asset = resp.data[0];
                        const originalDownloadUrl = asset.binary?.package?.link;
                        const resolved = resolveJavaMirrorUrl(originalDownloadUrl, source, fv, arch, osType);

                        return {
                            featureVersion: fv,
                            version: asset.version?.openjdk_version || asset.version?.semver || `${fv}`,
                            releaseName: asset.release_name,
                            downloadUrl: resolved.url,
                            fallbackUrl: (source !== 'adoptium' && originalDownloadUrl !== resolved.url) ? applyGithubProxy(originalDownloadUrl) : null,
                            size: asset.binary?.package?.size || 0,
                            imageType: typeUsed,
                            vendor: asset.vendor || 'Adoptium',
                            checksum: asset.binary?.package?.checksum
                        };
                    }
                } catch (e) {
                    // Skip unavailable versions
                }
                return null;
            };

            const allResults = await Promise.all(featureVersions.map(fv => fetchVersionData(fv)));
            const finalResults = allResults.filter(r => r !== null);

            res.json({ source, results: finalResults, ltsVersions });
        } catch (e) {
            res.status(500).json({ error: '获取可用版本失败: ' + e.message });
        }
    });

    // POST /api/java/install — 下载并安装 Java
    app.post('/api/java/install', requireAdmin, async (req, res) => {
        const { featureVersion, downloadUrl, version, source, fallbackUrl } = req.body;
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

        const tryDownloadWithAxios = async (url, label) => {
            console.log(`[Java Install] [axios] Downloading from ${label}: ${url}`);
            io.emit('java_install_progress', { featureVersion, step: 'downloading', percent: 0, message: `正在从${label}下载...` });

            const response = await axios({
                method: 'get',
                url,
                responseType: 'stream',
                timeout: 600000,
                signal: controller.signal,
                headers: { 'User-Agent': MODRINTH_UA },
                validateStatus: (status) => status >= 200 && status < 400,
                maxRedirects: 10,
                httpAgent: new http.Agent({ timeout: 15000 }),
                httpsAgent: new https.Agent({ timeout: 15000 })
            });

            console.log(`[Java Install] [axios] Connected to ${label}, status: ${response.status}, size: ${response.headers['content-length'] || 'unknown'}`);
            return { stream: response.data, contentLength: parseInt(response.headers['content-length'] || '0', 10) };
        };

        const tryDownloadNative = async (url, label) => {
            console.log(`[Java Install] [native] Downloading from ${label}: ${url}`);
            io.emit('java_install_progress', { featureVersion, step: 'downloading', percent: 0, message: `正在从${label}下载(原生模式)...` });

            const res = await nativeHttpGet(url, {
                headers: { 'User-Agent': MODRINTH_UA },
                maxRedirects: 10,
                signal: controller.signal
            });

            console.log(`[Java Install] [native] Connected to ${label}, status: ${res.statusCode}, size: ${res.headers['content-length'] || 'unknown'}`);
            return { stream: res, contentLength: parseInt(res.headers['content-length'] || '0', 10) };
        };

        const tryDownload = async (url, label) => {
            try {
                return await tryDownloadWithAxios(url, label);
            } catch (axiosErr) {
                if (controller.signal.aborted) throw axiosErr;
                console.warn(`[Java Install] axios failed for ${label}: ${axiosErr.message}`);
                console.log(`[Java Install] Retrying with native HTTP...`);
                try {
                    return await tryDownloadNative(url, label);
                } catch (nativeErr) {
                    if (controller.signal.aborted) throw nativeErr;
                    throw new Error(`${label}下载失败(axios: ${axiosErr.message}, native: ${nativeErr.message})`);
                }
            }
        };

        // Download in background with progress
        try {
            fs.ensureDirSync(installDir);
            const tmpFile = path.join(JAVA_DIR, `${id}.tar.gz`);

            let dlResult;
            let usedUrl = downloadUrl;
            const sourceLabel = source === 'tuna' ? '清华镜像' : (source === 'ghproxy' ? 'GitHub代理' : '源站');

            let urlsToTry = [{ url: downloadUrl, label: sourceLabel }];

            if (fallbackUrl && fallbackUrl !== downloadUrl) {
                urlsToTry.push({ url: fallbackUrl, label: '备用源' });
            }

            if (downloadUrl.includes('github.com') && source !== 'tuna') {
                try {
                    const filename = path.basename(downloadUrl);
                    const imageType = downloadUrl.includes('-jdk_') ? 'jdk' : 'jre';
                    const arch = os.arch() === 'x64' ? 'x64' : os.arch() === 'arm64' ? 'aarch64' : os.arch();
                    const osType = process.platform === 'linux' ? 'linux' : process.platform === 'darwin' ? 'mac' : 'windows';
                    const autoMirrorUrl = `${ADOPTIUM_SOURCES.tuna}/${featureVersion}/${imageType}/${arch}/${osType}/${filename}`;
                    if (!urlsToTry.some(u => u.url === autoMirrorUrl)) {
                        urlsToTry.push({ url: autoMirrorUrl, label: '清华镜像(自动)' });
                    }
                } catch (e) { }
            }

            if (appConfig.githubProxy && downloadUrl.includes('github.com')) {
                const proxyUrl = applyGithubProxy(downloadUrl);
                if (proxyUrl !== downloadUrl && !urlsToTry.some(u => u.url === proxyUrl)) {
                    urlsToTry.push({ url: proxyUrl, label: 'GitHub代理' });
                }
            }

            let lastError = null;
            for (let i = 0; i < urlsToTry.length; i++) {
                const { url, label } = urlsToTry[i];
                try {
                    if (i > 0) {
                        console.log(`[Java Install] Trying fallback ${i}/${urlsToTry.length - 1}: ${label}`);
                        io.emit('java_install_progress', { featureVersion, step: 'downloading', percent: 0, message: `正在尝试${label}...` });
                    }
                    dlResult = await tryDownload(url, label);
                    usedUrl = url;
                    lastError = null;
                    break;
                } catch (err) {
                    if (controller.signal.aborted) throw err;
                    lastError = err;
                    console.warn(`[Java Install] ${label} failed: ${err.message}`);
                }
            }

            if (!dlResult) {
                const failedSources = urlsToTry.map(u => `[${u.label}]`).join(', ');
                throw new Error(`所有下载源均失败(${failedSources}): ${lastError?.message || '未知错误'}`);
            }

            const totalBytes = dlResult.contentLength;
            let downloadedBytes = 0;

            const writer = fs.createWriteStream(tmpFile);
            let lastUpdateTime = Date.now();
            let lastDownloadedBytes = 0;

            dlResult.stream.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                const now = Date.now();
                if (now - lastUpdateTime >= 1000) {
                    const speed = (downloadedBytes - lastDownloadedBytes) / ((now - lastUpdateTime) / 1000);
                    lastUpdateTime = now;
                    lastDownloadedBytes = downloadedBytes;

                    if (totalBytes > 0) {
                        const percent = Math.round((downloadedBytes / totalBytes) * 80); // 80% for download
                        io.emit('java_install_progress', {
                            featureVersion, step: 'downloading', percent,
                            message: `下载中... ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB`,
                            speed: speed
                        });
                    }
                }
            });
            await pipeline(
                dlResult.stream,
                writer,
                { signal: controller.signal }
            );

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
            if (e.name === 'AbortError' || e.code === 'ERR_CANCELED' || (controller && controller.signal.aborted)) {
                console.log(`[Java Install] Cancelled: ${featureVersion}`);
                io.emit('java_install_progress', { featureVersion, step: 'error', percent: 0, message: '已取消更新' });
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
    app.post('/api/java/install/cancel', requireAdmin, (req, res) => {
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
    app.post('/api/java/remove', requireAdmin, async (req, res) => {
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
    app.post('/api/java/add-local', requireAdmin, async (req, res) => {
        const { javaPath: localPath } = req.body;
        if (!localPath) return res.status(400).json({ error: '参数不完整' });

        const detectedVer = await checkJavaVersion(localPath);
        if (detectedVer === 'Not Installed') {
            return res.status(400).json({ error: '指定路径无法运行 Java: ' + localPath });
        }

        // Parse feature version from detected version (handles 1.8 -> 8, 11 -> 11)
        const fvMatch = detectedVer.match(/^(\d+)(?:\.(\d+))?/);
        let featureVersion = 0;
        if (fvMatch) {
            const major = parseInt(fvMatch[1]);
            const minor = fvMatch[2] ? parseInt(fvMatch[2]) : 0;
            featureVersion = (major === 1 && minor > 0) ? minor : major;
        }

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
    app.post('/api/probe-url', requireAdmin, async (req, res) => {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: '缺少 URL' });
        try {
            const resp = await axios.head(url, {
                timeout: 10000,
                headers: { 'User-Agent': MODRINTH_UA },
                maxRedirects: 5
            });
            res.json({ accessible: resp.status >= 200 && resp.status < 400, status: resp.status, size: parseInt(resp.headers['content-length'] || '0', 10) });
        } catch (e) {
            res.json({ accessible: false, status: e.response?.status || 0, error: e.message });
        }
    });

    app.get('/api/java/sources', requireAuth, (req, res) => {
        res.json([
            { id: 'adoptium', name: 'Adoptium (Official)', url: ADOPTIUM_SOURCES.adoptium },
            { id: 'tuna', name: '清华大学镜像', url: ADOPTIUM_SOURCES.tuna },
            { id: 'ghproxy', name: 'GitHub 代理加速 (推荐)', url: appConfig.githubProxy || 'Mirror' }
        ]);
    });

    app.get('/api/java/diagnose', requireAuth, async (req, res) => {
        const results = {};
        const arch = os.arch() === 'x64' ? 'x64' : os.arch() === 'arm64' ? 'aarch64' : os.arch();
        const osType = process.platform === 'linux' ? 'linux' : process.platform === 'darwin' ? 'mac' : 'windows';
        const fv = 17;

        results.system = { arch, os: osType, nodeVersion: process.version, platform: process.platform };
        results.paths = { BASE_DIR, DATA_DIR, JAVA_DIR: path.join(DATA_DIR, 'java') };

        const testUrl = async (label, url) => {
            const r = { url, axios: null, native: null };
            try {
                const resp = await axios.head(url, { timeout: 10000, headers: { 'User-Agent': MODRINTH_UA }, maxRedirects: 5 });
                r.axios = { ok: true, status: resp.status, size: parseInt(resp.headers['content-length'] || '0', 10) };
            } catch (e) {
                r.axios = { ok: false, status: e.response?.status || 0, error: e.message };
            }
            try {
                const resp = await nativeHttpGet(url, { method: 'HEAD', headers: { 'User-Agent': MODRINTH_UA }, connectTimeout: 10000, maxRedirects: 5 });
                r.native = { ok: true, status: resp.statusCode, size: parseInt(resp.headers['content-length'] || '0', 10) };
                resp.resume();
            } catch (e) {
                r.native = { ok: false, error: e.message };
            }
            return r;
        };

        try {
            results.adoptiumApi = await testUrl('Adoptium API', `${ADOPTIUM_SOURCES.adoptium}/info/available_releases`);
        } catch (e) { results.adoptiumApi = { error: e.message }; }

        try {
            const assetUrl = `${ADOPTIUM_SOURCES.adoptium}/assets/latest/${fv}/hotspot?architecture=${arch}&os=${osType}&image_type=jre`;
            const assetResp = await axios.get(assetUrl, { timeout: 15000, headers: { 'User-Agent': MODRINTH_UA } });
            if (assetResp.data && assetResp.data[0]) {
                const originalUrl = assetResp.data[0].binary?.package?.link;
                const filename = path.basename(originalUrl);
                const imageType = originalUrl.includes('-jdk_') ? 'jdk' : 'jre';
                const mirrorUrl = `${ADOPTIUM_SOURCES.tuna}/${fv}/${imageType}/${arch}/${osType}/${filename}`;

                results.originalUrl = originalUrl;
                results.mirrorUrl = mirrorUrl;
                results.tunaMirror = await testUrl('清华镜像', mirrorUrl);
                results.githubDirect = await testUrl('GitHub', originalUrl);

                if (appConfig.githubProxy) {
                    const proxyUrl = applyGithubProxy(originalUrl);
                    if (proxyUrl !== originalUrl) {
                        results.githubProxy = { proxy: appConfig.githubProxy, proxyUrl };
                        results.githubProxyTest = await testUrl('GitHub代理', proxyUrl);
                    }
                }
            }
        } catch (e) {
            results.assetFetchError = e.message;
        }

        res.json(results);
    });


    // 检查插件更新服务 (由插件开发者决定更新地址，非统一商店)
    app.get('/api/plugins/check-update', requirePermission('panel.plugins'), async (req, res) => {
        const { pluginId } = req.query;
        if (!pluginId) {
            return res.status(400).json({ error: '缺少插件 ID' });
        }

        const manifest = pluginLoader.getPluginManifest(pluginId);
        if (!manifest) {
            return res.status(404).json({ error: '未找到该插件' });
        }

        const updateUrl = manifest.updateUrl || manifest.updateCheckUrl;
        if (!updateUrl) {
            return res.status(400).json({ error: '该插件未配置更新查询地址 (updateUrl)' });
        }

        try {
            const response = await axios.get(updateUrl, { timeout: 5000 });
            const data = response.data;
            if (!data || !data.version) {
                return res.status(400).json({ error: '更新接口返回的格式不正确' });
            }

            res.json({
                currentVersion: manifest.version,
                latestVersion: data.version,
                downloadUrl: data.downloadUrl || data.url,
                changelog: data.changelog || data.description || ''
            });
        } catch (e) {
            res.status(500).json({ error: '获取更新失败: ' + e.message });
        }
    });

    // 远程执行插件更新/升级安装
    app.post('/api/plugins/update-remote', requirePermission('panel.plugins'), async (req, res) => {
        const { pluginId, downloadUrl } = req.body;
        if (!pluginId || !downloadUrl) {
            return res.status(400).json({ error: '缺少必要参数 (pluginId 或 downloadUrl)' });
        }

        const tempZipPath = path.join(PLUGINS_DIR, `_update_${pluginId}_${Date.now()}.zip`);
        try {
            // 下载 ZIP 文件到临时目录
            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempZipPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // 先卸载原先的插件以防文件冲突与旧实例占用
            try {
                await pluginLoader.uninstall(pluginId);
            } catch (err) {
                // 如果是新安装，卸载失败可以忽略
            }

            // 执行新版本热安装
            const manifest = await pluginLoader.install(tempZipPath);

            // 清理下载的 ZIP 压缩包
            await fs.remove(tempZipPath);

            res.json({ success: true, plugin: manifest });
        } catch (e) {
            if (fs.existsSync(tempZipPath)) {
                try { await fs.remove(tempZipPath); } catch (err) {}
            }
            console.error('Failed to update plugin remotely:', e);
            res.status(500).json({ error: '远程插件更新失败: ' + e.message });
        }
    });

    // --- Plugin System API ---
    app.get('/api/plugins/list', requirePermission('panel.plugins'), (req, res) => {
        const lang = req.query.lang || 'zh';
        const list = pluginLoader.getPluginList().map(p => ({
            ...p,
            name: PluginLoader.getLocalizedValue(p.name, lang),
            description: PluginLoader.getLocalizedValue(p.description, lang)
        }));
        res.json(list);
    });

    app.post('/api/plugins/enable', requirePermission('panel.plugins'), async (req, res) => {
        try {
            const { pluginId } = req.body;
            if (!pluginId) return res.status(400).json({ error: '缺少插件 ID' });
            await pluginLoader.enable(pluginId);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/plugins/disable', requirePermission('panel.plugins'), async (req, res) => {
        try {
            const { pluginId } = req.body;
            if (!pluginId) return res.status(400).json({ error: '缺少插件 ID' });
            await pluginLoader.disable(pluginId);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    const pluginUpload = multer({ dest: path.join(DATA_DIR, 'tmp_uploads') });
    app.post('/api/plugins/upload', requirePermission('panel.plugins'), pluginUpload.single('plugin'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: '未收到文件' });
            const analysis = await pluginLoader.analyzePlugin(req.file.path);

            // Cleanup the original upload file, we keep the tempDir from analysis if it exists
            try { await fs.remove(req.file.path); } catch (e) { }

            res.json({
                success: true,
                analysis: {
                    manifest: analysis.manifest,
                    existing: analysis.existing,
                    isUpdate: analysis.isUpdate,
                    tempDir: analysis.tempDir,
                    finalDir: analysis.finalDir
                }
            });
        } catch (e) {
            if (req.file) try { await fs.remove(req.file.path); } catch (e2) { }
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/plugins/install-confirm', requirePermission('panel.plugins'), async (req, res) => {
        try {
            const { tempDir, finalDir } = req.body;
            if (!tempDir || !finalDir) return res.status(400).json({ error: '缺少安装信息' });

            const normalizedPluginsDir = path.resolve(PLUGINS_DIR);
            const resolvedFinalDir = path.resolve(finalDir);
            const resolvedTempDir = path.resolve(tempDir);
            if (!isPathInside(resolvedFinalDir, normalizedPluginsDir) || resolvedFinalDir === normalizedPluginsDir) {
                return res.status(400).json({ error: '非法的安装路径' });
            }
            if (!isPathInside(resolvedTempDir, normalizedPluginsDir) || resolvedTempDir === normalizedPluginsDir) {
                return res.status(400).json({ error: '非法的临时路径' });
            }

            const manifest = await pluginLoader.install(finalDir);

            if (tempDir && fs.existsSync(tempDir)) {
                try { await fs.remove(tempDir); } catch (e) { }
            }

            res.json({ success: true, plugin: manifest });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/plugins/uninstall', requirePermission('panel.plugins'), async (req, res) => {
        try {
            const { pluginId } = req.body;
            if (!pluginId) return res.status(400).json({ error: '缺少插件 ID' });
            await pluginLoader.uninstall(pluginId);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/plugins/export/:pluginId', requirePermission('panel.plugins'), async (req, res) => {
        const { pluginId } = req.params;
        const pluginPath = path.join(PLUGINS_DIR, pluginId);
        if (!fs.existsSync(pluginPath)) {
            return res.status(404).json({ error: '插件不存在' });
        }

        try {
            res.attachment(`${pluginId}.zip`);
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('error', (err) => {
                console.error('Archive error:', err);
                if (!res.headersSent) res.status(500).send(err.message);
            });
            archive.pipe(res);
            archive.directory(pluginPath, false);
            await archive.finalize();
        } catch (e) {
            console.error('Export error:', e);
            if (!res.headersSent) res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/plugins/:pluginId/manifest', requireAuth, (req, res) => {
        const manifest = pluginLoader.getPluginManifest(req.params.pluginId);
        if (!manifest) return res.status(404).json({ error: '插件不存在' });
        res.json(manifest);
    });

    app.get('/api/plugins/:pluginId/component/:componentName', requireAuth, (req, res) => {
        const components = pluginLoader.getComponents();
        const comp = components[req.params.componentName];
        if (!comp || comp.pluginId !== req.params.pluginId) {
            return res.status(404).json({ error: '组件不存在' });
        }
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(comp.path);
    });

    app.get('/api/plugins/sidebar-items', requireAuth, (req, res) => {
        res.json(pluginLoader.getSidebarItems());
    });

    app.get('/api/plugins/components', requireAuth, (req, res) => {
        res.json(pluginLoader.getComponents());
    });

    app.get('/api/plugins/dashboard-cards', requireAuth, (req, res) => {
        res.json(pluginLoader.getDashboardCards());
    });
    
    app.get('/api/plugins/translations', requireAuth, (req, res) => {
        res.json(pluginLoader.getTranslations());
    });

    app.get('/api/plugins/permissions', requireAuth, (req, res) => {
        res.json(PluginLoader.getKnownPermissions());
    });

    app.get('/api/plugins/status', requireAuth, (req, res) => {
        const pluginId = req.query.pluginId;
        res.json(pluginLoader.getPluginStatus(pluginId));
    });

    app.get('/api/plugins/settings', requirePermission('panel.plugins'), (req, res) => {
        const pluginId = req.query.pluginId;
        res.json(pluginLoader.getPluginSettings(pluginId));
    });

    app.post('/api/plugins/settings', requirePermission('panel.plugins'), (req, res) => {
        try {
            const { pluginId, values } = req.body;
            if (!pluginId) return res.status(400).json({ error: '缺少插件 ID' });
            if (!values || typeof values !== 'object') return res.status(400).json({ error: '缺少设置值' });
            const ok = pluginLoader.updatePluginSettings(pluginId, values);
            if (!ok) return res.status(404).json({ error: '插件设置未注册或插件不存在' });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/plugins/version', requireAuth, (req, res) => {
        res.json({ version: PluginLoader.API_VERSION || '2.0.0' });
    });



    // 5. Voicechat Config API (智能多路径嗅探与默认模板适配)
    const findVoicechatConfig = (instDir) => {
        const candidates = [
            path.join(instDir, 'config', 'voicechat', 'voicechat-server.properties'),
            path.join(instDir, 'config', 'voicechat', 'voicechat.properties'),
            path.join(instDir, 'config', 'voicechat.properties'),
            path.join(instDir, 'plugins', 'voicechat', 'voicechat-server.properties'),
            path.join(instDir, 'plugins', 'voicechat', 'voicechat.properties'),
            path.join(instDir, 'plugins', 'SimpleVoiceChat', 'voicechat-server.properties'),
            path.join(instDir, 'config', 'voicechat-server.properties')
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                return { fullPath: p, relativePath: path.relative(instDir, p), exists: true };
            }
        }
        const defaultPath = path.join(instDir, 'config', 'voicechat', 'voicechat-server.properties');
        return { fullPath: defaultPath, relativePath: 'config/voicechat/voicechat-server.properties', exists: false };
    };

    const DEFAULT_VOICECHAT_PROPERTIES = `# Simple Voice Chat server config
port=24454
bind_address=
max_voice_distance=48.0
whisper_distance=24.0
codec=VOIP
mtu_size=1024
tcp_rate_limit=16
keep_alive=1000
enable_groups=true
voice_host=
allow_recording=true
spectator_interaction=false
spectator_player_possession=false
force_voice_chat=false
login_timeout=10000
broadcast_range=-1.0
allow_pings=true
use_natives=true
threaded_server_support=false
`;

    app.get('/api/voicechat/config', requireAuth, withInstance, async (req, res) => {
        try {
            const fileInfo = findVoicechatConfig(req.instDir);
            let content = '';
            if (fileInfo.exists) {
                content = await fs.readFile(fileInfo.fullPath, 'utf8');
            } else {
                content = DEFAULT_VOICECHAT_PROPERTIES;
            }
            res.json({
                content,
                filePath: fileInfo.relativePath,
                exists: fileInfo.exists,
                hasVoicechat: true
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/voicechat/save', requireAuth, withInstance, async (req, res) => {
        try {
            const { content, filePath } = req.body;
            let targetFile;
            if (filePath && typeof filePath === 'string' && !filePath.includes('..')) {
                targetFile = path.resolve(req.instDir, filePath);
                if (!targetFile.startsWith(req.instDir)) {
                    return res.status(403).json({ error: '非法文件路径' });
                }
            } else {
                targetFile = findVoicechatConfig(req.instDir).fullPath;
            }
            await fs.ensureDir(path.dirname(targetFile));
            await fs.writeFile(targetFile, content !== undefined ? content : '', 'utf8');
            res.json({
                success: true,
                filePath: path.relative(req.instDir, targetFile)
            });
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
                instState.status = 'stopped';
                io.emit(`status:${instanceId}`, { isRunning: false, status: 'stopped' });
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
        const loaderType = req.query.loaderType || 'fabric';
        try {
            if (loaderType === 'forge') {
                const versions = await fetchForgeMcVersions();
                return res.json(versions);
            } else if (loaderType === 'neoforge') {
                const versions = await fetchNeoForgeMcVersions();
                return res.json(versions);
            } else {
                const resp = await axios.get('https://meta.fabricmc.net/v2/versions/game');
                const stable = resp.data.filter(v => v.stable).map(v => v.version);
                return res.json(stable);
            }
        } catch (e) { res.status(500).json({ error: 'Failed to fetch MC versions' }); }
    });

    app.get('/api/setup/versions/loader/:gameVersion', requireAuth, async (req, res) => {
        const loaderType = req.query.loaderType || 'fabric';
        const gameVersion = req.params.gameVersion;
        try {
            if (loaderType === 'forge') {
                const versions = await fetchForgeVersions(gameVersion);
                return res.json(versions);
            } else if (loaderType === 'neoforge') {
                const versions = await fetchNeoForgeVersions(gameVersion);
                return res.json(versions);
            } else {
                const resp = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`);
                const loaders = [...new Set(resp.data.map(v => v.loader.version))];
                return res.json(loaders);
            }
        } catch (e) { res.status(500).json({ error: `Failed to fetch ${loaderType} versions` }); }
    });

    app.post('/api/setup/install', requireAuth, withInstance, async (req, res) => {
        const { instDir, instState, instanceId } = req;
        const { gameVersion, loaderVersion, loaderType } = req.body;
        if (!gameVersion || !loaderVersion) return res.status(400).json({ error: 'Missing version info' });

        const lt = loaderType || 'fabric';
        const instConf = instanceConfig.instances.find(i => i.id === instanceId);
        if (lt && instConf) {
            instConf.loaderType = lt;
            saveInstances(instanceConfig);
        }

        const loaderName = lt === 'neoforge' ? 'NeoForge' : lt.charAt(0).toUpperCase() + lt.slice(1);
        console.log(`Installing ${loaderName} Server: MC ${gameVersion}, Loader ${loaderVersion}`);
        res.json({ success: true, message: 'Installation started' });

        try {
            await installLoaderCore(instanceId, instDir, instState, lt, gameVersion, loaderVersion);
            const eulaFile = path.join(instDir, 'eula.txt');
            fs.writeFileSync(eulaFile, 'eula=true\n');
        } catch (e) {
            console.error(e);
            appendLog(instanceId, `[错误] ${loaderName} 安装失败: ${e.message}\n`);
        }
    });

    // --- Loader Version Management API (Fabric / Forge / NeoForge) ---
    const fetchForgeVersions = async (gameVersion) => {
        const resp = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', { timeout: 15000 });
        const promos = resp.data.promos;
        const versions = [];
        for (const [key, val] of Object.entries(promos)) {
            if (key.startsWith(gameVersion)) {
                versions.push({ version: val, mc: key.split('-')[0], label: key });
            }
        }
        return versions.filter(v => v.mc === gameVersion).map(v => v.version);
    };

    const fetchNeoForgeVersions = async (gameVersion) => {
        const resp = await axios.get('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge', { timeout: 15000 });
        const allVersions = resp.data.versions || [];
        const prefix = gameVersion.replace(/^1\./, '') + '.';
        return allVersions.filter(v => v.startsWith(prefix) && !v.includes('-beta'));
    };

    const fetchForgeMcVersions = async () => {
        const resp = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', { timeout: 15000 });
        const mcVersions = new Set();
        for (const key of Object.keys(resp.data.promos)) {
            const mc = key.split('-')[0];
            if (mc) mcVersions.add(mc);
        }
        return [...mcVersions].sort((a, b) => {
            const pa = a.split('.').map(Number);
            const pb = b.split('.').map(Number);
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
            }
            return 0;
        });
    };

    const fetchNeoForgeMcVersions = async () => {
        const resp = await axios.get('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge', { timeout: 15000 });
        const allVersions = resp.data.versions || [];
        const mcVersions = new Set();
        for (const v of allVersions) {
            if (v.includes('-beta')) continue;
            const parts = v.split('.');
            if (parts.length >= 2) {
                const mcVer = '1.' + parts[0] + '.' + parts[1];
                mcVersions.add(mcVer);
            }
        }
        return [...mcVersions].sort((a, b) => {
            const pa = a.split('.').map(Number);
            const pb = b.split('.').map(Number);
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
            }
            return 0;
        });
    };

    const runForgeInstaller = async (instDir, installerPath, javaPath, instanceId, instState) => {
        return new Promise((resolve, reject) => {
            const proc = spawn(javaPath, ['-jar', installerPath, '--installServer'], { cwd: instDir });
            let lastLine = '';
            proc.stdout.on('data', (d) => { lastLine = d.toString().trim(); });
            proc.stderr.on('data', (d) => { lastLine = d.toString().trim(); });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Forge installer exited with code ${code}: ${lastLine}`));
            });
            proc.on('error', reject);
        });
    };

    const installLoaderCore = async (instanceId, instDir, instState, loaderType, gameVersion, loaderVersion) => {
        const instConf = instanceConfig.instances.find(i => i.id === instanceId);
        const jarName = instConf.jarName || appConfig.jarName;
        const targetJar = path.join(instDir, jarName);
        const versionFile = path.join(instDir, 'server-version.json');
        const oldJarBackup = targetJar + '.bak';

        if (fs.existsSync(targetJar)) {
            await fs.copy(targetJar, oldJarBackup);
        }

        try {
            if (loaderType === 'fabric') {
                const installerUrl = `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/1.0.1/server/jar`;
                const writer = fs.createWriteStream(targetJar);
                const response = await axios({ url: installerUrl, method: 'GET', responseType: 'stream' });
                await new Promise((resolve, reject) => {
                    response.data.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            } else if (loaderType === 'forge') {
                const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${gameVersion}-${loaderVersion}/forge-${gameVersion}-${loaderVersion}-installer.jar`;
                const installerPath = path.join(instDir, `forge-${gameVersion}-${loaderVersion}-installer.jar`);
                const writer = fs.createWriteStream(installerPath);
                const response = await axios({ url: installerUrl, method: 'GET', responseType: 'stream' });
                await new Promise((resolve, reject) => {
                    response.data.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                const rawJavaPath = instConf.javaPath || appConfig.javaPath;
                const javaPath = resolveJavaPath(rawJavaPath);
                appendLog(instanceId, `[系统] 正在运行 Forge 安装器，请稍候...\n`);
                await runForgeInstaller(instDir, installerPath, javaPath, instanceId, instState);
                try { await fs.remove(installerPath); } catch (e) { }
            } else if (loaderType === 'neoforge') {
                const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVersion}/neoforge-${loaderVersion}-installer.jar`;
                const installerPath = path.join(instDir, `neoforge-${loaderVersion}-installer.jar`);
                const writer = fs.createWriteStream(installerPath);
                const response = await axios({ url: installerUrl, method: 'GET', responseType: 'stream' });
                await new Promise((resolve, reject) => {
                    response.data.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                const rawJavaPath = instConf.javaPath || appConfig.javaPath;
                const javaPath = resolveJavaPath(rawJavaPath);
                appendLog(instanceId, `[系统] 正在运行 NeoForge 安装器，请稍候...\n`);
                await runForgeInstaller(instDir, installerPath, javaPath, instanceId, instState);
                try { await fs.remove(installerPath); } catch (e) { }
            }

            fs.writeJsonSync(versionFile, { gameVersion, loaderVersion, loaderType, installDate: new Date() });
            if (fs.existsSync(oldJarBackup)) await fs.remove(oldJarBackup);
            instState.detectedVersion = { mc: gameVersion, loader: loaderVersion };
            const loaderName = loaderType === 'neoforge' ? 'NeoForge' : loaderType.charAt(0).toUpperCase() + loaderType.slice(1);
            appendLog(instanceId, `[系统] ${loaderName} 核心已安装: MC ${gameVersion} / ${loaderName} ${loaderVersion}\n`);
        } catch (e) {
            if (fs.existsSync(oldJarBackup)) {
                await fs.copy(oldJarBackup, targetJar);
                await fs.remove(oldJarBackup);
            }
            throw e;
        }
    };

    app.get('/api/loader/current-version', requireAuth, withInstance, async (req, res) => {
        const { instDir, instState } = req;
        try {
            const vFile = path.join(instDir, 'server-version.json');
            if (fs.existsSync(vFile)) {
                const vData = await fs.readJson(vFile);
                return res.json({ mc: vData.gameVersion, loader: vData.loaderVersion, loaderType: vData.loaderType || 'fabric' });
            }
            if (instState.detectedVersion.mc !== 'Unknown') {
                const instConf = instanceConfig.instances.find(i => i.id === req.instanceId);
                return res.json({ ...instState.detectedVersion, loaderType: instConf.loaderType || 'fabric' });
            }
            res.json({ mc: 'Unknown', loader: 'Unknown', loaderType: 'fabric' });
        } catch (e) {
            res.json({ mc: 'Unknown', loader: 'Unknown', loaderType: 'fabric' });
        }
    });

    app.get('/api/fabric/current-version', requireAuth, withInstance, async (req, res) => {
        const { instDir, instState } = req;
        try {
            const vFile = path.join(instDir, 'server-version.json');
            if (fs.existsSync(vFile)) {
                const vData = await fs.readJson(vFile);
                return res.json({ mc: vData.gameVersion, loader: vData.loaderVersion });
            }
            if (instState.detectedVersion.mc !== 'Unknown') {
                return res.json(instState.detectedVersion);
            }
            res.json({ mc: 'Unknown', loader: 'Unknown' });
        } catch (e) {
            res.json({ mc: 'Unknown', loader: 'Unknown' });
        }
    });

    app.get('/api/loader/versions/mc', requireAuth, async (req, res) => {
        const loaderType = req.query.loaderType || 'fabric';
        try {
            if (loaderType === 'forge') {
                const versions = await fetchForgeMcVersions();
                return res.json(versions);
            } else if (loaderType === 'neoforge') {
                const versions = await fetchNeoForgeMcVersions();
                return res.json(versions);
            } else {
                const resp = await axios.get('https://meta.fabricmc.net/v2/versions/game');
                const stable = resp.data.filter(v => v.stable).map(v => v.version);
                return res.json(stable);
            }
        } catch (e) { res.status(500).json({ error: 'Failed to fetch MC versions' }); }
    });

    app.get('/api/fabric/versions/mc', requireAuth, async (req, res) => {
        try {
            const resp = await axios.get('https://meta.fabricmc.net/v2/versions/game');
            const stable = resp.data.filter(v => v.stable).map(v => v.version);
            res.json(stable);
        } catch (e) { res.status(500).json({ error: 'Failed to fetch MC versions' }); }
    });

    app.get('/api/loader/versions/loader/:gameVersion', requireAuth, async (req, res) => {
        const loaderType = req.query.loaderType || 'fabric';
        const gameVersion = req.params.gameVersion;
        try {
            if (loaderType === 'forge') {
                const versions = await fetchForgeVersions(gameVersion);
                return res.json(versions);
            } else if (loaderType === 'neoforge') {
                const versions = await fetchNeoForgeVersions(gameVersion);
                return res.json(versions);
            } else {
                const resp = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`);
                const loaders = [...new Set(resp.data.map(v => v.loader.version))];
                return res.json(loaders);
            }
        } catch (e) { res.status(500).json({ error: `Failed to fetch ${loaderType} loader versions` }); }
    });

    app.get('/api/fabric/versions/loader/:gameVersion', requireAuth, async (req, res) => {
        try {
            const resp = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${req.params.gameVersion}`);
            const loaders = [...new Set(resp.data.map(v => v.loader.version))];
            res.json(loaders);
        } catch (e) { res.status(500).json({ error: 'Failed to fetch Fabric loader versions' }); }
    });

    app.post('/api/loader/change-version', requireAuth, withInstance, async (req, res) => {
        const { instDir, instState, instanceId } = req;
        const { gameVersion, loaderVersion, loaderType } = req.body;
        if (!gameVersion || !loaderVersion) return res.status(400).json({ error: 'Missing version info' });

        if (instState.process) {
            return res.status(400).json({ error: 'Server is running. Please stop it before changing version.' });
        }

        const lt = loaderType || 'fabric';
        const loaderName = lt === 'neoforge' ? 'NeoForge' : lt.charAt(0).toUpperCase() + lt.slice(1);
        console.log(`Changing ${loaderName} Server version: MC ${gameVersion}, Loader ${loaderVersion} for instance ${instanceId}`);
        res.json({ success: true, message: 'Version change started' });

        try {
            await installLoaderCore(instanceId, instDir, instState, lt, gameVersion, loaderVersion);
        } catch (e) {
            console.error(e);
            appendLog(instanceId, `[错误] ${loaderName} 核心更换失败: ${e.message}\n`);
        }
    });

    app.post('/api/fabric/change-version', requireAuth, withInstance, async (req, res) => {
        const { instDir, instState, instanceId } = req;
        const { gameVersion, loaderVersion } = req.body;
        if (!gameVersion || !loaderVersion) return res.status(400).json({ error: 'Missing version info' });

        if (instState.process) {
            return res.status(400).json({ error: 'Server is running. Please stop it before changing version.' });
        }

        console.log(`Changing Fabric Server version: MC ${gameVersion}, Loader ${loaderVersion} for instance ${instanceId}`);
        res.json({ success: true, message: 'Version change started' });

        try {
            await installLoaderCore(instanceId, instDir, instState, 'fabric', gameVersion, loaderVersion);
        } catch (e) {
            console.error(e);
            appendLog(instanceId, `[错误] Fabric 核心更换失败: ${e.message}\n`);
        }
    });

    // Modrinth API / AI Translate
    app.get('/api/mods/modrinth/search', requirePermission('instance.mods'), async (req, res) => {
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

    app.get('/api/mods/modrinth/versions', requirePermission('instance.mods'), async (req, res) => {
        try {
            const response = await axios.get('https://api.modrinth.com/v2/tag/game_version', {
                headers: { 'User-Agent': MODRINTH_UA }
            });
            res.json(response.data);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/mods/modrinth/project/:id', requirePermission('instance.mods'), async (req, res) => {
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

    app.post('/api/mods/modrinth/download', requirePermission('instance.mods'), withInstance, async (req, res) => {
        const { instDir, instanceId } = req;
        const { url, filename } = req.body;
        if (!url || !filename) return res.status(400).json({ error: 'URL and filename required' });
        if (typeof filename !== 'string' || path.basename(filename) !== filename) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const modsDir = path.join(instDir, 'mods');
        await fs.ensureDir(modsDir);
        const dest = path.join(modsDir, filename);
        if (!isPathInside(dest, modsDir)) return res.status(403).json({ error: 'Access Denied' });

        appendLog(instanceId, `Installing mod: ${filename}...`);

        try {
            const response = await axios.get(applyGithubProxy(url), { responseType: 'stream' });
            const writer = fs.createWriteStream(dest);
            response.data.pipe(writer);

            writer.on('finish', () => {
                appendLog(instanceId, `Successfully installed ${filename}\n`);
                res.json({ success: true });
            });

            writer.on('error', (err) => {
                console.error('Download failed', err);
                appendLog(instanceId, 'Installation failed: ' + err.message + '\n');
                res.status(500).json({ error: err.message });
            });

        } catch (e) {
            console.error(e);
            appendLog(instanceId, 'Installation error: ' + e.message + '\n');
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

    app.post('/api/panel/ai/test', requirePermission('panel.settings'), async (req, res) => {
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

    app.get('/api/mods/local/list', requirePermission('instance.mods'), withInstance, async (req, res) => {
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

    app.get('/api/mods/local/metadata', requirePermission('instance.mods'), withInstance, async (req, res) => {
        const { file } = req.query;
        if (!file || typeof file !== 'string') return res.status(400).json({ error: 'File name required' });
        if (path.basename(file) !== file) return res.status(400).json({ error: 'Invalid file name' });

        const modsDir = path.join(req.instDir, 'mods');
        const filePath = path.join(modsDir, file);
        if (!isPathInside(filePath, modsDir)) return res.status(403).json({ error: 'Access Denied' });

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
    app.post('/api/panel/config', requirePermission('panel.settings'), async (req, res) => {
        try {
            const { port, defaultLang, theme, consoleInfoPosition, loaderType, jarName, javaArgs, sessionTimeout, maxLogHistory, monitorInterval, javaPath, aiEndpoint, aiKey, aiModel, githubProxy, appearance, webhooks } = req.body;

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
            if (loaderType && !['fabric', 'forge', 'neoforge'].includes(loaderType)) {
                return res.status(400).json({ error: '无效的加载器类型' });
            }

            if (port !== undefined) appConfig.port = port;
            if (defaultLang !== undefined) appConfig.defaultLang = defaultLang;
            if (theme !== undefined) appConfig.theme = theme;
            if (loaderType !== undefined) appConfig.loaderType = loaderType;
            if (jarName !== undefined) appConfig.jarName = jarName;
            if (javaArgs !== undefined) appConfig.javaArgs = javaArgs;
            if (webhooks !== undefined) appConfig.webhooks = webhooks;
            if (sessionTimeout !== undefined) appConfig.sessionTimeout = sessionTimeout;
            if (maxLogHistory !== undefined) appConfig.maxLogHistory = maxLogHistory;
            if (monitorInterval !== undefined) appConfig.monitorInterval = monitorInterval;
            if (javaPath !== undefined) appConfig.javaPath = javaPath;
            if (aiEndpoint !== undefined) appConfig.aiEndpoint = aiEndpoint;
            if (aiKey !== undefined) appConfig.aiKey = aiKey;
            if (aiModel !== undefined) appConfig.aiModel = aiModel;
            if (githubProxy !== undefined) appConfig.githubProxy = githubProxy;
            if (consoleInfoPosition !== undefined) appConfig.consoleInfoPosition = consoleInfoPosition;
            if (appearance !== undefined) {
                if (!appConfig.appearance) appConfig.appearance = {};
                if (appearance.logo !== undefined) appConfig.appearance.logo = appearance.logo;
                if (appearance.backgroundImage !== undefined) appConfig.appearance.backgroundImage = appearance.backgroundImage;
                if (appearance.sidebarOpacity !== undefined) appConfig.appearance.sidebarOpacity = Math.max(0, Math.min(1, Number(appearance.sidebarOpacity)));
                if (appearance.contentOpacity !== undefined) appConfig.appearance.contentOpacity = Math.max(0, Math.min(1, Number(appearance.contentOpacity)));
                if (appearance.cardOpacity !== undefined) appConfig.appearance.cardOpacity = Math.max(0, Math.min(1, Number(appearance.cardOpacity)));
                if (appearance.loginOpacity !== undefined) appConfig.appearance.loginOpacity = Math.max(0, Math.min(1, Number(appearance.loginOpacity)));
                if (appearance.instanceOpacity !== undefined) appConfig.appearance.instanceOpacity = Math.max(0, Math.min(1, Number(appearance.instanceOpacity)));
            }

            // 保存到文件
            await fs.writeJson(CONFIG_FILE, appConfig, { spaces: 2 });

            res.json({ success: true, message: '配置已保存,需要重启面板才能生效' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 3. 重置 2FA
    app.get('/api/panel/2fa/generate', requirePermission('panel.settings'), async (req, res) => {
        try {
            const secret = authenticator.generateSecret();
            const otpauth = authenticator.keyuri('Admin', 'MC-Panel', secret);
            QRCode.toDataURL(otpauth, (err, qr) => {
                if (err) throw err;
                res.json({ secret, qr });
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/panel/2fa/verify', requirePermission('panel.settings'), async (req, res) => {
        const { secret, token } = req.body;
        try {
            if (!authenticator.check(token, secret)) return res.status(400).json({ error: 'Invalid Code' });
            appConfig.secret = secret;
            await fs.writeJson(CONFIG_FILE, appConfig, { spaces: 2 });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/panel/2fa/disable', requirePermission('panel.settings'), async (req, res) => {
        try {
            appConfig.secret = '';
            await fs.writeJson(CONFIG_FILE, appConfig, { spaces: 2 });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/panel/account/update', requirePermission('panel.settings'), async (req, res) => {
        const { username, currentPassword, newPassword } = req.body;
        try {
            if (!username) {
                return res.status(400).json({ error: '用户名不能为空' });
            }

            // 1. 验证当前密码
            if (!currentPassword) {
                return res.status(400).json({ error: '必须输入当前密码进行安全校验' });
            }
            const { hash } = hashPassword(currentPassword, appConfig.passwordSalt);
            if (hash !== appConfig.passwordHash) {
                return res.status(400).json({ error: '当前密码验证错误' });
            }

            // 2. 更新用户名
            appConfig.username = username;

            // 3. 更新密码 (如果提供了新密码)
            if (newPassword) {
                if (newPassword.length < 6) {
                    return res.status(400).json({ error: '新密码长度不能少于 6 位' });
                }
                const { hash: newHash, salt: newSalt } = hashPassword(newPassword);
                appConfig.passwordHash = newHash;
                appConfig.passwordSalt = newSalt;
            }

            await fs.writeJson(CONFIG_FILE, appConfig, { spaces: 2 });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 4. 重启面板
    // 4. 重启面板
    app.post('/api/panel/restart', requirePermission('panel.settings'), (req, res) => {
        res.json({ success: true, message: '面板正在重启...' });
        setTimeout(() => {
            // Exit with 100 to signal master to restart this worker
            process.exit(100);
        }, 1000);
    });

    // ==================== 全局面板备份与回档原生集成 ====================
    const BACKUP_CHUNK_TEMP_DIR = path.join(DATA_DIR, 'backup_chunks');
    fs.ensureDirSync(BACKUP_CHUNK_TEMP_DIR);

    const isSafeBackupFile = (filename) => {
        if (!filename || typeof filename !== 'string') return false;
        const base = path.basename(filename);
        if (base !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return false;
        if (!filename.toLowerCase().endsWith('.zip')) return false;
        const fullPath = path.resolve(path.join(GLOBAL_BACKUP_DIR, filename));
        return isPathInside(fullPath, GLOBAL_BACKUP_DIR);
    };

    /**
     * 高可用、无损系统备份解压管道
     * 1. 优先调用系统原生 unzip，重置 UNZIP/ZIPINFO 环境变量，100% 还原 0755 权限与符号链接，且流式解压无需将数 GB 读入 V8 堆内存；
     * 2. 备用尝试系统原生 tar (Windows 10/11 和 Linux 原生支持 tar -xf)；
     * 3. 终极降级方案：使用 AdmZip 解压，并逐项恢复 entry.attr 记录的 POSIX 文件权限与软链接。
     */
    const extractBackupArchive = async (zipPath, targetDir) => {
        await fs.ensureDir(targetDir);

        // 方案 1: 系统原生 unzip
        try {
            const { execFileSync } = require('child_process');
            const cleanEnv = { ...process.env, UNZIP: '', ZIPINFO: '' };
            execFileSync('unzip', ['-qo', zipPath, '-d', targetDir], { env: cleanEnv, stdio: 'pipe' });
            return true;
        } catch (unzipErr) {
            console.warn('[ExtractArchive] 系统 unzip 执行失败，尝试降级方案:', unzipErr.message);
        }

        // 方案 2: 系统原生 tar
        try {
            const { execFileSync } = require('child_process');
            execFileSync('tar', ['-xf', zipPath, '-C', targetDir], { stdio: 'pipe' });
            return true;
        } catch (tarErr) {
            console.warn('[ExtractArchive] 系统 tar 执行失败，尝试 AdmZip 智能降级方案:', tarErr.message);
        }

        // 方案 3: AdmZip 智能降级（显式恢复文件模式与符号链接）
        const zip = new AdmZip(zipPath);
        const entries = zip.getEntries();
        for (const entry of entries) {
            const outPath = path.join(targetDir, entry.entryName);
            if (entry.isDirectory) {
                fs.ensureDirSync(outPath);
                continue;
            }

            fs.ensureDirSync(path.dirname(outPath));
            const mode = (entry.attr >>> 16) & 0o777;
            const isSymlink = ((entry.attr >>> 16) & 0o120000) === 0o120000;

            if (isSymlink) {
                const linkTarget = entry.getData().toString('utf8').trim();
                try {
                    if (fs.existsSync(outPath) || fs.lstatSync(outPath).isSymbolicLink()) {
                        fs.unlinkSync(outPath);
                    }
                } catch (_) {}
                try {
                    fs.symlinkSync(linkTarget, outPath);
                } catch (err) {
                    fs.writeFileSync(outPath, entry.getData());
                }
            } else {
                fs.writeFileSync(outPath, entry.getData());
                if (mode && process.platform !== 'win32') {
                    try {
                        fs.chmodSync(outPath, mode);
                    } catch (_) {}
                }
            }
        }
        return true;
    };

    const requireBackupAccess = (req, res, next) => {
        if (appConfig && appConfig.isSetup) {
            if (!req.session || !req.session.authenticated) {
                // 支持登录界面/灾难恢复场景通过管理员密码验证授权
                const candidatePass = req.headers['x-admin-password'] || req.body?.adminPassword || req.query?.adminPassword;
                if (candidatePass && appConfig.passwordHash) {
                    const salt = appConfig.passwordSalt || '';
                    const hashed = hashPassword(candidatePass, salt).hash;
                    if (hashed === appConfig.passwordHash) {
                        return next();
                    } else {
                        return res.status(401).json({ error: '管理员密码错误，无法执行灾难恢复' });
                    }
                }
                return res.status(401).json({ error: '未授权：请先登录或提供管理员密码' });
            }
            if (req.session.isSubAccount) {
                const perms = req.session.permissions || [];
                if (!perms.includes('instance.backups') && !perms.includes('panel.settings')) {
                    return res.status(403).json({ error: '无权操作面板备份' });
                }
            }
        }
        next();
    };

    const createGlobalBackup = async (options = { configs: true, java: [], instances: [] }, note = '') => {
        await fs.ensureDir(GLOBAL_BACKUP_DIR);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `global_backup_${timestamp}.zip`;
        const zipPath = path.join(GLOBAL_BACKUP_DIR, filename);

        const instConf = await fs.readJson(path.join(DATA_DIR, 'instances.json')).catch(() => ({ instances: [] }));
        instConf.instances.forEach(inst => appendLog(inst.id, `[系统] 全局备份开始: ${filename}...\n`));

        // 1. 安全刷盘：检查并通知运行中的 Minecraft 服务端保存世界数据
        const runningInstances = [];
        for (const [id, state] of instancesState) {
            if (state.process && state.process.stdin && !state.process.stdin.destroyed) {
                runningInstances.push(state);
                try {
                    state.process.stdin.write('save-off\n');
                    state.process.stdin.write('save-all flush\n');
                    appendLog(id, '[系统] 全局备份前安全刷盘 (save-all flush)...\n');
                } catch (_) {}
            }
        }
        if (runningInstances.length > 0) {
            // 等待 1.5 秒确保世界缓存数据完全落盘
            await new Promise(r => setTimeout(r, 1500));
        }

        const restoreRunningSaves = () => {
            for (const state of runningInstances) {
                try {
                    if (state.process && state.process.stdin && !state.process.stdin.destroyed) {
                        state.process.stdin.write('save-on\n');
                    }
                } catch (_) {}
            }
        };

        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 5 } });

            output.on('close', async () => {
                restoreRunningSaves();
                const metaPath = zipPath + '.meta.json';
                await fs.writeJson(metaPath, { note, options, createdAt: new Date() }, { spaces: 2 });
                instConf.instances.forEach(inst => appendLog(inst.id, `[系统] 全局备份完成！大小: ${(archive.pointer() / 1024 / 1024).toFixed(1)} MB\n`));
                resolve({ filename, size: archive.pointer() });
            });

            archive.on('error', (err) => {
                restoreRunningSaves();
                instConf.instances.forEach(inst => appendLog(inst.id, `[错误] 全局备份失败: ${err.message}\n`));
                reject(err);
            });

            archive.pipe(output);

            // 2. 备份面板配置与子目录数据（包含 appearance, frp, scroll_storage，排除临时缓存）
            if (options.configs && fs.existsSync(DATA_DIR)) {
                const excludeDataItems = new Set(['java', 'backup_chunks', 'tmp_uploads', 'avatar_cache', 'map_cache', 'panel.pid', 'panel.log', 'global_backups']);
                const entries = fs.readdirSync(DATA_DIR);
                for (const entry of entries) {
                    if (excludeDataItems.has(entry)) continue;
                    const fullPath = path.join(DATA_DIR, entry);
                    const stat = fs.statSync(fullPath);
                    if (stat.isFile()) {
                        archive.file(fullPath, { name: `data/${entry}` });
                    } else if (stat.isDirectory()) {
                        archive.directory(fullPath, `data/${entry}`);
                    }
                }
            }

            // 3. 备份 Java 环境
            if (Array.isArray(options.java)) {
                for (const javaId of options.java) {
                    const javaPath = path.join(DATA_DIR, 'java', javaId);
                    if (fs.existsSync(javaPath)) {
                        archive.directory(javaPath, `data/java/${javaId}`);
                    }
                }
            } else if (options.java === true) {
                const javaDir = path.join(DATA_DIR, 'java');
                if (fs.existsSync(javaDir)) archive.directory(javaDir, 'data/java');
            }

            // 4. 备份 Minecraft 实例数据（排除内部嵌套 backups/ 与临时日志）
            const archiveInstance = (instId) => {
                const instPath = path.join(INSTANCES_DIR, instId);
                if (!fs.existsSync(instPath)) return;
                const entries = fs.readdirSync(instPath);
                for (const entry of entries) {
                    if (entry === 'backups' || entry === 'panel.log') continue;
                    const fullPath = path.join(instPath, entry);
                    const stat = fs.statSync(fullPath);
                    if (stat.isFile()) {
                        archive.file(fullPath, { name: `instances/${instId}/${entry}` });
                    } else if (stat.isDirectory()) {
                        archive.directory(fullPath, `instances/${instId}/${entry}`);
                    }
                }
            };

            if (Array.isArray(options.instances)) {
                for (const instId of options.instances) {
                    archiveInstance(instId);
                }
            } else if (options.instances === true) {
                if (fs.existsSync(INSTANCES_DIR)) {
                    const allInsts = fs.readdirSync(INSTANCES_DIR);
                    for (const id of allInsts) {
                        archiveInstance(id);
                    }
                }
            }

            archive.finalize();
        });
    };

    app.get('/api/panel/backups/list', requireBackupAccess, async (req, res) => {
        try {
            const backups = [];
            if (fs.existsSync(GLOBAL_BACKUP_DIR)) {
                const files = await fs.readdir(GLOBAL_BACKUP_DIR);
                for (const file of files) {
                    if (file.endsWith('.zip')) {
                        const filePath = path.join(GLOBAL_BACKUP_DIR, file);
                        const stat = await fs.stat(filePath);
                        const metaPath = filePath + '.meta.json';
                        let meta = { note: '', options: {} };
                        if (fs.existsSync(metaPath)) {
                            try { meta = await fs.readJson(metaPath); } catch (e) { }
                        }
                        backups.push({
                            name: file,
                            size: stat.size,
                            mtime: stat.mtime,
                            note: meta.note || '',
                            options: meta.options || {}
                        });
                    }
                }
            }
            backups.sort((a, b) => b.mtime - a.mtime);
            res.json(backups);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/panel/backups/create', requireBackupAccess, async (req, res) => {
        const { options, note } = req.body;
        try {
            const result = await createGlobalBackup(options, note);
            res.json({ success: true, ...result });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/panel/backups/delete', requireBackupAccess, async (req, res) => {
        const { filename } = req.body;
        if (!isSafeBackupFile(filename)) {
            return res.status(400).json({ error: '非法的文件名' });
        }
        const zipPath = path.join(GLOBAL_BACKUP_DIR, filename);
        try {
            if (fs.existsSync(zipPath)) {
                await fs.remove(zipPath);
                const metaPath = zipPath + '.meta.json';
                if (fs.existsSync(metaPath)) await fs.remove(metaPath).catch(() => { });
                res.json({ success: true });
            } else {
                res.status(404).json({ error: '备份文件不存在' });
            }
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/panel/backups/download', requireBackupAccess, (req, res) => {
        const { filename } = req.query;
        if (!isSafeBackupFile(filename)) {
            return res.status(400).send('非法的文件名');
        }
        const zipPath = path.join(GLOBAL_BACKUP_DIR, filename);
        if (!fs.existsSync(zipPath)) return res.status(404).send('备份未找到');
        res.download(zipPath);
    });

    const handleBackupImport = async (req, res) => {
        if (!req.file) return res.status(400).json({ error: '未上传文件' });
        const safeName = path.basename(req.file.originalname).replace(/[\\/:*?"<>|]/g, '_');
        if (!isSafeBackupFile(safeName)) return res.status(400).json({ error: '非法的备份压缩包文件' });
        const targetPath = path.join(GLOBAL_BACKUP_DIR, safeName);
        if (!isPathInside(targetPath, GLOBAL_BACKUP_DIR)) return res.status(403).json({ error: 'Access Denied' });
        try {
            await fs.move(req.file.path, targetPath, { overwrite: true });
            const metaPath = targetPath + '.meta.json';
            await fs.writeJson(metaPath, { note: '导入的备份', createdAt: new Date() }, { spaces: 2 });
            res.json({ success: true, filename: path.basename(targetPath) });
        } catch (e) { res.status(500).json({ error: e.message }); }
    };

    const handleChunkInit = async (req, res) => {
        const { fileName, fileSize, totalChunks } = req.body;
        const safeName = path.basename(fileName || '').replace(/[\\/:*?"<>|]/g, '_');
        if (!isSafeBackupFile(safeName)) return res.status(400).json({ error: '非法的备份压缩包文件名' });
        const uploadId = crypto.randomBytes(16).toString('hex');
        const chunkDir = path.join(BACKUP_CHUNK_TEMP_DIR, uploadId);
        await fs.ensureDir(chunkDir);
        await fs.writeJson(path.join(chunkDir, '.meta'), {
            fileName: safeName,
            fileSize,
            totalChunks,
            createdAt: Date.now()
        });
        res.json({ uploadId });
    };

    const handleChunkUpload = async (req, res) => {
        const { uploadId, chunkIndex } = req.body;
        if (!uploadId || chunkIndex === undefined) return res.status(400).json({ error: '缺少分片参数' });
        const chunkDir = path.join(BACKUP_CHUNK_TEMP_DIR, uploadId);
        const metaPath = path.join(chunkDir, '.meta');
        if (!fs.existsSync(metaPath)) return res.status(404).json({ error: '上传会话已失效' });

        try {
            const chunkFile = path.join(chunkDir, String(chunkIndex).padStart(6, '0'));
            await fs.move(req.file.path, chunkFile, { overwrite: true });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    };

    const handleChunkComplete = async (req, res) => {
        const { uploadId } = req.body;
        if (!uploadId) return res.status(400).json({ error: '缺少 uploadId' });
        const chunkDir = path.join(BACKUP_CHUNK_TEMP_DIR, uploadId);
        const metaPath = path.join(chunkDir, '.meta');
        if (!fs.existsSync(metaPath)) return res.status(404).json({ error: '上传会话已失效' });

        try {
            const meta = await fs.readJson(metaPath);
            const { fileName, totalChunks } = meta;
            if (!isSafeBackupFile(fileName)) return res.status(400).json({ error: '非法的备份文件' });
            const finalPath = path.join(GLOBAL_BACKUP_DIR, fileName);
            if (!isPathInside(finalPath, GLOBAL_BACKUP_DIR)) return res.status(403).json({ error: 'Access Denied' });
            await fs.ensureDir(GLOBAL_BACKUP_DIR);

            // 使用 Node.js Stream Pipeline 流式拼接分片，杜绝内存堆积与背压截断
            const writeStream = fs.createWriteStream(finalPath);
            try {
                for (let i = 0; i < totalChunks; i++) {
                    const chunkFile = path.join(chunkDir, String(i).padStart(6, '0'));
                    if (!fs.existsSync(chunkFile)) {
                        writeStream.destroy();
                        await fs.remove(finalPath).catch(() => { });
                        return res.status(400).json({ error: `缺少分片 ${i}` });
                    }
                    const readStream = fs.createReadStream(chunkFile);
                    await pipeline(readStream, writeStream, { end: false });
                }
                await new Promise((resolve, reject) => {
                    writeStream.end(resolve);
                    writeStream.on('error', reject);
                });
            } catch (streamErr) {
                writeStream.destroy();
                await fs.remove(finalPath).catch(() => { });
                throw streamErr;
            }

            const metaJsonPath = finalPath + '.meta.json';
            await fs.writeJson(metaJsonPath, { note: '导入的备份', createdAt: new Date() }, { spaces: 2 });
            await fs.remove(chunkDir);
            res.json({ success: true, filename: path.basename(finalPath) });
        } catch (e) {
            res.status(500).json({ error: e.message });
            try { await fs.remove(path.join(BACKUP_CHUNK_TEMP_DIR, uploadId)); } catch (_) { }
        }
    };

    const handleChunkCancel = async (req, res) => {
        const { uploadId } = req.body;
        if (!uploadId) return res.status(400).json({ error: '缺少 uploadId' });
        try {
            const chunkDir = path.join(BACKUP_CHUNK_TEMP_DIR, uploadId);
            if (fs.existsSync(chunkDir)) await fs.remove(chunkDir);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    };

    const handleBackupRestore = async (req, res) => {
        const { filename } = req.body;
        if (!isSafeBackupFile(filename)) return res.status(400).json({ error: '非法的备份压缩包' });
        const zipPath = path.join(GLOBAL_BACKUP_DIR, filename);
        if (!isPathInside(zipPath, GLOBAL_BACKUP_DIR)) return res.status(403).json({ error: 'Access Denied' });
        if (!fs.existsSync(zipPath)) return res.status(404).json({ error: '备份文件不存在' });

        // 先返回响应告知前端回档已开始
        res.json({ success: true, message: '回档流程已启动' });

        // 异步执行完整的安全停机、解压与覆盖
        (async () => {
            const tempExtractDir = path.join(os.tmpdir(), `panel-restore-${Date.now()}`);
            try {
                // 1. 安全停机所有运行中的 Minecraft 服务器
                const runningServers = [];
                for (const [id, state] of instancesState) {
                    if (state.process) {
                        runningServers.push({ id, state });
                    }
                }

                if (runningServers.length > 0) {
                    io.emit('restore_progress', { percent: 10, message: '正在安全保存并停止所有运行中的实例...' });
                    for (const { id, state } of runningServers) {
                        try {
                            appendLog(id, '[系统] 全局备份回档中，正在保存世界并停止服务器...\n');
                            state.stopping = true;
                            if (state.process.stdin && !state.process.stdin.destroyed) {
                                state.process.stdin.write('stop\n');
                            }
                        } catch (e) { }
                    }

                    // 等待所有实例退出，最多等待 30 秒（为大型 Mod 整合包预留充足刷盘落盘时间）
                    const waitStartTime = Date.now();
                    while (Date.now() - waitStartTime < 30000) {
                        const stillRunning = runningServers.some(({ state }) => state.process !== null);
                        if (!stillRunning) break;
                        await new Promise(r => setTimeout(r, 500));
                    }

                    // 如果仍有实例未退出，强制终止
                    for (const { id, state } of runningServers) {
                        if (state.process) {
                            try {
                                appendLog(id, '[系统] 服务端未在预期时间内退出，强制终止以完成回档\n');
                                state.process.kill('SIGKILL');
                            } catch (e) { }
                        }
                    }
                }

                // 2. 解压备份到临时目录（使用 extractBackupArchive 原生无损解压，完整保留 0755 权限与符号链接）
                io.emit('restore_progress', { percent: 35, message: '正在解压备份文件...' });
                await extractBackupArchive(zipPath, tempExtractDir);

                // 3. 还原系统配置与运行时数据（整目录覆盖，保留 appearance, frp, scroll_storage 等）
                io.emit('restore_progress', { percent: 65, message: '正在还原面板配置与运行时数据...' });
                const dataRestoreDir = path.join(tempExtractDir, 'data');
                if (fs.existsSync(dataRestoreDir)) {
                    await fs.copy(dataRestoreDir, DATA_DIR, { overwrite: true });
                }

                // 4. 还原实例数据
                io.emit('restore_progress', { percent: 85, message: '正在还原 Minecraft 实例数据...' });
                const instancesRestoreDir = path.join(tempExtractDir, 'instances');
                if (fs.existsSync(instancesRestoreDir)) {
                    await fs.copy(instancesRestoreDir, INSTANCES_DIR, { overwrite: true });
                }

                // 5. Linux 环境下校验并修复 Java 与可执行脚本权限（额外安全兜底）
                if (process.platform !== 'win32') {
                    try {
                        const { execSync } = require('child_process');
                        const javaDir = path.join(DATA_DIR, 'java');
                        if (fs.existsSync(javaDir)) {
                            execSync(`find "${javaDir}" -type f -name "java" -exec chmod 755 {} +`, { stdio: 'ignore' });
                        }
                    } catch (_) {}
                }

                // 6. 完成并准备重启
                await fs.remove(tempExtractDir).catch(() => { });
                io.emit('restore_progress', { percent: 100, message: '还原完成，面板即将重启...' });
                io.emit('restore_completed');

                setTimeout(() => {
                    process.exit(100);
                }, 1500);

            } catch (err) {
                console.error('[Restore Error]', err);
                await fs.remove(tempExtractDir).catch(() => { });
                io.emit('restore_error', err.message || '回档执行失败');
            }
        })();
    };

    // 面板内部主路由
    app.post('/api/panel/backups/import', requireBackupAccess, upload.single('backup'), handleBackupImport);
    app.post('/api/panel/backups/import-chunk/init', requireBackupAccess, handleChunkInit);
    app.post('/api/panel/backups/import-chunk/upload', requireBackupAccess, upload.single('chunk'), handleChunkUpload);
    app.post('/api/panel/backups/import-chunk/complete', requireBackupAccess, handleChunkComplete);
    app.post('/api/panel/backups/import-chunk/cancel', requireBackupAccess, handleChunkCancel);
    app.post('/api/panel/backups/restore', requireBackupAccess, handleBackupRestore);

    // 兼容历史与登录界面的 /api/backups/global/* 以及 /api/panel/backups/global/* 别名路由
    const backupGlobalAliases = ['/api/backups/global', '/api/panel/backups/global'];
    for (const prefix of backupGlobalAliases) {
        app.post(`${prefix}/import`, requireBackupAccess, upload.single('backup'), handleBackupImport);
        app.post(`${prefix}/import-chunk/init`, requireBackupAccess, handleChunkInit);
        app.post(`${prefix}/import-chunk/upload`, requireBackupAccess, upload.single('chunk'), handleChunkUpload);
        app.post(`${prefix}/import-chunk/complete`, requireBackupAccess, handleChunkComplete);
        app.post(`${prefix}/import-chunk/cancel`, requireBackupAccess, handleChunkCancel);
        app.post(`${prefix}/restore`, requireBackupAccess, handleBackupRestore);
    }

    app.get('/api/auth/check', (req, res) => {
        let isSetup = false;
        try {
            const instId = instanceConfig.activeInstanceId || 'default';
            const instDir = getInstanceDir(instId);
            isSetup = fs.readdirSync(instDir).length > 2;
        } catch (e) { }
        res.json({
            isSetup,
            initialized: !!appConfig.username && !!appConfig.passwordHash,
            authenticated: !!req.session.authenticated,
            has2FA: !!appConfig.secret,
            username: req.session.authenticated ? (req.session.username || '') : '',
            isSubAccount: req.session.authenticated ? (!!req.session.isSubAccount) : false,
            permissions: req.session.authenticated ? (req.session.permissions || []) : []
        });
    });

    app.get('/api/auth/captcha', (req, res) => {
        const { text, svg } = generateCaptcha();
        req.session.captcha = text;
        res.json({ svg });
    });

    app.get('/api/auth/qr', (req, res) => {
        let secret = appConfig.secret;
        if (!secret) {
            if (!req.session.tempSecret) req.session.tempSecret = authenticator.generateSecret();
            secret = req.session.tempSecret;
        }
        QRCode.toDataURL(authenticator.keyuri('Admin', 'MC-Panel', secret), (err, url) => {
            res.json({ qr: url, secret: secret });
        });
    });

    app.post('/api/auth/setup', (req, res) => {
        const { username, password, enable2FA, token, tempSecret } = req.body;

        if (appConfig.username && appConfig.passwordHash) {
            return res.status(400).json({ error: '系统已经初始化过账户密码' });
        }

        if (!username || !password || password.length < 6) {
            return res.status(400).json({ error: '用户名不能为空，密码长度必须大于等于 6 位' });
        }

        if (enable2FA) {
            const secret = tempSecret || req.session.tempSecret;
            if (!secret) {
                return res.status(400).json({ error: '缺少 2FA 密钥，请重新扫描二维码' });
            }
            if (!token || !authenticator.check(token, secret)) {
                return res.status(400).json({ error: '2FA 验证码校验失败' });
            }
            appConfig.secret = secret;
        } else {
            appConfig.secret = '';
        }

        const { hash, salt } = hashPassword(password);
        appConfig.username = username;
        appConfig.passwordHash = hash;
        appConfig.passwordSalt = salt;
        appConfig.isSetup = true;

        fs.writeJsonSync(CONFIG_FILE, appConfig, { spaces: 2 });
        delete req.session.tempSecret;

        req.session.authenticated = true;
        resetFailedAttempts(req.ip);
        res.json({ success: true });
    });

    app.post('/api/auth/login', (req, res) => {
        const { username, password, captcha, token } = req.body;

        // 1. 防爆破检测
        const lock = checkBruteForce(req.ip);
        if (lock.locked) {
            return res.status(429).json({ error: `防爆破拦截: 尝试次数过多，请等待 ${lock.remaining} 秒后再试` });
        }

        // 情况 A: 2FA 令牌直登 (仅限主管理员，因为无用户名)
        if (token && !username) {
            let secret = appConfig.secret;
            if (!secret) {
                return res.status(400).json({ error: '系统未启用 2FA 双重认证' });
            }
            if (authenticator.check(token, secret)) {
                req.session.authenticated = true;
                req.session.username = appConfig.username;
                req.session.isSubAccount = false;
                req.session.permissions = [];
                resetFailedAttempts(req.ip);
                return res.json({ success: true });
            } else {
                recordFailedAttempt(req.ip);
                return res.status(400).json({ error: '2FA 验证码错误' });
            }
        }

        // 情况 B: 账号密码登录
        // 2. 验证码校验
        if (!req.session.captcha || !captcha || req.session.captcha !== captcha.toLowerCase()) {
            recordFailedAttempt(req.ip);
            delete req.session.captcha;
            return res.status(400).json({ error: '验证码错误' });
        }
        delete req.session.captcha;

        // 3. 账号密码校验
        if (!appConfig.username || !appConfig.passwordHash) {
            return res.status(400).json({ error: '系统尚未初始化' });
        }

        let isMatched = false;
        let matchedUser = null;

        if (username === appConfig.username) {
            const { hash } = hashPassword(password, appConfig.passwordSalt);
            if (hash === appConfig.passwordHash) {
                isMatched = true;
            }
        } else {
            const users = loadUsers();
            const user = users.find(u => u.username === username);
            if (user) {
                const { hash } = hashPassword(password, user.passwordSalt);
                if (hash === user.passwordHash) {
                    isMatched = true;
                    matchedUser = user;
                }
            }
        }

        if (!isMatched) {
            recordFailedAttempt(req.ip);
            return res.status(400).json({ error: '用户名或密码错误' });
        }

        // 4. 检查是否开启 2FA
        const userSecret = matchedUser ? matchedUser.secret : appConfig.secret;
        if (userSecret) {
            req.session.preAuth = {
                username,
                isSubAccount: !!matchedUser,
                permissions: matchedUser ? matchedUser.permissions : []
            };
            return res.json({ require2FA: true });
        }

        // 5. 登录成功
        req.session.authenticated = true;
        req.session.username = username;
        req.session.isSubAccount = !!matchedUser;
        req.session.permissions = matchedUser ? matchedUser.permissions : [];
        resetFailedAttempts(req.ip);
        res.json({ success: true });
    });

    app.post('/api/auth/verify-2fa', (req, res) => {
        const { token } = req.body;

        const lock = checkBruteForce(req.ip);
        if (lock.locked) {
            return res.status(429).json({ error: `防爆破拦截: 尝试次数过多，请等待 ${lock.remaining} 秒后再试` });
        }

        if (!req.session.preAuth) {
            return res.status(401).json({ error: '会话已过期，请重新登录' });
        }

        const { username, isSubAccount, permissions } = req.session.preAuth;
        let secret = '';
        if (isSubAccount) {
            const users = loadUsers();
            const user = users.find(u => u.username === username);
            secret = user ? user.secret : '';
        } else {
            secret = appConfig.secret;
        }

        if (!secret) {
            return res.status(400).json({ error: '未启用 2FA' });
        }

        if (token && authenticator.check(token, secret)) {
            req.session.authenticated = true;
            req.session.username = username;
            req.session.isSubAccount = isSubAccount;
            req.session.permissions = permissions;
            delete req.session.preAuth;
            resetFailedAttempts(req.ip);
            res.json({ success: true });
        } else {
            recordFailedAttempt(req.ip);
            res.status(400).json({ error: '2FA 验证码错误' });
        }
    });

    // 子账号管理 API (仅限主管理员)
    app.get('/api/users', requireAdmin, (req, res) => {
        const users = loadUsers();
        const safeUsers = users.map(u => ({
            username: u.username,
            permissions: u.permissions || [],
            has2FA: !!u.secret
        }));
        res.json({ users: safeUsers });
    });

    app.get('/api/users/qr', requireAdmin, (req, res) => {
        const { username, tempSecret } = req.query;
        const secret = tempSecret || authenticator.generateSecret();
        QRCode.toDataURL(authenticator.keyuri(username || 'SubAccount', 'MC-Panel', secret), (err, url) => {
            res.json({ qr: url, secret });
        });
    });

    app.post('/api/users', requireAdmin, (req, res) => {
        const { username, password, permissions, enable2FA, tempSecret } = req.body;

        if (!username || username.trim().length < 2) {
            return res.status(400).json({ error: '用户名长度不能少于 2 位' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: '密码长度不能少于 6 位' });
        }
        if (username === appConfig.username) {
            return res.status(400).json({ error: '用户名与主管理员冲突' });
        }

        const users = loadUsers();
        if (users.some(u => u.username === username)) {
            return res.status(400).json({ error: '该用户名已存在' });
        }

        const { hash, salt } = hashPassword(password);
        const newUser = {
            username,
            passwordHash: hash,
            passwordSalt: salt,
            permissions: permissions || [],
            secret: enable2FA ? (tempSecret || '') : ''
        };

        users.push(newUser);
        saveUsers(users);
        res.json({ success: true });
    });

    app.put('/api/users/:username', requireAdmin, (req, res) => {
        const targetUsername = req.params.username;
        const { password, permissions, enable2FA, tempSecret } = req.body;

        const users = loadUsers();
        const userIdx = users.findIndex(u => u.username === targetUsername);
        if (userIdx === -1) {
            return res.status(404).json({ error: '未找到该子账号' });
        }

        const user = users[userIdx];

        if (password && password.length >= 6) {
            const { hash, salt } = hashPassword(password);
            user.passwordHash = hash;
            user.passwordSalt = salt;
        }

        if (permissions !== undefined) {
            user.permissions = permissions;
        }

        if (enable2FA !== undefined) {
            if (enable2FA) {
                if (tempSecret) {
                    user.secret = tempSecret;
                } else if (!user.secret) {
                    return res.status(400).json({ error: '启用 2FA 必须提供验证密钥' });
                }
            } else {
                user.secret = '';
            }
        }

        users[userIdx] = user;
        saveUsers(users);
        res.json({ success: true });
    });

    app.delete('/api/users/:username', requireAdmin, (req, res) => {
        const targetUsername = req.params.username;
        const users = loadUsers();
        const filtered = users.filter(u => u.username !== targetUsername);
        if (users.length === filtered.length) {
            return res.status(404).json({ error: '未找到该子账号' });
        }
        saveUsers(filtered);
        res.json({ success: true });
    });

    app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

    // 服务器控制
    app.get('/api/server/status', requireAuth, withInstance, (req, res) => res.json({
        running: !!req.instState.process,
        status: req.instState.status || (req.instState.process ? 'running' : 'stopped'),
        onlinePlayers: Array.from(req.instState.onlinePlayers)
    }));

    // Player Inventory API
    app.get('/api/server/player-inventory/:name', requirePermission('instance.players'), withInstance, async (req, res) => {
        try {
            const playerName = req.params.name;
            const instDir = req.instDir;

            // Get level-name from server.properties
            let levelName = 'world';
            const propPath = path.join(instDir, 'server.properties');
            if (fs.existsSync(propPath)) {
                try {
                    const propContent = fs.readFileSync(propPath, 'utf8');
                    for (const line of propContent.split('\n')) {
                        if (line.trim().startsWith('level-name=')) {
                            levelName = line.split('=')[1].trim();
                            break;
                        }
                    }
                } catch (e) {}
            }

            // Get UUID from usercache.json
            let uuid = null;
            const userCachePath = path.join(instDir, 'usercache.json');
            if (fs.existsSync(userCachePath)) {
                try {
                    const userCache = fs.readJsonSync(userCachePath);
                    const entry = userCache.find(u => u.name === playerName);
                    if (entry) uuid = entry.uuid;
                } catch (e) {}
            }

            if (!uuid) {
                return res.status(404).json({ error: 'Player not found in usercache' });
            }

            // Read player .dat file
            const playerDataPath = path.join(instDir, levelName, 'playerdata', `${uuid}.dat`);
            if (!fs.existsSync(playerDataPath)) {
                return res.status(404).json({ error: 'Player data file not found' });
            }

            const compressed = fs.readFileSync(playerDataPath);
            const decompressed = zlib.gunzipSync(compressed);
            const inventory = parsePlayerInventory(decompressed);

            if (!inventory) {
                return res.status(500).json({ error: 'Failed to parse player inventory' });
            }

            res.json({ player: playerName, uuid, items: inventory });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Skin Proxy API - 解决前端 CORS 问题
    app.get('/api/skin-proxy', requireAuth, async (req, res) => {
        try {
            const url = req.query.url;
            if (!url) return res.status(400).json({ error: 'Missing url parameter' });
            // 只允许已知的皮肤域名
            const allowedHosts = [
                'crafatar.com',
                'crafthead.net',
                'mc-heads.net',
                'minotar.net',
                'littleskin.cn',
                'textures.minecraft.net',
                'playerdb.co'
            ];
            let parsedUrl;
            try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'Invalid url' }); }
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return res.status(400).json({ error: 'Invalid protocol' });
            }
            if (!allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))) {
                return res.status(403).json({ error: 'Domain not allowed' });
            }
            const axios = require('axios');
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
            res.set('Content-Type', response.headers['content-type'] || 'image/png');
            res.set('Cache-Control', 'public, max-age=3600');
            res.send(response.data);
        } catch (e) {
            res.status(502).json({ error: 'Failed to fetch skin: ' + e.message });
        }
    });

    // 统一玩家头像 API（多源容灾 + 本地磁盘持久缓存）
    app.get('/api/avatar', async (req, res) => {
        try {
            const player = (req.query.player || '').trim();
            const size = Math.min(Math.max(parseInt(req.query.size) || 64, 16), 256);
            if (!player || player.length > 36 || !/^[a-zA-Z0-9_-]+$/.test(player)) {
                return res.status(400).send('Invalid player');
            }

            const cacheDir = path.join(__dirname, 'data', 'avatar_cache');
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            const safeKey = player.toLowerCase();
            const cacheFile = path.join(cacheDir, `${safeKey}_${size}.png`);

            // 本地缓存 24 小时有效
            if (fs.existsSync(cacheFile)) {
                const stat = fs.statSync(cacheFile);
                if (Date.now() - stat.mtimeMs < 24 * 3600 * 1000) {
                    res.set('Content-Type', 'image/png');
                    res.set('Cache-Control', 'public, max-age=86400');
                    return res.sendFile(cacheFile);
                }
            }

            const axios = require('axios');
            const candidateUrls = [
                `https://crafthead.net/avatar/${encodeURIComponent(player)}/${size}`,
                `https://mc-heads.net/avatar/${encodeURIComponent(player)}/${size}`,
                `https://littleskin.cn/avatar/player/${encodeURIComponent(player)}?size=${size}`,
                `https://minotar.net/helm/${encodeURIComponent(player)}/${size}`,
                `https://crafatar.com/avatars/${encodeURIComponent(player)}?size=${size}&overlay`
            ];

            let fetched = false;
            for (const url of candidateUrls) {
                try {
                    const resp = await axios.get(url, {
                        responseType: 'arraybuffer',
                        timeout: 3000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) mc-web-panel/2.4.0' }
                    });
                    if (resp.status === 200 && resp.data && resp.data.length > 100) {
                        const contentType = resp.headers['content-type'] || 'image/png';
                        await fs.promises.writeFile(cacheFile, resp.data);
                        res.set('Content-Type', contentType);
                        res.set('Cache-Control', 'public, max-age=86400');
                        res.send(resp.data);
                        fetched = true;
                        break;
                    }
                } catch {
                    // 尝试下一个候选源
                }
            }

            if (!fetched) {
                // 如果抓取失败但本地存在旧缓存，直接使用旧缓存
                if (fs.existsSync(cacheFile)) {
                    res.set('Content-Type', 'image/png');
                    res.set('Cache-Control', 'public, max-age=300');
                    return res.sendFile(cacheFile);
                }
                res.status(404).send('Avatar not found');
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/api/server/player-pings', requireAuth, withInstance, async (req, res) => {
        try {
            const instDir = req.instDir;
            const pings = {};
            const playerIps = {};
            
            const playersSamplePath = path.join(instDir, 'logs');
            const latestLogPath = path.join(playersSamplePath, 'latest.log');
            if (fs.existsSync(latestLogPath)) {
                try {
                    const stat = fs.statSync(latestLogPath);
                    const start = Math.max(0, stat.size - 65536);
                    const fd = fs.openSync(latestLogPath, 'r');
                    const buf = Buffer.alloc(stat.size - start);
                    fs.readSync(fd, buf, 0, buf.length, start);
                    fs.closeSync(fd);
                    const tail = buf.toString('utf8');
                    const lines = tail.split('\n');
                    for (const line of lines.slice(-500)) {
                        // 1. Try to parse join/login IP address: Username[/127.0.0.1:54321] logged in
                        const ipMatch = line.match(/\[Server thread\/INFO\]:\s+(\w+)\[\/([\d\.]+):\d+\]\s+logged in/);
                        if (ipMatch) {
                            playerIps[ipMatch[1]] = ipMatch[2];
                        }
                        
                        // 2. Parse any legacy latency logs: Username ... (35ms)
                        const m = line.match(/\[(\d{2}:\d{2}:\d{2})\].*\[Server thread\/INFO\]:\s+(\w+)\s.*\((\d+)ms\)/);
                        if (m) {
                            pings[m[2]] = parseInt(m[3]);
                        }
                    }
                } catch (_) {}
            }
            
            // 3. Try to get RTT from established sockets using ss command (Linux only, instant and non-blocking)
            if (Object.keys(playerIps).length > 0) {
                try {
                    await new Promise((resolve) => {
                        const { exec } = require('child_process');
                        exec('ss -i -t -n state established', (err, stdout) => {
                            if (!err && stdout) {
                                const lines = stdout.split('\n');
                                for (let i = 0; i < lines.length - 1; i++) {
                                    const line = lines[i];
                                    for (const [name, ip] of Object.entries(playerIps)) {
                                        if (line.includes(ip)) {
                                            const nextLine = lines[i + 1];
                                            if (nextLine && nextLine.includes('rtt:')) {
                                                const rttMatch = nextLine.match(/rtt:([\d\.]+)/);
                                                if (rttMatch) {
                                                    pings[name] = Math.round(parseFloat(rttMatch[1]));
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            resolve();
                        });
                    });
                } catch (_) {}
            }
            
            const result = {};
            for (const name of req.instState.onlinePlayers) {
                result[name] = pings[name] !== undefined ? pings[name] : -1;
            }
            res.json(result);
        } catch (e) {
            res.json({});
        }
    });

    // Server Icon API
    app.get('/api/server/icon', withInstance, (req, res) => {
        const iconPath = path.join(req.instDir, 'server-icon.png');
        if (fs.existsSync(iconPath)) res.sendFile(iconPath);
        else res.status(404).send('No icon');
    });
    app.post('/api/server/icon', requirePermission('instance.properties'), withInstance, upload.single('icon'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file' });
            await fs.move(req.file.path, path.join(req.instDir, 'server-icon.png'), { overwrite: true });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.delete('/api/server/icon', requirePermission('instance.properties'), withInstance, async (req, res) => {
        try {
            await fs.remove(path.join(req.instDir, 'server-icon.png'));
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    const APPEARANCE_DIR = path.join(DATA_DIR, 'appearance');
    fs.ensureDirSync(APPEARANCE_DIR);

    app.post('/api/appearance/upload', requireAuth, upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file' });
            const { type } = req.body;
            if (!['logo', 'background'].includes(type)) {
                await fs.remove(req.file.path);
                return res.status(400).json({ error: 'Invalid type' });
            }
            const ext = path.extname(req.file.originalname) || '.png';
            const filename = `${type}${ext}`;
            await fs.move(req.file.path, path.join(APPEARANCE_DIR, filename), { overwrite: true });
            res.json({ success: true, filename });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/appearance/upload', requireAuth, async (req, res) => {
        try {
            const { type } = req.body;
            if (!['logo', 'background'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
            const files = await fs.readdir(APPEARANCE_DIR);
            for (const f of files) {
                if (f.startsWith(type + '.')) await fs.remove(path.join(APPEARANCE_DIR, f));
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/appearance/config', (req, res) => {
        try {
            const appearance = appConfig.appearance || {};
            res.json(appearance);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/appearance/:type', (req, res) => {
        const { type } = req.params;
        if (!['logo', 'background'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
        try {
            const files = fs.readdirSync(APPEARANCE_DIR);
            const match = files.find(f => f.startsWith(type + '.'));
            if (!match) return res.status(404).json({ error: 'Not found' });
            res.sendFile(path.join(APPEARANCE_DIR, match));
        } catch (e) { res.status(404).json({ error: 'Not found' }); }
    });

    app.post('/api/server/start', requirePermission('instance.control'), withInstance, async (req, res) => {
        const { instState, instDir, instanceId } = req;
        if (instState.process) return res.json({ message: '已运行' });
        instState.stopping = false;
        instState.status = 'starting';

        // Port conflict detection
        const propsFile = path.join(instDir, 'server.properties');
        let port = 25565;
        if (fs.existsSync(propsFile)) {
            try {
                const props = PropertiesReader(propsFile);
                port = parseInt(props.get('server-port')) || 25565;
            } catch (e) {}
        }
        if (await isPortInUse(port)) {
            instState.status = 'stopped';
            return res.json({ success: false, errorType: 'port_in_use', port: port, message: `端口 ${port} 已被占用` });
        }

        const instConf = instanceConfig.instances.find(i => i.id === instanceId);
        const rawJavaPath = instConf.javaPath || appConfig.javaPath;
        const javaPath = resolveJavaPath(rawJavaPath);
        const javaArgs = (instConf.javaArgs && instConf.javaArgs.length) ? instConf.javaArgs : appConfig.javaArgs;
        const loaderType = instConf.loaderType || 'fabric';
        let jarName = instConf.jarName || appConfig.jarName;

        if (loaderType === 'forge' || loaderType === 'neoforge') {
            const vFile = path.join(instDir, 'server-version.json');
            if (fs.existsSync(vFile)) {
                try {
                    const vData = fs.readJsonSync(vFile);
                    const mc = vData.gameVersion;
                    const lv = vData.loaderVersion;
                    if (loaderType === 'forge') {
                        const forgeJar = path.join(instDir, `forge-${mc}-${lv}.jar`);
                        const forgeUniversalJar = path.join(instDir, `forge-${mc}-${lv}-universal.jar`);
                        const mcServerJar = path.join(instDir, `minecraft_server.${mc}.jar`);
                        if (fs.existsSync(forgeJar)) jarName = `forge-${mc}-${lv}.jar`;
                        else if (fs.existsSync(forgeUniversalJar)) jarName = `forge-${mc}-${lv}-universal.jar`;
                        else if (fs.existsSync(mcServerJar)) jarName = `minecraft_server.${mc}.jar`;
                    } else {
                        const neoforgeJar = path.join(instDir, `neoforge-${lv}.jar`);
                        const neoforgeUniversalJar = path.join(instDir, `neoforge-${lv}-universal.jar`);
                        const mcServerJar = path.join(instDir, `minecraft_server.${mc}.jar`);
                        if (fs.existsSync(neoforgeJar)) jarName = `neoforge-${lv}.jar`;
                        else if (fs.existsSync(neoforgeUniversalJar)) jarName = `neoforge-${lv}-universal.jar`;
                        else if (fs.existsSync(mcServerJar)) jarName = `minecraft_server.${mc}.jar`;
                    }
                } catch (e) { }
            }
            if (!fs.existsSync(path.join(instDir, jarName))) {
                const files = fs.readdirSync(instDir).filter(f => f.endsWith('.jar') && !f.includes('installer'));
                const forgeLike = files.find(f => f.startsWith('forge-') || f.startsWith('neoforge-'));
                if (forgeLike) jarName = forgeLike;
                else if (files.length > 0) jarName = files[0];
            }
        }

        const javaVer = await checkJavaVersion(javaPath);
        if (javaVer === 'Not Installed') {
            instState.status = 'stopped';
            appendLog(instanceId, `[错误] Java 未找到: ${javaPath}\n`);
            return res.json({ success: false, message: `Java 未安装或二进制文件未找到: ${javaPath}` });
        }
        instState.javaVersion = javaVer;

        const eulaPath = path.join(instDir, 'eula.txt');
        try { if (!await fs.pathExists(eulaPath) || !(await fs.readFile(eulaPath, 'utf8')).includes('eula=true')) await fs.writeFile(eulaPath, 'eula=true'); } catch (e) { }

        instState.onlinePlayers.clear();
        appendLog(instanceId, '[系统] --- 正在启动服务器 ---\n');
        appendLog(instanceId, `[系统] 使用 Java: ${javaPath} (版本: ${javaVer})\n`);

        try {
            let spawnCmd, spawnArgs, spawnOpts = { cwd: instDir };

            const runSh = path.join(instDir, 'run.sh');
            const runBat = path.join(instDir, 'run.bat');
            const userJvmArgs = path.join(instDir, 'user_jvm_args.txt');
            const isWindows = process.platform === 'win32';
            const hasRunScript = (loaderType === 'forge' || loaderType === 'neoforge') && (isWindows ? (fs.existsSync(runBat) || fs.existsSync(runSh)) : fs.existsSync(runSh));

            if (hasRunScript) {
                const jvmArgsContent = javaArgs.map(a => a.trim()).filter(a => a).join('\n') + '\n';
                await fs.writeFile(userJvmArgs, jvmArgsContent);
                const scriptName = (isWindows && fs.existsSync(runBat)) ? 'run.bat' : 'run.sh';
                appendLog(instanceId, `[系统] 加载器: ${loaderType === 'neoforge' ? 'NeoForge' : 'Forge'} (${scriptName} 模式)\n`);
                appendLog(instanceId, `[系统] JVM 参数已写入 user_jvm_args.txt\n`);
                if (isWindows && scriptName === 'run.bat') {
                    spawnCmd = 'cmd.exe';
                    spawnArgs = ['/c', 'run.bat', 'nogui'];
                } else if (isWindows) {
                    spawnCmd = 'bash';
                    spawnArgs = [runSh, 'nogui'];
                } else {
                    spawnCmd = '/bin/bash';
                    spawnArgs = [runSh, 'nogui'];
                    try { await fs.chmod(runSh, 0o755); } catch (e) { }
                }
            } else {
                appendLog(instanceId, `[系统] 加载器: ${loaderType === 'neoforge' ? 'NeoForge' : loaderType.charAt(0).toUpperCase() + loaderType.slice(1)} (jar 模式)\n`);
                spawnCmd = javaPath;
                spawnArgs = [...javaArgs, '-jar', jarName, 'nogui'];
            }

            instState.process = spawn(spawnCmd, spawnArgs, spawnOpts);

            instState.process.stdout.on('data', (data) => {
                const line = data.toString();
                appendLog(instanceId, line);

                // Lifecycle state detection (Vanilla, Fabric, Forge, NeoForge, Paper, etc.)
                if (instState.status === 'starting' && /(?:Done \([0-9.]+s\)!|Done in [0-9.]+|Done! For help|Timings Reset)/i.test(line)) {
                    instState.status = 'running';
                    io.emit(`status:${instanceId}`, { isRunning: true, status: 'running' });
                    if (scrollEngine) {
                        scrollEngine.handleServerStart(instanceId);
                    }
                } else if (instState.status !== 'stopped' && /(?:Stopping (?:the )?server|Saving worlds|Saving players|Closing Server)/i.test(line)) {
                    instState.status = 'stopping';
                    io.emit(`status:${instanceId}`, { isRunning: true, status: 'stopping' });
                    if (scrollEngine) {
                        scrollEngine.handleServerStop(instanceId);
                    }
                }

                const rawLines = line.split('\n');
                for (const rawLine of rawLines) {
                    if (!rawLine.trim()) continue;

                    // Strip log prefix (e.g. "[13:27:31] [Server thread/INFO]: ") and optional "[Not Secure] "
                    const cleanMsg = rawLine
                        .replace(/^(?:\[\d{2}:\d{2}:\d{2}\]\s*)?(?:\[(?:Server thread|Async Chat Thread|INFO|minecraft\/MinecraftServer|[^\]]+)\]\s*)*:\s*/i, '')
                        .replace(/^\[Not Secure\]\s*/i, '')
                        .trim();

                    // 1. /list 指令响应解析（校准在线玩家）
                    // 兼容: "There are 1 of a max of 20 players online: Henvei", "There are 1/20 players online: Henvei", "共有 1 个在线玩家: Henvei"
                    const listMatch = cleanMsg.match(/(?:There are|共有)\s*(\d+)[^:：]*[:：]\s*(.*)$/i);
                    if (listMatch) {
                        const count = parseInt(listMatch[1], 10);
                        const rawNames = listMatch[2].trim();
                        const names = rawNames ? rawNames.split(',').map(n => n.trim().replace(/^\[.*?\]\s*/, '')).filter(Boolean) : [];
                        instState.onlinePlayers.clear();
                        for (const name of names) {
                            instState.onlinePlayers.add(name);
                        }
                        io.emit(`players_update:${instanceId}`, Array.from(instState.onlinePlayers));
                        continue;
                    }

                    // 2. 玩家加入游戏（支持英文、中文、Not Secure、带前缀/特殊符号用户名）
                    const join = cleanMsg.match(/^([a-zA-Z0-9_.* -]+?)\s+(?:joined the game|加入了游戏)/i);
                    if (join) {
                        const playerName = join[1].trim();
                        instState.onlinePlayers.add(playerName);
                        io.emit(`players_update:${instanceId}`, Array.from(instState.onlinePlayers));
                        triggerWebhook('player_change', { instanceId, type: 'join', player: playerName, onlinePlayers: Array.from(instState.onlinePlayers) });
                        if (pluginLoader && pluginLoader.emitLifecycleEvent) {
                            pluginLoader.emitLifecycleEvent('playerJoin', { instanceId, player: playerName, onlinePlayers: Array.from(instState.onlinePlayers) });
                        }
                        if (scrollEngine) {
                            scrollEngine.handlePlayerJoin(instanceId, playerName);
                        }
                        continue;
                    }

                    // 3. 玩家离开游戏或掉线（支持 left the game, 离开了游戏, lost connection: Disconnected）
                    const leave = cleanMsg.match(/^([a-zA-Z0-9_.* -]+?)\s+(?:left the game|离开了游戏|lost connection)/i);
                    if (leave) {
                        const playerName = leave[1].trim();
                        instState.onlinePlayers.delete(playerName);
                        io.emit(`players_update:${instanceId}`, Array.from(instState.onlinePlayers));
                        triggerWebhook('player_change', { instanceId, type: 'leave', player: playerName, onlinePlayers: Array.from(instState.onlinePlayers) });
                        if (pluginLoader && pluginLoader.emitLifecycleEvent) {
                            pluginLoader.emitLifecycleEvent('playerQuit', { instanceId, player: playerName, onlinePlayers: Array.from(instState.onlinePlayers) });
                        }
                        if (scrollEngine) {
                            scrollEngine.handlePlayerQuit(instanceId, playerName);
                        }
                        continue;
                    }
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
                    const forgeMatch = line.match(/Loading Minecraft (\S+) with Forge (\S+)/);
                    if (forgeMatch) {
                        instState.detectedVersion.mc = forgeMatch[1];
                        instState.detectedVersion.loader = forgeMatch[2];
                    }
                    const neoforgeMatch = line.match(/Loading Minecraft (\S+) with NeoForge (\S+)/);
                    if (neoforgeMatch) {
                        instState.detectedVersion.mc = neoforgeMatch[1];
                        instState.detectedVersion.loader = neoforgeMatch[2];
                    }
                    const forgeAltMatch = line.match(/Forge Mod Loader version (\S+)/);
                    if (forgeAltMatch && instState.detectedVersion.mc !== 'Unknown') {
                        instState.detectedVersion.loader = forgeAltMatch[1];
                    }
                    const neoforgeAltMatch = line.match(/NeoForge (\S+)/);
                    if (neoforgeAltMatch && instState.detectedVersion.mc !== 'Unknown') {
                        instState.detectedVersion.loader = neoforgeAltMatch[1];
                    }
                }
            });

            instState.process.stderr.on('data', d => appendLog(instanceId, d.toString()));

            instState.process.on('error', (err) => {
                appendLog(instanceId, `[严重错误] 启动失败: ${err.message}\n`);
                instState.status = 'stopped';
                instState.process = null;
                instState.stopping = false;
                io.emit(`status:${instanceId}`, { isRunning: false, status: 'stopped' });
            });

            instState.process.on('close', async (code) => {
                appendLog(instanceId, `[系统] --- 服务器已停止 (Code ${code}) ---\n`);
                
                // 异常关闭且非主动作业时执行崩溃原因诊断
                if (code !== 0 && !instState.stopping) {
                    const logsToAnalyze = instState.logHistory.slice(-50).join('\n');
                    let diagnosed = false;

                    // 1. OOM (Java Heap Space) 内存溢出
                    if (/java\.lang\.OutOfMemoryError/i.test(logsToAnalyze) || 
                        /Could not reserve enough space for object heap/i.test(logsToAnalyze) ||
                        /Too small initial heap/i.test(logsToAnalyze) ||
                        /JVM heap/i.test(logsToAnalyze)) {
                        appendLog(instanceId, `[诊断] 🔴 服务器因内存溢出 (OOM) 崩溃！检测到 Java 堆内存耗尽，请前往“服务器设置”或实例配置适当调高最大分配内存 (如 -Xmx 参数)。\n`);
                        diagnosed = true;
                    }
                    
                    // 2. Linux 系统 OOM Killer 杀进程 (Exit Code 137 / SIGKILL)
                    if (!diagnosed && code === 137) {
                        appendLog(instanceId, `[诊断] 🔴 服务器进程被系统强制终止 (Code 137)！这通常是由于系统物理内存耗尽，触发了 Linux 系统的 OOM Killer。请检查物理主机可用内存，或适当调小本实例的最大内存限制 (-Xmx)。\n`);
                        diagnosed = true;
                    }

                    // 3. Java 版本不匹配
                    if (!diagnosed && (/UnsupportedClassVersionError/i.test(logsToAnalyze) || 
                                       /has been compiled by a more recent version/i.test(logsToAnalyze) || 
                                       /Java class version/i.test(logsToAnalyze) || 
                                       /Unsupported Java/i.test(logsToAnalyze))) {
                        appendLog(instanceId, `[诊断] 🔴 Java 版本不兼容！当前配置的 Java 路径版本不支持该版本的 Minecraft。请前往“Java 管理”安装或切换到更合适的 Java 版本 (例如：MC 1.20+ 建议使用 Java 17+)。\n`);
                        diagnosed = true;
                    }

                    // 4. 端口已被占用
                    if (!diagnosed && (/FAILED TO BIND TO PORT/i.test(logsToAnalyze) || 
                                       /Address already in use/i.test(logsToAnalyze) || 
                                       /port already in use/i.test(logsToAnalyze))) {
                        appendLog(instanceId, `[诊断] 🔴 网络端口绑定失败！服务器设定的通讯端口已被系统中的其他程序占用。请前往实例启动设置或 server.properties 中修改端口，或者关闭其他冲突的实例/服务。\n`);
                        diagnosed = true;
                    }

                    // 5. 未同意 EULA 协议
                    if (!diagnosed && (/agree to the EULA/i.test(logsToAnalyze) || /Failed to load eula\.txt/i.test(logsToAnalyze))) {
                        appendLog(instanceId, `[诊断] 🔴 服务器未同意 EULA 协议！请通过文件管理器编辑实例根目录下的 eula.txt 文件，将 eula=false 更改为 eula=true 以允许服务器正常启动。\n`);
                        diagnosed = true;
                    }

                    // 6. Mod / 插件前置依赖缺失或冲突
                    if (!diagnosed && (/DependencyResolutionException/i.test(logsToAnalyze) || 
                                       /Missing or unsupported mandatory dependencies/i.test(logsToAnalyze) || 
                                       /requires version/i.test(logsToAnalyze) || 
                                       /depends on/i.test(logsToAnalyze))) {
                        appendLog(instanceId, `[诊断] 🔴 检测到 Mod/插件依赖缺失或冲突！请仔细阅读上方的报错日志，确保下载了所有必需的前置 Mod，并删除版本冲突的插件。\n`);
                        diagnosed = true;
                    }

                    // 7. 扫描最新崩溃日志文件 (crash-reports)
                    if (!diagnosed) {
                        try {
                            const crashDir = path.join(instDir, 'crash-reports');
                            if (fs.existsSync(crashDir)) {
                                const files = await fs.readdir(crashDir);
                                if (files.length > 0) {
                                    const fileStats = await Promise.all(files.map(async f => {
                                        const s = await fs.stat(path.join(crashDir, f));
                                        return { name: f, mtime: s.mtimeMs };
                                    }));
                                    fileStats.sort((a, b) => b.mtime - a.mtime);
                                    const newest = fileStats[0];
                                    if (Date.now() - newest.mtime < 30000) {
                                        appendLog(instanceId, `[诊断] 🔴 服务器发生异常崩溃！崩溃报告已生成：crash-reports/${newest.name}。您可以在文件管理器中查看该文件以获取详细异常堆栈。\n`);
                                        diagnosed = true;
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Failed to scan crash-reports', e);
                        }
                    }

                    if (!diagnosed) {
                        appendLog(instanceId, `[诊断] ⚠️ 服务器异常退出 (Code ${code})，但未能匹配到特定崩溃特征。请仔细检查上方最新的报错日志信息进行排查。\n`);
                    }
                }

                // Webhook & Plugin event triggers on stop/crash
                if (code !== 0 && !instState.stopping) {
                    triggerWebhook('server_state_change', { instanceId, isRunning: false, state: 'crash', code });
                    if (pluginLoader && pluginLoader.emitLifecycleEvent) {
                        pluginLoader.emitLifecycleEvent('serverCrash', { instanceId, code });
                    }
                } else {
                    triggerWebhook('server_state_change', { instanceId, isRunning: false, state: 'stop', code });
                    if (pluginLoader && pluginLoader.emitLifecycleEvent) {
                        pluginLoader.emitLifecycleEvent('serverStop', { instanceId, code });
                    }
                    if (scrollEngine) {
                        scrollEngine.handleServerStop(instanceId);
                    }
                }

                instState.status = 'stopped';
                io.emit(`status:${instanceId}`, { isRunning: false, status: 'stopped' });
                instState.onlinePlayers.clear();
                io.emit(`players_update:${instanceId}`, []);
                instState.process = null;
                instState.stopping = false;
            });

            instState.status = 'starting';
            io.emit(`status:${instanceId}`, { isRunning: true, status: 'starting' });
            triggerWebhook('server_state_change', { instanceId, isRunning: true, state: 'start' });
            if (pluginLoader && pluginLoader.emitLifecycleEvent) {
                pluginLoader.emitLifecycleEvent('serverStart', { instanceId });
            }
            res.json({ success: true });
        } catch (e) {
            instState.status = 'stopped';
            appendLog(instanceId, `[错误] 启动异常: ${e.message}\n`);
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/server/reassign_port', requireAuth, withInstance, async (req, res) => {
        const { instDir, instanceId } = req;
        const propsFile = path.join(instDir, 'server.properties');
        if (!fs.existsSync(propsFile)) {
            return res.status(404).json({ error: 'server.properties 文件不存在' });
        }
        
        try {
            // Find a free port starting from 25565
            let port = 25565;
            while (await isPortInUse(port)) {
                port++;
            }
            
            // Read and update properties file
            const content = await fs.readFile(propsFile, 'utf-8');
            let result = content;
            const regex = new RegExp(`^(server-port\\s*=\\s*)(.*)$`, 'm');
            if (regex.test(result)) {
                result = result.replace(regex, `$1${port}`);
            } else {
                result += `\nserver-port=${port}`;
            }
            await fs.writeFile(propsFile, result);
            appendLog(instanceId, `[系统] 检测到端口冲突，已自动将端口重分配为: ${port}\n`);
            
            res.json({ success: true, port });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/server/stop', requirePermission('instance.control'), withInstance, (req, res) => {
        if (req.instState.process) {
            req.instState.stopping = true;
            req.instState.status = 'stopping';
            io.emit(`status:${req.instanceId}`, { isRunning: true, status: 'stopping' });
            req.instState.process.stdin.write('stop\n');
        }
        res.json({ success: true });
    });

    app.post('/api/server/force_stop', requirePermission('instance.control'), withInstance, (req, res) => {
        const proc = req.instState.process;
        if (proc) {
            try {
                req.instState.stopping = true;
                req.instState.status = 'stopping';
                io.emit(`status:${req.instanceId}`, { isRunning: true, status: 'stopping' });
                proc.kill('SIGKILL');
                appendLog(req.instanceId, '[系统] 服务器进程已被强制终止\n');
            } catch (e) {
                req.instState.stopping = false;
                return res.status(500).json({ error: '强制终止失败: ' + e.message });
            }
        }
        res.json({ success: true });
    });
    app.post('/api/server/command', requirePermission('instance.control'), withInstance, (req, res) => {
        if (req.instState.process) {
            req.instState.process.stdin.write(req.body.command + '\n');
            appendLog(req.instanceId, `> ${req.body.command}\n`);
        }
        res.json({ success: true });
    });

    // 文件管理
    app.get('/api/files/list', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        const targetPath = path.join(instDir, req.query.path || '');
        if (!isPathInside(targetPath, instDir)) return res.status(403).send('Denied');
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
    const fixFileName = (name) => {
        if (!name) return name;
        let hasHighUnicode = false;
        let hasLatin1Extended = false;
        for (let i = 0; i < name.length; i++) {
            const code = name.charCodeAt(i);
            if (code > 0xFF) { hasHighUnicode = true; break; }
            if (code >= 0x80) hasLatin1Extended = true;
        }
        if (hasHighUnicode || !hasLatin1Extended) return name;
        try {
            const decoded = Buffer.from(name, 'latin1').toString('utf8');
            if (/[\x00-\x1f\x7f-\x9f]/.test(decoded)) return name;
            return decoded;
        } catch (e) {
            return name;
        }
    };

    app.post('/api/files/upload', requirePermission('instance.files'), withInstance, upload.array('files'), async (req, res) => {
        const { instDir } = req;
        const targetDir = req.body.path ? path.join(instDir, req.body.path) : instDir;
        if (!isPathInside(targetDir, instDir)) return res.status(403).json({ error: 'Access Denied' });
        let fileNames = [];
        try { if (req.body.fileNames) fileNames = JSON.parse(req.body.fileNames); } catch (e) {}
        try {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const originalName = fixFileName(fileNames[i] || file.originalname);
                const destPath = path.join(targetDir, originalName);
                const destDir = path.dirname(destPath);
                if (!isPathInside(destDir, instDir) || !isPathInside(destPath, instDir)) continue;
                await fs.ensureDir(destDir);
                await fs.move(file.path, destPath, { overwrite: true });
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    const CHUNK_TEMP_DIR = path.join(DATA_DIR, 'chunk_uploads');
    fs.ensureDirSync(CHUNK_TEMP_DIR);

    app.post('/api/files/chunk/init', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        const { fileName, fileSize, totalChunks, targetPath } = req.body;
        const destDir = targetPath ? path.join(instDir, targetPath) : instDir;
        if (!isPathInside(destDir, instDir)) return res.status(403).json({ error: 'Access Denied' });

        const uploadId = crypto.randomBytes(16).toString('hex');
        const chunkDir = path.join(CHUNK_TEMP_DIR, uploadId);
        await fs.ensureDir(chunkDir);
        await fs.writeJson(path.join(chunkDir, '.meta'), {
            fileName: fixFileName(fileName),
            fileSize,
            totalChunks,
            destDir,
            createdAt: Date.now()
        });
        res.json({ uploadId });
    });

    app.post('/api/files/chunk/upload', requirePermission('instance.files'), withInstance, upload.single('chunk'), async (req, res) => {
        const { uploadId, chunkIndex } = req.body;
        if (!uploadId || chunkIndex === undefined) return res.status(400).json({ error: 'Missing params' });

        const chunkDir = path.join(CHUNK_TEMP_DIR, uploadId);
        const metaPath = path.join(chunkDir, '.meta');
        if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Upload session not found' });

        try {
            const chunkFile = path.join(chunkDir, String(chunkIndex).padStart(6, '0'));
            await fs.move(req.file.path, chunkFile, { overwrite: true });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/chunk/complete', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { uploadId } = req.body;
        if (!uploadId) return res.status(400).json({ error: 'Missing uploadId' });

        const chunkDir = path.join(CHUNK_TEMP_DIR, uploadId);
        const metaPath = path.join(chunkDir, '.meta');
        if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Upload session not found' });

        try {
            const meta = await fs.readJson(metaPath);
            const { fileName, totalChunks, destDir } = meta;
            if (!isPathInside(destDir, req.instDir)) return res.status(403).json({ error: 'Access Denied' });

            const finalPath = path.join(destDir, fileName);
            if (!isPathInside(finalPath, req.instDir)) return res.status(403).json({ error: 'Access Denied' });
            await fs.ensureDir(path.dirname(finalPath));

            const writeStream = fs.createWriteStream(finalPath);
            for (let i = 0; i < totalChunks; i++) {
                const chunkFile = path.join(chunkDir, String(i).padStart(6, '0'));
                if (!fs.existsSync(chunkFile)) {
                    writeStream.close();
                    await fs.remove(finalPath).catch(() => { });
                    return res.status(400).json({ error: `Chunk ${i} missing` });
                }
                const data = fs.readFileSync(chunkFile);
                writeStream.write(data);
            }
            await new Promise((resolve, reject) => {
                writeStream.end(resolve);
                writeStream.on('error', reject);
            });

            await fs.remove(chunkDir);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
            try { await fs.remove(path.join(CHUNK_TEMP_DIR, uploadId)); } catch (_) { }
        }
    });

    app.post('/api/files/chunk/cancel', requirePermission('instance.files'), async (req, res) => {
        const { uploadId } = req.body;
        if (!uploadId) return res.status(400).json({ error: 'Missing uploadId' });
        try {
            const chunkDir = path.join(CHUNK_TEMP_DIR, uploadId);
            if (fs.existsSync(chunkDir)) await fs.remove(chunkDir);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    setInterval(() => {
        try {
            if (!fs.existsSync(CHUNK_TEMP_DIR)) return;
            const now = Date.now();
            for (const d of fs.readdirSync(CHUNK_TEMP_DIR)) {
                const metaPath = path.join(CHUNK_TEMP_DIR, d, '.meta');
                if (fs.existsSync(metaPath)) {
                    const meta = fs.readJsonSync(metaPath);
                    if (now - meta.createdAt > 3600000) fs.removeSync(path.join(CHUNK_TEMP_DIR, d));
                }
            }
        } catch (e) { }
    }, 1800000);

    app.post('/api/files/operate', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        const { action, sources, destination, compressName } = req.body;
        const destPath = destination ? path.join(instDir, destination) : instDir;
        if (!isPathInside(destPath, instDir)) return res.status(403).json({ error: 'Access Denied' });

        try {
            if (action === 'delete') {
                for (const src of (sources || [])) {
                    const p = path.join(instDir, src);
                    if (!isPathInside(p, instDir) || path.resolve(p) === path.resolve(instDir)) {
                        throw new Error('Access Denied');
                    }
                    await fs.remove(p);
                }
            }
            else if (action === 'move' || action === 'copy') {
                for (const src of (sources || [])) {
                    const srcPath = path.join(instDir, src);
                    if (!isPathInside(srcPath, instDir) || path.resolve(srcPath) === path.resolve(instDir)) throw new Error('Access Denied');

                    const finalDest = path.join(destPath, path.basename(src));
                    if (!isPathInside(finalDest, instDir)) throw new Error('Access Denied');

                    if (action === 'move') await fs.move(srcPath, finalDest, { overwrite: true });
                    else await fs.copy(srcPath, finalDest, { overwrite: true });
                }
            }
            else if (action === 'compress') {
                const archiveFileName = compressName ? path.basename(compressName) : `archive_${Date.now()}.zip`;
                const zipPath = path.join(destPath, archiveFileName);
                if (!isPathInside(zipPath, instDir)) throw new Error('Access Denied');

                const archive = archiver('zip', { zlib: { level: 9 } });
                const output = fs.createWriteStream(zipPath);

                await new Promise(async (resolve, reject) => {
                    output.on('close', resolve);
                    output.on('error', reject);
                    archive.on('error', reject);
                    archive.pipe(output);

                    try {
                        for (const src of (sources || [])) {
                            const srcPath = path.join(instDir, src);
                            if (!isPathInside(srcPath, instDir)) continue;
                            const stat = await fs.stat(srcPath);
                            if (stat.isDirectory()) {
                                archive.directory(srcPath, path.basename(srcPath));
                            } else {
                                archive.file(srcPath, { name: path.basename(srcPath) });
                            }
                        }
                        await archive.finalize();
                    } catch (e) {
                        reject(e);
                    }
                });
            }
            else if (action === 'extract') {
                for (const src of (sources || [])) {
                    const srcPath = path.join(instDir, src);
                    if (!isPathInside(srcPath, instDir)) continue;
                    const ext = src.toLowerCase();
                    const zip = new AdmZip(srcPath);
                    let extractDir;
                    if (destination) {
                        extractDir = path.join(instDir, destination);
                    } else {
                        extractDir = ext.endsWith('.tar.gz') || ext.endsWith('.tgz')
                            ? srcPath.replace(/\.(tar\.gz|tgz)$/i, '')
                            : srcPath.replace(/\.(zip|tar|gz)$/i, '');
                    }
                    if (!isPathInside(extractDir, instDir)) continue;
                    await fs.ensureDir(extractDir);
                    const entries = zip.getEntries();
                    for (const entry of entries) {
                        let entryName = entry.entryName;
                        try {
                            const rawName = entry.rawEntryName;
                            const hasUtf8Flag = (entry.header.flags & 0x0800) !== 0;
                            if (!hasUtf8Flag && rawName) {
                                try {
                                    const gbkDecoded = new TextDecoder('gbk').decode(rawName);
                                    if (gbkDecoded && !/[\x00-\x08\x0e-\x1f]/.test(gbkDecoded)) {
                                        entryName = gbkDecoded;
                                    }
                                } catch (_) {}
                            }
                        } catch (_) {}
                        const outputPath = path.join(extractDir, entryName);
                        if (!isPathInside(outputPath, extractDir)) continue;
                        if (entry.isDirectory) {
                            await fs.ensureDir(outputPath);
                        } else {
                            await fs.ensureDir(path.dirname(outputPath));
                            await fs.writeFile(outputPath, entry.getData());
                        }
                    }
                }
            }
            else if (action === 'disable') {
                for (const src of (sources || [])) {
                    const p = path.join(instDir, src);
                    if (!isPathInside(p, instDir) || path.resolve(p) === path.resolve(instDir)) continue;
                    if (!src.endsWith('.disabled')) await fs.rename(p, p + '.disabled');
                }
            }
            else if (action === 'enable') {
                for (const src of (sources || [])) {
                    if (src.endsWith('.disabled')) {
                        const newPath = src.slice(0, -9);
                        const p = path.join(instDir, src);
                        const np = path.join(instDir, newPath);
                        if (!isPathInside(p, instDir) || !isPathInside(np, instDir) || path.resolve(p) === path.resolve(instDir)) continue;

                        await fs.rename(p, np);
                    }
                }
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/rename', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        const { oldPath, newPath } = req.body;
        const op = path.join(instDir, oldPath);
        const np = path.join(instDir, newPath);
        if (!isPathInside(op, instDir) || !isPathInside(np, instDir) || path.resolve(op) === path.resolve(instDir)) return res.status(403).json({ error: 'Access Denied' });

        try {
            await fs.rename(op, np);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/mkdir', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        const targetPath = path.join(instDir, req.body.path);
        if (!isPathInside(targetPath, instDir)) return res.status(403).json({ error: 'Denied' });
        try { await fs.ensureDir(targetPath); res.json({ success: true }); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/files/create', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        const targetPath = path.join(instDir, req.body.path);
        if (!isPathInside(targetPath, instDir)) return res.status(403).json({ error: 'Denied' });
        try {
            if (await fs.pathExists(targetPath)) return res.status(400).json({ error: 'File exists' });
            await fs.outputFile(targetPath, '');
            res.json({ success: true });
        }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/files/download', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        const filePath = path.join(instDir, req.query.path);
        if (!isPathInside(filePath, instDir)) return res.status(403).send('Denied');
        if (fs.existsSync(filePath)) res.download(filePath); else res.status(404).send('Not Found');
    });
    app.get('/api/files/content', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const filepath = path.join(instDir, req.query.path);
            if (!isPathInside(filepath, instDir)) return res.status(403).send('Denied');
            if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
            res.json({ content: await fs.readFile(filepath, 'utf8') });
        } catch (e) { res.status(500).send('Err'); }
    });

    app.get('/api/files/archive-list', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const filepath = path.join(instDir, req.query.path);
            if (!isPathInside(filepath, instDir)) return res.status(403).send('Denied');
            if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
            const zip = new AdmZip(filepath);
            const entries = zip.getEntries().map(e => {
                let name = e.entryName;
                try {
                    const rawName = e.rawEntryName;
                    const hasUtf8Flag = (e.header.flags & 0x0800) !== 0;
                    if (!hasUtf8Flag && rawName) {
                        try {
                            const gbkDecoded = new TextDecoder('gbk').decode(rawName);
                            if (gbkDecoded && !/[\x00-\x08\x0e-\x1f]/.test(gbkDecoded)) {
                                name = gbkDecoded;
                            }
                        } catch (_) {}
                    }
                } catch (_) {}
                return {
                    name,
                    isDir: e.isDirectory,
                    size: e.header.size,
                    compressedSize: e.header.compressedSize,
                    date: e.header.time ? new Date(e.header.time * 1000).toISOString() : null
                };
            });
            res.json({ entries, total: entries.length });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/files/preview-image', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const filepath = path.join(instDir, req.query.path);
            if (!isPathInside(filepath, instDir)) return res.status(403).send('Denied');
            if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
            const ext = path.extname(filepath).toLowerCase();
            const mimeMap = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
                '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
            };
            const mime = mimeMap[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            fs.createReadStream(filepath).pipe(res);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    app.post('/api/files/save', requirePermission('instance.files'), withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const filepath = path.join(instDir, req.body.filepath);
            if (!isPathInside(filepath, instDir)) return res.status(403).send('Denied');
            await fs.writeFile(filepath, req.body.content);
            res.json({ success: true });
        } catch (e) { res.status(500).send('Err'); }
    });

    const SERVER_PROPS_SCHEMA = {
        'motd': { type: 'text' },
        'server-port': { type: 'number' },
        'max-players': { type: 'number' },
        'online-mode': { type: 'boolean' },
        'white-list': { type: 'boolean' },
        'enable-rcon': { type: 'boolean' },
        'rcon.password': { type: 'text' },
        'rcon.port': { type: 'number' },
        'gamemode': { type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
        'force-gamemode': { type: 'boolean' },
        'difficulty': { type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
        'hardcore': { type: 'boolean' },
        'pvp': { type: 'boolean' },
        'allow-flight': { type: 'boolean' },
        'level-seed': { type: 'text' },
        'level-type': { type: 'text' },
        'level-name': { type: 'text' },
        'generate-structures': { type: 'boolean' },
        'generator-settings': { type: 'text' },
        'allow-nether': { type: 'boolean' },
        'spawn-monsters': { type: 'boolean' },
        'spawn-animals': { type: 'boolean' },
        'spawn-npcs': { type: 'boolean' },
        'spawn-protection': { type: 'number' },
        'view-distance': { type: 'number' },
        'simulation-distance': { type: 'number' },
        'max-tick-time': { type: 'number' },
        'rate-limit': { type: 'number' },
        'enable-query': { type: 'boolean' },
        'query.port': { type: 'number' },
        'enable-status': { type: 'boolean' },
        'enforce-secure-profile': { type: 'boolean' },
        'enforce-whitelist': { type: 'boolean' },
        'entity-broadcast-range-percentage': { type: 'number' },
        'function-permission-level': { type: 'select', options: ['1', '2', '3', '4'] },
        'op-permission-level': { type: 'select', options: ['1', '2', '3', '4'] },
        'player-idle-timeout': { type: 'number' },
        'prevent-proxy-connections': { type: 'boolean' },
        'network-compression-threshold': { type: 'number' },
        'max-world-size': { type: 'number' },
        'sync-chunk-writes': { type: 'boolean' },
        'use-native-transport': { type: 'boolean' },
        'enable-jmx-monitoring': { type: 'boolean' },
        'broadcast-console-to-ops': { type: 'boolean' },
        'broadcast-rcon-to-ops': { type: 'boolean' },
        'require-resource-pack': { type: 'boolean' },
        'resource-pack': { type: 'text' },
        'resource-pack-sha1': { type: 'text' },
        'resource-pack-prompt': { type: 'text' },
        'resource-pack-id': { type: 'text' },
        'server-ip': { type: 'text' },
        'hide-online-players': { type: 'boolean' },
        'initial-enabled-packs': { type: 'text' },
        'initial-disabled-packs': { type: 'text' },
        'max-chained-neighbor-updates': { type: 'number' },
        'log-ips': { type: 'boolean' },
        'region-file-compression': { type: 'select', options: ['deflate', 'lz4'] },
        'pause-when-empty-seconds': { type: 'number' },
        'accepts-transfers': { type: 'boolean' },
        'enable-code-of-conduct': { type: 'boolean' },
        'bug-report-link': { type: 'text' },
        'text-filtering-config': { type: 'text' },
        'text-filtering-version': { type: 'number' },
        'management-server-enabled': { type: 'boolean' },
        'management-server-host': { type: 'text' },
        'management-server-port': { type: 'number' },
        'management-server-secret': { type: 'text' },
        'management-server-allowed-origins': { type: 'text' },
        'management-server-tls-enabled': { type: 'boolean' },
        'management-server-tls-keystore': { type: 'text' },
        'management-server-tls-keystore-password': { type: 'text' },
        'status-heartbeat-interval': { type: 'number' },
        'enable-command-block': { type: 'boolean' }
    };

    const SERVER_PROPS_GROUPS = [
        { titleKey: 'properties.groups.general', keys: ['motd', 'server-port', 'max-players', 'online-mode', 'white-list', 'server-ip', 'enable-status', 'hide-online-players', 'log-ips'] },
        { titleKey: 'properties.groups.gameplay', keys: ['gamemode', 'force-gamemode', 'difficulty', 'hardcore', 'pvp', 'allow-flight', 'enforce-secure-profile', 'enforce-whitelist'] },
        { titleKey: 'properties.groups.world', keys: ['level-seed', 'level-type', 'level-name', 'generate-structures', 'generator-settings', 'allow-nether', 'initial-enabled-packs', 'initial-disabled-packs'] },
        { titleKey: 'properties.groups.spawning', keys: ['spawn-monsters', 'spawn-animals', 'spawn-npcs', 'spawn-protection', 'entity-broadcast-range-percentage'] },
        { titleKey: 'properties.groups.network', keys: ['view-distance', 'simulation-distance', 'max-tick-time', 'rate-limit', 'network-compression-threshold', 'max-world-size', 'sync-chunk-writes', 'use-native-transport', 'max-chained-neighbor-updates', 'pause-when-empty-seconds'] },
        { titleKey: 'properties.groups.security', keys: ['enable-rcon', 'rcon.password', 'rcon.port', 'enable-query', 'query.port', 'prevent-proxy-connections', 'enable-jmx-monitoring', 'broadcast-console-to-ops', 'broadcast-rcon-to-ops'] },
        { titleKey: 'properties.groups.resource_pack', keys: ['require-resource-pack', 'resource-pack', 'resource-pack-sha1', 'resource-pack-prompt', 'resource-pack-id'] },
        { titleKey: 'properties.groups.permissions', keys: ['function-permission-level', 'op-permission-level', 'player-idle-timeout'] },
        { titleKey: 'properties.groups.management', keys: ['management-server-enabled', 'management-server-host', 'management-server-port', 'management-server-secret', 'management-server-allowed-origins', 'management-server-tls-enabled', 'management-server-tls-keystore', 'management-server-tls-keystore-password', 'status-heartbeat-interval'] },
        { titleKey: 'properties.groups.other', keys: ['accepts-transfers', 'enable-code-of-conduct', 'bug-report-link', 'text-filtering-config', 'text-filtering-version', 'region-file-compression', 'enable-command-block'] }
    ];

    app.get('/api/server/properties', requirePermission('instance.properties'), withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const propsFile = path.join(instDir, 'server.properties');
            if (!fs.existsSync(propsFile)) return res.status(404).json({ error: 'File not found' });
            const content = await fs.readFile(propsFile, 'utf-8');
            const lines = content.split('\n');
            const properties = [];
            const groupedKeys = new Set(SERVER_PROPS_GROUPS.flatMap(g => g.keys));
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx === -1) continue;
                const key = trimmed.substring(0, eqIdx).trim();
                const value = trimmed.substring(eqIdx + 1).trim();
                const schema = SERVER_PROPS_SCHEMA[key] || { type: 'text' };
                let parsedValue = value;
                if (schema.type === 'boolean') parsedValue = value === 'true';
                else if (schema.type === 'number') parsedValue = Number(value) || 0;
                properties.push({
                    key,
                    value: parsedValue,
                    rawValue: value,
                    type: schema.type,
                    options: schema.options || undefined,
                    known: !!SERVER_PROPS_SCHEMA[key],
                    grouped: groupedKeys.has(key)
                });
            }
            res.json({ properties, groups: SERVER_PROPS_GROUPS, schema: SERVER_PROPS_SCHEMA });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/server/properties', requirePermission('instance.properties'), withInstance, async (req, res) => {
        const { instDir } = req;
        try {
            const propsFile = path.join(instDir, 'server.properties');
            if (!fs.existsSync(propsFile)) return res.status(404).json({ error: 'File not found' });
            const content = await fs.readFile(propsFile, 'utf-8');
            const updates = req.body.properties || {};
            let result = content;
            for (const [key, value] of Object.entries(updates)) {
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`^(${escapedKey}\\s*=\\s*)(.*)$`, 'm');
                if (regex.test(result)) {
                    result = result.replace(regex, `$1${value}`);
                } else {
                    result += `\n${key}=${value}`;
                }
            }
            await fs.writeFile(propsFile, result);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    const ALLOWED_LIST_TYPES = ['ops', 'whitelist', 'banned-players', 'banned-ips'];

    app.get('/api/lists/:type', requirePermission('instance.players'), withInstance, async (req, res) => {
        const { instDir } = req;
        const type = req.params.type;
        if (!ALLOWED_LIST_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid list type' });
        try { res.json(await fs.readJson(path.join(instDir, `${type}.json`))); } catch (e) { res.json([]); }
    });
    app.post('/api/lists/:type', requirePermission('instance.players'), withInstance, async (req, res) => {
        const { instDir } = req;
        const type = req.params.type;
        if (!ALLOWED_LIST_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid list type' });
        try {
            const f = path.join(instDir, `${type}.json`);
            if (!isPathInside(f, instDir)) return res.status(403).json({ error: 'Denied' });
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
                body: gh.data.body,
                publishedAt: gh.data.published_at
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

            const runningInstances = instanceConfig.instances.filter(inst => {
                const state = getOrCreateInstanceState(inst.id);
                return state.process !== null;
            });
            if (runningInstances.length > 0) {
                const names = runningInstances.map(i => i.name).join('、');
                return res.status(409).json({ error: `存在正在运行的实例（${names}），请先手动关闭所有运行中的实例后再执行更新操作` });
            }

            // 1. 获取最新版本信息
            const gh = await axios.get('https://api.github.com/repos/4YStudio/mc-web-panel/releases/latest', {
                headers: { 'User-Agent': 'MC-Web-Panel' },
                timeout: 5000
            });

            const platform = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'macos' : 'linux';
            const archStr = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : process.arch;
            const arch = `${platform}-${archStr}`;
            const version = gh.data.tag_name.replace(/^v/, '');
            const versionCompact = version.replace(/\./g, '');
            const assetName = `MWP-${versionCompact}-${arch}`;
            
            // 1. 精确匹配
            let asset = gh.data.assets.find(a => a.name === assetName);
            
            // 2. 如果精确匹配失败，尝试模糊匹配（只匹配架构部分）
            if (!asset) {
                console.log(`[Update] Exact match for "${assetName}" not found, trying fuzzy match...`);
                asset = gh.data.assets.find(a => 
                    a.name.includes(arch) && 
                    a.name.startsWith('MWP-')
                );
            }
            
            // 3. 如果还失败，尝试更宽松的匹配（只匹配平台和架构关键词）
            if (!asset) {
                console.log(`[Update] Fuzzy match failed, trying keyword match...`);
                asset = gh.data.assets.find(a => 
                    (a.name.includes(platform) || a.name.includes(process.platform)) &&
                    (a.name.includes(archStr) || a.name.includes(process.arch)) &&
                    a.name.startsWith('MWP-')
                );
            }

            if (!asset) {
                const availableAssets = gh.data.assets.map(a => a.name).join(', ');
                console.error(`[Update] Asset "${assetName}" not found. Available: ${availableAssets}`);
                return res.status(404).json({ error: `未找到对应架构 ( ${arch} ) 的发布文件，可用文件: ${availableAssets}` });
            }
            
            console.log(`[Update] Found asset: ${asset.name}`);

            const downloadUrl = applyGithubProxy(asset.browser_download_url);
            const newExePath = APP_EXECUTABLE + '.new';
            const oldExePath = APP_EXECUTABLE + '.old';

            console.log(`[Update] Downloading ${assetName} from ${downloadUrl}...`);
            io.emit('update_status', { step: 'downloading', message: '正在下载新版本...' });

            const controller = new AbortController();
            activeDownloads.set('system_update', controller);

            const writer = fs.createWriteStream(newExePath);

            let currentUrl = downloadUrl;
            let response = null;
            let redirectsFollowed = 0;
            const maxRedirects = 5;

            while (redirectsFollowed < maxRedirects) {
                console.log(`[Update] Requesting download chunk: ${currentUrl}`);
                response = await axios({
                    url: currentUrl,
                    method: 'GET',
                    responseType: 'stream',
                    signal: controller.signal,
                    maxRedirects: 0,
                    validateStatus: (status) => (status >= 200 && status < 400)
                });

                if (response.status >= 300 && response.status < 400 && response.headers.location) {
                    let nextUrl = new URL(response.headers.location, currentUrl).href;
                    currentUrl = applyGithubProxy(nextUrl);
                    redirectsFollowed++;
                    console.log(`[Update] Redirecting to: ${currentUrl}`);
                } else {
                    break;
                }
            }

            if (!response || response.status !== 200) {
                throw new Error(`Failed to download update, server returned status: ${response ? response.status : 'unknown'}`);
            }

            // 追踪进度
            const totalLength = parseInt(response.headers['content-length'], 10) || 0;
            let downloadedLength = 0;
            let lastUpdateTime = Date.now();
            let lastDownloadedLength = 0;

            response.data.on('data', (chunk) => {
                downloadedLength += chunk.length;
                const now = Date.now();
                if (now - lastUpdateTime >= 1000) {
                    const speed = (downloadedLength - lastDownloadedLength) / ((now - lastUpdateTime) / 1000);
                    lastUpdateTime = now;
                    lastDownloadedLength = downloadedLength;

                    const progress = totalLength > 0 ? Math.round((downloadedLength / totalLength) * 100) : 0;
                    io.emit('update_progress', { 
                        progress, 
                        speed,
                        processedSize: downloadedLength,
                        totalSize: totalLength
                    });
                }
            });

            try {
                await pipeline(
                    response.data,
                    writer,
                    { signal: controller.signal }
                );

                console.log('[Update] Download complete. Applying update...');
                io.emit('update_status', { step: 'applying', message: '正在应用更新...' });

                // 给予执行权限
                await fs.chmod(newExePath, '755');

                // 使用实际的 asset 文件名（支持模糊匹配）
                const newVersionedName = asset.name;
                const newVersionedPath = path.join(path.dirname(APP_EXECUTABLE), newVersionedName);

                // 备份旧版本
                if (await fs.pathExists(oldExePath)) await fs.remove(oldExePath);
                await fs.move(APP_EXECUTABLE, oldExePath);

                // 替换为新版本（使用新版本名称）
                await fs.move(newExePath, newVersionedPath);

                // 更新 APP_EXECUTABLE 指向新路径
                APP_EXECUTABLE = newVersionedPath;

                // 更新持久化路径
                try {
                    const dataDir = path.join(path.dirname(APP_EXECUTABLE), 'data');
                    fs.ensureDirSync(dataDir);
                    fs.writeFileSync(path.join(dataDir, 'executable_path.txt'), APP_EXECUTABLE);
                } catch (e) { }

                console.log(`[Update] Update applied. New executable: ${APP_EXECUTABLE}. Restarting...`);
                io.emit('update_status', { step: 'restarting', message: '更新成功，正在重启面板...' });

                setTimeout(() => {
                    process.send({ type: 'restart_master', newExecutable: APP_EXECUTABLE });
                    process.exit(100);
                }, 2000);

                res.json({ success: true, message: '更新已下载并应用，正在重启...' });

            } catch (err) {
                if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || controller.signal.aborted) {
                    console.log('[Update] Update cancelled by user.');
                    io.emit('update_status', { step: 'cancelled', message: '已取消更新' });
                } else {
                    console.error('[Update] Error during update:', err);
                    io.emit('update_status', { step: 'error', message: '更新失败: ' + err.message });
                }

                // Cleanup temporary files
                try {
                    if (await fs.pathExists(newExePath)) await fs.remove(newExePath);
                } catch (cleanupErr) {
                    console.error('[Update] Failed to cleanup .new file:', cleanupErr);
                }

                // If we aborted and hadn't yet moved the old executable, no recovery needed.
                // If we were in the middle of moving, try to ensure APP_EXECUTABLE exists.
                if (await fs.pathExists(oldExePath) && !await fs.pathExists(APP_EXECUTABLE)) {
                    await fs.move(oldExePath, APP_EXECUTABLE);
                }

                // Don't res.json here if headers sent
                if (!res.headersSent) {
                    res.status(500).json({ error: err.message });
                }
            } finally {
                activeDownloads.delete('system_update');
            }

            // End of update block

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
        res.json({ version: APP_VERSION, startupTime: STARTUP_TIME });
    });


    const listenPort = process.env.PORT || appConfig.port || 3000;
    server.listen(listenPort, () => console.log(`MC Panel v${APP_VERSION} running on http://localhost:${listenPort}`));
}