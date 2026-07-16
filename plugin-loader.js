const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const EventEmitter = require('events');

const DEFAULT_PLUGINS_DIR = path.join(__dirname, 'plugins');

const API_VERSION = '2.0.0';

const KNOWN_PERMISSIONS = {
    'fs.read': { label: { zh: '读取文件系统', en: 'Read Filesystem' }, description: { zh: '读取服务器文件', en: 'Read server files' } },
    'fs.write': { label: { zh: '写入文件系统', en: 'Write Filesystem' }, description: { zh: '写入或修改服务器文件', en: 'Write or modify server files' } },
    'network': { label: { zh: '网络访问', en: 'Network Access' }, description: { zh: '发起网络请求', en: 'Make network requests' } },
    'process': { label: { zh: '执行命令', en: 'Execute Commands' }, description: { zh: '执行系统命令或子进程', en: 'Execute system commands or child processes' } },
    'socket': { label: { zh: '实时通信', en: 'Real-time Communication' }, description: { zh: '创建 Socket.IO 命名空间', en: 'Create Socket.IO namespaces' } },
    'http': { label: { zh: 'HTTP 路由', en: 'HTTP Routes' }, description: { zh: '注册 HTTP API 路由', en: 'Register HTTP API routes' } },
    'http.public': { label: { zh: '公开 HTTP 路由', en: 'Public HTTP Routes' }, description: { zh: '注册无需认证的公开路由', en: 'Register unauthenticated public routes' } },
    'storage': { label: { zh: '持久化存储', en: 'Persistent Storage' }, description: { zh: '使用键值存储 API', en: 'Use key-value storage API' } },
    'settings': { label: { zh: '插件设置', en: 'Plugin Settings' }, description: { zh: '注册插件设置面板', en: 'Register plugin settings panel' } },
    'task': { label: { zh: '后台任务', en: 'Background Tasks' }, description: { zh: '注册常驻或定时任务', en: 'Register persistent or scheduled tasks' } },
    'events': { label: { zh: '插件间通信', en: 'Inter-plugin Communication' }, description: { zh: '监听或发送插件间事件', en: 'Listen or emit inter-plugin events' } },
    'status': { label: { zh: '状态上报', en: 'Status Reporting' }, description: { zh: '上报插件运行状态', en: 'Report plugin runtime status' } },
};

const getDisplayName = (name) => {
    if (!name) return 'Unknown';
    if (typeof name === 'string') return name;
    if (typeof name === 'object') return name.en || name.zh || Object.values(name)[0] || 'Unknown';
    return String(name);
};

class PluginLoader {
    constructor(app, io, options = {}) {
        this.app = app;
        this.io = io;
        this.options = options;
        this.pluginsDir = options.pluginsDir || DEFAULT_PLUGINS_DIR;
        this._requireAuth = options.requireAuth || null;
        this.plugins = new Map();
        this.pluginState = {};
        this._stateFile = options.stateFile || path.join(__dirname, 'data', 'plugin-state.json');
        this._loadState();

        this._sidebarItems = [];
        this._components = {};
        this._dashboardCards = [];
        this.pluginRouters = new Map();
        this.publicPluginRouters = new Map();
        this._tasks = new Map();
        this._crons = new Map();
        this._eventBus = new EventEmitter();
        this._eventBus.setMaxListeners(100);
        this._pluginEventHandlers = new Map();
        this._pluginSettings = new Map();
        this._pluginStatus = new Map();
        this._pluginStorage = new Map();
        this._pluginRequireCache = new Map();

        setTimeout(() => this.cleanTempFiles(), 1000);
        setInterval(() => this.cleanTempFiles(), 3600000);
    }

    registerMiddleware() {
        this.app.use('/api/plugins/:pluginId', (req, res, next) => {
            const pluginId = req.params.pluginId;
            const routers = this.pluginRouters.get(pluginId);
            if (!routers) return next();

            let matchedPrefix = null;
            let matchedRouter = null;

            for (const [prefix, router] of routers) {
                const isRoot = prefix === '/';
                const matchPrefix = isRoot ? '/' : (prefix.endsWith('/') ? prefix : prefix + '/');
                if (req.path === prefix || req.path.startsWith(matchPrefix)) {
                    if (!matchedPrefix || prefix.length > matchedPrefix.length) {
                        matchedPrefix = prefix;
                        matchedRouter = router;
                    }
                }
            }

            if (matchedRouter) {
                const originalUrl = req.url;
                const originalBaseUrl = req.baseUrl;
                let subPath = req.url.substring(matchedPrefix.length);
                if (!subPath.startsWith('/')) subPath = '/' + subPath;
                req.url = subPath;
                req.baseUrl = req.baseUrl + matchedPrefix;

                return this.requireAuth(req, res, () => {
                    matchedRouter(req, res, (err) => {
                        req.url = originalUrl;
                        req.baseUrl = originalBaseUrl;
                        next(err);
                    });
                });
            }
            next();
        });

        this.app.use('/api/public/plugins/:pluginId', (req, res, next) => {
            const pluginId = req.params.pluginId;
            const routers = this.publicPluginRouters.get(pluginId);
            if (!routers) return next();

            let matchedPrefix = null;
            let matchedRouter = null;

            for (const [prefix, router] of routers) {
                const isRoot = prefix === '/';
                const matchPrefix = isRoot ? '/' : (prefix.endsWith('/') ? prefix : prefix + '/');
                if (req.path === prefix || req.path.startsWith(matchPrefix)) {
                    if (!matchedPrefix || prefix.length > matchedPrefix.length) {
                        matchedPrefix = prefix;
                        matchedRouter = router;
                    }
                }
            }

            if (matchedRouter) {
                const originalUrl = req.url;
                const originalBaseUrl = req.baseUrl;
                let subPath = req.url.substring(matchedPrefix.length);
                if (!subPath.startsWith('/')) subPath = '/' + subPath;
                req.url = subPath;
                req.baseUrl = req.baseUrl + matchedPrefix;

                return matchedRouter(req, res, (err) => {
                    req.url = originalUrl;
                    req.baseUrl = originalBaseUrl;
                    next(err);
                });
            }
            next();
        });
    }

