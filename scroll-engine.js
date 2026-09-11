/**
 * MC Web Panel - 卷轴引擎 (Scroll Engine)
 * 轻量、免侵入的 Minecraft 控制台事件驱动与自动化脚本系统
 * 
 * 核心设计架构：
 * 1. 实例级隔离：卷轴存放于各 MC 实例目录 instances/<instanceId>/scrolls/，互不干扰；
 * 2. 独立事件总线：日志、进出服、聊天、死亡事件按 instanceId 精准路由分发；
 * 3. 独立上下文沙盒：指令下发、定时器调度、持久化存储 (.storage/) 均与实例严格绑定；
 * 4. 平滑兼容与迁移：启动时自动将根目录历史卷轴平滑迁移至 default 实例。
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const multer = require('multer');
const axios = require('axios');

class ScrollEngine {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.instancesDir = options.instancesDir || path.join(this.projectRoot, 'instances');
        this.getInstanceDir = options.getInstanceDir || ((id) => path.join(this.instancesDir, id));
        this.getInstances = options.getInstances || (() => []);
        this.instancesState = options.instancesState || null;
        this.getActiveInstanceId = options.getActiveInstanceId || (() => 'default');
        this.appendLog = options.appendLog || null;
        this.io = options.io || null;

        // 临时上传目录
        this.tmpUploadDir = path.join(this.projectRoot, 'data', 'tmp_uploads');
        if (!fs.existsSync(this.tmpUploadDir)) fs.mkdirSync(this.tmpUploadDir, { recursive: true });

        /**
         * 实例级卷轴与事件容器映射:
         * instanceId -> {
         *   instanceId: string,
         *   scrollsDir: string,
         *   storageDir: string,
         *   scrolls: Map<scrollId, ScrollRecord>,
         *   eventListeners: { playerJoin, playerQuit, chat, death, log, serverStart, serverStop }
         * }
         */
        this.instanceHolders = new Map();
    }

    /**
     * 获取指定实例的根目录
     */
    resolveInstanceDir(instanceId) {
        if (typeof this.getInstanceDir === 'function') {
            const dir = this.getInstanceDir(instanceId);
            if (dir) return dir;
        }
        return path.join(this.instancesDir, instanceId);
    }

    /**
     * 获取指定实例的卷轴存储目录: instances/<instanceId>/scrolls
     */
    getInstanceScrollsDir(instanceId) {
        const instDir = this.resolveInstanceDir(instanceId);
        return path.join(instDir, 'scrolls');
    }

    /**
     * 获取指定实例的卷轴持久化存储目录: instances/<instanceId>/scrolls/.storage
     */
    getInstanceStorageDir(instanceId) {
        return path.join(this.getInstanceScrollsDir(instanceId), '.storage');
    }

    /**
     * 获取或初始化指定实例的容器
     */
    getOrCreateHolder(instanceId) {
        const iid = instanceId || this.getActiveInstanceId() || 'default';
        if (!this.instanceHolders.has(iid)) {
            const scrollsDir = this.getInstanceScrollsDir(iid);
            const storageDir = this.getInstanceStorageDir(iid);

            if (!fs.existsSync(scrollsDir)) fs.mkdirSync(scrollsDir, { recursive: true });
            if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

            this.instanceHolders.set(iid, {
                instanceId: iid,
                scrollsDir,
                storageDir,
                scrolls: new Map(),
                eventListeners: {
                    playerJoin: new Set(),
                    playerQuit: new Set(),
                    chat: new Set(),
                    death: new Set(),
                    log: new Set(),
                    serverStart: new Set(),
                    serverStop: new Set()
                }
            });
        }
        return this.instanceHolders.get(iid);
    }

    /**
     * 初始化卷轴引擎
     */
    async init() {
        console.log('[ScrollEngine] 正在初始化卷轴引擎 (MC 实例级隔离模式)...');

        // 1. 平滑迁移检查：如果旧版根目录 scrolls/ 存在，将其内容拷贝迁移到 default 实例
        await this.migrateLegacyRootScrolls();

        // 2. 加载所有已知实例的卷轴
        let instances = [];
        try {
            instances = typeof this.getInstances === 'function' ? this.getInstances() : [];
        } catch (_) {}

        if (instances && instances.length > 0) {
            for (const inst of instances) {
                if (inst && inst.id) {
                    await this.loadInstanceScrolls(inst.id);
                }
            }
        } else {
            await this.loadInstanceScrolls('default');
        }

        let totalScrolls = 0;
        for (const holder of this.instanceHolders.values()) {
            totalScrolls += holder.scrolls.size;
        }

        console.log(`[ScrollEngine] 卷轴引擎初始化完毕，当前维护 ${this.instanceHolders.size} 个实例环境，共加载 ${totalScrolls} 个卷轴`);
    }

    /**
     * 平滑迁移旧版根目录 scrolls/
     */
    async migrateLegacyRootScrolls() {
        try {
            const legacyDir = path.join(this.projectRoot, 'scrolls');
            const defaultScrollsDir = this.getInstanceScrollsDir('default');

            if (fs.existsSync(legacyDir)) {
                const entries = fs.readdirSync(legacyDir, { withFileTypes: true }).filter(e => e.isDirectory());
                if (entries.length > 0) {
                    if (!fs.existsSync(defaultScrollsDir)) {
                        fs.mkdirSync(defaultScrollsDir, { recursive: true });
                    }
                    let migratedCount = 0;
                    for (const entry of entries) {
                        const src = path.join(legacyDir, entry.name);
                        const dest = path.join(defaultScrollsDir, entry.name);
                        if (!fs.existsSync(dest)) {
                            fs.cpSync(src, dest, { recursive: true });
                            migratedCount++;
                        }
                    }
                    if (migratedCount > 0) {
                        console.log(`[ScrollEngine] 已将旧版根目录下的 ${migratedCount} 个卷轴平滑迁移至 default 实例目录: ${defaultScrollsDir}`);
                    }
                }
            }
        } catch (err) {
            console.warn('[ScrollEngine] 迁移根目录旧卷轴时发生轻微异常 (已忽略):', err.message);
        }
    }

    /**
     * 加载指定实例的所有卷轴
     */
    async loadInstanceScrolls(instanceId) {
        const holder = this.getOrCreateHolder(instanceId);
        if (!fs.existsSync(holder.scrollsDir)) return;

        const entries = fs.readdirSync(holder.scrollsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
            const scrollId = entry.name;
            try {
                await this.loadScroll(instanceId, scrollId);
            } catch (err) {
                console.error(`[ScrollEngine:${instanceId}] 加载卷轴 [${scrollId}] 失败:`, err.message);
            }
        }
    }

    /**
     * 读取指定实例卷轴的 manifest
     */
    readManifest(instanceId, scrollId) {
        const holder = this.getOrCreateHolder(instanceId);
        const manifestPath = path.join(holder.scrollsDir, scrollId, 'scroll.json');
        if (!fs.existsSync(manifestPath)) return null;
        try {
            const raw = fs.readFileSync(manifestPath, 'utf8');
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * 保存指定实例卷轴的 manifest
     */
    saveManifest(instanceId, scrollId, manifest) {
        const holder = this.getOrCreateHolder(instanceId);
        const manifestPath = path.join(holder.scrollsDir, scrollId, 'scroll.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    }

    /**
     * 加载并运行指定实例下的一个卷轴
     */
    async loadScroll(instanceId, scrollId) {
        const holder = this.getOrCreateHolder(instanceId);
        this.unloadScroll(instanceId, scrollId); // 先清理旧实例资源

        const manifest = this.readManifest(instanceId, scrollId);
        if (!manifest) return null;

        const entryPath = path.join(holder.scrollsDir, scrollId, 'index.js');
        if (!fs.existsSync(entryPath)) {
            throw new Error(`卷轴 ${scrollId} 缺少入口文件 index.js`);
        }

        const context = this.createContext(instanceId, scrollId, manifest);
        const record = {
            id: scrollId,
            instanceId,
            manifest,
            active: false,
            context,
            entryPath,
            timers: new Set(),
            listeners: []
        };

        holder.scrolls.set(scrollId, record);

        if (manifest.enabled !== false) {
            try {
                // 清理 require 缓存实现热重载
                delete require.cache[require.resolve(entryPath)];
                const scrollFunc = require(entryPath);
                if (typeof scrollFunc === 'function') {
                    await scrollFunc(context);
                    record.active = true;
                    const displayName = typeof manifest.name === 'object' ? (manifest.name.zh || manifest.name.en || scrollId) : (manifest.name || scrollId);
                    console.log(`[ScrollEngine:${instanceId}] 卷轴 [${displayName}] 已成功激活`);
                }
            } catch (err) {
                record.active = false;
                record.error = err.message;
                console.error(`[ScrollEngine:${instanceId}] 卷轴 [${scrollId}] 运行抛出异常:`, err);
            }
        }

        return record;
    }

    /**
     * 停用并卸载指定实例下的一个卷轴（清理该卷轴在当前实例下的所有定时器与监听）
     */
    unloadScroll(instanceId, scrollId) {
        const holder = this.instanceHolders.get(instanceId);
        if (!holder) return;

        const record = holder.scrolls.get(scrollId);
        if (!record) return;

        // 1. 清理该卷轴在当前实例下注册的所有定时器
        if (record.timers) {
            for (const timer of record.timers) {
                clearInterval(timer);
                clearTimeout(timer);
            }
            record.timers.clear();
        }

        // 2. 解除该卷轴在当前实例下的所有事件监听
        if (record.listeners) {
            for (const { event, handler } of record.listeners) {
                if (holder.eventListeners[event]) {
                    holder.eventListeners[event].delete(handler);
                }
            }
            record.listeners = [];
        }

        record.active = false;
        holder.scrolls.delete(scrollId);
    }

    /**
     * 卸载清理整个实例的所有卷轴（例如实例被删除时调用）
     */
    unloadInstance(instanceId) {
        const holder = this.instanceHolders.get(instanceId);
        if (!holder) return;

        for (const scrollId of Array.from(holder.scrolls.keys())) {
            this.unloadScroll(instanceId, scrollId);
        }
        this.instanceHolders.delete(instanceId);
        console.log(`[ScrollEngine] 实例 [${instanceId}] 的卷轴环境已全部卸载`);
    }

    /**
     * 为卷轴生成专属的实例级上下文沙盒 (ScrollContext)
     */
    createContext(instanceId, scrollId, manifest) {
        const self = this;
        const holder = this.getOrCreateHolder(instanceId);

        const recordTimers = () => holder.scrolls.get(scrollId)?.timers;
        const recordListeners = () => holder.scrolls.get(scrollId)?.listeners;

        // 独立存储文件: instances/<instanceId>/scrolls/.storage/<scrollId>.json
        const storageFile = path.join(holder.storageDir, `${scrollId}.json`);
        let storageCache = null;

        const loadStorage = () => {
            if (storageCache !== null) return storageCache;
            try {
                if (fs.existsSync(storageFile)) {
                    storageCache = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
                } else {
                    storageCache = {};
                }
            } catch {
                storageCache = {};
            }
            return storageCache;
        };

        const saveStorage = () => {
            try {
                fs.writeFileSync(storageFile, JSON.stringify(storageCache || {}, null, 2), 'utf8');
            } catch {}
        };

        const addListener = (event, handler) => {
            if (!holder.eventListeners[event]) holder.eventListeners[event] = new Set();
            holder.eventListeners[event].add(handler);
            const listeners = recordListeners();
            if (listeners) listeners.push({ event, handler });
            return () => {
                if (holder.eventListeners[event]) holder.eventListeners[event].delete(handler);
            };
        };

        return {
            id: scrollId,
            instanceId,
            manifest,
            config: manifest.config || {},

            logger: {
                info: (...args) => console.log(`[Scroll:${instanceId}:${scrollId}]`, ...args),
                warn: (...args) => console.warn(`[Scroll:${instanceId}:${scrollId}]`, ...args),
                error: (...args) => console.error(`[Scroll:${instanceId}:${scrollId}]`, ...args)
            },

            sleep: (ms) => new Promise(resolve => {
                const timer = setTimeout(resolve, ms);
                const timers = recordTimers();
                if (timers) timers.add(timer);
            }),

            // 事件订阅（绑定在本实例总线上）
            onPlayerJoin: (handler) => addListener('playerJoin', handler),
            onPlayerQuit: (handler) => addListener('playerQuit', handler),
            onChat: (handler) => addListener('chat', handler),
            onDeath: (handler) => addListener('death', handler),
            onLog: (handler) => addListener('log', handler),
            onServerStart: (handler) => addListener('serverStart', handler),
            onServerStop: (handler) => addListener('serverStop', handler),

            // 定时任务调度（精准作用于当前实例）
            schedule: (intervalMs, taskFn) => {
                const timer = setInterval(() => {
                    try {
                        taskFn(instanceId);
                    } catch (err) {
                        console.error(`[Scroll:${instanceId}:${scrollId}] 定时任务执行失败:`, err);
                    }
                }, intervalMs);
                const timers = recordTimers();
                if (timers) timers.add(timer);
                return () => clearInterval(timer);
            },

            // 命令发送：默认直接下发给当前所属实例
            sendCommand: (command, targetInstanceId) => {
                const iid = targetInstanceId || instanceId;
                return self.sendCommand(iid, command);
            },

            // 便捷全屏大标题
            sendTitle: async (player, options = {}, targetInstanceId) => {
                const iid = targetInstanceId || instanceId;
                const title = options.title || '';
                const subtitle = options.subtitle || '';
                const color = options.color || 'gold';
                const fadeIn = options.fadeIn ?? 10;
                const stay = options.stay ?? 60;
                const fadeOut = options.fadeOut ?? 20;

                self.sendCommand(iid, `title ${player} times ${fadeIn} ${stay} ${fadeOut}`);
                if (subtitle) {
                    self.sendCommand(iid, `title ${player} subtitle {"text":"${subtitle}","color":"yellow"}`);
                }
                if (title) {
                    self.sendCommand(iid, `title ${player} title {"text":"${title}","color":"${color}","bold":true}`);
                }
            },

            // 便捷 ActionBar
            sendActionBar: async (player, message, targetInstanceId) => {
                const iid = targetInstanceId || instanceId;
                const json = JSON.stringify({ text: message });
                self.sendCommand(iid, `title ${player} actionbar ${json}`);
            },

            // 便捷聊天全服广播
            broadcast: async (message, targetInstanceId) => {
                const iid = targetInstanceId || instanceId;
                const json = JSON.stringify({ text: message });
                self.sendCommand(iid, `tellraw @a ${json}`);
            },

            // 持久化存储 API（实例隔离）
            storage: {
                get: (key, defaultValue) => {
                    const cache = loadStorage();
                    return cache[key] !== undefined ? cache[key] : defaultValue;
                },
                set: (key, value) => {
                    const cache = loadStorage();
                    cache[key] = value;
                    saveStorage();
                },
                delete: (key) => {
                    const cache = loadStorage();
                    delete cache[key];
                    saveStorage();
                }
            }
        };
    }

    /**
     * 发送控制台命令到指定实例进程
     */
    sendCommand(instanceId, command) {
        if (!command) return false;
        const iid = instanceId || this.getActiveInstanceId();
        const state = this.instancesState ? (this.instancesState.get ? this.instancesState.get(iid) : this.instancesState[iid]) : null;
        if (!state || !state.process) return false;
        try {
            state.process.stdin.write(command + '\n');
            if (this.appendLog) this.appendLog(iid, `> [卷轴] ${command}\n`);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 捕获并分发控制台日志事件（按 instanceId 隔离）
     */
    handleConsoleLog(instanceId, logLine) {
        if (!logLine) return;
        const holder = this.instanceHolders.get(instanceId);
        if (!holder) return;

        // 1. 触发该实例的通用 onLog
        for (const handler of holder.eventListeners.log) {
            try { handler({ instanceId, line: logLine }); } catch (e) {}
        }

        // 2. 匹配玩家聊天消息: <Player> message
        const chatMatch = logLine.match(/<(\w+)>\s+(.*)/);
        if (chatMatch) {
            const player = chatMatch[1];
            const message = chatMatch[2].trim();
            for (const handler of holder.eventListeners.chat) {
                try { handler({ instanceId, player, message }); } catch (e) {}
            }
        }

        // 3. 匹配死亡消息
        const deathPatterns = [
            /:\s+(\w+)\swas\sslain\sby\s(.*)/,
            /:\s+(\w+)\sfell\sfrom\sa\shigh\splace/,
            /:\s+(\w+)\sdrowned/,
            /:\s+(\w+)\sburned\sto\sdeath/,
            /:\s+(\w+)\swas\sshot\sby\s(.*)/,
            /:\s+(\w+)\swas\sblown\sup\sby\s(.*)/,
            /:\s+(\w+)\ssuffocated\sin\sa\swall/
        ];
        for (const pat of deathPatterns) {
            const m = logLine.match(pat);
            if (m) {
                const player = m[1];
                for (const handler of holder.eventListeners.death) {
                    try { handler({ instanceId, player, reason: logLine.trim() }); } catch (e) {}
                }
                break;
            }
        }
    }

    /**
     * 玩家加入事件分发（按 instanceId 隔离）
     */
    handlePlayerJoin(instanceId, player) {
        const holder = this.instanceHolders.get(instanceId);
        if (!holder) return;

        for (const handler of holder.eventListeners.playerJoin) {
            try { handler({ instanceId, player }); } catch (e) {
                console.error(`[ScrollEngine:${instanceId}] 执行 playerJoin 钩子失败:`, e);
            }
        }
    }

    /**
     * 玩家退出事件分发（按 instanceId 隔离）
     */
    handlePlayerQuit(instanceId, player) {
        const holder = this.instanceHolders.get(instanceId);
        if (!holder) return;

        for (const handler of holder.eventListeners.playerQuit) {
            try { handler({ instanceId, player }); } catch (e) {
                console.error(`[ScrollEngine:${instanceId}] 执行 playerQuit 钩子失败:`, e);
            }
        }
    }

    /**
     * 获取指定实例的所有卷轴列表（用于前端展示）
     */
    getAllScrolls(instanceId) {
        const holder = this.getOrCreateHolder(instanceId);
        const list = [];
        if (!fs.existsSync(holder.scrollsDir)) return list;

        const entries = fs.readdirSync(holder.scrollsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
            const scrollId = entry.name;
            const manifest = this.readManifest(instanceId, scrollId);
            if (!manifest) continue;

            const record = holder.scrolls.get(scrollId);
            list.push({
                id: scrollId,
                instanceId,
                name: manifest.name || scrollId,
                version: manifest.version || '1.0.0',
                author: manifest.author || 'Anonymous',
                description: manifest.description || '',
                icon: manifest.icon || 'fa-scroll',
                category: manifest.category || 'tools',
                color: manifest.color || '#8b5cf6',
                enabled: manifest.enabled !== false,
                active: record ? record.active : false,
                error: record ? record.error : null,
                config: manifest.config || {},
                configSchema: manifest.configSchema || []
            });
        }
        return list;
    }

    /**
     * 注册 REST API 路由 (集成 withInstance 中间件)
     */
    registerRoutes(app, requireAuth, withInstance) {
        const router = require('express').Router();

        // 1. 获取当前实例的所有卷轴
        router.get('/', requireAuth, withInstance, (req, res) => {
            res.json({ scrolls: this.getAllScrolls(req.instanceId) });
        });

        // 2. 切换当前实例指定卷轴的启用状态
        router.post('/:id/toggle', requireAuth, withInstance, async (req, res) => {
            const { id } = req.params;
            const manifest = this.readManifest(req.instanceId, id);
            if (!manifest) return res.status(404).json({ error: '卷轴不存在' });

            const enabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : !manifest.enabled;
            manifest.enabled = enabled;
            this.saveManifest(req.instanceId, id, manifest);

            if (enabled) {
                await this.loadScroll(req.instanceId, id);
            } else {
                this.unloadScroll(req.instanceId, id);
            }

            res.json({ success: true, enabled });
        });

        // 3. 修改当前实例指定卷轴的配置
        router.post('/:id/config', requireAuth, withInstance, async (req, res) => {
            const { id } = req.params;
            const manifest = this.readManifest(req.instanceId, id);
            if (!manifest) return res.status(404).json({ error: '卷轴不存在' });

            manifest.config = { ...(manifest.config || {}), ...(req.body.config || {}) };
            this.saveManifest(req.instanceId, id, manifest);

            // 热重载使配置即时生效
            if (manifest.enabled !== false) {
                await this.loadScroll(req.instanceId, id);
            }

            res.json({ success: true, config: manifest.config });
        });

        // 4. 获取卷轴代码
        router.get('/:id/code', requireAuth, withInstance, (req, res) => {
            const { id } = req.params;
            const holder = this.getOrCreateHolder(req.instanceId);
            const entryPath = path.join(holder.scrollsDir, id, 'index.js');
            const manifestPath = path.join(holder.scrollsDir, id, 'scroll.json');
            if (!fs.existsSync(entryPath)) return res.status(404).json({ error: '卷轴代码不存在' });

            const code = fs.readFileSync(entryPath, 'utf8');
            let manifestStr = '{}';
            if (fs.existsSync(manifestPath)) {
                manifestStr = fs.readFileSync(manifestPath, 'utf8');
            }
            res.json({ code, manifest: manifestStr });
        });

        // 5. 保存卷轴代码并热重载
        router.post('/:id/code', requireAuth, withInstance, async (req, res) => {
            const { id } = req.params;
            const holder = this.getOrCreateHolder(req.instanceId);
            const entryPath = path.join(holder.scrollsDir, id, 'index.js');
            const manifestPath = path.join(holder.scrollsDir, id, 'scroll.json');
            const { code, manifestStr } = req.body;

            if (typeof code === 'string') {
                fs.writeFileSync(entryPath, code, 'utf8');
            }
            if (typeof manifestStr === 'string') {
                try {
                    const parsed = JSON.parse(manifestStr);
                    fs.writeFileSync(manifestPath, JSON.stringify(parsed, null, 2), 'utf8');
                } catch (e) {
                    return res.status(400).json({ error: 'scroll.json 格式错误: ' + e.message });
                }
            }

            try {
                await this.loadScroll(req.instanceId, id);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: '保存成功但载入失败: ' + err.message });
            }
        });

        // 6. 删除当前实例下的卷轴
        router.post('/:id/delete', requireAuth, withInstance, (req, res) => {
            const { id } = req.params;
            this.unloadScroll(req.instanceId, id);
            const holder = this.getOrCreateHolder(req.instanceId);
            const targetDir = path.join(holder.scrollsDir, id);
            if (fs.existsSync(targetDir)) {
                fs.rmSync(targetDir, { recursive: true, force: true });
            }
            res.json({ success: true });
        });

        // 7. 导出当前实例下的卷轴为 ZIP
        router.get('/:id/export', requireAuth, withInstance, (req, res) => {
            try {
                const { id } = req.params;
                const holder = this.getOrCreateHolder(req.instanceId);
                const targetDir = path.join(holder.scrollsDir, id);
                if (!fs.existsSync(targetDir)) {
                    return res.status(404).json({ error: '卷轴目录不存在' });
                }

                const zip = new AdmZip();
                zip.addLocalFolder(targetDir);
                const buffer = zip.toBuffer();

                res.set('Content-Type', 'application/zip');
                res.set('Content-Disposition', `attachment; filename="${id}.zip"`);
                res.send(buffer);
            } catch (e) {
                res.status(500).json({ error: '导出卷轴失败: ' + e.message });
            }
        });

        // 8. 上传本地 ZIP 卷轴并安装至当前实例
        const scrollUpload = multer({ dest: this.tmpUploadDir });

        router.post('/upload', requireAuth, withInstance, scrollUpload.single('scroll'), async (req, res) => {
            if (!req.file) return res.status(400).json({ error: '未接收到上传的文件' });

            try {
                const zip = new AdmZip(req.file.path);
                const manifestEntry = zip.getEntry('scroll.json');
                if (!manifestEntry) {
                    throw new Error('无效的卷轴包：ZIP 内未找到 scroll.json 清单文件');
                }

                const meta = JSON.parse(manifestEntry.getData().toString('utf8'));
                const scrollId = meta.id;
                if (!scrollId) throw new Error('scroll.json 中缺少有效 id');

                const holder = this.getOrCreateHolder(req.instanceId);
                const targetDir = path.join(holder.scrollsDir, scrollId);
                if (fs.existsSync(targetDir)) {
                    this.unloadScroll(req.instanceId, scrollId);
                }
                fs.mkdirSync(targetDir, { recursive: true });
                zip.extractAllTo(targetDir, true);

                await this.loadScroll(req.instanceId, scrollId);

                try { fs.unlinkSync(req.file.path); } catch (e) {}

                res.json({ success: true, id: scrollId, manifest: meta });
            } catch (err) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
                res.status(500).json({ error: err.message });
            }
        });

        // 9. 远程或在线商店一键安装卷轴至当前实例
        router.post('/install-remote', requireAuth, withInstance, async (req, res) => {
            try {
                const { id, downloadUrl } = req.body;
                if (!id) return res.status(400).json({ error: '缺少卷轴 ID' });

                let zipBuffer = null;
                const localZip = path.join(this.projectRoot, 'docs', 'scrolls_shop', `${id}.zip`);

                if (fs.existsSync(localZip)) {
                    zipBuffer = fs.readFileSync(localZip);
                } else if (downloadUrl) {
                    if (downloadUrl.startsWith('./') || downloadUrl.startsWith('/')) {
                        const localRelPath = path.join(this.projectRoot, 'docs', downloadUrl.replace(/^\.\//, ''));
                        if (fs.existsSync(localRelPath)) {
                            zipBuffer = fs.readFileSync(localRelPath);
                        }
                    }

                    if (!zipBuffer && (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://'))) {
                        const resp = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: 15000 });
                        zipBuffer = Buffer.from(resp.data);
                    }
                }

                if (!zipBuffer) {
                    return res.status(404).json({ error: '未能定位或下载卷轴 ZIP 压缩包' });
                }

                const zip = new AdmZip(zipBuffer);
                const holder = this.getOrCreateHolder(req.instanceId);
                const targetDir = path.join(holder.scrollsDir, id);
                if (fs.existsSync(targetDir)) {
                    this.unloadScroll(req.instanceId, id);
                }
                fs.mkdirSync(targetDir, { recursive: true });
                zip.extractAllTo(targetDir, true);

                await this.loadScroll(req.instanceId, id);
                res.json({ success: true, id });
            } catch (e) {
                res.status(500).json({ error: '安装卷轴失败: ' + e.message });
            }
        });

        // 10. 获取在线商店卷轴列表（附带当前实例的比对状态）
        router.get('/market', requireAuth, withInstance, async (req, res) => {
            try {
                const shopJsonPath = path.join(this.projectRoot, 'docs', 'scrolls_shop', 'scrolls.json');
                let marketItems = [];
                if (fs.existsSync(shopJsonPath)) {
                    marketItems = JSON.parse(fs.readFileSync(shopJsonPath, 'utf8'));
                }

                const installedList = this.getAllScrolls(req.instanceId);
                const installedMap = new Map();
                installedList.forEach(s => installedMap.set(s.id, s));

                const result = marketItems.map(item => {
                    const inst = installedMap.get(item.id);
                    return {
                        ...item,
                        installed: !!inst,
                        installedVersion: inst ? inst.version : null,
                        hasUpdate: inst ? (inst.version !== item.version) : false
                    };
                });

                res.json({ scrolls: result });
            } catch (err) {
                res.status(500).json({ error: '获取卷轴市场失败: ' + err.message });
            }
        });

        app.use('/api/scrolls', router);
    }
}

module.exports = ScrollEngine;
