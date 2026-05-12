const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

const DEFAULT_PLUGINS_DIR = path.join(__dirname, 'plugins');

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
        this.pluginRouters = new Map(); // Map<pluginId, Map<prefix, router>>
        this.publicPluginRouters = new Map(); // Map<pluginId, Map<prefix, router>>
        
        // Clean temp files on startup and then every 1 hour
        setTimeout(() => this.cleanTempFiles(), 1000); 
        setInterval(() => this.cleanTempFiles(), 3600000);
    }

    registerMiddleware() {
        // Dynamic routing middleware for plugins (Authenticated)
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
                
                // Correctly handle the URL path for the sub-router
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

        // Dynamic routing middleware for plugins (Public/External)
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

            // 1. Clean pluginsDir/_tmp_*
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

            // 2. Clean tmp_uploads (if options.dataDir is provided)
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
                    loaded: false
                });

                discovered.push(manifest);
            } catch (e) {
                console.warn(`[PluginLoader] Failed to read manifest from ${entry.name}:`, e.message);
            }
        }

        return discovered;
    }

    async loadAll() {
        const results = [];
        for (const [id, plugin] of this.plugins) {
            if (!plugin.manifest._enabled) {
                results.push({ id, status: 'disabled', error: null });
                continue;
            }
            try {
                await this.load(id);
                results.push({ id, status: 'loaded', error: null });
            } catch (e) {
                console.error(`[PluginLoader] Failed to load plugin ${id}:`, e.message);
                results.push({ id, status: 'error', error: e.message });
            }
        }
        return results;
    }

    async load(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
        if (plugin.loaded) return plugin.instance;

        const manifest = plugin.manifest;
        const mainFile = path.join(manifest._dir, manifest.main || 'index.js');

        if (!fs.existsSync(mainFile)) {
            throw new Error(`Main file not found: ${mainFile}`);
        }

        try {
            const { createRequire } = require('module');
            const pluginRequire = createRequire(mainFile);
            
            // Clear cache to ensure fresh load
            try {
                const resolvedPath = require.resolve(mainFile);
                delete require.cache[resolvedPath];
            } catch (e) {}

            const pluginModule = pluginRequire(mainFile);
            const pluginFactory = typeof pluginModule === 'function' ? pluginModule : pluginModule.default;

            if (typeof pluginFactory !== 'function') {
                throw new Error(`Plugin must export a function (got ${typeof pluginFactory})`);
            }

            const api = this._createPluginAPI(manifest);
            const instance = await pluginFactory(api);
            
            plugin.instance = instance;
            plugin.loaded = true;

            console.log(`[PluginLoader] Successfully loaded plugin: ${getDisplayName(manifest.name)} v${manifest.version}`);
            return instance;
        } catch (e) {
            console.error(`[PluginLoader] Error loading plugin ${pluginId}:`, e);
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

        const mainFile = path.join(plugin.manifest._dir, plugin.manifest.main || 'index.js');
        const resolvedPath = require.resolve(mainFile);
        delete require.cache[resolvedPath];

        // Cleanup metadata
        this._sidebarItems = this._sidebarItems.filter(item => item.pluginId !== pluginId);
        
        for (const key in this._components) {
            if (this._components[key].pluginId === pluginId) {
                delete this._components[key];
            }
        }
        
        this._dashboardCards = this._dashboardCards.filter(card => card.pluginId !== pluginId);

        // Cleanup routes
        this.pluginRouters.delete(pluginId);
        this.publicPluginRouters.delete(pluginId);

        plugin.instance = null;
        plugin.loaded = false;

        console.log(`[PluginLoader] Unloaded plugin: ${getDisplayName(plugin.manifest.name)}`);
    }

    async enable(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

        plugin.manifest._enabled = true;
        this.pluginState[pluginId] = this.pluginState[pluginId] || {};
        this.pluginState[pluginId].enabled = true;
        this._saveState();

        await this.load(pluginId);
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
                // Check if it's a nested directory inside the ZIP
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
                finalDir: finalDir // The directory containing plugin.json
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
            // If plugin is currently loaded, unload it first
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
        
        // --- Dependency Installation ---
        try {
            await this._installDependencies(targetDir, manifest);
        } catch (e) {
            console.error(`[PluginLoader] Failed to install dependencies for ${manifest.id}:`, e.message);
        }
        // ------------------------------

        // Cleanup the entire temp root if we created one
        if (tmpToCleanup) {
            fs.removeSync(tmpToCleanup);
        }

        await this.discover();
        
        // Auto-load the plugin if it's enabled
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
        
        // Create a temporary package.json if it doesn't exist
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

        // Try pnpm first
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
            'https://registry.npmmirror.com',       // Aliyun/Taobao (Fastest in China)
            'https://mirrors.cloud.tencent.com/npm/', // Tencent
            'https://registry.npmjs.org'            // Official (Global fallback)
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

            registerRoutes(prefix, setupFn) {
                const router = (typeof setupFn === 'function' && setupFn.length === 0) ? setupFn() : setupFn;
                const normalizedPrefix = prefix.startsWith('/') ? prefix : '/' + prefix;
                
                if (!self.pluginRouters.has(pluginId)) {
                    self.pluginRouters.set(pluginId, new Map());
                }
                self.pluginRouters.get(pluginId).set(normalizedPrefix, router);
            },

            registerPublicRoutes(prefix, setupFn) {
                const router = (typeof setupFn === 'function' && setupFn.length === 0) ? setupFn() : setupFn;
                const normalizedPrefix = prefix.startsWith('/') ? prefix : '/' + prefix;
                
                if (!self.publicPluginRouters.has(pluginId)) {
                    self.publicPluginRouters.set(pluginId, new Map());
                }
                self.publicPluginRouters.get(pluginId).set(normalizedPrefix, router);
            },

            registerSocket(namespace, handlers) {
                const ns = self.io.of(`/plugin/${pluginId}${namespace}`);
                ns.removeAllListeners('connection'); // Prevent accumulation on reload
                for (const [event, handler] of Object.entries(handlers)) {
                    ns.on('connection', (socket) => {
                        socket.on(event, (...args) => handler(socket, ...args));
                    });
                }
                return ns;
            },

            registerSidebarItem(item) {
                // 默认位置为 instance，保持兼容性
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
                installed: true,
                permissions: m.permissions || [],
                homepage: m.homepage || '',
                license: m.license || ''
            });
        }
        return list;
    }

    static getLocalizedValue(field, lang) {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (typeof field === 'object') {
            return field[lang] || field['en'] || field['zh'] || Object.values(field)[0] || '';
        }
        return String(field);
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
}

module.exports = PluginLoader;