    set requireAuth(fn) {
        this._requireAuth = fn;
    }

    get requireAuth() {
        return this._requireAuth || ((req, res, next) => next());
    }

    _loadState() {
        try {
            if (fs.existsSync(this._stateFile)) {
                this.pluginState = fs.readJsonSync(this._stateFile);
            }
        } catch (e) {
            this.pluginState = {};
        }
    }

    _saveState() {
        try {
            fs.ensureDirSync(path.dirname(this._stateFile));
            fs.writeJsonSync(this._stateFile, this.pluginState, { spaces: 2 });
        } catch (e) {
            console.error('[PluginLoader] Failed to save plugin state:', e.message);
        }
    }

    cleanTempFiles() {
        try {
            const now = Date.now();
            const oneHour = 3600000;

            if (fs.existsSync(this.pluginsDir)) {
                const entries = fs.readdirSync(this.pluginsDir);
                for (const entry of entries) {
                    if (entry.startsWith('_tmp_')) {
                        const fullPath = path.join(this.pluginsDir, entry);
                        const stats = fs.statSync(fullPath);
                        if (now - stats.mtimeMs > oneHour) {
                            fs.removeSync(fullPath);
                            console.log(`[PluginLoader] Cleaned up old temp directory: ${entry}`);
                        }
                    }
                }
            }

            const dataDir = this.options.dataDir;
            if (dataDir) {
                const tmpUploadsDir = path.join(dataDir, 'tmp_uploads');
                if (fs.existsSync(tmpUploadsDir)) {
                    const entries = fs.readdirSync(tmpUploadsDir);
                    for (const entry of entries) {
                        const fullPath = path.join(tmpUploadsDir, entry);
                        const stats = fs.statSync(fullPath);
                        if (now - stats.mtimeMs > oneHour) {
                            fs.removeSync(fullPath);
                            console.log(`[PluginLoader] Cleaned up old upload file: ${entry}`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[PluginLoader] Error during temp file cleanup:', e.message);
        }
    }

    _checkPermission(pluginId, permission) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return false;
        const permissions = plugin.manifest.permissions || [];
        if (permissions.includes('*')) return true;
        const basePermission = permission.split('.')[0];
        return permissions.includes(permission) || permissions.includes(basePermission);
    }

    _requirePermission(pluginId, permission) {
        if (!this._checkPermission(pluginId, permission)) {
            throw new Error(`Plugin "${pluginId}" requires permission "${permission}" but it was not declared in manifest.permissions`);
        }
    }

    _clearPluginRequireCache(pluginDir) {
        const normalizedDir = path.resolve(pluginDir);
        const keysToDelete = [];
        for (const key of Object.keys(require.cache)) {
            if (path.resolve(key).startsWith(normalizedDir)) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            delete require.cache[key];
        }
        if (keysToDelete.length > 0) {
            console.log(`[PluginLoader] Cleared ${keysToDelete.length} require.cache entries for ${path.basename(pluginDir)}`);
        }
    }

    _loadPluginStorage(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return {};
        const storageFile = path.join(plugin.manifest._dir, 'data', 'storage.json');
        try {
            if (fs.existsSync(storageFile)) {
                return fs.readJsonSync(storageFile);
            }
        } catch (e) {
            console.warn(`[PluginLoader] Failed to load storage for ${pluginId}:`, e.message);
        }
        return {};
    }

    _savePluginStorage(pluginId, data) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return;
        const dataDir = path.join(plugin.manifest._dir, 'data');
        const storageFile = path.join(dataDir, 'storage.json');
        try {
            fs.ensureDirSync(dataDir);
            fs.writeJsonSync(storageFile, data, { spaces: 2 });
        } catch (e) {
            console.error(`[PluginLoader] Failed to save storage for ${pluginId}:`, e.message);
        }
    }

    _loadPluginSettingsValues(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return {};
        const settingsFile = path.join(plugin.manifest._dir, 'data', 'settings.json');
        try {
            if (fs.existsSync(settingsFile)) {
                return fs.readJsonSync(settingsFile);
            }
        } catch (e) {
            console.warn(`[PluginLoader] Failed to load settings for ${pluginId}:`, e.message);
        }
        return {};
    }

    _savePluginSettingsValues(pluginId, values) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return;
        const dataDir = path.join(plugin.manifest._dir, 'data');
        const settingsFile = path.join(dataDir, 'settings.json');
        try {
            fs.ensureDirSync(dataDir);
            fs.writeJsonSync(settingsFile, values, { spaces: 2 });
        } catch (e) {
            console.error(`[PluginLoader] Failed to save settings for ${pluginId}:`, e.message);
        }
    }

    async discover() {
        this.plugins.clear();
        if (!fs.existsSync(this.pluginsDir)) {
            fs.ensureDirSync(this.pluginsDir);
            return [];
        }

        const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
        const discovered = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const pluginDir = path.join(this.pluginsDir, entry.name);
            const manifestPath = path.join(pluginDir, 'plugin.json');

            if (!fs.existsSync(manifestPath)) continue;

            try {
                const manifest = fs.readJsonSync(manifestPath);
                if (!manifest.id || !manifest.version) {
                    console.warn(`[PluginLoader] Invalid manifest in ${entry.name}: missing id/version`);
                    continue;
                }
                if (!manifest.name) {
                    console.warn(`[PluginLoader] Invalid manifest in ${entry.name}: missing name`);
                    continue;
                }

                manifest._dir = pluginDir;
                manifest._enabled = this.pluginState[manifest.id]?.enabled ?? (manifest.defaultEnabled ?? true);
                manifest._installed = true;

                this.plugins.set(manifest.id, {
                    manifest,
                    instance: null,
                    loaded: false,
                    error: null
                });

                discovered.push(manifest);
            } catch (e) {
                console.warn(`[PluginLoader] Failed to read manifest from ${entry.name}:`, e.message);
            }
        }

        return discovered;
    }

    async loadAll() {
        const sortedIds = this._resolveLoadOrder();
        const results = [];
        for (const id of sortedIds) {
            const plugin = this.plugins.get(id);
            if (!plugin.manifest._enabled) {
                results.push({ id, status: 'disabled', error: null });
                continue;
            }
            try {
                await this.load(id);
                plugin.error = null;
                results.push({ id, status: 'loaded', error: null });
            } catch (e) {
                console.error(`[PluginLoader] Failed to load plugin ${id}:`, e.message);
                plugin.manifest._enabled = false;
                this.pluginState[id] = this.pluginState[id] || {};
                this.pluginState[id].enabled = false;
                this._saveState();
                plugin.error = e.message;
                results.push({ id, status: 'error', error: e.message });
            }
        }
        return results;
    }

    _resolveLoadOrder() {
        const ids = [];
        for (const [id] of this.plugins) {
            ids.push(id);
        }
        const visited = new Set();
        const result = [];
        const visiting = new Set();
        const pathStack = [];

        const visit = (id) => {
            if (visited.has(id)) return;
            if (visiting.has(id)) {
                const cycle = [...pathStack.slice(pathStack.indexOf(id)), id].join(' -> ');
                console.warn(`[PluginLoader] Circular dependency detected: ${cycle}`);
                return;
            }
            if (!this.plugins.has(id)) return;
            visiting.add(id);
            pathStack.push(id);
            const plugin = this.plugins.get(id);
            const deps = plugin.manifest.pluginDependencies || {};
            for (const depId of Object.keys(deps)) {
                visit(depId);
            }
            pathStack.pop();
            visiting.delete(id);
            visited.add(id);
            result.push(id);
        };

        for (const id of ids) {
            visit(id);
        }
        return result;
    }

    async load(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
        if (plugin.loaded) return plugin.instance;

        const manifest = plugin.manifest;

        if (manifest.pluginDependencies) {
            for (const [depId, depVersion] of Object.entries(manifest.pluginDependencies)) {
                const dep = this.plugins.get(depId);
                if (!dep) {
                    throw new Error(`Plugin dependency not found: ${depId}`);
                }
                if (!dep.manifest._enabled || !dep.loaded) {
                    throw new Error(`Plugin dependency not loaded: ${depId}. Enable it first.`);
                }
            }
        }

        const mainFile = path.join(manifest._dir, manifest.main || 'index.js');

        if (!fs.existsSync(mainFile)) {
            throw new Error(`Main file not found: ${mainFile}`);
        }

        try {
            const { createRequire } = require('module');
            const Module = require('module');
            const pluginRequire = createRequire(mainFile);

            const panelNodeModules = path.join(__dirname, 'node_modules');

            if (!this._resolvePatchRefCount) this._resolvePatchRefCount = 0;
            if (this._resolvePatchRefCount === 0) {
                this._origResolveFilename = Module._resolveFilename;
                const origFn = this._origResolveFilename;
                Module._resolveFilename = function(request, parent, isMain, options) {
                    if (!request.startsWith('.') && !path.isAbsolute(request)) {
                        try {
                            return origFn.call(this, request, parent, isMain, options);
                        } catch (e) {
                            return origFn.call(this, request, parent, isMain, { paths: [panelNodeModules] });
                        }
                    }
                    return origFn.call(this, request, parent, isMain, options);
                };
            }
            this._resolvePatchRefCount++;

            try {
                const resolvedPath = pluginRequire.resolve(mainFile);
                delete require.cache[resolvedPath];
            } catch (e) {}

            try {
                const pluginModule = pluginRequire(mainFile);
                const pluginFactory = typeof pluginModule === 'function' ? pluginModule : pluginModule.default;

                if (typeof pluginFactory !== 'function') {
                    throw new Error(`Plugin must export a function (got ${typeof pluginFactory})`);
                }

                const cachedKeys = new Set(Object.keys(require.cache));

                const api = this._createPluginAPI(manifest);
                const instance = await pluginFactory(api);

                const newKeys = Object.keys(require.cache).filter(k => !cachedKeys.has(k));
                this._pluginRequireCache.set(pluginId, newKeys);

                plugin.instance = instance;
                plugin.loaded = true;

                console.log(`[PluginLoader] Successfully loaded plugin: ${getDisplayName(manifest.name)} v${manifest.version}`);
                return instance;
            } finally {
                this._resolvePatchRefCount--;
                if (this._resolvePatchRefCount === 0) {
                    Module._resolveFilename = this._origResolveFilename;
                    this._origResolveFilename = null;
                }
            }
        } catch (e) {
            console.error(`[PluginLoader] Error loading plugin ${pluginId}:`, e);
            plugin.error = e.message;
            throw e;
        }
    }

    async unload(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
        if (!plugin.loaded) return;

        if (plugin.instance && typeof plugin.instance.destroy === 'function') {
            await plugin.instance.destroy();
        }

        this._clearPluginRequireCache(plugin.manifest._dir);
        const trackedKeys = this._pluginRequireCache.get(pluginId) || [];
        for (const key of trackedKeys) {
            delete require.cache[key];
        }
        this._pluginRequireCache.delete(pluginId);

        this._sidebarItems = this._sidebarItems.filter(item => item.pluginId !== pluginId);

        for (const key in this._components) {
            if (this._components[key].pluginId === pluginId) {
                delete this._components[key];
            }
        }

        this._dashboardCards = this._dashboardCards.filter(card => card.pluginId !== pluginId);

        this.pluginRouters.delete(pluginId);
        this.publicPluginRouters.delete(pluginId);

        const tasks = this._tasks.get(pluginId);
        if (tasks) {
            for (const [name, task] of tasks) {
                if (task.status === 'running' || task.status === 'stopping') {
                    if (typeof task.stop === 'function') {
                        try { task.stop(); } catch (e) { /* ignore */ }
                    }
                }
            }
            this._tasks.delete(pluginId);
        }

        const crons = this._crons.get(pluginId);
        if (crons) {
            for (const [name, cron] of crons) {
                if (cron.timer) {
                    clearInterval(cron.timer);
                }
            }
            this._crons.delete(pluginId);
        }

        const eventHandlers = this._pluginEventHandlers.get(pluginId);
        if (eventHandlers) {
            for (const { event, handler } of eventHandlers) {
                this._eventBus.removeListener(event, handler);
            }
            this._pluginEventHandlers.delete(pluginId);
        }

        this._pluginSettings.delete(pluginId);
        this._pluginStatus.delete(pluginId);
        this._pluginStorage.delete(pluginId);

        plugin.instance = null;
        plugin.loaded = false;
        plugin.error = null;

        console.log(`[PluginLoader] Unloaded plugin: ${getDisplayName(plugin.manifest.name)}`);
    }

    notifyLogHandlers(instanceId, msg) {
        if (!this._logHandlers || !this._logHandlers.length) return;
        for (const { handler } of this._logHandlers) {
            try { handler(instanceId, msg); } catch (e) { /* ignore */ }
        }
    }

    async enable(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

        plugin.manifest._enabled = true;
        this.pluginState[pluginId] = this.pluginState[pluginId] || {};
        this.pluginState[pluginId].enabled = true;
        this._saveState();

        try {
            await this.load(pluginId);
            plugin.error = null;
        } catch (e) {
            plugin.manifest._enabled = false;
            this.pluginState[pluginId].enabled = false;
            this._saveState();
            plugin.error = e.message;
            throw e;
        }
    }

    async disable(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

        await this.unload(pluginId);

        plugin.manifest._enabled = false;
        this.pluginState[pluginId] = this.pluginState[pluginId] || {};
        this.pluginState[pluginId].enabled = false;
        this._saveState();
    }

    async analyzePlugin(pluginPath) {
        const stat = fs.statSync(pluginPath);
        let sourceDir;
        let isTemp = false;

        if (stat.isFile()) {
            const AdmZip = require('adm-zip');
            let zip;
            try {
                zip = new AdmZip(pluginPath);
            } catch (e) {
                throw new Error('Plugin file is not a valid ZIP archive');
            }

            sourceDir = path.join(this.pluginsDir, '_tmp_analyze_' + Date.now());
            isTemp = true;
            zip.extractAllTo(sourceDir, true);
        } else {
            sourceDir = pluginPath;
        }

        try {
            let manifestPath = path.join(sourceDir, 'plugin.json');
            let finalDir = sourceDir;

            if (!fs.existsSync(manifestPath)) {
                const entries = fs.readdirSync(sourceDir);
                if (entries.length === 1 && fs.statSync(path.join(sourceDir, entries[0])).isDirectory()) {
                    const nestedDir = path.join(sourceDir, entries[0]);
                    if (fs.existsSync(path.join(nestedDir, 'plugin.json'))) {
                        manifestPath = path.join(nestedDir, 'plugin.json');
                        finalDir = nestedDir;
                    }
                }
            }

            if (!fs.existsSync(manifestPath)) {
                if (isTemp) fs.removeSync(sourceDir);
                throw new Error('plugin.json not found in plugin package');
            }

            const manifest = fs.readJsonSync(manifestPath);
            if (!manifest.id) {
                if (isTemp) fs.removeSync(sourceDir);
                throw new Error('Plugin manifest missing "id" field');
            }

            const existing = this.plugins.get(manifest.id);
            return {
                manifest,
                existing: existing ? existing.manifest : null,
                isUpdate: !!existing,
                tempDir: isTemp ? sourceDir : null,
                finalDir: finalDir
            };
        } catch (e) {
            if (isTemp) fs.removeSync(sourceDir);
            throw e;
        }
    }

    async install(pluginPath) {
        const stat = fs.statSync(pluginPath);
        let sourceDir;
        let tmpToCleanup = null;

        if (stat.isFile()) {
            const AdmZip = require('adm-zip');
            let zip;
            try {
                zip = new AdmZip(pluginPath);
            } catch (e) {
                throw new Error('Plugin file is not a valid ZIP archive');
            }

            const tmpDir = path.join(this.pluginsDir, '_tmp_install_' + Date.now());
            tmpToCleanup = tmpDir;
            zip.extractAllTo(tmpDir, true);
            const entries = fs.readdirSync(tmpDir);
            if (entries.length === 1 && fs.statSync(path.join(tmpDir, entries[0])).isDirectory()) {
                sourceDir = path.join(tmpDir, entries[0]);
            } else {
                sourceDir = tmpDir;
            }
        } else if (stat.isDirectory()) {
            sourceDir = pluginPath;
        } else {
            throw new Error('Plugin must be a .zip file or a directory');
        }

        const manifestPath = path.join(sourceDir, 'plugin.json');
        if (!fs.existsSync(manifestPath)) {
            if (tmpToCleanup) fs.removeSync(tmpToCleanup);
            throw new Error('Plugin manifest (plugin.json) not found');
        }

        const manifest = fs.readJsonSync(manifestPath);
        if (!manifest.id) {
            if (tmpToCleanup) fs.removeSync(tmpToCleanup);
            throw new Error('Plugin manifest missing "id" field');
        }

        const targetDir = path.join(this.pluginsDir, manifest.id);
        if (fs.existsSync(targetDir)) {
            if (this.plugins.has(manifest.id)) {
                try {
                    await this.unload(manifest.id);
                } catch (e) {
                    console.warn(`[PluginLoader] Failed to unload existing plugin ${manifest.id} during update:`, e.message);
                }
            }
            fs.removeSync(targetDir);
        }

        fs.copySync(sourceDir, targetDir);

        try {
            await this._installDependencies(targetDir, manifest);
        } catch (e) {
            console.error(`[PluginLoader] Failed to install dependencies for ${manifest.id}:`, e.message);
        }

        if (tmpToCleanup) {
            fs.removeSync(tmpToCleanup);
        }

        await this.discover();

        const plugin = this.plugins.get(manifest.id);
        if (plugin && plugin.manifest._enabled) {
            try {
                await this.load(manifest.id);
            } catch (e) {
                console.error(`[PluginLoader] Failed to auto-load plugin ${manifest.id} after install/update:`, e.message);
            }
        }

        return manifest;
    }

    async uninstall(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

        await this.unload(pluginId);

        const pluginDir = plugin.manifest._dir;
        if (fs.existsSync(pluginDir)) {
            fs.removeSync(pluginDir);
        }

        delete this.pluginState[pluginId];
        this._saveState();

        this.plugins.delete(pluginId);
    }

    async _installDependencies(targetDir, manifest) {
        if (!manifest.dependencies || typeof manifest.dependencies !== 'object' || Object.keys(manifest.dependencies).length === 0) {
            return;
        }

        console.log(`[PluginLoader] Installing dependencies for ${getDisplayName(manifest.name)}...`);

        const pkgPath = path.join(targetDir, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            const pkg = {
                name: manifest.id,
                version: manifest.version,
                private: true,
                dependencies: manifest.dependencies
            };
            fs.writeJsonSync(pkgPath, pkg, { spaces: 2 });
        }

        const util = require('util');
        const execAsync = util.promisify(require('child_process').exec);

        try {
            await execAsync('pnpm --version');
            console.log('[PluginLoader] Using pnpm for installation');
            await execAsync('pnpm install --production', { cwd: targetDir });
            console.log(`[PluginLoader] Dependencies installed via pnpm for ${getDisplayName(manifest.name)}`);
            return;
        } catch (e) {
            // fallback to npm
        }

        const registries = [
            'https://registry.npmmirror.com',
            'https://mirrors.cloud.tencent.com/npm/',
            'https://registry.npmjs.org'
        ];

        let lastError = '';
        for (const registry of registries) {
            try {
                console.log(`[PluginLoader] Trying npm registry: ${registry}`);
                await execAsync(`npm install --no-package-lock --no-save --production --registry=${registry}`, { cwd: targetDir });
                console.log(`[PluginLoader] Successfully installed dependencies for ${getDisplayName(manifest.name)} via ${registry}`);
                return;
            } catch (e) {
                console.warn(`[PluginLoader] Failed to install via ${registry}:`, e.message);
                lastError = e.message;
            }
        }

        throw new Error(`All registries failed. Last error: ${lastError}`);
    }

    _createPluginAPI(manifest) {
        const self = this;
        const pluginId = manifest.id;

        return {
            id: pluginId,
            manifest,
            io: self.io,
            context: self.options,
            version: API_VERSION,

            checkPermission(permission) {
                return self._checkPermission(pluginId, permission);
            },

            registerRoutes(prefix, setupFn) {
                self._requirePermission(pluginId, 'http');
                const router = (typeof setupFn === 'function' && setupFn.length === 0) ? setupFn() : setupFn;
                const normalizedPrefix = prefix.startsWith('/') ? prefix : '/' + prefix;

                if (!self.pluginRouters.has(pluginId)) {
                    self.pluginRouters.set(pluginId, new Map());
                }
                self.pluginRouters.get(pluginId).set(normalizedPrefix, router);
            },

            registerPublicRoutes(prefix, setupFn) {
                self._requirePermission(pluginId, 'http.public');
                const router = (typeof setupFn === 'function' && setupFn.length === 0) ? setupFn() : setupFn;
                const normalizedPrefix = prefix.startsWith('/') ? prefix : '/' + prefix;

                if (!self.publicPluginRouters.has(pluginId)) {
                    self.publicPluginRouters.set(pluginId, new Map());
                }
                self.publicPluginRouters.get(pluginId).set(normalizedPrefix, router);
            },

            registerSocket(namespace, handlers) {
                self._requirePermission(pluginId, 'socket');
                const ns = self.io.of(`/plugin/${pluginId}${namespace}`);
                ns.removeAllListeners('connection');
                for (const [event, handler] of Object.entries(handlers)) {
                    ns.on('connection', (socket) => {
                        socket.on(event, (...args) => handler(socket, ...args));
                    });
                }
                return ns;
            },

            registerSidebarItem(item) {
                const location = item.location || 'instance';
                self._sidebarItems.push({ ...item, pluginId, location });
            },

            registerComponent(name, componentPath) {
                self._components[name] = {
                    pluginId,
                    path: path.join(manifest._dir, componentPath)
                };
            },

            registerDashboardCard(name, componentName) {
                self._dashboardCards.push({
                    name,
                    component: componentName,
                    pluginId
                });
            },

            registerSettings(schema) {
                self._requirePermission(pluginId, 'settings');
                if (!schema || typeof schema !== 'object') {
                    throw new Error('Settings schema must be an object');
                }
                const existingValues = self._loadPluginSettingsValues(pluginId);
                self._pluginSettings.set(pluginId, {
                    schema,
                    values: { ...schema.defaults, ...existingValues },
                    pluginId
                });
                return {
                    get(key) {
                        const settings = self._pluginSettings.get(pluginId);
                        if (!settings) return undefined;
                        return key ? settings.values[key] : settings.values;
                    },
                    set(key, value) {
                        const settings = self._pluginSettings.get(pluginId);
                        if (!settings) return;
                        settings.values[key] = value;
                        self._savePluginSettingsValues(pluginId, settings.values);
                        self._eventBus.emit(`settings:${pluginId}`, { key, value, pluginId });
                    },
                    getAll() {
                        const settings = self._pluginSettings.get(pluginId);
                        if (!settings) return {};
                        return { ...settings.values };
                    },
                    reset(key) {
                        const settings = self._pluginSettings.get(pluginId);
                        if (!settings) return;
                        if (key) {
                            settings.values[key] = schema.defaults?.[key];
                        } else {
                            settings.values = { ...schema.defaults };
                        }
                        self._savePluginSettingsValues(pluginId, settings.values);
                    },
                    getSchema() {
                        return schema;
                    }
                };
            },

            getDataDir() {
                const dir = path.join(manifest._dir, 'data');
                fs.ensureDirSync(dir);
                return dir;
            },

            getGlobalDataDir() {
                return self.options.baseDir ? path.join(self.options.baseDir, 'data') : this.getDataDir();
            },

            getInstancesDir() {
                return self.options.instancesDir;
            },

            getBaseDir() {
                return self.options.baseDir;
            },

            getActiveInstanceId() {
                const instancesFile = path.join(self.options.baseDir, 'data', 'instances.json');
                try {
                    if (fs.existsSync(instancesFile)) {
                        const config = fs.readJsonSync(instancesFile);
                        return config.activeInstanceId || 'default';
                    }
                } catch (e) { }
                return 'default';
            },

            getInstanceDir(instanceId) {
                const instancesFile = path.join(self.options.baseDir, 'data', 'instances.json');
                try {
                    if (fs.existsSync(instancesFile)) {
                        const config = fs.readJsonSync(instancesFile);
                        const inst = config.instances.find(i => i.id === (instanceId || this.getActiveInstanceId()));
                        if (inst) return path.join(self.options.baseDir, inst.dir);
                    }
                } catch (e) { }
                return path.join(self.options.instancesDir, instanceId || 'default');
            },

            getConfig() {
                return self.options.getConfig ? self.options.getConfig() : {};
            },

            storage: (() => {
                let _cache = null;
                let _saveTimer = null;
                const getCache = () => {
                    if (_cache === null) {
                        _cache = self._loadPluginStorage(pluginId);
                    }
                    return _cache;
                };
                const scheduleSave = () => {
                    if (_saveTimer) clearTimeout(_saveTimer);
                    _saveTimer = setTimeout(() => {
                        if (_cache !== null) {
                            self._savePluginStorage(pluginId, _cache);
                        }
                    }, 500);
                    if (_saveTimer.unref) _saveTimer.unref();
                };
                return {
                    get(key, defaultValue) {
                        self._requirePermission(pluginId, 'storage');
                        const data = getCache();
                        if (key === undefined) return { ...data };
                        return data.hasOwnProperty(key) ? data[key] : defaultValue;
                    },
                    set(key, value) {
                        self._requirePermission(pluginId, 'storage');
                        const data = getCache();
                        data[key] = value;
                        scheduleSave();
                    },
                    delete(key) {
                        self._requirePermission(pluginId, 'storage');
                        const data = getCache();
                        delete data[key];
                        scheduleSave();
                    },
                    has(key) {
                        self._requirePermission(pluginId, 'storage');
                        const data = getCache();
                        return data.hasOwnProperty(key);
                    },
                    keys() {
                        self._requirePermission(pluginId, 'storage');
                        const data = getCache();
                        return Object.keys(data);
                    },
                    clear() {
                        self._requirePermission(pluginId, 'storage');
                        _cache = {};
                        scheduleSave();
                    },
                    save() {
                        if (_cache !== null) {
                            self._savePluginStorage(pluginId, _cache);
                        }
                    }
                };
            })(),

            emit(event, data) {
                self._requirePermission(pluginId, 'events');
                self._eventBus.emit(`plugin:${pluginId}:${event}`, { data, sourcePluginId: pluginId });
                self._eventBus.emit(`plugin:*:${event}`, { data, sourcePluginId: pluginId });
            },

            on(event, handler) {
                self._requirePermission(pluginId, 'events');
                const wrappedHandler = (payload) => {
                    if (payload.sourcePluginId !== pluginId) {
                        handler(payload.data, payload.sourcePluginId);
                    }
                };
                self._eventBus.on(`plugin:*:${event}`, wrappedHandler);

                if (!self._pluginEventHandlers.has(pluginId)) {
                    self._pluginEventHandlers.set(pluginId, []);
                }
                self._pluginEventHandlers.get(pluginId).push({
                    event: `plugin:*:${event}`,
                    handler: wrappedHandler,
                    originalEvent: event
                });

                return () => {
                    self._eventBus.removeListener(`plugin:*:${event}`, wrappedHandler);
                    const handlers = self._pluginEventHandlers.get(pluginId);
                    if (handlers) {
                        const idx = handlers.findIndex(h => h.handler === wrappedHandler);
                        if (idx !== -1) handlers.splice(idx, 1);
                    }
                };
            },

            onPlugin(sourcePluginId, event, handler) {
                self._requirePermission(pluginId, 'events');
                const fullEvent = `plugin:${sourcePluginId}:${event}`;
                const wrappedHandler = (payload) => {
                    handler(payload.data, payload.sourcePluginId);
                };
                self._eventBus.on(fullEvent, wrappedHandler);

                if (!self._pluginEventHandlers.has(pluginId)) {
                    self._pluginEventHandlers.set(pluginId, []);
                }
                self._pluginEventHandlers.get(pluginId).push({
                    event: fullEvent,
                    handler: wrappedHandler,
                    originalEvent: `${sourcePluginId}:${event}`
                });

                return () => {
                    self._eventBus.removeListener(fullEvent, wrappedHandler);
                    const handlers = self._pluginEventHandlers.get(pluginId);
                    if (handlers) {
                        const idx = handlers.findIndex(h => h.handler === wrappedHandler);
                        if (idx !== -1) handlers.splice(idx, 1);
                    }
                };
            },

            once(event, handler) {
                self._requirePermission(pluginId, 'events');
                const unsubscribe = this.on(event, (data, sourceId) => {
                    unsubscribe();
                    handler(data, sourceId);
                });
                return unsubscribe;
            },

            reportStatus(status) {
                self._requirePermission(pluginId, 'status');
                self._pluginStatus.set(pluginId, {
                    ...status,
                    pluginId,
                    reportedAt: new Date().toISOString()
                });
            },

            sendCommand(instanceId, command) {
                self._requirePermission(pluginId, 'command');
                const iid = instanceId || self.getActiveInstanceId();
                const state = self.options.instancesState ? (self.options.instancesState.get ? self.options.instancesState.get(iid) : self.options.instancesState[iid]) : null;
                if (!state || !state.process) return false;
                state.process.stdin.write(command + '\n');
                if (self.options.appendLog) self.options.appendLog(iid, `> ${command}\n`);
                return true;
            },

            getOnlinePlayers(instanceId) {
                const iid = instanceId || self.getActiveInstanceId();
                const state = self.options.instancesState ? (self.options.instancesState.get ? self.options.instancesState.get(iid) : self.options.instancesState[iid]) : null;
                return state?.onlinePlayers ? Array.from(state.onlinePlayers) : [];
            },

            onLog(handler) {
                self._requirePermission(pluginId, 'command');
                if (!self._logHandlers) self._logHandlers = [];
                self._logHandlers.push({ pluginId, handler });
                return () => {
                    self._logHandlers = self._logHandlers.filter(h => h.handler !== handler);
                };
            },

            registerTask(name, options) {
                self._requirePermission(pluginId, 'task');
                if (!name || typeof name !== 'string') {
                    throw new Error('Task name must be a non-empty string');
                }
                if (!options || typeof options.run !== 'function') {
                    throw new Error('Task options must include a "run" function');
                }

                if (!self._tasks.has(pluginId)) {
                    self._tasks.set(pluginId, new Map());
                }
                const tasks = self._tasks.get(pluginId);

                if (tasks.has(name)) {
                    console.warn(`[PluginLoader] Task "${name}" already registered for plugin ${pluginId}, overwriting`);
                    const existing = tasks.get(name);
                    if (existing.status === 'running' && typeof existing.stop === 'function') {
                        try { existing.stop(); } catch (e) { /* ignore */ }
                    }
                }

                const taskName = getDisplayName(manifest.name) + '/' + name;
                let abortController = new AbortController();
                let taskStatus = 'idle';
                let startPromise = null;

                const taskHandle = {
                    name,
                    get status() { return taskStatus; },
                    async start(...args) {
                        if (taskStatus === 'running') {
                            console.warn(`[PluginLoader] Task "${taskName}" is already running`);
                            return;
                        }
                        abortController = new AbortController();
                        taskStatus = 'running';
                        tasks.get(name).status = 'running';
                        startPromise = (async () => {
                            try {
                                await options.run(abortController.signal, ...args);
                                taskStatus = 'completed';
                                if (tasks.get(name)) tasks.get(name).status = 'completed';
                            } catch (e) {
                                if (e.name === 'AbortError') {
                                    taskStatus = 'stopped';
                                    if (tasks.get(name)) tasks.get(name).status = 'stopped';
                                } else {
                                    taskStatus = 'error';
                                    if (tasks.get(name)) tasks.get(name).status = 'error';
                                    console.error(`[PluginLoader] Task "${taskName}" error:`, e.message);
                                }
                            } finally {
                                startPromise = null;
                            }
                        })();
                        return startPromise;
                    },
                    stop() {
                        if (taskStatus === 'running') {
                            abortController.abort();
                            taskStatus = 'stopping';
                            if (tasks.get(name)) tasks.get(name).status = 'stopping';
                        }
                    },
                    async restart(...args) {
                        if (taskStatus === 'running' || taskStatus === 'stopping') {
                            this.stop();
                            if (startPromise) {
                                try { await startPromise; } catch (e) { /* ignore */ }
                            }
                            await new Promise(resolve => {
                                const check = () => {
                                    if (taskStatus !== 'running' && taskStatus !== 'stopping') {
                                        resolve();
                                    } else {
                                        setTimeout(check, 50);
                                    }
                                };
                                setTimeout(check, 50);
                            });
                        }
                        return this.start(...args);
                    }
                };

                tasks.set(name, {
                    handle: taskHandle,
                    status: 'idle',
                    get stop() { return taskHandle.stop.bind(taskHandle); },
                    options
                });

                if (options.autoStart !== false) {
                    taskHandle.start();
                }

                return taskHandle;
            },

            registerCron(name, expression, handler, options = {}) {
                self._requirePermission(pluginId, 'task');
                if (!name || typeof name !== 'string') {
                    throw new Error('Cron name must be a non-empty string');
                }
                if (typeof expression !== 'string' && typeof expression !== 'number') {
                    throw new Error('Cron expression must be a string or number');
                }
                if (typeof handler !== 'function') {
                    throw new Error('Cron handler must be a function');
                }

                if (!self._crons.has(pluginId)) {
                    self._crons.set(pluginId, new Map());
                }
                const crons = self._crons.get(pluginId);

                if (crons.has(name)) {
                    console.warn(`[PluginLoader] Cron "${name}" already registered for plugin ${pluginId}, overwriting`);
                    const existing = crons.get(name);
                    if (existing.timer) {
                        clearInterval(existing.timer);
                    }
                }

                const cronName = getDisplayName(manifest.name) + '/' + name;
                const interval = self._parseCronExpression(expression);
                let cronStatus = 'idle';
                let timer = null;
                let lastRun = null;
                let runCount = 0;

                const executeHandler = async () => {
                    try {
                        lastRun = new Date();
                        runCount++;
                        await handler();
                    } catch (e) {
                        console.error(`[PluginLoader] Cron "${cronName}" error:`, e.message);
                    }
                };

                const cronHandle = {
                    name,
                    get status() { return cronStatus; },
                    get lastRun() { return lastRun; },
                    get runCount() { return runCount; },
                    get expression() { return expression; },
                    start() {
                        if (cronStatus === 'running') return;
                        cronStatus = 'running';
                        if (crons.get(name)) crons.get(name).status = 'running';
                        if (options.immediate) {
                            executeHandler();
                        }
                        timer = setInterval(executeHandler, interval);
                        timer.unref();
                    },
                    stop() {
                        if (timer) {
                            clearInterval(timer);
                            timer = null;
                        }
                        cronStatus = 'stopped';
                        if (crons.get(name)) crons.get(name).status = 'stopped';
                    },
                    restart() {
                        this.stop();
                        runCount = 0;
                        lastRun = null;
                        this.start();
                    }
                };

                crons.set(name, {
                    handle: cronHandle,
                    status: 'idle',
                    timer: null,
                    expression,
                    handler
                });

                if (options.autoStart !== false) {
                    cronHandle.start();
                }

                return cronHandle;
            },

            logger: {
                info: (...args) => console.log(`[Plugin:${getDisplayName(manifest.name)}]`, ...args),
                warn: (...args) => console.warn(`[Plugin:${getDisplayName(manifest.name)}]`, ...args),
                error: (...args) => console.error(`[Plugin:${getDisplayName(manifest.name)}]`, ...args),
            }
        };
    }

    getPluginList() {
        const list = [];
        for (const [id, plugin] of this.plugins) {
            const m = plugin.manifest;
            list.push({
                id: m.id,
                name: m.name,
                version: m.version,
                description: m.description || '',
                author: m.author || '',
                official: m.official || false,
                icon: m.icon || 'fa-puzzle-piece',
                color: m.color || 'primary',
                enabled: m._enabled,
                loaded: plugin.loaded,
                error: plugin.error || null,
                installed: true,
                permissions: m.permissions || [],
                homepage: m.homepage || '',
                license: m.license || '',
                pluginDependencies: m.pluginDependencies || {}
            });
        }
        return list;
    }

    getPluginStatus(pluginId) {
        if (pluginId) {
            return this._pluginStatus.get(pluginId) || null;
        }
        const result = {};
        for (const [id, status] of this._pluginStatus) {
            result[id] = status;
        }
        return result;
    }

    getPluginSettings(pluginId) {
        if (pluginId) {
            return this._pluginSettings.get(pluginId) || null;
        }
        const result = {};
        for (const [id, settings] of this._pluginSettings) {
            result[id] = {
                schema: settings.schema,
                values: settings.values,
                pluginId: settings.pluginId
            };
        }
        return result;
    }

    updatePluginSettings(pluginId, values) {
        const settings = this._pluginSettings.get(pluginId);
        if (!settings) return false;
        settings.values = { ...settings.values, ...values };
        this._savePluginSettingsValues(pluginId, settings.values);
        this._eventBus.emit(`settings:${pluginId}`, { values: settings.values, pluginId });
        return true;
    }

    static getLocalizedValue(field, lang) {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (typeof field === 'object') {
            return field[lang] || field['en'] || field['zh'] || Object.values(field)[0] || '';
        }
        return String(field);
    }

    static get API_VERSION() { return API_VERSION; }

    static getKnownPermissions() {
        return KNOWN_PERMISSIONS;
    }

    getSidebarItems() {
        const items = this._sidebarItems || [];
        const components = this._components || {};
        return items.map(item => {
            const result = { ...item };
            if (!result.component) {
                for (const [compName, compInfo] of Object.entries(components)) {
                    if (compInfo.pluginId === item.pluginId) {
                        result.component = compName;
                        break;
                    }
                }
            }
            return result;
        });
    }

    getComponents() {
        return this._components || {};
    }

    getDashboardCards() {
        return this._dashboardCards || [];
    }

    getPluginManifest(pluginId) {
        const plugin = this.plugins.get(pluginId);
        return plugin ? plugin.manifest : null;
    }

    isPluginEnabled(pluginId) {
        const plugin = this.plugins.get(pluginId);
        return plugin ? plugin.manifest._enabled : false;
    }

    getTranslations() {
        const translations = { zh: { plugins: {} }, en: { plugins: {} } };
        for (const plugin of this.plugins.values()) {
            if (!plugin.manifest._enabled) continue;

            const localesDir = path.join(plugin.manifest._dir, 'locales');
            if (fs.existsSync(localesDir)) {
                const files = fs.readdirSync(localesDir);
                files.forEach(file => {
                    if (file.endsWith('.json')) {
                        const lang = path.basename(file, '.json');
                        try {
                            const data = fs.readJsonSync(path.join(localesDir, file));
                            if (!translations[lang]) translations[lang] = { plugins: {} };
                            translations[lang].plugins[plugin.manifest.id] = data;
                        } catch (e) {
                            console.warn(`[PluginLoader] Failed to read locale ${file} for ${plugin.manifest.id}:`, e.message);
                        }
                    }
                });
            }
        }
        return translations;
    }

    _parseCronExpression(expression) {
        if (typeof expression === 'number') return expression;

        const units = {
            ms: 1,
            s: 1000, sec: 1000, second: 1000, seconds: 1000,
            m: 60000, min: 60000, minute: 60000, minutes: 60000,
            h: 3600000, hr: 3600000, hour: 3600000, hours: 3600000,
            d: 86400000, day: 86400000, days: 86400000,
        };

        const match = expression.trim().match(/^(\d+)\s*(ms|s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)$/i);
        if (match) {
            const value = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();
            return value * (units[unit] || 1);
        }

        const numOnly = parseInt(expression, 10);
        if (!isNaN(numOnly) && numOnly > 0) {
            return numOnly;
        }

        throw new Error(`Invalid cron expression: "${expression}". Supported formats: "5s", "10m", "1h", "1d", or numeric milliseconds`);
    }
}

module.exports = PluginLoader;
