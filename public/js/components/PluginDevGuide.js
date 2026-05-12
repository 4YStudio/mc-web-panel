import { ref, onMounted, onUnmounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { store } from '../store.js';

export default {
    template: `
    <div class="plugin-dev-guide p-0 p-md-3 animate-fade">
    <div class="d-flex shadow-lg border border-secondary rounded-4 w-100" style="background: var(--c-surface) !important; position: relative;">
    <!-- Sidebar: Only takes space on LG screens -->
    <div class="guide-sidebar border-end border-secondary d-none d-lg-block flex-shrink-0" style="flex-basis: 260px; width: 260px; background: rgba(0,0,0,0.05); z-index: 10;">
    <div style="position: sticky; top: 1.5rem; padding: 0 1rem 1rem 1rem;">
    <div class="rounded-4 p-3" style="margin-top: 1.5rem; background: rgba(var(--c-bg-base-rgb), 0.3); border: 1px solid var(--c-border); box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
    <h6 class="text-uppercase small fw-bold text-muted px-2 mb-3 tracking-wider" style="font-size: 0.7rem; letter-spacing: 0.1em;">{{ $t('plugins.guide_toc') }}</h6>
    <nav class="nav flex-column nav-pills gap-1">
    <a v-for="item in toc" :key="item.id"
    class="nav-link guide-nav-link d-flex align-items-center gap-2 px-3 py-2 rounded-3 border-0 transition-all"
    :class="{active: activeSection === item.id}"
    @click.prevent.stop="scrollToSection(item.id)"
    style="cursor: pointer;">
    <i class="fa-solid fa-fw" :class="item.icon" style="font-size: 0.9rem; opacity: 0.8;"></i>
    <span class="small fw-medium">{{ $t('plugins.' + item.id) || item.title }}</span>
    </a>
    </nav>
    </div>
    </div>
    </div>

    <!-- Content area: Forced to occupy full space and allow shrinking for scroll -->
    <div class="guide-content flex-grow-1 p-2 p-md-5 overflow-hidden" id="guide-content-scroll" style="background: var(--c-surface) !important; min-width: 0;">
    <div class="guide-inner-container mx-auto w-100" style="max-width: 900px;">

    <section id="section-intro" class="doc-section mb-5 animate-in">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-primary bg-opacity-10 text-primary rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-solid fa-rocket" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t('plugins.guide_step1_title') }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75">{{ $t('plugins.guide_step1_desc') }}</p>
    </div>
    </div>
    <p v-if="store.lang === 'zh'" class="text-muted mb-4 lh-lg">云语面板采用模块化架构，插件可以深度介入后端逻辑与前端 UI。每个插件都是一个独立的目录，包含元数据清单、后端入口和前端资源。打包时请将目录内容直接压缩为 ZIP 即可。</p>
    <p v-else class="text-muted mb-4 lh-lg">Cloud Language Panel adopts a modular architecture, plugins can deeply intervene in backend logic and frontend UI. Each plugin is an independent directory containing a metadata manifest, backend entry, and frontend resources. Simply compress the directory content into a ZIP when packaging.</p>

    <div class="row g-4 mb-4">
    <div class="col-md-6">
    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border">
    <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
    <span class="fw-bold">{{ store.lang === 'zh' ? '目录结构' : 'Directory Structure' }}</span>
    <span class="text-muted opacity-50">Tree</span>
    </div>
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>my-plugin/
    ├── plugin.json       # 核心清单文件 (必须)
    ├── index.js          # 后端逻辑入口 (可选)
    ├── component/        # 前端组件目录 (可选)
    │   └── Main.js       # 前端 Vue 组件
    └── data/             # 插件私有数据 (自动创建)
    └── ...           # 运行时生成的数据文件</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>my-plugin/
    ├── plugin.json       # Core manifest file (Required)
    ├── index.js          # Backend entry (Optional)
    ├── component/        # Frontend components directory (Optional)
    │   └── Main.js       # Frontend Vue component
    └── data/             # Plugin private data (Auto-created)
    └── ...           # Runtime generated data files</code></pre>
    </template>
    </div>
    </div>
    <div class="col-md-6">
    <div class="code-block-wrapper h-100 shadow-sm rounded-4 overflow-hidden border">
    <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
    <span class="fw-bold">plugin.json</span>
    <span class="text-muted opacity-50">JSON</span>
    </div>
    <pre v-pre class="p-3 small mb-0 dev-code-block h-100" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>{
        "id": "my-plugin",
        "name": {
            "zh": "我的插件",
            "en": "My Plugin"
        },
        "version": "1.0.0",
        "author": "Antigravity",
        "description": {
            "zh": "一个示例插件",
            "en": "An example plugin"
        },
        "icon": "fa-rocket",
        "color": "#4caf50",
        "main": "index.js",
        "defaultEnabled": true,
        "permissions": ["file_system"]
    }</code></pre>
    </div>
    </div>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-manifest" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-secondary bg-opacity-10 text-secondary rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-solid fa-file-code" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t("plugins.manifest") }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75">{{ store.lang === "zh" ? "每个字段的类型、是否必须、默认值与合法取值" : "Field types, requirements, defaults and valid values" }}</p>
    </div>
    </div>
    <p class="text-muted mb-4 lh-lg">{{ store.lang === "zh" ? "plugin.json 是插件的元数据清单文件，位于插件根目录下，是唯一必须存在的文件。系统通过此文件识别、加载和展示插件。" : "plugin.json is the metadata manifest file for the plugin, located in the root directory. It is the only required file." }}</p>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small text-uppercase text-secondary tracking-wider" style="font-size: 0.75rem;">{{ store.lang === "zh" ? "字段详细说明" : "Field Details" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead>
    <tr class="text-white opacity-75 border-bottom">
    <th>{{ store.lang === "zh" ? "字段" : "Field" }}</th>
    <th>{{ store.lang === "zh" ? "类型" : "Type" }}</th>
    <th>{{ store.lang === "zh" ? "必须" : "Required" }}</th>
    <th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th>
    <th>{{ store.lang === "zh" ? "说明" : "Description" }}</th>
    </tr>
    </thead>
    <tbody>
    <tr><td class="text-info font-monospace py-2">id</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "插件唯一标识符。只能包含小写字母、数字、连字符和下划线。" : "Unique plugin identifier. Can only contain lowercase letters, numbers, hyphens and underscores." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">name</td><td>string | object</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? '插件显示名称。支持两种格式：<br><strong>字符串</strong>：<code>&quot;My Plugin&quot;</code>（不区分语言）；<br><strong>对象</strong>：<code>{ &quot;zh&quot;: &quot;我的插件&quot;, &quot;en&quot;: &quot;My Plugin&quot; }</code>（多语言，推荐）。对象格式键名为语言代码，面板根据当前语言自动选择，回退顺序：当前语言 → en → zh → 第一个值。' : 'Plugin display name. Two formats:<br><strong>String</strong>: <code>&quot;My Plugin&quot;</code> (language-agnostic);<br><strong>Object</strong>: <code>{ &quot;zh&quot;: &quot;我的插件&quot;, &quot;en&quot;: &quot;My Plugin&quot; }</code> (multilingual, recommended). Fallback: current lang → en → zh → first value.' }}</td></tr>
    <tr><td class="text-info font-monospace py-2">version</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "版本号，如 1.0.0。" : "Version number, e.g., 1.0.0." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">description</td><td>string | object</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>—</td><td>{{ store.lang === "zh" ? '功能描述。与 name 格式相同，支持字符串或多语言对象。示例：<code>{ &quot;zh&quot;: &quot;一个示例插件&quot;, &quot;en&quot;: &quot;An example plugin&quot; }</code>' : 'Function description. Same format as name, supports string or multilingual object. Example: <code>{ &quot;zh&quot;: &quot;一个示例插件&quot;, &quot;en&quot;: &quot;An example plugin&quot; }</code>' }}</td></tr>
    <tr><td class="text-info font-monospace py-2">author</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>—</td><td>{{ store.lang === "zh" ? "作者信息。" : "Author info." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">icon</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>"fa-puzzle-piece"</td><td>{{ store.lang === "zh" ? "图标类名。" : "Icon class name." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">color</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>"primary"</td><td>{{ store.lang === "zh" ? "主题色。" : "Theme color." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">main</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>"index.js"</td><td>{{ store.lang === "zh" ? "后端入口。" : "Backend entry." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">defaultEnabled</td><td>boolean</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>true</td><td>{{ store.lang === "zh" ? "默认启用。" : "Enabled by default." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">official</td><td>boolean</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>false</td><td>{{ store.lang === "zh" ? "官方标记。" : "Official tag." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">permissions</td><td>string[]</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>[]</td><td>{{ store.lang === "zh" ? "权限列表。" : "Permissions list." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">homepage</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>""</td><td>{{ store.lang === "zh" ? "主页 URL。" : "Homepage URL." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">license</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>""</td><td>{{ store.lang === "zh" ? "许可证标识。" : "License identifier." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-dependencies" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-warning bg-opacity-10 text-warning rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-brands fa-npm" style="font-size: 1.8rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t('plugins.dependencies') }}</h3>
    <p v-if="store.lang === 'zh'" class="text-muted small m-0 mt-1 opacity-75">自动化依赖安装与模块作用域隔离</p>
    <p v-else class="text-muted small m-0 mt-1 opacity-75">Automated dependency installation and module scope isolation</p>
    </div>
    </div>
    <p v-if="store.lang === 'zh'" class="text-muted mb-4 lh-lg">插件系统深度集成了 NPM 依赖管理。您只需在 <code>plugin.json</code> 中声明 <code>dependencies</code>，面板会在安装或更新插件时自动处理安装逻辑。</p>
    <p v-else class="text-muted mb-4 lh-lg">The plugin system deeply integrates NPM dependency management. You only need to declare <code>dependencies</code> in <code>plugin.json</code>, and the panel will automatically handle the installation logic when installing or updating the plugin.</p>

    <div class="row g-4">
    <div class="col-md-6">
    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold text-warning mb-3"><i class="fa-solid fa-cloud-arrow-down me-2"></i>{{ store.lang === "zh" ? "智能安装流程" : "Smart Install Process" }}</h6>
    <ul v-if="store.lang === 'zh'" class="small text-muted mb-0 ps-3 lh-lg">
    <li>支持 <code>pnpm</code> 和 <code>npm</code> 自动回退</li>
    <li>内置国内镜像源轮询，确保安装成功率</li>
    <li>依赖物理隔离，各插件互不干扰</li>
    </ul>
    <ul v-else class="small text-muted mb-0 ps-3 lh-lg">
    <li>Supports <code>pnpm</code> and <code>npm</code> auto-fallback</li>
    <li>Built-in mirror source polling for high success rate</li>
    <li>Physical dependency isolation between plugins</li>
    </ul>
    </div>
    </div>
    </div>
    <div class="col-md-6">
    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold text-info mb-3"><i class="fa-solid fa-shield-halved me-2"></i>Module Isolation</h6>
    <p v-if="store.lang === 'zh'" class="small text-muted lh-lg mb-0">面板为每个插件实现了 Scoped Require。每个插件的 <code>require()</code> 调用都以其自身目录为锚点进行寻址，无需担心版本冲突。</p>
    <p v-else class="small text-muted lh-lg mb-0">The panel implements Scoped Require for each plugin. Each plugin's <code>require()</code> calls are anchored to its own directory, avoiding version conflicts.</p>
    </div>
    </div>
    </div>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-backend" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-info bg-opacity-10 text-info rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-solid fa-server" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t('plugins.backend') }}</h3>
    <p v-if="store.lang === 'zh'" class="text-muted small m-0 mt-1 opacity-75">利用 Node.js 扩展面板核心功能</p>
    <p v-else class="text-muted small m-0 mt-1 opacity-75">Extend panel core functions using Node.js</p>
    </div>
    </div>
    <p v-if="store.lang === 'zh'" class="text-muted mb-4 lh-lg">插件后端脚本需导出一个异步函数，系统会自动注入 <code>api</code> 对象。该对象封装了所有可操作的接口。后端运行在 Node.js 环境中，除了可以使用面板核心提供的全局包（如 <code>express</code>, <code>fs-extra</code>）外，更推荐通过 <code>plugin.json</code> 的 <code>dependencies</code> 声明并使用插件私有的第三方包。每个插件都拥有独立的模块加载上下文，互不干扰。</p>
    <p v-else class="text-muted mb-4 lh-lg">Plugin backend scripts must export an async function, and the system automatically injects the <code>api</code> object. This object encapsulates all operable interfaces. Running in a Node.js environment, besides core packages like <code>express</code> and <code>fs-extra</code>, it's recommended to declare and use private packages via <code>plugin.json</code>'s <code>dependencies</code>. Each plugin has an independent module loading context.</p>

    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
    <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
    <span class="fw-bold">{{ store.lang === "zh" ? "入口函数签名" : "Entry Function Signature" }}</span>
    <span class="text-muted opacity-50">Javascript</span>
    </div>
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>// index.js — 插件后端入口
    module.exports = async function(api) {
        // api 对象包含所有属性和方法

        // 可选：返回一个包含 destroy 方法的对象
        // 当插件被禁用或卸载时，destroy() 会被自动调用
        return {
            destroy: async () => {
                // 清理资源：关闭进程、断开连接、清除定时器等
            }
        };
    };</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>// index.js — Plugin Backend Entry
    module.exports = async function(api) {
        // api object contains all properties and methods

        // Optional: Return an object containing a destroy method
        // destroy() is called automatically when the plugin is disabled or uninstalled
        return {
            destroy: async () => {
                // Clean up resources: close processes, disconnect, clear timers, etc.
            }
        };
    };</code></pre>
    </template>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info me-2 text-info"></i>{{ store.lang === "zh" ? "api 对象只读属性" : "api Object Read-only Properties" }}</h5>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead>
    <tr class="text-white opacity-75 border-bottom">
    <th>{{ store.lang === "zh" ? "属性" : "Property" }}</th>
    <th>{{ store.lang === "zh" ? "类型" : "Type" }}</th>
    <th>{{ store.lang === "zh" ? "说明" : "Description" }}</th>
    </tr>
    </thead>
    <tbody>
    <tr><td class="text-info font-monospace py-2">api.id</td><td>string</td><td>{{ store.lang === "zh" ? "插件 ID，与 plugin.json 中的 id 一致。例如：'my-plugin'" : "Plugin ID, matches id in plugin.json. Example: 'my-plugin'" }}</td></tr>
    <tr><td class="text-info font-monospace py-2">api.manifest</td><td>object</td><td>{{ store.lang === "zh" ? "完整的 plugin.json 清单对象。包含所有清单字段以及系统追加的内部字段：_dir (string) 插件绝对路径；_enabled (boolean) 是否启用；_installed (boolean) 是否已安装。" : "Complete plugin.json manifest. Includes internal fields: _dir (absolute path), _enabled (boolean), _installed (boolean)." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">api.io</td><td>SocketIO.Server</td><td>{{ store.lang === "zh" ? "面板 Socket.IO 服务端实例。可用于全局广播。命名空间：/plugin/[插件ID]/[自定义路径]。" : "Panel Socket.IO server instance. Can be used for global broadcasting. Namespace: /plugin/[PluginID]/[CustomPath]." }}</td></tr>
    <tr><td class="text-info font-monospace py-2">api.context</td><td>object</td><td>{{ store.lang === "zh" ? "面板注入的上下文对象，包含运行时环境信息（详见下方 context 章节）。" : "Context object injected by the panel, containing runtime environment info (see context section below)." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-box-open me-2 text-info"></i>{{ store.lang === "zh" ? "api.context 上下文对象" : "api.context Context Object" }}</h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "通过 <code>api.context</code> 访问，也可以直接解构：<code>const { instancesDir, baseDir } = api.context;</code>。以下为所有可用字段：" : "Access via <code>api.context</code>, or destructure directly: <code>const { instancesDir, baseDir } = api.context;</code>. Available fields:" }}</p>
    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead>
    <tr class="text-white opacity-75 border-bottom">
    <th>{{ store.lang === "zh" ? "字段" : "Field" }}</th>
    <th>{{ store.lang === "zh" ? "类型" : "Type" }}</th>
    <th>{{ store.lang === "zh" ? "说明" : "Description" }}</th>
    </tr>
    </thead>
    <tbody>
    <tr><td class="font-monospace py-2">instancesDir</td><td>string</td><td>{{ store.lang === "zh" ? "所有 MC 实例的根目录绝对路径。例如：'/opt/mc-panel/instances'。每个实例的目录名为实例 ID。" : "Absolute path to instances root directory. Each sub-directory name is the instance ID." }}</td></tr>
    <tr><td class="font-monospace py-2">baseDir</td><td>string</td><td>{{ store.lang === "zh" ? "面板基础目录绝对路径。例如：'/opt/mc-panel'。属于系统根工作区。" : "Absolute path to panel base directory. Example: '/opt/mc-panel'. Root workspace." }}</td></tr>
    <tr><td class="font-monospace py-2">dataDir</td><td>string</td><td>{{ store.lang === "zh" ? "面板全局数据目录绝对路径。例如：'/opt/mc-panel/data'。存放配置文件、Java 安装等。" : "Absolute path to panel global data directory. Stores configs, Java, etc." }}</td></tr>
    <tr><td class="font-monospace py-2">globalBackupDir</td><td>string</td><td>{{ store.lang === "zh" ? "全局备份目录绝对路径。用于存放跨实例的全局备份 ZIP 文件。" : "Absolute path to global backups directory. Stores cross-instance backup ZIP files." }}</td></tr>
    <tr><td class="font-monospace py-2">pluginsDir</td><td>string</td><td>{{ store.lang === "zh" ? "插件安装目录绝对路径。例如：'/opt/mc-panel/plugins'。" : "Absolute path to plugins installation directory. Example: '/opt/mc-panel/plugins'." }}</td></tr>
    <tr><td class="font-monospace py-2">getConfig</td><td>function</td><td>{{ store.lang === "zh" ? "获取面板配置的函数。用法：api.context.getConfig()。详见下方 api.getConfig() 说明。" : "Function to get panel config. Usage: api.context.getConfig(). See api.getConfig() details below." }}</td></tr>
    <tr><td class="font-monospace py-2">instancesState</td><td>Map&lt;string, object&gt;</td><td>{{ store.lang === "zh" ? "所有实例的运行时状态 Map。键为实例 ID，包含：process, logHistory, onlinePlayers, detectedVersion 等。" : "Map of instance states. Key is instance ID. Contains: process, logHistory, onlinePlayers, detectedVersion, etc." }}</td></tr>
    <tr><td class="font-monospace py-2">appendLog</td><td>function</td><td>{{ store.lang === "zh" ? "向实例控制台追加日志的函数。签名：appendLog(instanceId: string, message: string)。" : "Function to append logs to instance console. Signature: appendLog(instanceId: string, message: string)." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-code me-2 text-info"></i>{{ store.lang === "zh" ? "api 方法完整参考" : "Full api Method Reference" }}</h5>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerRoutes(prefix, setupFn)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册 HTTP API 路由。所有路由自动添加认证中间件，最终路径为 /api/plugins/[插件ID][prefix]。" : "Register HTTP API routes. All routes automatically add authentication middleware, final path is /api/plugins/[PluginID][prefix]." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Param" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">prefix</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "路由前缀。建议以 / 开头。如果 prefix 不以 / 开头，系统会自动补全。" : "Route prefix. Recommended to start with /. Auto-completed if missing." }}</td></tr>
    <tr><td class="font-monospace">setupFn</td><td>express.Router | function</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "两种形式：<br>1. <strong>express.Router 实例</strong>（推荐）：直接传入配置好的 Router。<br>2. <strong>无参函数</strong>：传入返回 Router 对象的函数。" : "Two formats:<br>1. <strong>express.Router instance</strong> (Recommended): Pass a configured Router.<br>2. <strong>Function</strong>: Pass a function that returns a Router. Auto-called by system." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 方式一：直接传入 Router（推荐）
    const router = express.Router();
    router.get('/hello', (req, res) => res.json({ msg: 'Hello' }));
    router.post('/data', (req, res) => res.json({ received: req.body }));
    api.registerRoutes('/', router);
    // 前端调用：GET /api/plugins/my-plugin/hello

    // 方式二：传入函数
    api.registerRoutes('/api', () => {
        const router = express.Router();
        router.get('/status', (req, res) => res.json({ ok: true }));
        return router;
    });
    // 前端调用：GET /api/plugins/my-plugin/api/status

    // 文件上传示例 (需要 multer)
    const upload = multer({ dest: path.join(DATA_DIR, 'tmp_uploads') });
    router.post('/upload', upload.single('file'), (req, res) => {
        const file = req.file;
        res.json({ success: true, filename: file.originalname });
    });</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// Option 1: Direct Router (Recommended)
    const router = express.Router();
    router.get('/hello', (req, res) => res.json({ msg: 'Hello' }));
    router.post('/data', (req, res) => res.json({ received: req.body }));
    api.registerRoutes('/', router);
    // Frontend call: GET /api/plugins/my-plugin/hello

    // Option 2: Function
    api.registerRoutes('/api', () => {
        const router = express.Router();
        router.get('/status', (req, res) => res.json({ ok: true }));
        return router;
    });
    // Frontend call: GET /api/plugins/my-plugin/api/status

    // File upload example (requires multer)
    const upload = multer({ dest: path.join(DATA_DIR, 'tmp_uploads') });
    router.post('/upload', upload.single('file'), (req, res) => {
        const file = req.file;
        res.json({ success: true, filename: file.originalname });
    });</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerPublicRoutes(prefix, setupFn)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册公开的 HTTP API 路由。这些路由不会经过身份验证，适合外部集成使用。最终路径为 /api/public/plugins/[插件ID][prefix]。" : "Register public HTTP API routes. These do NOT require authentication, suitable for external integrations. Final path: /api/public/plugins/[PluginID][prefix]." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Param" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">prefix</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "路由前缀。最终路径 = /api/public/plugins/[插件ID] + prefix。" : "Route prefix. Final path = /api/public/plugins/[PluginID] + prefix." }}</td></tr>
    <tr><td class="font-monospace">setupFn</td><td>express.Router | function</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "同 registerRoutes。建议在此路由中自行实现 API Key 等安全验证。" : "Same as registerRoutes. Strongly recommended to implement custom API Key verification." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const router = express.Router();
    router.get('/status', (req, res) => {
        // 外部调用：GET /api/public/plugins/my-plugin/status
        res.json({ online: true, version: '1.0.0' });
    });
    api.registerPublicRoutes('/', router);</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const router = express.Router();
    router.get('/status', (req, res) => {
        // External call: GET /api/public/plugins/my-plugin/status
        res.json({ online: true, version: '1.0.0' });
    });
    api.registerPublicRoutes('/', router);</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerSocket(namespace, handlers)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册 WebSocket 命名空间和事件处理器。返回 Socket.IO Namespace 实例。命名空间路径为 /plugin/[插件ID][namespace]。" : "Register WebSocket namespace and event handlers. Returns Socket.IO Namespace instance. Namespace path is /plugin/[PluginID][namespace]." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Param" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">namespace</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "命名空间路径。建议以 / 开头。示例：'/live' → /plugin/my-plugin/live。" : "Namespace path. Recommended to start with /. Example: '/live'." }}</td></tr>
    <tr><td class="font-monospace">handlers</td><td>object</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "事件处理器映射对象。键为事件名称，值为处理函数。函数签名：(socket, ...args) => void。" : "Event handler mapping object. Key is event name, value is handler function. Signature: (socket, ...args) => void." }}</td></tr>
    </tbody>
    </table>
    </div>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "<strong>返回值</strong>：Socket.IO Namespace 实例。可用于向该命名空间的所有客户端广播：<code>ns.emit('event', data)</code>。" : "<strong>Returns</strong>: Socket.IO Namespace instance. Use <code>ns.emit('event', data)</code> to broadcast." }}</p>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const ns = api.registerSocket('/live', {
        'chat': (socket, message) => {
            api.logger.info('收到聊天:', message);
            ns.emit('chat_response', { echo: message });
        },
        'join_room': (socket, roomId) => {
            socket.join(roomId);
            socket.emit('joined', { roomId });
        }
    });

    // 后端全局广播示例
    ns.emit('notification', { msg: '系统维护通知' });</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const ns = api.registerSocket('/live', {
        'chat': (socket, message) => {
            api.logger.info('Received chat:', message);
            ns.emit('chat_response', { echo: message });
        },
        'join_room': (socket, roomId) => {
            socket.join(roomId);
            socket.emit('joined', { roomId });
        }
    });

    // Backend broadcast example
    ns.emit('notification', { msg: 'System Notification' });</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerSidebarItem(item)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册前端侧边栏导航项。根据 location 的不同，可以显示在实例侧边栏或全局下拉菜单中。" : "Register frontend sidebar navigation item. Appears in instance sidebar or global dropdown based on location." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数字段" : "Field" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">item.id</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "侧边栏项唯一标识符。建议格式：'[插件ID]-[功能名]'。" : "Unique identifier for sidebar item. Suggested format: '[PluginID]-[FeatureName]'." }}</td></tr>
    <tr><td class="font-monospace">item.labelKey</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "显示文本的 i18n 翻译键。系统通过 $t(item.labelKey) 翻译显示。示例：'plugins.my-plugin.title'" : "i18n translation key. Translated via $t(item.labelKey). Examples: 'plugins.my-plugin.title'." }}</td></tr>
    <tr><td class="font-monospace">item.icon</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "FontAwesome 6 Free 实体图标类名（不带 fa-solid 前缀）。" : "FontAwesome 6 Free solid icon class (without fa-solid prefix)." }}</td></tr>
    <tr><td class="font-monospace">item.color</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>—</td><td>{{ store.lang === "zh" ? "图标颜色。支持 CSS 颜色关键字或 HEX 值。" : "Icon color. Supports CSS color keywords or HEX values." }}</td></tr>
    <tr><td class="font-monospace">item.view</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "视图名称。点击时会设置 store.view。必须与 registerComponent 的 name 参数一致！" : "View name. Sets store.view on click. MUST match registerComponent name parameter!" }}</td></tr>
    <tr><td class="font-monospace">item.location</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"instance"</code></td><td>{{ store.lang === "zh" ? "侧边栏项显示位置。合法取值：'instance'（实例内可见）、'global'（全局下拉菜单）、'both'（两者皆显示）。" : "Display location. Valid values: 'instance' (instance sidebar only), 'global' (global dropdown), 'both'." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 实例级侧边栏项（默认，仅在管理特定实例时可见）
    api.registerSidebarItem({
        id: 'backup-manager',
        labelKey: 'plugins.my-plugin.title',
        icon: 'fa-box-archive',
        color: '#f1c40f',
        view: 'plugin-mc-panel-plugin-backup-main',
        location: 'instance'
    });

    // 全局级菜单项（无需选择实例即可访问）
    api.registerSidebarItem({
        id: 'frp-manager',
        labelKey: 'sidebar.frp_manager',
        icon: 'fa-network-wired',
        color: '#6366f1',
        view: 'frp-manager',
        location: 'global'
    });</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// Instance-level sidebar item (default, only visible inside instance)
    api.registerSidebarItem({
        id: 'backup-manager',
        labelKey: 'plugins.my-plugin.title',
        icon: 'fa-box-archive',
        color: '#f1c40f',
        view: 'plugin-mc-panel-plugin-backup-main',
        location: 'instance'
    });

    // Global-level sidebar item (accessible without selecting instance)
    api.registerSidebarItem({
        id: 'frp-manager',
        labelKey: 'sidebar.frp_manager',
        icon: 'fa-network-wired',
        color: '#6366f1',
        view: 'frp-manager',
        location: 'global'
    });</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerComponent(name, componentPath)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册前端 Vue 组件。系统会自动通过动态 import 加载组件文件并注册为全局组件。" : "Register frontend Vue component. System automatically loads it via dynamic import and registers it globally." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Param" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">name</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "组件注册名称。必须与 registerSidebarItem 的 view 值一致，否则点击侧边栏无法渲染组件。" : "Component registration name. MUST match registerSidebarItem view value to render properly." }}</td></tr>
    <tr><td class="font-monospace">componentPath</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "组件文件路径，相对于插件根目录。该文件必须是一个 ES Module，使用 export default 导出 Vue 3 选项对象。" : "Component file path, relative to plugin root. Must be an ES Module exporting Vue 3 options via export default." }}</td></tr>
    </tbody>
    </table>
    </div>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "<strong>组件加载机制</strong>：系统通过 <code>/api/plugins/[插件ID]/component/[组件名]</code> 端点提供组件文件服务，前端使用 <code>import()</code> 动态加载。组件必须使用 <code>export default</code> 导出。" : "<strong>Component Loading Mechanism</strong>: System serves component file via <code>/api/plugins/[PluginID]/component/[ComponentName]</code>, frontend dynamically loads via <code>import()</code>. Component must use <code>export default</code>." }}</p>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>api.registerComponent('plugin-my-plugin-main', 'component/Main.js');
    // 组件文件 component/Main.js 必须使用 export default：
    // export default { template: '...', setup() { ... } }</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>api.registerComponent('plugin-my-plugin-main', 'component/Main.js');
    // Component file component/Main.js must use export default:
    // export default { template: '...', setup() { ... } }</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerDashboardCard(name, componentName)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册仪表盘可视化卡片。卡片将显示在实例列表页面的顶部，适合展示全局系统状态或汇总数据。" : "Register dashboard visualization cards. Cards appear at the top of the instance list page, suitable for global system status or summary data." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Param" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">name</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "卡片唯一标识名。示例：'CPUStatus'、'MemoryUsage'" : "Unique identifier for the card. Example: 'CPUStatus', 'MemoryUsage'." }}</td></tr>
    <tr><td class="font-monospace">componentName</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "关联的 Vue 组件名称。必须已经通过 registerComponent 注册。" : "Associated Vue component name. MUST be registered via registerComponent first." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 1. 首先注册组件
    api.registerComponent('SystemStatusCard', 'component/SystemStatusCard.js');

    // 2. 将组件挂载到仪表盘卡片插槽
    api.registerDashboardCard('GlobalStatus', 'SystemStatusCard');</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 1. Register component first
    api.registerComponent('SystemStatusCard', 'component/SystemStatusCard.js');

    // 2. Mount component to dashboard card slot
    api.registerDashboardCard('GlobalStatus', 'SystemStatusCard');</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.getDataDir()</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取插件私有数据目录绝对路径。如果目录不存在，会自动创建。" : "Get plugin private data directory absolute path. Created automatically if missing." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "项目" : "Item" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
    <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>{{ store.lang === "zh" ? "string — 插件私有数据目录绝对路径。格式：[插件目录]/data。" : "string — Absolute path to plugin private data dir. Format: [PluginDir]/data." }}</td></tr>
    <tr><td>{{ store.lang === "zh" ? "副作用" : "Side Effects" }}</td><td>{{ store.lang === "zh" ? "如果目录不存在，会自动调用 fs.ensureDirSync() 创建" : "Created automatically via fs.ensureDirSync() if missing" }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const dataDir = api.getDataDir();
    const configPath = path.join(dataDir, 'config.json');
    await fs.writeJson(configPath, { setting: 'value' }, { spaces: 2 });</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const dataDir = api.getDataDir();
    const configPath = path.join(dataDir, 'config.json');
    await fs.writeJson(configPath, { setting: 'value' }, { spaces: 2 });</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.getGlobalDataDir()</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取面板全局数据目录路径。适合存放跨插件共享或需要持久化的数据。" : "Get panel global data directory path. Suitable for cross-plugin shared or persistent data." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "项目" : "Item" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
    <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>{{ store.lang === "zh" ? "string — 面板全局数据目录绝对路径。例如：'/opt/mc-panel/data'。" : "string — Absolute path to global data dir. Example: '/opt/mc-panel/data'." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const globalDir = api.getGlobalDataDir();
    const myDataDir = path.join(globalDir, 'my-plugin');
    await fs.ensureDir(myDataDir);</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const globalDir = api.getGlobalDataDir();
    const myDataDir = path.join(globalDir, 'my-plugin');
    await fs.ensureDir(myDataDir);</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.getInstancesDir()</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取 MC 实例根目录路径。等同于 api.context.instancesDir。" : "Get MC instances root directory path. Equivalent to api.context.instancesDir." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "项目" : "Item" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
    <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>{{ store.lang === "zh" ? "string — 实例根目录绝对路径。例如：'/opt/mc-panel/instances'。" : "string — Absolute path to instances root dir. Example: '/opt/mc-panel/instances'." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.getBaseDir()</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取面板基础目录路径。等同于 api.context.baseDir。" : "Get panel base directory path. Equivalent to api.context.baseDir." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "项目" : "Item" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
    <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>{{ store.lang === "zh" ? "string — 面板基础目录绝对路径。例如：'/opt/mc-panel'。" : "string — Absolute path to base directory. Example: '/opt/mc-panel'." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.getActiveInstanceId()</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取当前活跃的实例 ID。从 instances.json 中读取 activeInstanceId 字段，若未配置则返回 'default'。适用于插件需要知道当前用户正在管理哪个实例的场景。" : "Get the currently active instance ID. Reads activeInstanceId from instances.json, returns 'default' if not configured. Useful when a plugin needs to know which instance the user is managing." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "项目" : "Item" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
    <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>{{ store.lang === "zh" ? "string — 当前活跃实例 ID。例如：'my-server'、'default'。" : "string — Current active instance ID. Example: 'my-server', 'default'." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.getInstanceDir(instanceId?)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取指定实例的目录绝对路径。若不传 instanceId，则使用当前活跃实例。从 instances.json 中查找实例配置并拼接完整路径，确保多实例环境下路径正确。" : "Get the absolute directory path for a specified instance. If instanceId is omitted, uses the active instance. Looks up instance config in instances.json and builds the full path, ensuring correct paths in multi-instance environments." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "项目" : "Item" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td>instanceId</td><td>string?</td><td>{{ store.lang === "zh" ? "可选。实例 ID，默认使用当前活跃实例。" : "Optional. Instance ID, defaults to active instance." }}</td></tr>
    <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>string | null</td><td>{{ store.lang === "zh" ? "实例目录绝对路径。例如：'/opt/mc-panel/instances/my-server'。若实例不存在则返回 null。" : "Absolute instance directory path. Example: '/opt/mc-panel/instances/my-server'. Returns null if instance not found." }}</td></tr>
    </tbody>
    </table>
    </div>
    <h6 class="fw-bold mb-2 small text-muted">{{ store.lang === "zh" ? "使用示例" : "Usage Example" }}</h6>
    <pre class="bg-dark bg-opacity-10 rounded-3 p-3 small mb-0"><code>// 在插件路由中使用
const withInstance = (req, res, next) => {
    const instanceId = req.query.instanceId || api.getActiveInstanceId();
    const instDir = api.getInstanceDir(instanceId);
    if (!instDir) return res.status(404).json({ error: 'Instance not found' });
    req.instDir = instDir;
    next();
};

// 获取当前实例的数据库路径
const dbPath = path.join(api.getInstanceDir(), 'easyauth.db');</code></pre>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.getConfig()</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取面板完整配置对象。包含当前所有运行参数。" : "Get full panel configuration object including current runtime parameters." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "项目" : "Item" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
    <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>{{ store.lang === "zh" ? "object — 面板配置对象（详见下方字段说明）" : "object — Panel config object (see field details below)" }}</td></tr>
    </tbody>
    </table>
    </div>
    <h6 class="fw-bold mb-2 small text-muted">{{ store.lang === "zh" ? "返回对象字段" : "Return Object Fields" }}</h6>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "字段" : "Field" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace py-2">isSetup</td><td>boolean</td><td>{{ store.lang === "zh" ? "面板是否已完成初始设置（2FA 配置）。" : "Whether panel setup (2FA) is complete." }}</td></tr>
    <tr><td class="font-monospace py-2">sessionSecret</td><td>string</td><td>{{ store.lang === "zh" ? "Session 加密密钥。" : "Session encryption secret." }}</td></tr>
    <tr><td class="font-monospace py-2">sessionTimeout</td><td>number</td><td>{{ store.lang === "zh" ? "会话超时时间（天数）。" : "Session timeout (days)." }}</td></tr>
    <tr><td class="font-monospace py-2">githubProxy</td><td>string</td><td>{{ store.lang === "zh" ? "GitHub 代理地址。为空表示直连。" : "GitHub proxy. Empty means direct connection. Example: 'https://mirror.example.com'" }}</td></tr>
    <tr><td class="font-monospace py-2">modrinthApi</td><td>string</td><td>{{ store.lang === "zh" ? "Modrinth API 基础地址。默认：'https://api.modrinth.com/v2'" : "Modrinth API base URL. Default: 'https://api.modrinth.com/v2'" }}</td></tr>
    <tr><td class="font-monospace py-2">port</td><td>number</td><td>{{ store.lang === "zh" ? "面板监听端口。默认：3000" : "Panel listening port. Default: 3000" }}</td></tr>
    <tr><td class="font-monospace py-2">consoleInfoPosition</td><td>string</td><td>{{ store.lang === "zh" ? "控制台信息面板位置。合法取值：'top'、'sidebar'、'hide'。" : "Console info position. Values: 'top', 'sidebar', 'hide'." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const config = api.getConfig();
    if (config.githubProxy) {
        const proxiedUrl = originalUrl.replace('https://github.com', config.githubProxy);
    }</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const config = api.getConfig();
    if (config.githubProxy) {
        const proxiedUrl = originalUrl.replace('https://github.com', config.githubProxy);
    }</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-info font-monospace small">api.logger</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "插件专用日志记录器。所有输出自动添加 [Plugin:插件名] 前缀，便于在面板日志中区分来源。" : "Plugin-specific logger. Automatically prefixes [Plugin:PluginName] for easy tracing." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "签名" : "Signature" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace py-2">api.logger.info</td><td><code>(...args: any[]) => void</code></td><td>{{ store.lang === "zh" ? "输出信息级别日志。" : "Output info level log. Format: [Plugin:PluginName] Message" }}</td></tr>
    <tr><td class="font-monospace py-2">api.logger.warn</td><td><code>(...args: any[]) => void</code></td><td>{{ store.lang === "zh" ? "输出警告级别日志。" : "Output warning level logs." }}</td></tr>
    <tr><td class="font-monospace py-2">api.logger.error</td><td><code>(...args: any[]) => void</code></td><td>{{ store.lang === "zh" ? "输出错误级别日志。" : "Output error level log." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>api.logger.info('插件初始化成功');
    // 输出: [Plugin:MyPlugin] 插件初始化成功

    api.logger.warn('未找到配置，使用默认值');
    api.logger.error('连接失败:', error.message);</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>api.logger.info('Plugin initialized successfully');
    // Output: [Plugin:MyPlugin] Plugin initialized successfully

    api.logger.warn('Configuration not found, using defaults');
    api.logger.error('Failed to connect:', error.message);</code></pre>
    </template>
    </div>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-code me-2 text-info"></i>{{ store.lang === "zh" ? "后端完整示例" : "Full Backend Example" }}</h5>
    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border">
    <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
    <span class="fw-bold">{{ store.lang === "zh" ? "index.js — 完整后端示例" : "index.js — Full Backend Example" }}</span>
    <span class="text-muted opacity-50">Javascript</span>
    </div>
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>const fs = require('fs-extra');
    const path = require('path');
    const express = require('express');

    module.exports = async function(api) {
        const { registerRoutes, context } = api;
        const { instancesDir, dataDir, getConfig } = context;
        const DATA_DIR = api.getDataDir();
        const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

        const readConfig = () => {
            try { return fs.readJsonSync(CONFIG_FILE); }
            catch (e) { return { items:[] }; }
        };
        const writeConfig = (config) => {
            fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
        };

        const router = express.Router();

        router.get('/items', (req, res) => {
            const config = readConfig();
            res.json(config.items);
        });

        router.post('/items', (req, res) => {
            const { name, value } = req.body;
            if (!name) return res.status(400).json({ error: 'name 必须存在' });
            const config = readConfig();
            config.items.push({ id: Date.now().toString(), name, value: value || '' });
            writeConfig(config);
            res.json({ success: true });
        });

        api.registerRoutes('/', router);

        const ns = api.registerSocket('/live', {
            'message': (socket, data) => ns.emit('broadcast', data)
        });

        api.registerSidebarItem({
            id: 'my-plugin-main',
            labelKey: 'plugins.my_plugin.title',
            icon: 'fa-rocket',
            color: '#6366f1',
            view: 'my-plugin-view',
            location: 'instance'
        });

        api.registerComponent('my-plugin-view', 'component/Main.js');

        api.logger.info('插件已加载完成');

        return {
            destroy: async () => {
                api.logger.info('插件正在卸载，正在清理资源...');
            }
        };
    };</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>const fs = require('fs-extra');
    const path = require('path');
    const express = require('express');

    module.exports = async function(api) {
        const { registerRoutes, context } = api;
        const { instancesDir, dataDir, getConfig } = context;
        const DATA_DIR = api.getDataDir();
        const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

        const readConfig = () => {
            try { return fs.readJsonSync(CONFIG_FILE); }
            catch (e) { return { items:[] }; }
        };
        const writeConfig = (config) => {
            fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
        };

        const router = express.Router();

        router.get('/items', (req, res) => {
            const config = readConfig();
            res.json(config.items);
        });

        router.post('/items', (req, res) => {
            const { name, value } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });
            const config = readConfig();
            config.items.push({ id: Date.now().toString(), name, value: value || '' });
            writeConfig(config);
            res.json({ success: true });
        });

        api.registerRoutes('/', router);

        const ns = api.registerSocket('/live', {
            'message': (socket, data) => ns.emit('broadcast', data)
        });

        api.registerSidebarItem({
            id: 'my-plugin-main',
            labelKey: 'plugins.my_plugin.title',
            icon: 'fa-rocket',
            color: '#6366f1',
            view: 'my-plugin-view',
            location: 'instance'
        });

        api.registerComponent('my-plugin-view', 'component/Main.js');

        api.logger.info('Plugin initialized');

        return {
            destroy: async () => {
                api.logger.info('Plugin is being unloaded, cleaning up...');
            }
        };
    };</code></pre>
    </template>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-frontend" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-success bg-opacity-10 text-success rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-solid fa-display" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t('plugins.frontend') }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75">{{ store.lang === "zh" ? "使用 Vue 3 构建插件界面" : "Build plugin interface using Vue 3" }}</p>
    </div>
    </div>
    <p class="text-muted mb-4 lh-lg">{{ store.lang === "zh" ? "插件前端使用 Vue 3 组件（ES Module 格式），通过 <code>api.registerComponent()</code> 注册后，系统会自动动态加载。组件文件必须使用 <code>export default</code> 导出组件选项对象。" : "Frontend uses Vue 3 components (ES Module). Registered via <code>api.registerComponent()</code>, auto-loaded dynamically. Component must use <code>export default</code>." }}</p>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-puzzle-piece me-2 text-success"></i> {{ store.lang === "zh" ? "可用导入模块" : "Available Imports" }} </h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "以下是插件前端组件中可以使用的所有导入：" : "The following imports are available in frontend components:" }}</p>
    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "导入语句" : "Import Statement" }}</th><th>{{ store.lang === "zh" ? "来源" : "Source" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace py-2">import { ref, reactive, computed, onMounted, onUnmounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js'</td><td>Vue 3</td><td>{{ store.lang === "zh" ? "Vue 3 Composition API。可用导出：<code>ref</code>、<code>reactive</code>、<code>computed</code>、<code>watch</code>、<code>watchEffect</code>、<code>onMounted</code>、<code>onUnmounted</code>、<code>onBeforeUnmount</code>、<code>nextTick</code>、<code>getCurrentInstance</code> 等 Vue 3 Composition API 全部导出。" : "Vue 3 Composition API. Available exports: <code>ref</code>, <code>reactive</code>, <code>computed</code>, <code>watch</code>, etc." }}</td></tr>
    <tr><td class="font-monospace py-2">import { store } from '/js/store.js'</td><td>{{ store.lang === "zh" ? "面板" : "Panel" }}</td><td>{{ store.lang === 'zh' ? '全局响应式状态。Vue 3 reactive 对象，所有属性响应式。详见下方 store 参考表。' : 'Global reactive state. Vue 3 reactive() object. All properties are reactive. See store reference table below.' }}</td></tr>
    <tr><td class="font-monospace py-2">import { api } from '/js/api.js'</td><td>{{ store.lang === "zh" ? "面板" : "Panel" }}</td><td>{{ store.lang === 'zh' ? '基于 axios 的认证 API 请求。自动附加 instanceId。详见下方 API 参考表。' : 'Authenticated API requests based on axios. Automatically attaches instanceId. See API reference table below.' }}</td></tr>
    <tr><td class="font-monospace py-2">import { showToast, openModal, formatLog, waitForPanel, uploadFileWithChunk, isLargeFile } from '/js/utils.js'</td><td>{{ store.lang === "zh" ? "面板" : "Panel" }}</td><td>{{ store.lang === "zh" ? "工具函数集合。详见下方工具函数参考表。" : "Collection of utility functions. See reference table below." }}</td></tr>
    <tr><td class="font-monospace py-2">import { socket } from '/js/socket.js'</td><td>{{ store.lang === "zh" ? "面板" : "Panel" }}</td><td>{{ store.lang === "zh" ? "Socket.IO 客户端实例（默认命名空间）。用于监听面板全局事件。" : "Socket.IO client instance (default namespace). Used to listen for global panel events." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-code me-2 text-success"></i> {{ store.lang === "zh" ? "前端组件模板" : "Frontend Component Template" }} </h5>
    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
    <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
    <span class="fw-bold">{{ store.lang === "zh" ? "component/Main.js — 前端组件完整模板" : "component/Main.js — Full Frontend Component Template" }}</span>
    <span class="text-muted opacity-50">Javascript</span>
    </div>
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>import { ref, onMounted, onUnmounted, getCurrentInstance } from '/js/vue.esm-browser.js';
    import { api } from '/js/api.js';
    import { store } from '/js/store.js';
    import { showToast, openModal } from '/js/utils.js';

    export default {
        template: \`
        &lt;div class="animate-in"&gt;
        &lt;div class="page-header d-flex justify-content-between align-items-center mb-4"&gt;
        &lt;div class="d-flex align-items-center"&gt;
        &lt;button @click="store.view = store.prevView || 'instance-manager'" class="btn-back me-3"&gt;
        &lt;i class="fa-solid fa-chevron-left"&gt;&lt;/i&gt;
        &lt;/button&gt;
        &lt;div&gt;
        &lt;h3 class="m-0 fw-bold d-flex align-items-center"&gt;
        &lt;i class="fa-solid fa-rocket me-3 text-primary"&gt;&lt;/i&gt;
        &lt;span&gt;{{ $t('plugins.my_plugin.title') }}&lt;/span&gt;
        &lt;/h3&gt;
        &lt;/div&gt;
        &lt;/div&gt;
        &lt;button class="btn btn-primary rounded-pill px-4" @click="loadData"&gt;
        &lt;i class="fa-solid fa-refresh me-1"&gt;&lt;/i&gt;刷新
        &lt;/button&gt;
        &lt;/div&gt;
        &lt;div v-if="loading" class="text-center py-5"&gt;
        &lt;div class="spinner-border text-primary"&gt;&lt;/div&gt;
        &lt;/div&gt;
        &lt;div v-else&gt;
        &lt;!-- 这里放置你的页面内容 --&gt;
        &lt;/div&gt;
        &lt;/div&gt;
        \`,
        setup() {
            const { proxy } = getCurrentInstance();
            const $t = proxy.$t;
            const pluginApiBase = '/api/plugins/my-plugin';
            const loading = ref(false);
            const items = ref([]);

            const loadData = async () => {
                try {
                    loading.value = true;
                    const res = await api.get(\`\${pluginApiBase}/items\`);
                    items.value = res.data;
                } catch (e) {
                    showToast(e.response?.data?.error || e.message, 'danger');
                } finally {
                    loading.value = false;
                }
            };

            onMounted(() => { loadData(); });
            return { store, loading, items, loadData };
        }
    };</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>import { ref, onMounted, onUnmounted, getCurrentInstance } from '/js/vue.esm-browser.js';
    import { api } from '/js/api.js';
    import { store } from '/js/store.js';
    import { showToast, openModal } from '/js/utils.js';

    export default {
        template: \`
        &lt;div class="animate-in"&gt;
        &lt;div class="page-header d-flex justify-content-between align-items-center mb-4"&gt;
        &lt;div class="d-flex align-items-center"&gt;
        &lt;button @click="store.view = store.prevView || 'instance-manager'" class="btn-back me-3"&gt;
        &lt;i class="fa-solid fa-chevron-left"&gt;&lt;/i&gt;
        &lt;/button&gt;
        &lt;div&gt;
        &lt;h3 class="m-0 fw-bold d-flex align-items-center"&gt;
        &lt;i class="fa-solid fa-rocket me-3 text-primary"&gt;&lt;/i&gt;
        &lt;span&gt;{{ $t('plugins.my_plugin.title') }}&lt;/span&gt;
        &lt;/h3&gt;
        &lt;/div&gt;
        &lt;/div&gt;
        &lt;button class="btn btn-primary rounded-pill px-4" @click="loadData"&gt;
        &lt;i class="fa-solid fa-refresh me-1"&gt;&lt;/i&gt;Refresh
        &lt;/button&gt;
        &lt;/div&gt;
        &lt;div v-if="loading" class="text-center py-5"&gt;
        &lt;div class="spinner-border text-primary"&gt;&lt;/div&gt;
        &lt;/div&gt;
        &lt;div v-else&gt;
        &lt;!-- Your Content --&gt;
        &lt;/div&gt;
        &lt;/div&gt;
        \`,
        setup() {
            const { proxy } = getCurrentInstance();
            const $t = proxy.$t;
            const pluginApiBase = '/api/plugins/my-plugin';
            const loading = ref(false);
            const items = ref([]);

            const loadData = async () => {
                try {
                    loading.value = true;
                    const res = await api.get(\`\${pluginApiBase}/items\`);
                    items.value = res.data;
                } catch (e) {
                    showToast(e.response?.data?.error || e.message, 'danger');
                } finally {
                    loading.value = false;
                }
            };

            onMounted(() => { loadData(); });
            return { store, loading, items, loadData };
        }
    };</code></pre>
    </template>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-database me-2 text-success"></i> {{ store.lang === "zh" ? "store 全局状态完整参考" : "Full store Global State Reference" }} </h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "通过 <code>import { store } from '/js/store.js'</code> 导入。Vue 3 reactive 对象，所有属性响应式。可直接读取和修改。" : "Imported via <code>import { store } from '/js/store.js'</code>. Vue 3 reactive object, all properties are reactive. Can be directly read and modified." }}</p>
    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead>
    <tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "属性" : "Property" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr>
    </thead>
    <tbody>
    <tr><td class="text-success font-monospace py-2">store.auth</td><td>object</td><td>{{ store.lang === "zh" ? "认证状态对象，包含以下字段：<br><code>loggedIn</code> (boolean) 是否已登录；<code>isSetup</code> (boolean) 是否完成 2FA 设置；<code>qrCode</code> (string) 二维码 Data URL（仅设置阶段有值）；<code>secret</code> (string) 2FA 密钥（仅设置阶段有值）；<code>token</code> (string) 验证码。" : "Auth state object. Fields: <br><code>loggedIn</code> (boolean); <code>isSetup</code> (boolean) 2FA setup; <code>qrCode</code> (string) QR Data URL; <code>secret</code> (string) 2FA secret; <code>token</code> (string)." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.isSetup</td><td>boolean</td><td>{{ store.lang === "zh" ? "面板是否已完成初始设置。" : "Whether the panel setup is complete." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.lang</td><td>string</td><td>{{ store.lang === "zh" ? "当前界面语言。合法取值：<code>'zh'</code>（中文，默认）、<code>'en'</code>（英文）。" : "Current UI language. Values: <code>'zh'</code> (Chinese), <code>'en'</code> (English)." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.onlinePlayers</td><td>string[]</td><td>{{ store.lang === "zh" ? "当前实例在线玩家名称列表。示例：<code>['Steve', 'Alex']</code>" : "List of online player names for the current instance. Example: <code>['Steve', 'Alex']</code>" }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.stats</td><td>object</td><td>{{ store.lang === "zh" ? "系统与服务器状态对象，包含以下字段：<br><code>cpu</code> (string) CPU 使用率百分比，如 <code>'45.2'</code>；<code>mem</code> (object) 内存信息：<code>{ total: '15.9' (GB), used: '8.3' (GB), percentage: '52.3' (%) }</code>；<code>mc</code> (object) MC 服务器信息：<code>{ online: 5 (当前在线人数), maxPlayers: 20 (最大玩家数), port: '25565' (端口号), motd: 'A Minecraft Server' (MOTD) }</code>" : "System and server status object. Fields: <br><code>cpu</code> (string) CPU usage %, e.g., <code>'45.2'</code>; <code>mem</code> (object) memory info: <code>{ total: '15.9' (GB), used: '8.3' (GB), percentage: '52.3' (%) }</code>; <code>mc</code> (object) MC server info: <code>{ online: 5, maxPlayers: 20, port: '25565', motd: 'A Minecraft Server' }</code>" }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.isRunning</td><td>boolean</td><td>{{ store.lang === "zh" ? "当前实例 MC 服务器是否运行中。" : "Whether current MC server is running." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.hasBackupMod</td><td>boolean</td><td>{{ store.lang === "zh" ? "当前实例是否安装备份模组。" : "Whether current instance has backup mod." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.hasEasyAuth</td><td>boolean</td><td>{{ store.lang === "zh" ? "当前实例是否安装了 EasyAuth 模组。" : "Whether the current instance has EasyAuth mod installed." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.hasVoicechat</td><td>boolean</td><td>{{ store.lang === "zh" ? "当前实例是否安装语音聊天模组。" : "Whether current instance has voicechat mod." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.logs</td><td>string[]</td><td>{{ store.lang === "zh" ? "当前实例控制台日志数组。最多 1000 行纯文本。" : "Current instance console log array. Max 1000 lines. Each as plain text." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.view</td><td>string</td><td>{{ store.lang === "zh" ? "当前视图名称。设置此值可切换页面。内置视图：<code>'instance-manager'</code>（实例列表）、<code>'dashboard'</code>（控制台）、<code>'properties'</code>（server.properties）、<code>'mods'</code>（模组管理）、<code>'modrinth'</code>（Modrinth 浏览）、<code>'files'</code>（文件管理）、<code>'backups'</code>（备份管理）、<code>'easyauth'</code>（EasyAuth）、<code>'voicechat'</code>（语音聊天）、<code>'players'</code>（玩家管理）、<code>'java'</code>（Java 管理）、<code>'about'</code>（关于）、<code>'plugins'</code>（插件管理）、<code>'panel-settings'</code>（面板设置）。插件视图为 registerSidebarItem 的 view 值。" : "Current view name. Set this to switch pages. Built-in views: <code>'instance-manager'</code>, <code>'dashboard'</code>, <code>'properties'</code>, <code>'mods'</code>, <code>'modrinth'</code>, <code>'files'</code>, <code>'backups'</code>, <code>'easyauth'</code>, <code>'voicechat'</code>, <code>'players'</code>, <code>'java'</code>, <code>'about'</code>, <code>'plugins'</code>, <code>'panel-settings'</code>. Plugin views use registerSidebarItem view value." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.prevView</td><td>string</td><td>{{ store.lang === "zh" ? "上一个视图名称。用于返回按钮。示例：<code>store.view = store.prevView</code>" : "Previous view name. Used for back buttons. Example: <code>store.view = store.prevView</code>" }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.consoleInfoPosition</td><td>string</td><td>{{ store.lang === "zh" ? "控制台信息面板位置。合法取值：'top'、'sidebar'、'hide'。" : "Console info panel position. Valid values: 'top' (default), 'sidebar', 'hide'." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.currentInstanceId</td><td>string|null</td><td>{{ store.lang === "zh" ? "当前管理的实例 ID。<code>null</code> 表示在实例列表页。示例：<code>'default'</code>、<code>'survival'</code>" : "ID of current instance. <code>null</code> on list page. Examples: <code>'default'</code>, <code>'survival'</code>" }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.instanceList</td><td>object[]</td><td>{{ store.lang === "zh" ? "所有实例列表。每个元素包含：<code>id</code> (string) 实例 ID；<code>name</code> (string) 实例显示名；<code>dir</code> (string) 实例目录绝对路径；<code>hasBackupMod</code> (boolean) 是否有备份模组；<code>backupStrategy</code> (string) 备份策略，合法值：<code>'panel'</code>、<code>'mod'</code>；<code>isRunning</code> (boolean) 是否运行中；<code>onlinePlayers</code> (number) 在线人数；<code>port</code> (string) 端口号。" : "List of all instances. Each contains: <code>id</code>, <code>name</code>, <code>dir</code>, <code>hasBackupMod</code>, <code>backupStrategy</code>, <code>isRunning</code>, etc." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.javaInstallations</td><td>object[]</td><td>{{ store.lang === "zh" ? "已安装 Java 列表。每个元素包含：<code>id</code> (string) Java 安装 ID；<code>featureVersion</code> (number) 主版本号，如 <code>17</code>、<code>21</code>；<code>path</code> (string) 可执行文件绝对路径；<code>source</code> (string) 安装来源，合法值：<code>'local'</code>（手动添加）、<code>'panel'</code>（面板安装）。" : "List of installed Java. Each: <code>id</code>; <code>featureVersion</code> (e.g., 17, 21); <code>path</code> (absolute); <code>source</code> ('local'|'panel')." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.customLogoUrl</td><td>string</td><td>{{ store.lang === "zh" ? "自定义 Logo URL。空字符串表示使用默认。" : "Custom Logo URL. Empty string uses default. Format: '/api/appearance/logo' or full URL." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.customBgUrl</td><td>string</td><td>{{ store.lang === "zh" ? "自定义背景图 URL。空字符串使用默认。格式：<code>'/api/appearance/background'</code> 或完整 URL。" : "Custom background URL. Empty for default. Format: <code>'/api/appearance/background'</code> or full URL." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.task</td><td>object</td><td>{{ store.lang === "zh" ? "全局任务进度对象。用于全屏进度遮罩（ProgressModal 组件）。包含字段：<br><code>visible</code> (boolean) 是否显示进度遮罩；<br><code>title</code> (string) 任务标题，如 '系统更新'、'系统回档中'；<br><code>message</code> (string) 当前步骤描述；<br><code>subMessage</code> (string) 附加信息（如百分比文本）；<br><code>percent</code> (number) 进度百分比 0-100；<br><code>speed</code> (number) 传输速度（字节/秒），0 表示无速度信息；<br><code>canCancel</code> (boolean) 是否可取消；<br><code>onCancel</code> (function|null) 取消回调函数。" : "Global task progress object (ProgressModal component). Fields: <code>visible</code> (boolean); <code>title</code> (string); <code>message</code> (string); <code>subMessage</code> (string); <code>percent</code> (number 0-100); <code>speed</code> (bytes/sec, 0=none); <code>canCancel</code> (boolean); <code>onCancel</code> (function|null)." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.dashboardCards</td><td>object[]</td><td>{{ store.lang === "zh" ? "仪表盘卡片列表。由插件通过 api.registerDashboardCard 注册。每个元素包含：<code>name</code> (string) 卡片标识名；<code>componentName</code> (string) 关联的 Vue 组件名。" : "Dashboard card list. Registered via api.registerDashboardCard. Each: <code>name</code> (string), <code>componentName</code> (string)." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.pluginSidebarItems</td><td>object[]</td><td>{{ store.lang === "zh" ? "所有插件注册的侧边栏项列表。每个元素包含：<code>id</code> (string) 侧边栏项 ID；<code>labelKey</code> (string) 翻译键；<code>icon</code> (string) FontAwesome 图标名；<code>color</code> (string) 图标颜色；<code>view</code> (string) 视图名称；<code>location</code> (string) 显示位置，合法值：<code>'instance'</code>、<code>'global'</code>、<code>'both'</code>；<code>pluginId</code> (string) 所属插件 ID；<code>component</code> (string) 关联组件名。" : "List of plugin sidebar items. Each: <code>id</code>, <code>labelKey</code>, <code>icon</code>, <code>color</code>, <code>view</code>, <code>location</code>, <code>pluginId</code>, <code>component</code>." }}</td></tr>
    <tr><td class="text-success font-monospace py-2">store.pluginComponents</td><td>object</td><td>{{ store.lang === "zh" ? "所有插件注册的前端组件映射。键为组件名 (string)，值为组件信息对象：<code>{ pluginId: string, path: string }</code>。通常不需要直接操作此属性，系统会根据 <code>store.view</code> 自动加载对应组件。" : "Map of plugin components. Key: name. Value: <code>{ pluginId, path }</code>. Auto-loaded via <code>store.view</code>." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-globe me-2 text-success"></i> Frontend API Reference </h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "通过 <code>import { api } from '/js/api.js'</code> 导入。基于 axios 封装，自动附加 <code>instanceId</code> 参数和认证信息。" : "Imported via <code>import { api } from '/js/api.js'</code>. Based on axios, automatically attaches <code>instanceId</code> and auth info." }}</p>
    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "签名" : "Signature" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="text-success font-monospace py-2">api.get</td><td><code>(url: string, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>{{ store.lang === "zh" ? "发送 GET 请求。自动附加 instanceId 到 URL 参数。示例：<code>const res = await api.get('/api/plugins/my-plugin/items');</code>" : "Send GET request. <code>config</code> is optional. Automatically attaches <code>instanceId</code> query parameter. Example: <code>const res = await api.get('/api/plugins/my-plugin/items');</code>" }}</td></tr>
    <tr><td class="text-success font-monospace py-2">api.post</td><td><code>(url: string, data?: any, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>{{ store.lang === "zh" ? "发送 POST 请求。<code>data</code> 为请求体（自动 JSON 序列化）；如果 <code>data</code> 是 <code>FormData</code> 则以 multipart 发送。自动附加 <code>instanceId</code> 到请求体。示例：<code>await api.post('/api/plugins/my-plugin/items', { name: 'test' });</code>" : "Send POST request. <code>data</code> is body (auto JSON); or multipart if <code>FormData</code>. Auto-attaches <code>instanceId</code> to body. Example: <code>await api.post('/api/plugins/my-plugin/items', { name: 'test' });</code>" }}</td></tr>
    <tr><td class="text-success font-monospace py-2">api.put</td><td><code>(url: string, data?: any, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>{{ store.lang === "zh" ? "发送 PUT 请求。参数同 <code>api.post</code>。示例：<code>await api.put('/api/plugins/my-plugin/config', { key: 'value' });</code>" : "Send PUT request. Params same as <code>api.post</code>. Example: <code>await api.put('/api/plugins/my-plugin/config', { key: 'value' });</code>" }}</td></tr>
    <tr><td class="text-success font-monospace py-2">api.delete</td><td><code>(url: string, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>{{ store.lang === "zh" ? "发送 DELETE 请求。自动附加 instanceId 查询参数。示例：<code>await api.delete('/api/plugins/my-plugin/items/123');</code>" : "Send DELETE request. Automatically attaches <code>instanceId</code> query parameter. Example: <code>await api.delete('/api/plugins/my-plugin/items/123');</code>" }}</td></tr>
    </tbody>
    </table>
    </div>
    <p class="small text-muted mb-0 mt-3">{{ store.lang === "zh" ? "<strong>请求拦截器行为</strong>：所有请求自动附加 <code>store.currentInstanceId</code> 作为参数。GET/DELETE 请求附加到 URL 查询参数；POST/PUT 请求附加到请求体（FormData 使用 <code>append</code>，JSON 对象使用展开运算符）。响应数据通过 <code>res.data</code> 获取。" : "<strong>Request Interceptor</strong>: All requests auto-attach <code>store.currentInstanceId</code>. GET/DELETE attach to URL query; POST/PUT attach to body (FormData uses <code>append</code>, JSON uses spread). Data via <code>res.data</code>." }}</p>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-wrench me-2 text-success"></i> Utility Functions Reference </h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "通过 <code>import { showToast, openModal, formatLog, waitForPanel, uploadFileWithChunk, isLargeFile } from '/js/utils.js'</code> 导入。" : "Import via <code>import { ... } from '/js/utils.js'</code>." }}</p>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-success font-monospace small">showToast(msg, type, params)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "显示全局 Toast 提示消息。消息会在 3 秒后自动消失。如果 msg 是翻译键，会自动翻译。" : "Show global toast. Auto-translates if msg is a translation key. Disappears after 3s." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Param" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">msg</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "提示消息文本或 i18n 翻译键。如果是翻译键（如 'common.saved'）会自动翻译；如果不是翻译键则直接显示原文。示例：'操作成功'、'common.error'" : "Toast message or i18n key. Auto-translates if key (e.g., 'common.saved'); else shows original. Examples: 'Success', 'common.error'" }}</td></tr>
    <tr><td class="font-monospace">type</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"success"</code></td><td>{{ store.lang === "zh" ? "提示类型，决定颜色和图标。合法取值：'success'、'danger'、'warning'、'info'。" : "Toast type, determines color and icon. Valid values: 'success', 'danger', 'warning', 'info'." }}</td></tr>
    <tr><td class="font-monospace">params</td><td>object</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>{}</code></td><td>{{ store.lang === "zh" ? "翻译参数对象。用于替换模板中的占位符。示例：{ name: '备份' }。" : "Translation parameters object. Used to replace placeholders in the template when msg is a translation key." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>showToast('保存成功');                    // 成功提示（默认绿色）
    showToast('操作失败', 'danger');           // 错误提示（红色）
    showToast('请注意配置', 'warning');
    showToast('正在处理中', 'info');            // 信息提示（蓝色）
    showToast('common.saved', 'success');      // 使用翻译键
    showToast('common.welcome', 'info', { name: 'Admin' }); // 携带翻译参数</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>showToast('Saved Successfully');                    // Success toast (green)
    showToast('Operation Failed', 'danger');           // Error toast (red)
    showToast('Check Config', 'warning');
    showToast('Processing', 'info');            // Info toast (blue)
    showToast('common.saved', 'success');      // Use translation key
    showToast('common.welcome', 'info', { name: 'Admin' }); // With translation params</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-success font-monospace small">openModal(opts)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "打开全局模态对话框。支持确认、输入和选择三种模式。支持嵌套模态框（自动处理 z-index）。" : "Open global modal. Supports confirm, input, select modes. Handles nesting." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数字段" : "Field" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">opts.title</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"确认"</code></td><td>{{ store.lang === "zh" ? "模态框标题。示例：'删除确认'、'输入名称'" : "Modal title. Example: 'Delete Confirmation'." }}</td></tr>
    <tr><td class="font-monospace">opts.message</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>""</code></td><td>{{ store.lang === "zh" ? "模态框正文消息。支持 HTML。" : "Modal body message. Supports HTML." }}</td></tr>
    <tr><td class="font-monospace">opts.mode</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"confirm"</code></td><td>{{ store.lang === "zh" ? "模态框模式。合法取值：'confirm'、'input'、'select'。" : "Modal mode. Valid values: 'confirm', 'input', 'select'." }}</td></tr>
    <tr><td class="font-monospace">opts.inputValue</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>""</code></td><td>{{ store.lang === "zh" ? "输入框默认值。仅在 mode: 'input' 时有效。" : "Input box default value. Only valid when mode is 'input'." }}</td></tr>
    <tr><td class="font-monospace">opts.placeholder</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>""</code></td><td>{{ store.lang === "zh" ? "输入框占位符文本。仅在 mode: 'input' 时有效。" : "Input box placeholder text. Only valid when mode is 'input'." }}</td></tr>
    <tr><td class="font-monospace">opts.options</td><td>Array&lt;string | {label: string, value: any}&gt;</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>[]</code></td><td>{{ store.lang === "zh" ? "选项列表。仅在 mode: 'select' 时有效。支持两种格式：<br><strong>字符串数组</strong>：<code>['选项A', '选项B']</code>，选择后 callback 接收字符串；<br><strong>对象数组</strong>：<code>[{label: '显示文本', value: '实际值'}]</code>，选择后 callback 接收 value。" : "Options list. Only valid when mode is 'select'. Two formats:<br><strong>String array</strong>: <code>['OptionA', 'OptionB']</code>, callback receives string;<br><strong>Object array</strong>: <code>[{label: 'Display Text', value: 'actual_value'}]</code>, callback receives value." }}</td></tr>
    <tr><td class="font-monospace">opts.suffix</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>""</code></td><td>{{ store.lang === "zh" ? "输入框后缀文本。仅在 mode: 'input' 时有效。显示在输入框右侧，常用于单位提示（如 '秒'、'MB'）。" : "Input suffix text. Only valid when mode is 'input'. Displayed right of input, commonly for units (e.g., 'seconds', 'MB')." }}</td></tr>
    <tr><td class="font-monospace">opts.callback</td><td>function</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>null</code></td><td>{{ store.lang === "zh" ? "确认回调函数。签名：<br>mode: 'confirm' → <code>() =&gt; void</code>；<br>mode: 'input' → <code>(inputValue: string) =&gt; void</code>；<br>mode: 'select' → <code>(selectedValue: string) =&gt; void</code>。" : "Confirm callback. Signature:<br>mode: 'confirm' → <code>() =&gt; void</code>;<br>mode: 'input' → <code>(inputValue: string) =&gt; void</code>;<br>mode: 'select' → <code>(selectedValue: string) =&gt; void</code>." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 确认模式
    openModal({
        title: "删除确认",
        message: '确定要删除此项目吗？此操作不可撤销。',
        mode: 'confirm',
        callback: () => { showToast('已删除'); }
    });

    // 输入模式（带后缀和默认值）
    openModal({
        title: "设置间隔",
        message: '请输入自动备份间隔：',
        mode: 'input',
        inputValue: "30",
        placeholder: '输入数字',
        suffix: '分钟',
        callback: (val) => {
            if (val) showToast('间隔已设为: ' + val + '分钟');
        }
    });

    // 选择模式 — 字符串数组
    openModal({
        title: "选择备份策略",
        message: '请选择备份方式：',
        mode: 'select',
        options: ["面板备份", "模组备份", "手动备份"],
        callback: (choice) => { showToast("选择了: " + choice); }
    });

    // 选择模式 — 对象数组（label 显示，value 回调）
    openModal({
        title: "选择游戏模式",
        message: '请选择玩家游戏模式：',
        mode: 'select',
        inputValue: 'survival',
        options: [
            { label: '生存模式', value: 'survival' },
            { label: '创造模式', value: 'creative' },
            { label: '冒险模式', value: 'adventure' },
            { label: '旁观模式', value: 'spectator' }
        ],
        callback: (val) => { sendCmd('gamemode ' + val + ' Steve'); }
    });</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// Confirm Mode
    openModal({
        title: "Delete Confirmation",
        message: 'Are you sure you want to delete this? This cannot be undone.',
        mode: 'confirm',
        callback: () => { showToast('Deleted'); }
    });

    // Input mode (with suffix and default value)
    openModal({
        title: "Set Interval",
        message: 'Enter auto-backup interval:',
        mode: 'input',
        inputValue: "30",
        placeholder: 'Enter number',
        suffix: 'minutes',
        callback: (val) => {
            if (val) showToast('Interval set to: ' + val + ' minutes');
        }
    });

    // Select Mode — String array
    openModal({
        title: "Select Backup Policy",
        message: 'Please select backup method:',
        mode: 'select',
        options:["Panel Backup", "Mods Backup", "Manual Backup"],
        callback: (choice) => { showToast("Selected: " + choice); }
    });

    // Select Mode — Object array (label for display, value for callback)
    openModal({
        title: "Select Game Mode",
        message: 'Choose player game mode:',
        mode: 'select',
        inputValue: 'survival',
        options: [
            { label: 'Survival', value: 'survival' },
            { label: 'Creative', value: 'creative' },
            { label: 'Adventure', value: 'adventure' },
            { label: 'Spectator', value: 'spectator' }
        ],
        callback: (val) => { sendCmd('gamemode ' + val + ' Steve'); }
    });</code></pre>
    </template>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-success font-monospace small">formatLog(log)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "格式化 MC 服务器日志文本，为 INFO/WARN/ERROR 标签添加 HTML 高亮标签。" : "Format MC server logs with HTML highlighting for INFO/WARN/ERROR tags." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Param" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">log</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "原始日志文本。示例：'[12:00:00 INFO]: Server started'" : "Raw log text. Example: '[12:00:00 INFO]: Server started'" }}</td></tr>
    </tbody>
    </table>
    </div>
    <p class="small text-muted mb-0"><strong>{{ store.lang === "zh" ? "返回值" : "Returns" }}</strong>：string — {{ store.lang === "zh" ? "格式化后的 HTML 字符串" : "Formatted HTML string" }}。<code>[INFO]</code> → <code>&lt;span class="log-info"&gt;INFO&lt;/span&gt;</code>；<code>[WARN]</code> → <code>&lt;span class="log-warn"&gt;WARN&lt;/span&gt;</code>；<code>[ERROR]</code> → <code>&lt;span class="log-error"&gt;ERROR&lt;/span&gt;</code>；<code>{{ store.lang === "zh" ? "[系统]" : "[System]" }}</code> → <code>&lt;span class="log-system"&gt;{{ store.lang === "zh" ? "[系统]" : "[System]" }}&lt;/span&gt;</code>。{{ store.lang === "zh" ? "同时转义 < 为 &lt;。" : "Also escapes < to &lt;." }}</p>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-success font-monospace small">waitForPanel(targetPort)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "等待面板重新上线。用于重启面板后，轮询直到面板恢复响应。" : "Wait for panel to come back online. Used after restart, polls until responsive." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">targetPort</td><td>string|number|null</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>null</code></td><td>{{ store.lang === "zh" ? "目标端口号。如果提供，则探测相应端口；如果为 null，则探测当前页面的版本接口。" : "Target port. If provided, polls that port; if null, polls current page API." }}</td></tr>
    </tbody>
    </table>
    </div>
    <p class="small text-muted mb-0"><strong>{{ store.lang === "zh" ? "返回值" : "Returns" }}</strong>: Promise&lt;void&gt; — {{ store.lang === "zh" ? "面板恢复响应时 resolve。初始等待 1.5 秒后开始探测，每次探测间隔 1 秒，单次探测超时 2 秒。" : "Resolves when panel recovers. Initial wait 1.5s, then polls every 1s, timeout 2s per poll." }}</p>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-success font-monospace small">uploadFileWithChunk(file, options)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "大文件分片上传。仅当文件 ≥ 100MB 时启用分片上传，小于 100MB 的文件返回 null，需使用普通上传方式。" : "Multipart upload for files ≥ 100MB. Returns null if < 100MB." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数字段" : "Field" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">file</td><td>File</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "要上传的文件对象（浏览器 File API）。" : "File object to upload (Browser File API)." }}</td></tr>
    <tr><td class="font-monospace">options.initUrl</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "初始化上传的 API 端点。POST 请求，后端应返回 { uploadId: string }。" : "Upload init endpoint. POST request. Should return { uploadId: string }." }}</td></tr>
    <tr><td class="font-monospace">options.uploadUrl</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"/api/files/chunk/upload"</code></td><td>{{ store.lang === "zh" ? "分片上传 API 端点。POST 请求，发送 FormData。" : "Chunk upload API endpoint. POST request, sends FormData." }}</td></tr>
    <tr><td class="font-monospace">options.completeUrl</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "完成上传的 API 端点。POST 请求，发送 { uploadId }。" : "Upload complete endpoint. POST request, sends { uploadId }." }}</td></tr>
    <tr><td class="font-monospace">options.cancelUrl</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"/api/files/chunk/cancel"</code></td><td>{{ store.lang === "zh" ? "取消上传的 API 端点。上传失败时自动调用。" : "Upload cancellation API endpoint. Automatically called on failure." }}</td></tr>
    <tr><td class="font-monospace">options.fieldName</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"chunk"</code></td><td>{{ store.lang === "zh" ? "FormData 中分片文件的字段名。" : "Field name of the chunk file in FormData." }}</td></tr>
    <tr><td class="font-monospace">options.extraInitData</td><td>object</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>{}</code></td><td>{{ store.lang === "zh" ? "初始化请求的额外数据。会合并到 initUrl 的请求体中。" : "Extra data for initialization request. Merged into initUrl request body." }}</td></tr>
    <tr><td class="font-monospace">options.onProgress</td><td>function</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>() =&gt; {}</code></td><td>{{ store.lang === "zh" ? "进度回调函数。签名：" : "Progress callback. Signature: " }}<code>(uploadedBytes: number, totalBytes: number, chunkIndex: number, totalChunks: number) =&gt; void</code>。</td></tr>
    </tbody>
    </table>
    </div>
    <p class="small text-muted mb-0">{{ store.lang === "zh" ? "<strong>返回值</strong>：Promise<object|null> — 文件 < 100MB 返回 null；≥ 100MB 返回完成请求的响应数据。分片大小为 10MB。上传失败时自动调用取消接口。" : "<strong>Returns</strong>: Promise<object|null> — null if < 100MB; response data if ≥ 100MB. Chunk size 10MB. Auto-cancels on failure." }}</p>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-success font-monospace small">isLargeFile(file)</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "检查文件是否为大文件 (≥ 100MB)。用于决定是否使用分片上传。" : "Check if file is large (≥ 100MB). Used to decide whether to use multipart upload." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">file</td><td>File</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "浏览器 File 对象。" : "Browser File object." }}</td></tr>
    </tbody>
    </table>
    </div>
    <p class="small text-muted mb-0">{{ store.lang === "zh" ? "<strong>返回值</strong>：boolean — true 表示文件 ≥ 100MB，应使用 uploadFileWithChunk；false 表示文件较小，使用普通上传。" : "<strong>Returns</strong>: boolean — true if ≥ 100MB (use uploadFileWithChunk); false otherwise." }}</p>
    </div>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-vue-options" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-purple bg-opacity-10 rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px; background: rgba(139,92,246,0.1); color: #8b5cf6;">
    <i class="fa-solid fa-cubes" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ store.lang === "zh" ? "Vue 组件选项与内置组件" : "Vue Component Options & Built-in Components" }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75">{{ store.lang === "zh" ? "组件声明规范、子组件注册、内置可复用组件" : "Component declaration, sub-component registration, reusable built-in components" }}</p>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-code me-2" style="color: #8b5cf6;"></i>{{ store.lang === "zh" ? "组件选项对象完整字段" : "Component Options Object Fields" }}</h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "前端组件文件必须使用 <code>export default {}</code> 导出选项对象。以下是所有可用字段：" : "Frontend component files must use <code>export default {}</code>. Available fields:" }}</p>
    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "字段" : "Field" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace py-2">template</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "组件 HTML 模板字符串。使用 ES6 模板字面量（反引号）。支持 Vue 3 模板语法：v-if、v-for、v-model、@click、:class 等。" : "Component HTML template string. Use ES6 template literals. Supports Vue 3 template syntax." }}</td></tr>
    <tr><td class="font-monospace py-2">setup()</td><td>function</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "Composition API 入口函数。返回的对象属性在模板中可用。签名：<code>() =&gt; Object</code>。必须返回模板中使用的所有响应式变量和方法。" : "Composition API entry. Returns object with properties accessible in template. Must return all reactive vars and methods used in template." }}</td></tr>
    <tr><td class="font-monospace py-2">components</td><td>object</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>{{ store.lang === "zh" ? "注册子组件。键为组件标签名（PascalCase），值为导入的组件对象。注册后可在 template 中使用 kebab-case 标签引用。示例：<code>components: { Avatar, CustomSelect }</code> → <code>&lt;avatar&gt;&lt;/avatar&gt;</code>" : "Register sub-components. Key: PascalCase name, Value: imported component. Use kebab-case in template. Example: <code>components: { Avatar }</code> → <code>&lt;avatar&gt;</code>" }}</td></tr>
    <tr><td class="font-monospace py-2">props</td><td>object</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>{{ store.lang === "zh" ? "组件属性定义。支持简写和完整格式。简写：<code>props: { name: String }</code>；完整：<code>props: { name: { type: String, required: true, default: '' } }</code>。父组件通过属性传递：<code>&lt;my-comp name='test'&gt;</code>" : "Component props definition. Short: <code>props: { name: String }</code>; Full: <code>props: { name: { type: String, required: true, default: '' } }</code>." }}</td></tr>
    <tr><td class="font-monospace py-2">emits</td><td>string[]</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>{{ store.lang === "zh" ? "声明组件可触发的事件。示例：<code>emits: ['update', 'delete']</code>。在 setup 中通过第二个参数 <code>{ emit }</code> 触发：<code>emit('update', newValue)</code>。" : "Declare events. Example: <code>emits: ['update', 'delete']</code>. Trigger via setup's second param: <code>emit('update', newValue)</code>." }}</td></tr>
    <tr><td class="font-monospace py-2">name</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>{{ store.lang === "zh" ? "组件名称。用于递归组件和 DevTools 调试。示例：<code>name: 'MyPluginView'</code>" : "Component name. Used for recursion and DevTools. Example: <code>name: 'MyPluginView'</code>" }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-puzzle-piece me-2" style="color: #8b5cf6;"></i>{{ store.lang === "zh" ? "在 setup() 中获取 $t 翻译函数" : "Getting $t Translation Function in setup()" }}</h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "在模板中可以直接使用 <code>$t('key')</code>，但在 <code>setup()</code> 函数内需要通过 <code>getCurrentInstance()</code> 获取：" : "Use <code>$t('key')</code> directly in templates. In <code>setup()</code>, get it via <code>getCurrentInstance()</code>:" }}</p>
    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>import { getCurrentInstance } from '/js/vue.esm-browser.js';

export default {
    setup() {
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        // 在 JS 逻辑中使用翻译
        const title = $t('plugins.my-plugin.title');
        showToast($t('common.success'));

        // ...
    }
};</code></pre>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-boxes-stacked me-2" style="color: #8b5cf6;"></i>{{ store.lang === "zh" ? "内置可复用组件" : "Built-in Reusable Components" }}</h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "面板提供了以下内置组件，插件可以直接导入使用。在组件选项中通过 <code>components</code> 字段注册后即可在模板中使用。" : "The panel provides built-in components that plugins can import and use. Register via <code>components</code> field." }}</p>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 small" style="color: #8b5cf6;"><i class="fa-solid fa-user me-2"></i>Avatar — {{ store.lang === "zh" ? "玩家头像" : "Player Avatar" }}</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "自动检测玩家皮肤来源（正版/LittleSkin），显示玩家头像。支持 CSS 像素风裁剪。" : "Auto-detects skin source (official/LittleSkin), displays player avatar with pixel-art CSS cropping." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "导入" : "Import" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody><tr><td class="font-monospace">import Avatar from '/js/components/Avatar.js'</td><td>{{ store.lang === "zh" ? "玩家头像组件" : "Player avatar component" }}</td></tr></tbody>
    </table>
    </div>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>Props</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">player</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>—</td><td>{{ store.lang === "zh" ? "玩家名称。" : "Player name." }}</td></tr>
    <tr><td class="font-monospace">size</td><td>number</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>64</td><td>{{ store.lang === "zh" ? "头像尺寸（像素）。常用值：24（列表小头像）、64（卡片大头像）。" : "Avatar size in pixels. Common: 24 (list), 64 (card)." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>import Avatar from '/js/components/Avatar.js';

export default {
    components: { Avatar },
    template: \`
        &lt;div&gt;
            &lt;!-- 大头像 --&gt;
            &lt;avatar :player="playerName" :size="64"&gt;&lt;/avatar&gt;
            &lt;!-- 列表小头像 --&gt;
            &lt;avatar :player="p" :size="24" class="me-2"&gt;&lt;/avatar&gt;
        &lt;/div&gt;
    \`,
    setup() {
        const playerName = ref('Steve');
        return { playerName };
    }
};</code></pre>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 small" style="color: #8b5cf6;"><i class="fa-solid fa-list me-2"></i>CustomSelect — {{ store.lang === "zh" ? "自定义下拉选择器" : "Custom Select Dropdown" }}</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "功能丰富的自定义下拉选择组件，支持搜索、键盘导航、自动定位。使用 Teleport 渲染到 body 层，避免溢出问题。" : "Feature-rich custom select with search, keyboard nav, auto-positioning. Uses Teleport to body." }}</p>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "导入" : "Import" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody><tr><td class="font-monospace">import CustomSelect from '/js/components/CustomSelect.js'</td><td>{{ store.lang === "zh" ? "自定义下拉选择组件" : "Custom select component" }}</td></tr></tbody>
    </table>
    </div>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>Props</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">modelValue</td><td>any</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>''</td><td>{{ store.lang === "zh" ? "当前选中值。支持 v-model 双向绑定。" : "Current selected value. Supports v-model." }}</td></tr>
    <tr><td class="font-monospace">options</td><td>Array&lt;string | {label: string, value: any}&gt;</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>[]</td><td>{{ store.lang === "zh" ? "选项列表。支持字符串数组和对象数组（同 openModal）。" : "Options list. Supports string array and object array (same as openModal)." }}</td></tr>
    <tr><td class="font-monospace">placeholder</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>''</td><td>{{ store.lang === "zh" ? "占位提示文本。" : "Placeholder text." }}</td></tr>
    <tr><td class="font-monospace">disabled</td><td>boolean</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>false</td><td>{{ store.lang === "zh" ? "是否禁用。" : "Whether disabled." }}</td></tr>
    <tr><td class="font-monospace">size</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>''</td><td>{{ store.lang === "zh" ? "尺寸。合法取值：<code>''</code>（默认）、<code>'sm'</code>（小）、<code>'lg'</code>（大）。" : "Size. Valid: <code>''</code> (default), <code>'sm'</code>, <code>'lg'</code>." }}</td></tr>
    <tr><td class="font-monospace">searchable</td><td>boolean</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>false</td><td>{{ store.lang === "zh" ? "是否启用搜索过滤功能。" : "Enable search filtering." }}</td></tr>
    <tr><td class="font-monospace">width</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>''</td><td>{{ store.lang === "zh" ? "自定义宽度。CSS 值，如 '200px'、'100%'。" : "Custom width. CSS value, e.g., '200px', '100%'." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="table-responsive mb-3">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>Events</th><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">update:modelValue</td><td>value: any</td><td>{{ store.lang === "zh" ? "选中值变化时触发。用于 v-model。" : "Fired when selection changes. For v-model." }}</td></tr>
    <tr><td class="font-monospace">change</td><td>value: any</td><td>{{ store.lang === "zh" ? "选中值变化时触发。用于监听变化执行逻辑。" : "Fired on selection change. For watching changes." }}</td></tr>
    </tbody>
    </table>
    </div>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>import CustomSelect from '/js/components/CustomSelect.js';

export default {
    components: { CustomSelect },
    template: \`
        &lt;div&gt;
            &lt;!-- 基础用法 --&gt;
            &lt;custom-select
                v-model="selectedMode"
                :options="modeOptions"
                placeholder="选择模式"
            /&gt;

            &lt;!-- 带搜索 --&gt;
            &lt;custom-select
                v-model="selectedPlayer"
                :options="store.onlinePlayers"
                searchable
                placeholder="搜索玩家"
                size="sm"
            /&gt;
        &lt;/div&gt;
    \`,
    setup() {
        const selectedMode = ref('');
        const modeOptions = [
            { label: '生存模式', value: 'survival' },
            { label: '创造模式', value: 'creative' }
        ];
        const selectedPlayer = ref('');
        return { selectedMode, modeOptions, selectedPlayer, store };
    }
};</code></pre>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 small" style="color: #8b5cf6;"><i class="fa-solid fa-spinner me-2"></i>ProgressModal — {{ store.lang === "zh" ? "全局进度遮罩" : "Global Progress Overlay" }}</h6>
    <p class="small text-muted mb-2">{{ store.lang === "zh" ? "全屏毛玻璃进度遮罩组件，已在全局注册，插件无需导入。通过 <code>store.task</code> 控制显示和内容。" : "Fullscreen frosted-glass progress overlay, globally registered. Control via <code>store.task</code>." }}</p>
    <div class="code-block-wrapper rounded-3 overflow-hidden border">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 显示进度遮罩
store.task.visible = true;
store.task.title = '导出数据';
store.task.message = '正在处理...';
store.task.percent = 50;
store.task.speed = 0;
store.task.canCancel = true;
store.task.onCancel = () => {
    store.task.visible = false;
    showToast('已取消', 'warning');
};

// 更新进度
store.task.percent = 80;
store.task.message = '即将完成...';

// 完成后关闭
store.task.percent = 100;
store.task.message = '完成！';
setTimeout(() => { store.task.visible = false; }, 1000);</code></pre>
    </div>
    </div>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-i18n" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-info bg-opacity-10 text-info rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-solid fa-globe" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t('plugins.i18n') }}</h3>
    <p v-if="store.lang === 'zh'" class="text-muted small m-0 mt-1 opacity-75">让你的插件支持多语言</p>
    <p v-else class="text-muted small m-0 mt-1 opacity-75">Make your plugin support multiple languages</p>
    </div>
    </div>
    <p v-if="store.lang === 'zh'" class="text-muted mb-4 lh-lg">面板支持插件独立的国际化配置。插件可以在其根目录下创建 <code>locales/</code> 目录，放置 JSON 格式的翻译文件。系统会自动加载并在前端合并这些翻译。</p>
    <p v-else class="text-muted mb-4 lh-lg">The panel supports independent internationalization for plugins. Plugins can create a <code>locales/</code> directory in their root to place JSON format translation files. The system will automatically load and merge these translations on the frontend.</p>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-folder-tree me-2 text-info"></i>{{ store.lang === "zh" ? "目录结构" : "Directory Structure" }}</h5>
    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>my-plugin/
    ├── locales/
    │   ├── zh.json    # 中文翻译
    │   └── en.json    # 英文翻译
    ├── component/
    │   └── Main.js
    └── plugin.json</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>my-plugin/
    ├── locales/
    │   ├── zh.json    # Chinese Translation
    │   └── en.json    # English Translation
    ├── component/
    │   └── Main.js
    └── plugin.json</code></pre>
    </template>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-code me-2 text-info"></i>Translation Example (zh.json)</h5>
    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>{
        "title": "我的插件",
        "description": "这是一个测试插件",
        "buttons": {
            "start": "开始任务",
            "stop": "停止任务"
        }
    }</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>{
        "title": "My Plugin",
        "description": "This is a test plugin",
        "buttons": {
            "start": "Start Task",
            "stop": "Stop Task"
        }
    }</code></pre>
    </template>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-tag me-2 text-info"></i>{{ store.lang === "zh" ? "命名空间规则" : "Namespace Rules" }}</h5>
    <p v-if="store.lang === 'zh'" class="text-muted mb-3">为了避免不同插件之间的词条冲突，系统会将插件的所有翻译自动挂载到 <code>plugins.[pluginId]</code> 命名空间下。</p>
    <p v-else class="text-muted mb-3">To avoid conflicts between plugins, the system automatically mounts all translations of a plugin under the <code>plugins.[pluginId]</code> namespace.</p>
    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <ul v-if="store.lang === 'zh'" class="list-unstyled mb-0 small text-muted lh-lg">
    <li><i class="fa-solid fa-check text-success me-2"></i>如果插件 ID 为 <code>my-plugin</code>，并且翻译文件中有 <code>"title": "你好"</code></li>
    <li><i class="fa-solid fa-check text-success me-2"></i>前端调用键名为：<code>plugins.my-plugin.title</code></li>
    <li><i class="fa-solid fa-check text-success me-2"></i>侧边栏注册时的 <code>labelKey</code> 应该是：<code>plugins.my-plugin.title</code></li>
    </ul>
    <ul v-else class="list-unstyled mb-0 small text-muted lh-lg">
    <li><i class="fa-solid fa-check text-success me-2"></i>If plugin ID is <code>my-plugin</code> and translation has <code>"title": "Hello"</code></li>
    <li><i class="fa-solid fa-check text-success me-2"></i>Frontend call key: <code>plugins.my-plugin.title</code></li>
    <li><i class="fa-solid fa-check text-success me-2"></i>Sidebar <code>labelKey</code>: <code>plugins.my-plugin.title</code></li>
    </ul>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-terminal me-2 text-info"></i>{{ store.lang === "zh" ? "前端组件中使用" : "Frontend Usage" }}</h5>
    <p v-if="store.lang === 'zh'" class="text-muted mb-3 small">在 Vue 模板中直接使用全局 <code>$t()</code> 函数即可：</p>
    <p v-else class="text-muted mb-3 small">Use the global <code>$t()</code> function in Vue templates:</p>
    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>&lt;template&gt;
    &lt;div&gt;
    &lt;h3&gt;{{ $t('plugins.my-plugin.title') }}&lt;/h3&gt;
    &lt;button&gt;{{ $t('plugins.my-plugin.buttons.start') }}&lt;/button&gt;
    &lt;/div&gt;
    &lt;/template&gt;</code></pre>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-socket" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-warning bg-opacity-10 text-warning rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-solid fa-plug" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t('plugins.socket') }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75"> {{ store.lang === "zh" ? "实时双向数据交互" : "Real-time Bidirectional Data Interaction" }} </p>
    </div>
    </div>
    <p class="text-muted mb-4 lh-lg">{{ store.lang === "zh" ? "面板内置了 Socket.IO，插件可以注册独立的命名空间，实现与前端的实时通信（如控制台日志流、实时状态监控等）。" : "Panel has built-in Socket.IO. Plugins can register namespaces for real-time communication (logs, status, etc.)." }}</p>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small text-uppercase text-warning tracking-wider" style="font-size: 0.75rem;">Panel Global Events (Default Namespace)</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead>
    <tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "事件名" : "Event" }}</th><th>{{ store.lang === "zh" ? "数据结构" : "Data Structure" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr>
    </thead>
    <tbody>
    <tr><td class="text-warning font-monospace py-2">status</td><td>{ isRunning: boolean }</td><td>{{ store.lang === "zh" ? "当前活跃实例的运行状态变更。" : "Running state change of current active instance." }}</td></tr>
    <tr><td class="text-warning font-monospace py-2">status:{instanceId}</td><td>{ isRunning: boolean }</td><td>{{ store.lang === "zh" ? "特定实例的运行状态变更。" : "Status change of a specific instance." }}</td></tr>
    <tr><td class="text-warning font-monospace py-2">players_update</td><td>string[]</td><td>{{ store.lang === "zh" ? "当前活跃实例的在线玩家列表更新。" : "Online player list update for current active instance." }}</td></tr>
    <tr><td class="text-warning font-monospace py-2">players_update:{instanceId}</td><td>string[]</td><td>{{ store.lang === "zh" ? "指定实例的在线玩家列表更新。" : "Online player list update for specified instance." }}</td></tr>
    <tr><td class="text-warning font-monospace py-2">system_stats</td><td>object</td><td>{{ store.lang === "zh" ? "系统状态更新。包含：cpu (string) CPU 使用率；mem (object) 内存信息；mc (object) MC 服务器信息。" : "System stats update. Includes: cpu, mem, mc info." }}</td></tr>
    <tr><td class="text-warning font-monospace py-2">instances_update</td><td>object[]</td><td>{{ store.lang === "zh" ? "实例列表更新。数据格式同 store.instanceList。" : "Instance list update. Format matches store.instanceList." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <h5 class="fw-bold mb-3"><i class="fa-solid fa-code me-2 text-warning"></i>{{ store.lang === "zh" ? "插件自定义 Socket 命名空间" : "Plugin Custom Socket Namespace" }}</h5>
    <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "插件后端通过 api.registerSocket(namespace, handlers) 创建独立的 Socket 命名空间。前端连接方法如下：" : "Plugin backend creates an independent Socket namespace via api.registerSocket(namespace, handlers). Frontend connection method:" }}</p>
    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
    <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
    <span class="fw-bold">{{ store.lang === "zh" ? "插件 Socket 前后端通信示例" : "Plugin Socket Communication Example" }}</span>
    <span class="text-muted opacity-50">Javascript</span>
    </div>
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>// === 后端 index.js ===
    const ns = api.registerSocket('/live', {
        'chat': (socket, message) => {
            api.logger.info('收到消息:', message);
            ns.emit('chat_response', { echo: message, from: socket.id });
        },
        'request_data': (socket, params) => {
            socket.emit('data_response', { result: 'processed', params });
        }
    });

    // 向所有客户端广播
    // ns.emit('notification', { msg: '系统维护通知' });

    // === 前端 component/Main.js ===
    import { ref, onMounted, onUnmounted } from '/js/vue.esm-browser.js';

    export default {
        template: '&lt;div&gt;{{ message }}&lt;/div&gt;',
        setup() {
            const message = ref('');
            let pluginSocket = null;

            onMounted(async () => {
                // 动态导入 Socket.IO 客户端
                const { io: ioClient } = await import('/socket.io/socket.io.esm.min.js');

                // 方式一：连接到插件的自定义命名空间
                pluginSocket = ioClient('/plugin/my-plugin/live');
                pluginSocket.on('chat_response', (data) => {
                    message.value = data.echo;
                });
                pluginSocket.on('notification', (data) => {
                    message.value = data.msg;
                });

                // 方式二：使用默认命名空间（监听面板全局事件）
                // pluginSocket = ioClient();
                // pluginSocket.on('system_stats', (data) => { ... });
            });

            onUnmounted(() => {
                if (pluginSocket) {
                    pluginSocket.disconnect();
                    pluginSocket = null;
                }
            });

            const sendChat = (msg) => {
                pluginSocket?.emit('chat', msg);
            };

            return { message, sendChat };
        }
    };</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>// === Backend index.js ===
    const ns = api.registerSocket('/live', {
        'chat': (socket, message) => {
            api.logger.info('Chat received:', message);
            ns.emit('chat_response', { echo: message, from: socket.id });
        },
        'request_data': (socket, params) => {
            socket.emit('data_response', { result: 'processed', params });
        }
    });

    // Broadcast to all connected clients
    // ns.emit('notification', { msg: 'System Maintenance Notice' });

    // === Frontend component/Main.js ===
    import { ref, onMounted, onUnmounted } from '/js/vue.esm-browser.js';

    export default {
        template: '&lt;div&gt;{{ message }}&lt;/div&gt;',
        setup() {
            const message = ref('');
            let pluginSocket = null;

            onMounted(async () => {
                // Dynamically import Socket.IO client
                const { io: ioClient } = await import('/socket.io/socket.io.esm.min.js');

                // Option 1: Connect to plugin custom namespace
                pluginSocket = ioClient('/plugin/my-plugin/live');
                pluginSocket.on('chat_response', (data) => {
                    message.value = data.echo;
                });
                pluginSocket.on('notification', (data) => {
                    message.value = data.msg;
                });

                // Option 2: Use default namespace (listen to global events)
                // pluginSocket = ioClient();
                // pluginSocket.on('system_stats', (data) => { ... });
            });

            onUnmounted(() => {
                if (pluginSocket) {
                    pluginSocket.disconnect();
                    pluginSocket = null;
                }
            });

            const sendChat = (msg) => {
                pluginSocket?.emit('chat', msg);
            };

            return { message, sendChat };
        }
    };</code></pre>
    </template>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-2 text-warning font-monospace small">{{ store.lang === "zh" ? "Socket.IO 客户端 API 参考" : "Socket.IO Client API Reference" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "方法/属性" : "Method/Prop" }}</th><th>{{ store.lang === "zh" ? "签名" : "Signature" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace py-2">ioClient(namespace)</td><td><code>(namespace?: string) =&gt; Socket</code></td><td>{{ store.lang === "zh" ? "连接到指定命名空间。不传参则连接默认命名空间；传入路径必须与后端 registerSocket 的路径一致。示例：ioClient('/plugin/my-plugin/live')" : "Connect to namespace. Default if no param; else must match backend registerSocket path. Example: ioClient('/plugin/my-plugin/live')" }}</td></tr>
    <tr><td class="font-monospace py-2">socket.on(event, callback)</td><td><code>(event: string, callback: Function) =&gt; void</code></td><td>{{ store.lang === "zh" ? "监听服务端事件。callback 参数为事件数据。" : "Listen for server-side events. callback param gets event data." }}</td></tr>
    <tr><td class="font-monospace py-2">socket.emit(event, data)</td><td><code>(event: string, data: any) =&gt; void</code></td><td>{{ store.lang === "zh" ? "向服务端发送事件。" : "Send events to the server." }}</td></tr>
    <tr><td class="font-monospace py-2">socket.disconnect()</td><td><code>() =&gt; void</code></td><td>{{ store.lang === "zh" ? "断开连接。组件卸载时应主动调用此方法清理资源。" : "Disconnect. Should be proactively called when component unmounts." }}</td></tr>
    <tr><td class="font-monospace py-2">socket.connected</td><td>boolean</td><td>{{ store.lang === "zh" ? "是否已连接。只读属性。" : "Whether connected. Read-only." }}</td></tr>
    <tr><td class="font-monospace py-2">socket.id</td><td>string</td><td>{{ store.lang === "zh" ? "Socket 连接 ID。只读属性。" : "Socket connection ID. Read-only property." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-lifecycle" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-danger bg-opacity-10 text-danger rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-solid fa-heart-pulse" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t('plugins.lifecycle') }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75">{{ store.lang === "zh" ? "加载、运行、销毁的完整流程" : "Full Lifecycle: Load, Run, Destroy" }}</p>
    </div>
    </div>
    <p class="text-muted mb-4 lh-lg">{{ store.lang === "zh" ? "插件从安装到卸载会经历多个生命周期阶段。理解这些阶段对于正确管理资源（尤其是清理操作）至关重要。" : "Plugins go through several lifecycle stages from installation to uninstallation. Understanding these stages is crucial for proper resource management." }}</p>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "阶段" : "Phase" }}</th><th>{{ store.lang === "zh" ? "触发条件" : "Trigger" }}</th><th>{{ store.lang === "zh" ? "系统行为" : "System Action" }}</th><th>{{ store.lang === "zh" ? "开发者需知" : "Developer Notice" }}</th></tr></thead>
    <tbody>
    <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "发现 (Discover)" : "Discover" }} </td><td> {{ store.lang === "zh" ? "面板启动或主动调用 discover()" : "Panel starts or discover() is called" }} </td><td> {{ store.lang === "zh" ? "扫描 plugins/ 目录，读取 plugin.json 并校验必须字段。检查持久化状态。" : "Scan plugins/ directory, read plugin.json in each subdirectory. Verify required fields. Check persistence state." }} </td><td> {{ store.lang === "zh" ? "确保 <code>plugin.json</code> 格式正确且包含必须字段。" : "Ensure <code>plugin.json</code> format is correct with required fields." }} </td></tr>
    <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "加载 (Load)" : "Load" }} </td><td> {{ store.lang === "zh" ? "插件已启用且面板启动，或用户手动启用" : "Plugin enabled and panel starts, or user enables manually" }} </td><td> {{ store.lang === "zh" ? "使用 <code>require()</code> 加载入口文件，创建 <code>api</code> 对象并调用入口函数。" : "Load entry via <code>require()</code>, create <code>api</code> object and call entry function." }} </td><td> {{ store.lang === "zh" ? "入口必须导出异步函数。可返回含 <code>destroy</code> 方法的对象。" : "Entry must export an async function. Can return an object with a <code>destroy</code> method." }} </td></tr>
    <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "运行 (Running)" : "Running" }} </td><td> {{ store.lang === "zh" ? "加载成功后" : "After successful loading" }} </td><td> {{ store.lang === "zh" ? "插件的 HTTP 路由、Socket 命名空间、侧边栏项和组件均已注册并可用。" : "HTTP routes, Sockets, Sidebar items, and Components are registered and available." }} </td><td> {{ store.lang === "zh" ? "正常提供服务。监听事件、处理请求。" : "Serving normally. Listening to events, handling requests." }} </td></tr>
    <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "卸载 (Unload)" : "Unload" }} </td><td> {{ store.lang === "zh" ? "用户禁用插件、更新插件或面板关闭时" : "User disables plugin, updates plugin, or panel closes" }} </td><td> {{ store.lang === "zh" ? "调用插件返回的 <code>destroy()</code> 方法，并清除 <code>require.cache</code> 缓存。" : "Call <code>destroy()</code> if exists. Clear <code>require.cache</code>." }} </td><td>{{ store.lang === "zh" ? "必须在 <code>destroy()</code> 中清理所有资源：关闭子进程、断开连接、清除定时器。" : "Must clean up all resources in <code>destroy()</code>: close processes, disconnect, clear timers." }}</td></tr>
    <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "启用 (Enable)" : "Enable" }} </td><td> {{ store.lang === "zh" ? "用户在插件管理点击“启用”" : "User clicks 'Enable' in plugin manager" }} </td><td> {{ store.lang === "zh" ? "持久化 <code>_enabled = true</code> 状态，然后触发 Load。" : "Persists <code>_enabled = true</code> state, then calls Load." }} </td><td> {{ store.lang === "zh" ? "无额外操作，系统自动加载。" : "No extra action, auto-loaded by system." }} </td></tr>
    <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "禁用 (Disable)" : "Disable" }} </td><td> {{ store.lang === "zh" ? "用户在插件管理点击“禁用”" : "User clicks 'Disable' in plugin manager" }} </td><td> {{ store.lang === "zh" ? "先触发 Unload，然后持久化 <code>_enabled = false</code> 状态。" : "Triggers Unload first, then persists <code>_enabled = false</code>." }} </td><td> {{ store.lang === "zh" ? "确保 <code>destroy()</code> 能够正确清理。" : "Ensure <code>destroy()</code> cleans up correctly." }} </td></tr>
    <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "安装 (Install)" : "Install" }} </td><td> {{ store.lang === "zh" ? "用户上传 ZIP" : "User uploads ZIP" }} </td><td> {{ store.lang === "zh" ? "解压到 plugins/[id]/，若有旧版则先卸载，重新扫描并自动加载。" : "Unzip to plugins/[id]/. Uninstall old version if exists. Rescan and auto-load." }} </td><td> {{ store.lang === "zh" ? "ZIP 包内可直接包含插件文件，或包含一层同名子目录。" : "ZIP can contain plugin files directly or in a subdirectory." }} </td></tr>
    <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "更新 (Update)" : "Update" }} </td><td> {{ store.lang === "zh" ? "用户上传同 ID 插件的 ZIP" : "User uploads ZIP with same ID" }} </td><td> {{ store.lang === "zh" ? "等同于覆盖安装：卸载旧版，清空目录，复制新文件，重新加载。" : "Same as installation: uninstall old, empty dir, copy new, reload." }} </td><td> {{ store.lang === "zh" ? "注意：更新时插件原目录被覆盖！请将持久化数据存放在 <code>api.getDataDir()</code> 中。" : "Warning: plugin dir is overwritten! Store persistent data in <code>api.getDataDir()</code>." }} </td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border">
    <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
    <span class="fw-bold">{{ store.lang === "zh" ? "生命周期管理最佳实践" : "Lifecycle Management Best Practices" }}</span>
    <span class="text-muted opacity-50">Javascript</span>
    </div>
    <template v-if="store.lang === 'zh'">
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>module.exports = async function(api) {
        let intervalId = null;
        let childProcess = null;
        const sockets = new Set();

        // 启动定时任务
        intervalId = setInterval(() => {
            api.logger.info('执行定时检查...');
        }, 60000);

        // 启动子进程
        // childProcess = require('child_process').spawn('some-command');

        // 注册 Socket 命名空间并追踪连接
        const ns = api.registerSocket('/live', {
            'join': (socket) => {
                sockets.add(socket);
                socket.on('disconnect', () => sockets.delete(socket));
            }
        });

        // 必须返回 destroy 方法，确保插件停用时资源被彻底清理
        return {
            destroy: async () => {
                // 1. 清除定时器
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }

                // 2. 终止子进程
                if (childProcess) {
                    childProcess.kill();
                    childProcess = null;
                }

                // 3. 断开所有活跃的 Socket 连接
                sockets.forEach(s => s.disconnect());
                sockets.clear();

                api.logger.info('所有资源已彻底清理');
            }
        };
    };</code></pre>
    </template>
    <template v-else>
    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>module.exports = async function(api) {
        let intervalId = null;
        let childProcess = null;
        const sockets = new Set();

        // Start periodic tasks
        intervalId = setInterval(() => {
            api.logger.info('Periodic check...');
        }, 60000);

        // Start child process
        // childProcess = require('child_process').spawn('some-command');

        // Register Socket namespace and track connections
        const ns = api.registerSocket('/live', {
            'join': (socket) => {
                sockets.add(socket);
                socket.on('disconnect', () => sockets.delete(socket));
            }
        });

        // Return destroy method to ensure resource cleanup
        return {
            destroy: async () => {
                // 1. Clear timers
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }

                // 2. Kill child process
                if (childProcess) {
                    childProcess.kill();
                    childProcess = null;
                }

                // 3. Disconnect all Socket connections
                sockets.forEach(s => s.disconnect());
                sockets.clear();

                api.logger.info('All resources cleaned up');
            }
        };
    };</code></pre>
    </template>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-panel-api" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px; background: rgba(236,72,153,0.1); color: #ec4899;">
    <i class="fa-solid fa-route" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ store.lang === "zh" ? "面板内置 API 端点参考" : "Panel Built-in API Endpoints Reference" }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75">{{ store.lang === "zh" ? "插件前端可直接调用的面板后端接口" : "Panel backend endpoints callable from plugin frontend" }}</p>
    </div>
    </div>
    <p class="text-muted mb-4 lh-lg">{{ store.lang === "zh" ? "插件前端通过 <code>api.get/post/put/delete</code> 调用面板内置 API。所有需要认证的接口已自动附加认证信息。带 <code>withInstance</code> 标记的接口会自动附加 <code>instanceId</code> 参数。插件后端路由前缀为 <code>/api/plugins/[插件ID]</code>。" : "Plugin frontend calls panel APIs via <code>api.get/post/put/delete</code>. Auth is auto-attached. Endpoints marked <code>withInstance</code> auto-attach <code>instanceId</code>. Plugin backend routes are prefixed with <code>/api/plugins/[PluginID]</code>." }}</p>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small" style="color: #ec4899;"><i class="fa-solid fa-server me-2"></i>{{ store.lang === "zh" ? "服务器控制" : "Server Control" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "端点" : "Endpoint" }}</th><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/server/status</td><td>{{ store.lang === "zh" ? "withInstance" : "withInstance" }}</td><td>{{ store.lang === "zh" ? "获取服务器运行状态。返回 <code>{ running: boolean, onlinePlayers: string[] }</code>" : "Get server status. Returns <code>{ running: boolean, onlinePlayers: string[] }</code>" }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/server/start</td><td>{{ store.lang === "zh" ? "withInstance" : "withInstance" }}</td><td>{{ store.lang === "zh" ? "启动服务器。" : "Start server." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/server/stop</td><td>{{ store.lang === "zh" ? "withInstance" : "withInstance" }}</td><td>{{ store.lang === "zh" ? "停止服务器。" : "Stop server." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/server/command</td><td>{{ store.lang === "zh" ? "withInstance, body: { command: string }" : "withInstance, body: { command: string }" }}</td><td>{{ store.lang === "zh" ? "发送服务器命令。示例：<code>await api.post('/api/server/command', { command: 'say Hello' })</code>" : "Send server command. Example: <code>await api.post('/api/server/command', { command: 'say Hello' })</code>" }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/server/icon</td><td>{{ store.lang === "zh" ? "withInstance" : "withInstance" }}</td><td>{{ store.lang === "zh" ? "获取服务器图标。" : "Get server icon." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small" style="color: #ec4899;"><i class="fa-solid fa-list me-2"></i>{{ store.lang === "zh" ? "玩家列表" : "Player Lists" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "端点" : "Endpoint" }}</th><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/lists/:type</td><td>{{ store.lang === "zh" ? "withInstance, :type 合法值：<code>'whitelist'</code>、<code>'ops'</code>、<code>'banned-players'</code>" : "withInstance, :type valid: <code>'whitelist'</code>, <code>'ops'</code>, <code>'banned-players'</code>" }}</td><td>{{ store.lang === "zh" ? "获取玩家列表。返回数组。" : "Get player list. Returns array." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/lists/:type</td><td>{{ store.lang === "zh" ? "withInstance, body: { action: 'add'|'remove', name: string }" : "withInstance, body: { action: 'add'|'remove', name: string }" }}</td><td>{{ store.lang === "zh" ? "修改玩家列表。" : "Modify player list." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small" style="color: #ec4899;"><i class="fa-solid fa-folder me-2"></i>{{ store.lang === "zh" ? "文件管理" : "File Management" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "端点" : "Endpoint" }}</th><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/files/list</td><td>{{ store.lang === "zh" ? "withInstance, query: { path: string }" : "withInstance, query: { path: string }" }}</td><td>{{ store.lang === "zh" ? "列出目录内容。" : "List directory contents." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/files/content</td><td>{{ store.lang === "zh" ? "withInstance, query: { path: string }" : "withInstance, query: { path: string }" }}</td><td>{{ store.lang === "zh" ? "读取文件文本内容。" : "Read file text content." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/files/save</td><td>{{ store.lang === "zh" ? "withInstance, body: { path: string, content: string }" : "withInstance, body: { path: string, content: string }" }}</td><td>{{ store.lang === "zh" ? "保存文件内容。" : "Save file content." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/files/mkdir</td><td>{{ store.lang === "zh" ? "withInstance, body: { path: string }" : "withInstance, body: { path: string }" }}</td><td>{{ store.lang === "zh" ? "创建目录。" : "Create directory." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/files/create</td><td>{{ store.lang === "zh" ? "withInstance, body: { path: string }" : "withInstance, body: { path: string }" }}</td><td>{{ store.lang === "zh" ? "创建空文件。" : "Create empty file." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/files/rename</td><td>{{ store.lang === "zh" ? "withInstance, body: { oldPath: string, newPath: string }" : "withInstance, body: { oldPath: string, newPath: string }" }}</td><td>{{ store.lang === "zh" ? "重命名/移动文件。" : "Rename/move file." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/files/operate</td><td>{{ store.lang === "zh" ? "withInstance, body: { action: 'delete'|'copy'|'move', paths: string[], target?: string }" : "withInstance, body: { action, paths, target }" }}</td><td>{{ store.lang === "zh" ? "批量文件操作。" : "Batch file operations." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/files/upload</td><td>{{ store.lang === "zh" ? "withInstance, FormData: files + path" : "withInstance, FormData: files + path" }}</td><td>{{ store.lang === "zh" ? "上传文件。" : "Upload files." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/files/download</td><td>{{ store.lang === "zh" ? "withInstance, query: { path: string }" : "withInstance, query: { path: string }" }}</td><td>{{ store.lang === "zh" ? "下载文件。" : "Download file." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small" style="color: #ec4899;"><i class="fa-solid fa-cubes me-2"></i>{{ store.lang === "zh" ? "实例管理" : "Instance Management" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "端点" : "Endpoint" }}</th><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/instances/list</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td><td>{{ store.lang === "zh" ? "获取所有实例列表。" : "Get all instances list." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/instances/create</td><td>{{ store.lang === "zh" ? "body: { id: string, name: string }" : "body: { id: string, name: string }" }}</td><td>{{ store.lang === "zh" ? "创建实例。" : "Create instance." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/instances/select</td><td>{{ store.lang === "zh" ? "body: { instanceId: string }" : "body: { instanceId: string }" }}</td><td>{{ store.lang === "zh" ? "选择当前管理的实例。" : "Select current instance." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/instances/rename</td><td>{{ store.lang === "zh" ? "body: { instanceId: string, name: string }" : "body: { instanceId, name }" }}</td><td>{{ store.lang === "zh" ? "重命名实例。" : "Rename instance." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/instances/delete</td><td>{{ store.lang === "zh" ? "body: { instanceId: string }" : "body: { instanceId }" }}</td><td>{{ store.lang === "zh" ? "删除实例。" : "Delete instance." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small" style="color: #ec4899;"><i class="fa-solid fa-gear me-2"></i>{{ store.lang === "zh" ? "面板配置" : "Panel Configuration" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "端点" : "Endpoint" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/panel/config</td><td>{{ store.lang === "zh" ? "获取面板配置。" : "Get panel config." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/panel/config</td><td>{{ store.lang === "zh" ? "保存面板配置。" : "Save panel config." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/panel/restart</td><td>{{ store.lang === "zh" ? "重启面板。" : "Restart panel." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/system/version</td><td>{{ store.lang === "zh" ? "获取面板版本号（无需认证）。" : "Get panel version (no auth required)." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/appearance/config</td><td>{{ store.lang === "zh" ? "获取外观配置。" : "Get appearance config." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/appearance/:type</td><td>{{ store.lang === "zh" ? "获取外观资源。:type 合法值：<code>'logo'</code>、<code>'background'</code>。" : "Get appearance resource. :type valid: <code>'logo'</code>, <code>'background'</code>." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small" style="color: #ec4899;"><i class="fa-solid fa-puzzle-piece me-2"></i>{{ store.lang === "zh" ? "插件系统" : "Plugin System" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "端点" : "Endpoint" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/plugins/list</td><td>{{ store.lang === "zh" ? "获取已安装插件列表。" : "Get installed plugins list." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/plugins/sidebar-items</td><td>{{ store.lang === "zh" ? "获取所有插件侧边栏项。" : "Get all plugin sidebar items." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/plugins/components</td><td>{{ store.lang === "zh" ? "获取所有插件组件映射。" : "Get all plugin component mappings." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/plugins/dashboard-cards</td><td>{{ store.lang === "zh" ? "获取仪表盘卡片列表。" : "Get dashboard cards list." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/plugins/translations</td><td>{{ store.lang === "zh" ? "获取所有插件翻译数据。" : "Get all plugin translations." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/plugins/:pluginId/manifest</td><td>{{ store.lang === "zh" ? "获取指定插件的 plugin.json。" : "Get plugin manifest." }}</td></tr>
    <tr><td class="font-monospace">GET</td><td class="font-monospace">/api/plugins/:pluginId/component/:name</td><td>{{ store.lang === "zh" ? "获取指定插件的组件文件。系统用于动态加载组件。" : "Get plugin component file. Used for dynamic loading." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/plugins/enable</td><td>{{ store.lang === "zh" ? "启用插件。body: { pluginId: string }" : "Enable plugin. body: { pluginId }" }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/plugins/disable</td><td>{{ store.lang === "zh" ? "禁用插件。body: { pluginId: string }" : "Disable plugin. body: { pluginId }" }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/plugins/upload</td><td>{{ store.lang === "zh" ? "上传安装插件。FormData: plugin (ZIP 文件)。" : "Upload and install plugin. FormData: plugin (ZIP file)." }}</td></tr>
    <tr><td class="font-monospace">POST</td><td class="font-monospace">/api/plugins/uninstall</td><td>{{ store.lang === "zh" ? "卸载插件。body: { pluginId: string }" : "Uninstall plugin. body: { pluginId }" }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-css" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px; background: rgba(245,158,11,0.1); color: #f59e0b;">
    <i class="fa-solid fa-palette" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ store.lang === "zh" ? "CSS 样式类参考" : "CSS Style Classes Reference" }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75">{{ store.lang === "zh" ? "面板预置的 CSS 工具类和组件样式" : "Panel preset CSS utility classes and component styles" }}</p>
    </div>
    </div>
    <p class="text-muted mb-4 lh-lg">{{ store.lang === "zh" ? "面板基于 Bootstrap 5 暗色主题构建，同时提供了一些自定义样式类。插件前端组件可直接使用这些类名。" : "Panel is built on Bootstrap 5 dark theme with custom style classes. Plugin components can use these directly." }}</p>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small" style="color: #f59e0b;"><i class="fa-solid fa-wand-magic-sparkles me-2"></i>{{ store.lang === "zh" ? "自定义工具类" : "Custom Utility Classes" }}</h6>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "类名" : "Class" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace py-2">.animate-in</td><td>{{ store.lang === "zh" ? "页面进入淡入动画。用于顶层容器。" : "Page enter fade-in animation. Use on top-level container." }}</td></tr>
    <tr><td class="font-monospace py-2">.animate-fade</td><td>{{ store.lang === "zh" ? "淡入动画变体。" : "Fade-in animation variant." }}</td></tr>
    <tr><td class="font-monospace py-2">.btn-back</td><td>{{ store.lang === "zh" ? "返回按钮样式。圆形半透明按钮，内含左箭头图标。用法：<code>&lt;button class='btn-back me-3' @click='...'&gt;&lt;i class='fa-solid fa-chevron-left'&gt;&lt;/i&gt;&lt;/button&gt;</code>" : "Back button style. Circular semi-transparent button with left arrow. Usage: <code>&lt;button class='btn-back'&gt;...&lt;/button&gt;</code>" }}</td></tr>
    <tr><td class="font-monospace py-2">.page-header</td><td>{{ store.lang === "zh" ? "页面顶部标题区域样式。提供底部间距和对齐。" : "Page header area style. Provides bottom spacing and alignment." }}</td></tr>
    <tr><td class="font-monospace py-2">.dev-code-block</td><td>{{ store.lang === "zh" ? "代码块样式。等宽字体、适当行高。" : "Code block style. Monospace font, proper line height." }}</td></tr>
    <tr><td class="font-monospace py-2">.log-info / .log-warn / .log-error / .log-system</td><td>{{ store.lang === "zh" ? "日志级别高亮样式。INFO=绿色、WARN=黄色、ERROR=红色、系统=蓝色。" : "Log level highlight. INFO=green, WARN=yellow, ERROR=red, system=blue." }}</td></tr>
    <tr><td class="font-monospace py-2">.no-scrollbar</td><td>{{ store.lang === "zh" ? "隐藏滚动条但保留滚动功能。" : "Hide scrollbar but keep scroll functionality." }}</td></tr>
    <tr><td class="font-monospace py-2">.tracking-tighter / .tracking-tight / .tracking-wider</td><td>{{ store.lang === "zh" ? "字间距调整。对应 letter-spacing 值。" : "Letter-spacing adjustments." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>

    <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold mb-3 small" style="color: #f59e0b;"><i class="fa-solid fa-paintbrush me-2"></i>{{ store.lang === "zh" ? "CSS 变量" : "CSS Variables" }}</h6>
    <p class="small text-muted mb-3">{{ store.lang === "zh" ? "面板定义了以下 CSS 变量，可用于自定义样式并自动适配暗色/亮色主题：" : "Panel defines these CSS variables, auto-adapting to dark/light themes:" }}</p>
    <div class="table-responsive">
    <table class="table table-sm dev-table mb-0 small text-muted">
    <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "变量" : "Variable" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
    <tbody>
    <tr><td class="font-monospace py-2">--c-surface</td><td>{{ store.lang === "zh" ? "主表面背景色。" : "Main surface background." }}</td></tr>
    <tr><td class="font-monospace py-2">--c-surface-elevated</td><td>{{ store.lang === "zh" ? "提升层表面背景色（卡片等）。" : "Elevated surface background (cards, etc.)." }}</td></tr>
    <tr><td class="font-monospace py-2">--c-border</td><td>{{ store.lang === "zh" ? "边框颜色。" : "Border color." }}</td></tr>
    <tr><td class="font-monospace py-2">--c-bg-base-rgb</td><td>{{ store.lang === "zh" ? "基础背景色的 RGB 值（用于 rgba）。" : "Base background RGB values (for rgba)." }}</td></tr>
    <tr><td class="font-monospace py-2">--app-sidebar-opacity</td><td>{{ store.lang === "zh" ? "侧边栏透明度。" : "Sidebar opacity." }}</td></tr>
    <tr><td class="font-monospace py-2">--app-content-opacity</td><td>{{ store.lang === "zh" ? "内容区透明度。" : "Content area opacity." }}</td></tr>
    <tr><td class="font-monospace py-2">--app-card-opacity</td><td>{{ store.lang === "zh" ? "卡片透明度。" : "Card opacity." }}</td></tr>
    <tr><td class="font-monospace py-2">--app-bg-image</td><td>{{ store.lang === "zh" ? "背景图片 URL。" : "Background image URL." }}</td></tr>
    </tbody>
    </table>
    </div>
    </div>
    </div>
    </section>

    <hr class="my-5 opacity-10">

    <section id="section-tips" class="doc-section mb-5">
    <div class="d-flex align-items-center mb-4">
    <div class="section-icon-box bg-success bg-opacity-10 text-success rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
    <i class="fa-solid fa-lightbulb" style="font-size: 1.5rem;"></i>
    </div>
    <div>
    <h3 class="fw-bold m-0 tracking-tight">{{ $t('plugins.tips') }}</h3>
    <p class="text-muted small m-0 mt-1 opacity-75"> FAQ, Best Practices & Safety </p>
    </div>
    </div>

    <div class="row g-4">
    <div class="col-md-6">
    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold text-success mb-3"><i class="fa-solid fa-check-circle me-2"></i> {{ store.lang === "zh" ? "最佳实践" : "Best Practices" }} </h6>
    <ul class="small text-muted mb-0 ps-3 lh-lg">
    <li>{{ store.lang === "zh" ? "使用 <code>api.getDataDir()</code> 存放插件私有数据，系统会自动创建目录" : "Use <code>api.getDataDir()</code> for private data; auto-created." }}</li>
    <li>{{ store.lang === "zh" ? "使用 <code>api.getGlobalDataDir()</code> 存放跨插件共享数据" : "Use <code>api.getGlobalDataDir()</code> for data shared across plugins." }}</li>
    <li>{{ store.lang === "zh" ? "所有 HTTP 路由自动附加认证中间件，无需手动验证" : "Auth middleware auto-attached to all HTTP routes." }}</li>
    <li>{{ store.lang === "zh" ? "组件卸载时必须断开 Socket（在 <code>onUnmounted</code> 中调用 <code>disconnect()</code>）" : "Always disconnect Socket connections on unmount (call <code>disconnect()</code> in <code>onUnmounted</code>)" }}</li>
    <li>{{ store.lang === "zh" ? "使用 <code>api.logger</code> 而非 <code>console.log</code>，便于日志溯源" : "Use <code>api.logger</code> instead of <code>console.log</code> for better log traceability" }}</li>
    <li>{{ store.lang === "zh" ? "返回 <code>destroy</code> 方法清理所有资源（定时器、进程、连接）" : "Return <code>destroy</code> to clean up all resources (timers, procs, conns)." }}</li>
    <li>{{ store.lang === "zh" ? "前端使用 <code>api.get/post/put/delete</code>，自动附加认证和实例 ID" : "Use <code>api.get/post/put/delete</code> on frontend; auth/instanceId auto-attached." }}</li>
    <li>{{ store.lang === "zh" ? "使用全局的 <code>$t()</code> 函数支持多语言" : "Use the global <code>$t()</code> function for multi-language support" }}</li>
    </ul>
    </div>
    </div>
    </div>
    <div class="col-md-6">
    <div class="card border-0 shadow-sm rounded-4 h-100" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
    <div class="card-body p-4">
    <h6 class="fw-bold text-danger mb-3"><i class="fa-solid fa-triangle-exclamation me-2"></i> {{ store.lang === "zh" ? "注意事项" : "Precautions" }} </h6>
    <ul class="small text-muted mb-0 ps-3 lh-lg">
    <li>{{ store.lang === "zh" ? "插件发布后请勿随意修改 ID，因为它是目录名和 API 路径的一部分" : "Once published, the plugin ID should not be changed, as it is part of the directory name and API path" }}</li>
    <li>{{ store.lang === "zh" ? "更新插件时整个目录会被覆盖，请将持久化数据存放在 <code>data</code> 目录内" : "Plugin directory overwritten on update. Store persistent data in <code>data</code> dir." }}</li>
    <li>{{ store.lang === "zh" ? "不要直接修改面板核心文件，仅通过 <code>api</code> 对象提供的接口操作" : "Do not modify core files; only use <code>api</code> interfaces." }}</li>
    <li>{{ store.lang === "zh" ? "前端组件必须使用 ES Module 格式（<code>export default</code>）" : "Frontend components must use the ES Module format (<code>export default</code>)" }}</li>
    <li>{{ store.lang === "zh" ? "后端入口必须导出函数（<code>module.exports = async function(api) {}</code>）" : "Backend entry must export a function (<code>module.exports = async function(api) {}</code>)." }}</li>
    <li>{{ store.lang === "zh" ? "Socket 命名空间路径为 <code>/plugin/[插件ID]/[自定义路径]</code>，前端需完整拼接" : "Socket namespace path: <code>/plugin/[PluginID]/[CustomPath]</code>. Use full path on frontend." }}</li>
    <li>{{ store.lang === "zh" ? "避免在全局作用域创建长连接或定时器，应在入口函数内创建并在 <code>destroy</code> 中清理" : "Avoid creating long connections or timers in global scope. Do it inside entry and clean up in <code>destroy</code>." }}</li>
    <li>{{ store.lang === "zh" ? "插件间不要直接通信，应通过全局 Socket 事件或共享数据目录间接交互" : "Do not communicate directly between plugins. Use global Socket events or shared data directory." }}</li>
    </ul>
    </div>
    </div>
    </div>
    </div>
    </section>
    </div>
    </div>
    </div>
    </div>
    `,
    setup() {
        const activeSection = ref('intro');
        const scrollContainer = ref(null);

        const toc =[
            { id: "intro", title: store.lang === "zh" ? "快速开始" : "Quick Start", icon: "fa-rocket" },
            { id: "manifest", title: store.lang === "zh" ? "plugin.json 参考" : "plugin.json Reference", icon: "fa-file-code" },
            { id: "dependencies", title: store.lang === "zh" ? "NPM 依赖管理" : "NPM Dependencies", icon: "fa-brands fa-npm" },
            { id: "backend", title: store.lang === "zh" ? "后端开发与 API" : "Backend & API", icon: "fa-server" },
            { id: "frontend", title: store.lang === "zh" ? "前端开发" : "Frontend Development", icon: "fa-display" },
            { id: "vue-options", title: store.lang === "zh" ? "Vue 组件选项与内置组件" : "Vue Options & Components", icon: "fa-cubes" },
            { id: "i18n", title: store.lang === "zh" ? "国际化 (i18n)" : "Internationalization", icon: "fa-globe" },
            { id: "socket", title: store.lang === "zh" ? "Socket.IO 通信" : "Socket.IO Communication", icon: "fa-plug" },
            { id: "lifecycle", title: store.lang === "zh" ? "插件生命周期" : "Plugin Lifecycle", icon: "fa-heart-pulse" },
            { id: "panel-api", title: store.lang === "zh" ? "面板内置 API 端点" : "Panel API Endpoints", icon: "fa-route" },
            { id: "css", title: store.lang === "zh" ? "CSS 样式类参考" : "CSS Style Reference", icon: "fa-palette" },
            { id: "tips", title: store.lang === "zh" ? "开发技巧" : "Development Tips", icon: "fa-lightbulb" }
        ];

        const scrollToSection = (sectionId) => {
            activeSection.value = sectionId;
            const el = document.getElementById('section-' + sectionId);
            const scrollTarget = document.getElementById('guide-content-scroll');
            if (!el || !scrollTarget) return;

            // Find the actual scrollable container (the one with overflow-auto)
            const container = scrollTarget.closest('.overflow-auto');

            if (el && container) {
                const containerRect = container.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                // Formula: currentScroll + (elementTopRelativeToViewport - containerTopRelativeToViewport) - offset
                const targetTop = container.scrollTop + (elRect.top - containerRect.top) - 20;

                container.scrollTo({
                    top: targetTop,
                    behavior: 'smooth'
                });
            }
        };

        const handleScroll = () => {
            const scrollTarget = document.getElementById('guide-content-scroll');
            const container = scrollTarget?.closest('.overflow-auto');
            if (!container) return;

            const sections = document.querySelectorAll('.doc-section');
            const containerRect = container.getBoundingClientRect();

            let current = 'intro';
            for (const section of sections) {
                const rect = section.getBoundingClientRect();
                // Check if the section top has reached the container top (with 100px buffer)
                if (rect.top - containerRect.top <= 100) {
                    current = section.id.replace('section-', '');
                }
            }
            activeSection.value = current;
        };

        onMounted(() => {
            setTimeout(() => {
                const scrollTarget = document.getElementById('guide-content-scroll');
                const container = scrollTarget?.closest('.overflow-auto');
                if (container) {
                    container.addEventListener('scroll', handleScroll);
                }
            }, 500);
        });

        onUnmounted(() => {
            const scrollTarget = document.getElementById('guide-content-scroll');
            const container = scrollTarget?.closest('.overflow-auto');
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        });

        return { toc, activeSection, scrollToSection, handleScroll, store };
    }
};
