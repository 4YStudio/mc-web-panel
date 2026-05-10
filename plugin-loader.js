const fs = require('fs-extra');
const path = require('path');

const DEFAULT_PLUGINS_DIR = path.join(__dirname, 'plugins');

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
        
        // Clean temp files on startup and then every 1 hour
        setTimeout(() => this.cleanTempFiles(), 1000); 
        setInterval(() => this.cleanTempFiles(), 3600000);
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
                if (!manifest.id || !manifest.name || !manifest.version) {
                    console.warn(`[PluginLoader] Invalid manifest in ${entry.name}: missing id/name/version`);
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
        if (plugin.loaded) throw new Error(`Plugin already loaded: ${pluginId}`);

        const manifest = plugin.manifest;
        const mainFile = path.join(manifest._dir, manifest.main || 'index.js');

        if (!fs.existsSync(mainFile)) {
            throw new Error(`Main file not found: ${mainFile}`);
        }

        const pluginModule = require(mainFile);

        if (typeof pluginModule !== 'function' && typeof pluginModule.default !== 'function') {
            throw new Error(`Plugin must export a function (got ${typeof pluginModule})`);
        }

        const pluginFactory = typeof pluginModule === 'function' ? pluginModule : pluginModule.default;

        const api = this._createPluginAPI(manifest);

        const instance = await pluginFactory(api);
        plugin.instance = instance;
        plugin.loaded = true;

        console.log(`[PluginLoader] Loaded plugin: ${manifest.name} v${manifest.version}`);
        return instance;
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

        plugin.instance = null;
        plugin.loaded = false;

        console.log(`[PluginLoader] Unloaded plugin: ${plugin.manifest.name}`);
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

    _createPluginAPI(manifest) {
        const self = this;
        const pluginId = manifest.id;

        return {
            id: pluginId,
            manifest,
            io: self.io,
            context: self.options,

            registerRoutes(prefix, setupFn) {
                // 如果 setupFn 是一个无参函数，则调用它获取 router；否则直接使用 setupFn 作为 router
                const router = (typeof setupFn === 'function' && setupFn.length === 0) ? setupFn() : setupFn;
                const fullPath = `/api/plugins/${pluginId}${prefix.startsWith('/') ? prefix : '/' + prefix}`;
                self.app.use(fullPath, self.requireAuth, router);
            },

            registerSocket(namespace, handlers) {
                const ns = self.io.of(`/plugin/${pluginId}${namespace}`);
                for (const [event, handler] of Object.entries(handlers)) {
                    ns.on('connection', (socket) => {
                        socket.on(event, (...args) => handler(socket, ...args));
                    });
                }
                return ns;
            },

            registerSidebarItem(item) {
                if (!self._sidebarItems) self._sidebarItems = [];
                // 默认位置为 instance，保持兼容性
                const location = item.location || 'instance';
                self._sidebarItems.push({ ...item, pluginId, location });
            },

            registerComponent(name, componentPath) {
                if (!self._components) self._components = {};
                self._components[name] = {
                    pluginId,
                    path: path.join(manifest._dir, componentPath)
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

            getConfig() {
                return self.options.getConfig ? self.options.getConfig() : {};
            },

            logger: {
                info: (...args) => console.log(`[Plugin:${manifest.name}]`, ...args),
                warn: (...args) => console.warn(`[Plugin:${manifest.name}]`, ...args),
                error: (...args) => console.error(`[Plugin:${manifest.name}]`, ...args),
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

    getPluginManifest(pluginId) {
        const plugin = this.plugins.get(pluginId);
        return plugin ? plugin.manifest : null;
    }

    isPluginEnabled(pluginId) {
        const plugin = this.plugins.get(pluginId);
        return plugin ? plugin.manifest._enabled : false;
    }
}

module.exports = PluginLoader;
