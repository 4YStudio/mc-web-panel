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
                                        <span class="fw-bold">Directory Structure</span>
                                        <span class="text-muted opacity-50">Tree</span>
                                    </div>
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>my-plugin/
├── plugin.json       # {{ store.lang === "zh" ? "核心清单文件 (必须)" : "Core manifest file (Required)" }}
├── index.js          # {{ store.lang === "zh" ? "后端逻辑入口 (可选)" : "Backend entry (Optional)" }}
├── component/        # Frontend components directory (Optional)
│   └── Main.js       # {{ store.lang === "zh" ? "前端 Vue 组件" : "Frontend Vue component" }}
└── data/             # {{ store.lang === "zh" ? "插件私有数据 (自动创建)" : "Plugin private data (Auto-created)" }}
    └── ...           # {{ store.lang === "zh" ? "运行时生成的数据文件" : "Runtime generated data files" }}</code></pre>
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
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Antigravity",
  "description": "An example plugin",
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
                                            <tr><td class="text-info font-monospace py-2">id</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "插件唯一标识符。只能包含小写字母、数字、连字符和下划线。" : "Unique plugin identifier. Can only contain lowercase letters, numbers, hyphens and underscores." }}</td></tr>
                                            <tr><td class="text-info font-monospace py-2">name</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "插件显示名称。" : "Plugin display name." }}</td></tr>
                                            <tr><td class="text-info font-monospace py-2">version</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "版本号，如 1.0.0。" : "Version number, e.g., 1.0.0." }}</td></tr>
                                            <tr><td class="text-info font-monospace py-2">description</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "功能描述。" : "Function description." }}</td></tr>
                                            <tr><td class="text-info font-monospace py-2">author</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "作者信息。" : "Author info." }}</td></tr>
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
                                            <li>{{ store.lang === "zh" ? "支持 <code>pnpm</code> 和 <code>npm</code> 自动回退" : "Supports <code>pnpm</code> and <code>npm</code> auto-fallback" }}</li>
                                            <li>{{ store.lang === "zh" ? "内置国内镜像源轮询，确保安装成功率" : "Built-in mirror source polling" }}</li>
                                            <li>{{ store.lang === "zh" ? "依赖物理隔离，各插件互不干扰" : "Physical dependency isolation" }}</li>
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
                                <span class="fw-bold">Entry Function Signature</span>
                                <span class="text-muted opacity-50">Javascript</span>
                            </div>
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>// index.js — Plugin Backend Entry
module.exports = async function(api) {
    // api object contains all following properties and methods
    
    // Optional: Returns an object containing a destroy method' : 'Optional: Return an object containing a destroy method' }}
    // {{ store.lang === "zh" ? "当插件被禁用或卸载时，destroy() 会被自动调用" : "destroy() is called automatically when the plugin is disabled or uninstalled" }}
    return {
        destroy: async () => {
            // Clean up resources: close processes, disconnect, clear timers, etc.' : 'Clean up resources: close processes, disconnect, clear timers, etc.' }}
        }
    };
};</code></pre>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info me-2 text-info"></i>{{ store.lang === "zh" ? "api 对象只读属性" : "api Object Read-only Properties" }}</h5>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead>
                                            <tr class="text-white opacity-75 border-bottom">
                                                <th>Property</th>
                                                <th>{{ store.lang === "zh" ? "类型" : "Type" }}</th>
                                                <th>{{ store.lang === "zh" ? "说明" : "Description" }}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="text-info font-monospace py-2">api.id</td><td>string</td><td>Plugin ID, matches id in plugin.json.</td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.manifest</td><td>object</td><td>{{ store.lang === "zh" ? "完整的 plugin.json 清单对象。包含所有清单字段以及系统追加的内部字段：_dir (string) 插件绝对路径；_enabled (boolean) 是否启用；_installed (boolean) 是否已安装。" : "Complete plugin.json. Includes _dir, _enabled, _installed." }}</td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.io</td><td>SocketIO.Server</td><td>Panel Socket.IO server instance. Can be used for global broadcasting.</td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.context</td><td>object</td><td>Context object injected by the panel, containing runtime environment info.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="code-block-wrapper rounded-4 overflow-hidden border mb-4">
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>// index.js — Plugin Backend Entry
module.exports = async function(api) {
    // api object contains all properties and methods
    
    // Optional: Returns an object containing a destroy method
    // destroy() is called when plugin is disabled/uninstalled
    return {
        destroy: async () => {
            // Clean up: processes, connections, timers, etc.
        }
    };
};</code></pre>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info me-2 text-info"></i>api Object Read-only Properties</h5>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead>
                                            <tr class="text-white opacity-75 border-bottom"><th>属性</th><th>Type</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="text-info font-monospace py-2">api.id</td><td>string</td><td>{{ store.lang === "zh" ? "插件 ID，与 plugin.json 中的 <code>id</code> 一致。例如：<code>\'my-plugin\'</code>" : "Plugin ID, matches plugin.json. Example: <code>\'my-plugin\'</code>" }}</td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.manifest</td><td>object</td><td>{{ store.lang === "zh" ? "完整的 plugin.json 清单对象。包含所有清单字段以及系统追加的内部字段：<code>_dir</code> (string) 插件绝对路径；<code>_enabled</code> (boolean) 是否启用；<code>_installed</code> (boolean) 是否已安装（始终为 true）。" : "Complete plugin.json manifest. Includes all fields plus internal fields: <code>_dir</code> (string) absolute path; <code>_enabled</code> (boolean); <code>_installed</code> (boolean) (always true)." }}</td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.io</td><td>SocketIO.Server</td><td>Panel Socket.IO server instance. Use <code>api.io.emit('event', data)</code> for global broadcast. Namespace: <code>/plugin/[PluginID]/[CustomPath]</code>. Methods: <code>emit</code>, <code>of(namespace)</code>.</td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.context</td><td>object</td><td>{{ store.lang === "zh" ? "面板注入的上下文对象，包含运行时环境信息（详见下方 context 章节）。" : "Injected context with runtime info (see below)." }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-box-open me-2 text-info"></i>{{ store.lang === "zh" ? "api.context 上下文对象" : "api.context Context Object" }}</h5>
                        <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "通过 <code>api.context</code> 访问，也可以直接解构：<code>const { instancesDir, baseDir } = api.context;</code>。以下为所有可用字段：" : "Access via <code>api.context</code> or destructuring. Fields:" }}</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead>
                                            <tr class="text-white opacity-75 border-bottom">{{ store.lang === "zh" ? "字段" : "Field" }}<th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">instancesDir</td><td>string</td><td>{{ store.lang === "zh" ? "所有 MC 实例的根目录绝对路径。例如：<code>\'/opt/mc-panel/instances\'</code>。每个实例的目录名为实例 ID，如 <code>\'default\'</code>、<code>\'survival\'</code>。" : "Absolute path to instances root. Each dir is instance ID." }}</td></tr>
                                            <tr><td class="font-monospace py-2">baseDir</td><td>string</td><td>Absolute path to panel base directory. Example: <code>"/opt/mc-panel"</code>. Root workspace.</td></tr>
                                            <tr><td class="font-monospace py-2">dataDir</td><td>string</td><td>{{ store.lang === "zh" ? "面板数据目录绝对路径。例如：<code>\'/opt/mc-panel/data\'</code>。存放配置文件（如 <code>instances.json</code>、<code>app-config.json</code>）、Java 安装等。" : "Absolute path to panel data. Stores configs, Java, etc." }}</td></tr>
                                            <tr><td class="font-monospace py-2">globalBackupDir</td><td>string</td><td>{{ store.lang === "zh" ? "全局备份目录绝对路径。例如：<code>\'/opt/mc-panel/data/backups/global\'</code>。用于存放跨实例的全局备份 ZIP 文件。" : "Absolute path to global backups." }}</td></tr>
                                            <tr><td class="font-monospace py-2">pluginsDir</td><td>string</td><td>Absolute path to plugins install dir. Example: <code>"/opt/mc-panel/plugins"</code>.</td></tr>
                                            <tr><td class="font-monospace py-2">getConfig</td><td>function</td><td>Function to get panel config. Usage: <code>api.context.getConfig()</code>. See <code>api.getConfig()</code> for return details.</td></tr>
                                            <tr><td class="font-monospace py-2">instancesState</td><td>Map&lt;string, object&gt;</td><td>{{ store.lang === "zh" ? "所有实例的运行时状态 Map。键为实例 ID (string)，值为实例状态对象，包含以下字段：<code>process</code> (ChildProcess|null) MC 服务器进程；<code>logHistory</code> (string[]) 控制台日志历史；<code>onlinePlayers</code> (Set&lt;string&gt;) 在线玩家集合；<code>detectedVersion</code> (object) 检测到的版本信息 <code>{ mc: string, loader: string }</code>。使用示例：<code>const state = instancesState.get('default');</code>" : "Map of instance states. Contains process, logs, players, version." }}</td></tr>
                                            <tr><td class="font-monospace py-2">appendLog</td><td>function</td><td>{{ store.lang === "zh" ? "向实例控制台追加日志的函数。签名：<code>appendLog(instanceId: string, message: string)</code>。<code>instanceId</code> 为目标实例 ID；<code>message</code> 为日志文本（通常以 <code>\\n</code> 结尾）。使用示例：<code>appendLog('default', '[系统] 插件操作完成\\n');</code>" : "Append logs to instance. Example: <code>appendLog('default', '[System] Done\\n');</code>" }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-code me-2 text-info"></i>{{ store.lang === "zh" ? "api 方法完整参考" : "Full api Method Reference" }}</h5>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerRoutes(prefix, setupFn)</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册 HTTP API 路由。所有路由自动添加认证中间件，最终路径为 <code>/api/plugins/[插件ID][prefix]</code>。" : "注册 HTTP API 路由。所有路由自动添加认证中间件，最终路径为 <code>/api/plugins/[插件ID][prefix]</code>。" }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Param</th><th>Type</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">prefix</td><td>string</td><td class="text-danger">Yes</td><td>{{ store.lang === "zh" ? "路由前缀。建议以 <code>/</code> 开头。最终路径 = <code>/api/plugins/[插件ID]</code> + <code>prefix</code>。示例：<code>\'/\'</code> → <code>/api/plugins/my-plugin/</code>；<code>\'/api\'</code> → <code>/api/plugins/my-plugin/api</code>。如果 prefix 不以 <code>/</code> 开头，系统会自动补全。" : "Route prefix. Recommended starts with <code>/</code>. Final = <code>/api/plugins/[PluginID]</code> + <code>prefix</code>. Auto-completed if missing <code>/</code>." }}</td></tr>
                                            <tr><td class="font-monospace">setupFn</td><td>express.Router | function</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>两种形式：<br>1. <strong>express.Router 实例</strong>（推荐）：直接传入已配置好路由的 Router 对象。<br>2. <strong>无参函数</strong>：传入一个无参函数，函数内部创建并返回 Router 对象。系统会自动调用该函数获取 Router。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
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
{{ store.lang === "zh" ? "// 前端调用：GET /api/plugins/my-plugin/api/status" : "// Frontend call: GET /api/plugins/my-plugin/api/status" }}

// File upload (requires multer)
const upload = multer({ dest: path.join(DATA_DIR, 'tmp_uploads') });
router.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    res.json({ success: true, filename: file.originalname });
});

// Streaming download
router.get('/download', (req, res) => {
    const filePath = '/path/to/file';
    res.download(filePath);
});</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerPublicRoutes(prefix, setupFn)</h6>
                                <p class="small text-muted mb-2">Register <strong>public</strong> HTTP API routes. These do <strong>not</strong> require authentication, suitable for external integrations or scripts. Final path: <code>/api/public/plugins/[PluginID][prefix]</code>.</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">prefix</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>路由前缀。最终路径 = <code>/api/public/plugins/[插件ID]</code> + <code>prefix</code>。</td></tr>
                                            <tr><td class="font-monospace">setupFn</td><td>express.Router | function</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>同 <code>registerRoutes</code>。建议在此路由中自行实现 API Key 等安全验证。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const router = express.Router();
router.get('/status', (req, res) => {
    // External call: GET /api/public/plugins/my-plugin/status
    res.json({ online: true, version: '1.0.0' });
});
api.registerPublicRoutes('/', router);</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerSocket(namespace, handlers)</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册 WebSocket 命名空间和事件处理器。返回 Socket.IO Namespace 实例。命名空间路径为 <code>/plugin/[插件ID][namespace]</code>。" : "注册 WebSocket 命名空间和事件处理器。返回 Socket.IO Namespace 实例。命名空间路径为 <code>/plugin/[插件ID][namespace]</code>。" }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Param</th><th>Type</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">namespace</td><td>string</td><td class="text-danger">Yes</td><td>{{ store.lang === "zh" ? "命名空间路径。建议以 <code>/</code> 开头。最终路径 = <code>/plugin/[插件ID]</code> + <code>namespace</code>。示例：<code>\'/live\'</code> → <code>/plugin/my-plugin/live</code>。" : "Namespace path. Recommended starts with <code>/</code>. Final = <code>/plugin/[PluginID]</code> + <code>namespace</code>. Example: <code>\'/live\'</code>." }}</td></tr>
                                            <tr><td class="font-monospace">handlers</td><td>object</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>事件处理器映射对象。键为事件名称 (string)，值为处理函数。函数签名：<code>(socket, ...args) => void</code>。<code>socket</code> 为 Socket.IO Socket 实例；<code>...args</code> 为客户端发送的数据参数。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "<strong>返回值</strong>：Socket.IO Namespace 实例。可用于向该命名空间的所有客户端广播：<code>ns.emit('event', data)</code>。" : "<strong>Returns</strong>: Socket.IO Namespace instance. Use <code>ns.emit('event', data)</code> to broadcast." }}</p>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const ns = api.registerSocket('/live', {
    'chat': (socket, message) => {
        api.logger.info('Received chat:', message);
        ns.emit('chat_response', { echo: message });
        socket.emit('chat_response', { echo: message });
    },
    'join_room': (socket, roomId) => {
        socket.join(roomId);
        socket.emit('joined', { roomId });
    }
});

// Backend broadcast example
ns.emit('notification', { msg: store.lang === 'zh' ? '系统维护通知' : 'System Notification' });

// Frontend connection:
// const socket = io('/plugin/my-plugin/live');
// socket.on('chat_response', (data) => console.log(data));
// socket.emit('chat', 'Hello!');</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerSidebarItem(item)</h6>
                                <p class="small text-muted mb-2">Register frontend sidebar navigation item. Appears in different locations based on <code>location</code>.</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数字段" : "Field" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">item.id</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>侧边栏项唯一标识符。建议格式：<code>"[插件ID]-[功能名]"</code>。示例：<code>"backup-manager"</code>、<code>"frp-manager"</code></td></tr>
                                            <tr><td class="font-monospace">item.labelKey</td><td>string</td><td class="text-danger">Yes</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "显示文本的 i18n 翻译键。系统通过 <code>$t(item.labelKey)</code> 翻译显示。如翻译键不存在则直接显示键名。示例：<code>\'plugins.my-plugin.title\'</code>、<code>\'sidebar.frp_manager\'</code>" : "i18n translation key. Translated via <code>$t(item.labelKey)</code>. Examples: <code>\'plugins.my-plugin.title\'</code>." }}</td></tr>
                                            <tr><td class="font-monospace">item.icon</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>FontAwesome 6 Free solid icon class (without <code>fa-solid</code> prefix). Valid values match plugin.json icon field.</td></tr>
                                            <tr><td class="font-monospace">item.color</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>图标颜色。支持 CSS 颜色关键字或 HEX 值。示例：<code>"#f1c40f"</code>、<code>"primary"</code></td></tr>
                                            <tr><td class="font-monospace">item.view</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>View name. Sets <code>store.view</code> on click. <strong>Must match registerComponent name parameter</strong>. Suggested: <code>"plugin-[PluginID]-[FeatureName]"</code> or PascalCase like <code>"FrpManager"</code></td></tr>
                                            <tr><td class="font-monospace">item.location</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"instance"</code></td><td>侧边栏项显示位置。合法取值：<br><code>"instance"</code>（默认）— 显示在实例侧边栏中，仅在管理某个实例时可见；<br><code>"global"</code> — 显示在实例管理器页面的下拉菜单中，无需选择实例即可访问；<br><code>"both"</code> — 同时显示在实例侧边栏和全局下拉菜单中。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
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
});

// Display in both places
api.registerSidebarItem({
    id: 'my-tool',
    labelKey: 'sidebar.my_tool',
    icon: 'fa-wrench',
    color: '#22c55e',
    view: 'my-tool-view',
    location: 'both'
});</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerComponent(name, componentPath)</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "注册前端 Vue 组件。系统会自动通过动态 import 加载组件文件并注册为全局组件。" : "Register frontend Vue component. System loads via dynamic import." }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Param</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">name</td><td>string</td><td class="text-danger">Yes</td><td>{{ store.lang === "zh" ? "组件注册名称。<strong>必须与 registerSidebarItem 的 view 值一致</strong>，否则点击侧边栏无法渲染组件。命名建议：<code>\'plugin-[插件ID]-main\'</code> 或 PascalCase 如 <code>\'FrpManager\'</code>。示例：<code>\'plugin-mc-panel-plugin-backup-main\'</code>、<code>\'FrpManager\'</code>" : "Component registration name. <strong>Must match registerSidebarItem view</strong>. Suggested: <code>\'plugin-[PluginID]-main\'</code>." }}</td></tr>
                                            <tr><td class="font-monospace">componentPath</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>组件文件路径，相对于插件根目录。该文件必须是一个 ES Module，导出 Vue 3 组件选项对象（含 <code>template</code> 和 <code>setup</code>）。示例：<code>"component/Main.js"</code>、<code>"frontend/FrpManager.js"</code></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "<strong>组件加载机制</strong>：系统通过 <code>/api/plugins/[插件ID]/component/[组件名]</code> 端点提供组件文件服务，前端使用 <code>import()</code> 动态加载。组件必须使用 <code>export default</code> 导出。" : "<strong>组件加载机制</strong>：系统通过 <code>/api/plugins/[插件ID]/component/[组件名]</code> 端点提供组件文件服务，前端使用 <code>import()</code> 动态加载。组件必须使用 <code>export default</code> 导出。" }}</p>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>api.registerComponent('plugin-my-plugin-main', 'component/Main.js');
// Component file component/Main.js must use export default:
// export default { template: '...', setup() { ... } }</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerDashboardCard(name, componentName)</h6>
                                <p class="small text-muted mb-2">Register dashboard visualization cards. Cards appear at the top of the instance list page, suitable for global system status or summary data.</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Param</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">name</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>卡片唯一标识名。示例：<code>"CPUStatus"</code>、<code>"MemoryUsage"</code></td></tr>
                                            <tr><td class="font-monospace">componentName</td><td>string</td><td class="text-danger">{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>关联的 Vue 组件名称。<strong>必须已经通过 registerComponent 注册</strong>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 1. Register component first
api.registerComponent('SystemStatusCard', 'component/SystemStatusCard.js');

// 2. Mount component to dashboard card slot
api.registerDashboardCard('GlobalStatus', 'SystemStatusCard');</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.getDataDir()</h6>
                                <p class="small text-muted mb-2">Get plugin private data directory path. Created automatically if missing.</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Item</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
                                            <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>string — Absolute path to plugin private data dir. Format: <code>[PluginDir]/data</code>. Example: <code>"/opt/mc-panel/plugins/my-plugin/data"</code></td></tr>
                                            <tr><td>{{ store.lang === "zh" ? "副作用" : "Side Effects" }}</td><td>如果目录不存在，会自动调用 <code>fs.ensureDirSync()</code> 创建</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const dataDir = api.getDataDir();
const configPath = path.join(dataDir, 'config.json');
await fs.writeJson(configPath, { setting: 'value' }, { spaces: 2 });</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.getGlobalDataDir()</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取面板全局数据目录路径。适合存放跨插件共享或需要持久化的数据。" : "获取面板全局数据目录路径。适合存放跨插件共享或需要持久化的数据。" }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Item</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>None</td></tr>
                                            <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>string — 面板全局数据目录绝对路径。路径格式：<code>[baseDir]/data</code>。例如：<code>"/opt/mc-panel/data"</code>。如果 <code>baseDir</code> 未配置，则回退到 <code>api.getDataDir()</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const globalDir = api.getGlobalDataDir();
const myDataDir = path.join(globalDir, 'my-plugin');
await fs.ensureDir(myDataDir);</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.getInstancesDir()</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取 MC 实例根目录路径。等同于 <code>api.context.instancesDir</code>。" : "获取 MC 实例根目录路径。等同于 <code>api.context.instancesDir</code>。" }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Item</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
                                            <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>{{ store.lang === "zh" ? "string — 实例根目录绝对路径。例如：<code>\'/opt/mc-panel/instances\'</code>。" : "string — Absolute path to instances root dir. Example: <code>\'/opt/mc-panel/instances\'</code>." }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.getBaseDir()</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "获取面板基础目录路径。等同于 <code>api.context.baseDir</code>。" : "获取面板基础目录路径。等同于 <code>api.context.baseDir</code>。" }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "项目" : "Item" }}</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
                                            <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>string — 面板基础目录绝对路径。例如：<code>"/opt/mc-panel"</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.getConfig()</h6>
                                <p class="small text-muted mb-2">Get panel configuration object. Returns full current configuration including runtime parameters.</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Item</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td>{{ store.lang === "zh" ? "参数" : "Params" }}</td><td>{{ store.lang === "zh" ? "无" : "None" }}</td></tr>
                                            <tr><td>{{ store.lang === "zh" ? "返回值" : "Returns" }}</td><td>{{ store.lang === "zh" ? "object — 面板配置对象（详见下方字段说明）" : "object — Panel config object (see field details below)" }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <h6 class="fw-bold mb-2 small text-muted">{{ store.lang === "zh" ? "返回对象字段" : "Return Object Fields" }}</h6>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom">{{ store.lang === "zh" ? "字段" : "Field" }}<th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">isSetup</td><td>boolean</td><td>{{ store.lang === "zh" ? "面板是否已完成初始设置（2FA 配置）。" : "Whether panel setup (2FA) is complete." }}</td></tr>
                                            <tr><td class="font-monospace py-2">sessionSecret</td><td>string</td><td>Session encryption secret.</td></tr>
                                            <tr><td class="font-monospace py-2">sessionTimeout</td><td>number</td><td>{{ store.lang === "zh" ? "会话超时时间（天数）。" : "Session timeout (days)." }}</td></tr>
                                            <tr><td class="font-monospace py-2">githubProxy</td><td>string</td><td>GitHub proxy. Empty means none. Example: <code>"https://mirror.example.com"</code></td></tr>
                                            <tr><td class="font-monospace py-2">modrinthApi</td><td>string</td><td>Modrinth API base URL. Default: <code>"https://api.modrinth.com/v2"</code></td></tr>
                                            <tr><td class="font-monospace py-2">port</td><td>number</td><td>Panel listening port. Default: <code>3000</code></td></tr>
                                            <tr><td class="font-monospace py-2">consoleInfoPosition</td><td>string</td><td>{{ store.lang === "zh" ? "控制台信息面板位置。合法取值：<code>\'top\'</code>、<code>\'sidebar\'</code>、<code>\'hide\'</code>。" : "Console info position. Values: <code>\'top\'</code>, <code>\'sidebar\'</code>, <code>\'hide\'</code>." }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>const config = api.getConfig();
if (config.githubProxy) {
    const proxiedUrl = originalUrl.replace('https://github.com', config.githubProxy);
}</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.logger</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "插件专用日志记录器。所有输出自动添加 <code>[Plugin:插件名]</code> 前缀，便于在面板日志中区分来源。" : "Plugin-specific logger. Automatically prefixes <code>[Plugin:PluginName]</code> for easy tracing." }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "方法" : "Method" }}</th><th>{{ store.lang === "zh" ? "签名" : "Signature" }}</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">api.logger.info</td><td><code>(...args: any[]) => void</code></td><td>Output info level log. Format: <code>[Plugin:PluginName] Message</code></td></tr>
                                            <tr><td class="font-monospace py-2">api.logger.warn</td><td><code>(...args: any[]) => void</code></td><td>{{ store.lang === "zh" ? "输出警告级别日志。" : "Output warning level logs." }}</td></tr>
                                            <tr><td class="font-monospace py-2">api.logger.error</td><td><code>(...args: any[]) => void</code></td><td>Output error level log.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>api.logger.info('Plugin initialized successfully');
// Output: [Plugin:MyPlugin] Plugin initialized successfully

api.logger.warn('Configuration not found, using defaults');
api.logger.error('Failed to connect:', error.message);</code></pre>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-code me-2 text-info"></i>{{ store.lang === "zh" ? "后端完整示例" : "Full Backend Example" }}</h5>
                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border">
                            <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                <span class="fw-bold">{{ store.lang === "zh" ? "index.js — 完整后端示例" : "index.js — Full Backend Example" }}</span>
                                <span class="text-muted opacity-50">Javascript</span>
                            </div>
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
        catch (e) { return { items: [] }; }
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
                                <p class="text-muted small m-0 mt-1 opacity-75">Build plugin interface using Vue 3</p>
                            </div>
                        </div>
                        <p class="text-muted mb-4 lh-lg">{{ store.lang === "zh" ? "插件前端使用 Vue 3 组件（ES Module 格式），通过 <code>api.registerComponent()</code> 注册后，系统会自动动态加载。组件文件必须使用 <code>export default</code> 导出组件选项对象。" : "Frontend uses Vue 3 components (ES Module). Registered via <code>api.registerComponent()</code>, auto-loaded dynamically. Must use <code>export default</code>." }}</p>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-puzzle-piece me-2 text-success"></i> {{ store.lang === "zh" ? "可用导入模块" : "Available Imports" }} </h5>
                        <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "以下是插件前端组件中可以使用的所有导入：" : "The following imports are available in frontend components:" }}</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "导入语句" : "Import Statement" }}</th><th>Source</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">import { ref, reactive, computed, onMounted, onUnmounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js'</td><td>Vue 3</td><td>{{ store.lang === "zh" ? "Vue 3 Composition API。可用导出：<code>ref</code>、<code>reactive</code>、<code>computed</code>、<code>watch</code>、<code>watchEffect</code>、<code>onMounted</code>、<code>onUnmounted</code>、<code>onBeforeUnmount</code>、<code>nextTick</code>、<code>getCurrentInstance</code> 等 Vue 3 Composition API 全部导出。" : "Vue 3 Composition API. Available exports: <code>ref</code>, <code>reactive</code>, <code>computed</code>, <code>watch</code>, etc." }}</td></tr>
                                            <tr><td class="font-monospace py-2">import { store } from '/js/store.js'</td><td>{{ store.lang === "zh" ? "面板" : "Panel" }}</td><td>Global reactive state. Vue 3 <code>reactive()</code> object. All properties are reactive. See store reference table below.</td></tr>
                                            <tr><td class="font-monospace py-2">import { api } from '/js/api.js'</td><td>{{ store.lang === "zh" ? "面板" : "Panel" }}</td><td>Authenticated API requests based on axios. Automatically attaches <code>instanceId</code>. See api reference table below.</td></tr>
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
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-database me-2 text-success"></i> {{ store.lang === "zh" ? "store 全局状态完整参考" : "Full store Global State Reference" }} </h5>
                        <p class="text-muted mb-3 small">{{ store.lang === "zh" ? "通过 <code>import { store } from '/js/store.js'</code> 导入。Vue 3 reactive 对象，所有属性响应式。可直接读取和修改。" : "Imported via <code>import { store } from '/js/store.js'</code>. Vue 3 reactive object, all properties are reactive. Can be directly read and modified." }}</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead>
                                            <tr class="text-white opacity-75 border-bottom"><th>Property</th><th>Type</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="text-success font-monospace py-2">store.auth</td><td>object</td><td>{{ store.lang === "zh" ? "认证状态对象，包含以下字段：<br><code>loggedIn</code> (boolean) 是否已登录；<code>isSetup</code> (boolean) 是否完成 2FA 设置；<code>qrCode</code> (string) 二维码 Data URL（仅设置阶段有值）；<code>secret</code> (string) 2FA 密钥（仅设置阶段有值）；<code>token</code> (string) 验证码。" : "Auth state object. Fields: <br><code>loggedIn</code> (boolean); <code>isSetup</code> (boolean) 2FA setup; <code>qrCode</code> (string) QR Data URL; <code>secret</code> (string) 2FA secret; <code>token</code> (string)." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.isSetup</td><td>boolean</td><td>{{ store.lang === "zh" ? "面板是否已完成初始设置。" : "Whether the panel setup is complete." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.lang</td><td>string</td><td>{{ store.lang === "zh" ? "当前界面语言。合法取值：<code>\'zh\'</code>（中文，默认）、<code>\'en\'</code>（英文）。" : "Current UI language. Values: <code>\'zh\'</code> (Chinese), <code>\'en\'</code> (English)." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.onlinePlayers</td><td>string[]</td><td>List of online player names for the current instance. Example: <code>["Steve", "Alex"]</code></td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.stats</td><td>object</td><td>{{ store.lang === "zh" ? "系统与服务器状态对象，包含以下字段：<br><code>cpu</code> (string) CPU 使用率百分比，如 <code>\'45.2\'</code>；<code>mem</code> (object) 内存信息：<code>{ total: \'15.9\' (GB), used: \'8.3\' (GB), percentage: \'52.3\' (%) }</code>；<code>mc</code> (object) MC 服务器信息：<code>{ online: 5 (当前在线人数), maxPlayers: 20 (最大玩家数), port: \'25565\' (端口号), motd: \'A Minecraft Server\' (MOTD) }</code>" : "System and server status object. Fields: <br><code>cpu</code> (string) CPU usage %, e.g., <code>\'45.2\'</code>; <code>mem</code> (object) memory info: <code>{ total: \'15.9\' (GB), used: \'8.3\' (GB), percentage: \'52.3\' (%) }</code>; <code>mc</code> (object) MC server info: <code>{ online: 5, maxPlayers: 20, port: \'25565\', motd: \'A Minecraft Server\' }</code>" }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.isRunning</td><td>boolean</td><td>{{ store.lang === "zh" ? "当前实例 MC 服务器是否运行中。" : "Whether current MC server is running." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.hasBackupMod</td><td>boolean</td><td>{{ store.lang === "zh" ? "当前实例是否安装备份模组。" : "Whether current instance has backup mod." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.hasEasyAuth</td><td>boolean</td><td>Whether the current instance has EasyAuth mod installed.</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.hasVoicechat</td><td>boolean</td><td>{{ store.lang === "zh" ? "当前实例是否安装语音聊天模组。" : "Whether current instance has voicechat mod." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.logs</td><td>string[]</td><td>Current instance console log array. Max 1000 lines. Each as plain text.</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.view</td><td>string</td><td>{{ store.lang === "zh" ? "当前视图名称。设置此值可切换页面。内置视图：<code>\'instance-manager\'</code>（实例列表）、<code>\'dashboard\'</code>（控制台）、<code>\'properties\'</code>（server.properties）、<code>\'mods\'</code>（模组管理）、<code>\'modrinth\'</code>（Modrinth 浏览）、<code>\'files\'</code>（文件管理）、<code>\'backups\'</code>（备份管理）、<code>\'easyauth\'</code>（EasyAuth）、<code>\'voicechat\'</code>（语音聊天）、<code>\'players\'</code>（玩家管理）、<code>\'java\'</code>（Java 管理）、<code>\'about\'</code>（关于）、<code>\'plugins\'</code>（插件管理）、<code>\'panel-settings\'</code>（面板设置）。插件视图为 registerSidebarItem 的 view 值。" : "Current view name. Set this to switch pages. Built-in views: <code>\'instance-manager\'</code>, <code>\'dashboard\'</code>, <code>\'properties\'</code>, <code>\'mods\'</code>, <code>\'modrinth\'</code>, <code>\'files\'</code>, <code>\'backups\'</code>, <code>\'easyauth\'</code>, <code>\'voicechat\'</code>, <code>\'players\'</code>, <code>\'java\'</code>, <code>\'about\'</code>, <code>\'plugins\'</code>, <code>\'panel-settings\'</code>. Plugin views use registerSidebarItem view value." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.prevView</td><td>string</td><td>{{ store.lang === "zh" ? "上一个视图名称。用于返回按钮。示例：<code>store.view = store.prevView</code>" : "Previous view name. Used for back buttons. Example: <code>store.view = store.prevView</code>" }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.consoleInfoPosition</td><td>string</td><td>Console info panel position. Valid values: <code>"top"</code> (default), <code>"sidebar"</code>, <code>"hide"</code>.</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.currentInstanceId</td><td>string|null</td><td>{{ store.lang === "zh" ? "当前管理的实例 ID。<code>null</code> 表示在实例列表页。示例：<code>\'default\'</code>、<code>\'survival\'</code>" : "ID of current instance. <code>null</code> on list page. Examples: <code>\'default\'</code>, <code>\'survival\'</code>" }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.instanceList</td><td>object[]</td><td>{{ store.lang === "zh" ? "所有实例列表。每个元素包含：<code>id</code> (string) 实例 ID；<code>name</code> (string) 实例显示名；<code>dir</code> (string) 实例目录绝对路径；<code>hasBackupMod</code> (boolean) 是否有备份模组；<code>backupStrategy</code> (string) 备份策略，合法值：<code>\'panel\'</code>、<code>\'mod\'</code>；<code>isRunning</code> (boolean) 是否运行中；<code>onlinePlayers</code> (number) 在线人数；<code>port</code> (string) 端口号。" : "List of all instances. Each contains: <code>id</code>, <code>name</code>, <code>dir</code>, <code>hasBackupMod</code>, <code>backupStrategy</code>, <code>isRunning</code>, etc." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.javaInstallations</td><td>object[]</td><td>{{ store.lang === "zh" ? "已安装 Java 列表。每个元素包含：<code>id</code> (string) Java 安装 ID；<code>featureVersion</code> (number) 主版本号，如 <code>17</code>、<code>21</code>；<code>path</code> (string) 可执行文件绝对路径；<code>source</code> (string) 安装来源，合法值：<code>\'local\'</code>（手动添加）、<code>\'panel\'</code>（面板安装）。" : "List of installed Java. Each: <code>id</code>; <code>featureVersion</code> (e.g., 17, 21); <code>path</code> (absolute); <code>source</code> (\'local\'|\'panel\')." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.customLogoUrl</td><td>string</td><td>Custom Logo URL. Empty string uses default. Format: <code>"/api/appearance/logo"</code> or full URL.</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.customBgUrl</td><td>string</td><td>{{ store.lang === "zh" ? "自定义背景图 URL。空字符串使用默认。格式：<code>\'/api/appearance/background\'</code> 或完整 URL。" : "Custom background URL. Empty for default. Format: <code>\'/api/appearance/background\'</code> or full URL." }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.task</td><td>object</td><td>Global task progress object. Fields: <br><code>visible</code> (boolean); <code>title</code> (string) task title; <code>message</code> (string) main msg; <code>subMessage</code> (string) sub msg; <code>percent</code> (number) 0-100; <code>speed</code> (number) bytes/s. Used for fullscreen progress overlay.</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.pluginSidebarItems</td><td>object[]</td><td>{{ store.lang === "zh" ? "所有插件注册的侧边栏项列表。每个元素包含：<code>id</code> (string) 侧边栏项 ID；<code>labelKey</code> (string) 翻译键；<code>icon</code> (string) FontAwesome 图标名；<code>color</code> (string) 图标颜色；<code>view</code> (string) 视图名称；<code>location</code> (string) 显示位置，合法值：<code>\'instance\'</code>、<code>\'global\'</code>、<code>\'both\'</code>；<code>pluginId</code> (string) 所属插件 ID；<code>component</code> (string) 关联组件名。" : "List of plugin sidebar items. Each: <code>id</code>, <code>labelKey</code>, <code>icon</code>, <code>color</code>, <code>view</code>, <code>location</code>, <code>pluginId</code>, <code>component</code>." }}</td></tr>
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
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>Method</th><th>{{ store.lang === "zh" ? "签名" : "Signature" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td class="text-success font-monospace py-2">api.get</td><td><code>(url: string, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>Send GET request. <code>config</code> is optional. Automatically attaches <code>instanceId</code> query parameter.{{ store.lang === "zh" ? "示例：<code>const res = await api.get('/api/plugins/my-plugin/items');</code>" : "Example: <code>const res = await api.get('/api/plugins/my-plugin/items');</code>" }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">api.post</td><td><code>(url: string, data?: any, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>{{ store.lang === "zh" ? "发送 POST 请求。<code>data</code> 为请求体（自动 JSON 序列化）；如果 <code>data</code> 是 <code>FormData</code> 则以 multipart 发送。自动附加 <code>instanceId</code> 到请求体。示例：<code>await api.post('/api/plugins/my-plugin/items', { name: 'test' });</code>" : "Send POST request. <code>data</code> is body (auto JSON); or multipart if <code>FormData</code>. Auto-attaches <code>instanceId</code> to body. Example: <code>await api.post('/api/plugins/my-plugin/items', { name: 'test' });</code>" }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">api.put</td><td><code>(url: string, data?: any, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>{{ store.lang === "zh" ? "发送 PUT 请求。参数同 <code>api.post</code>。示例：<code>await api.put('/api/plugins/my-plugin/config', { key: 'value' });</code>" : "Send PUT request. Params same as <code>api.post</code>. Example: <code>await api.put('/api/plugins/my-plugin/config', { key: 'value' });</code>" }}</td></tr>
                                            <tr><td class="text-success font-monospace py-2">api.delete</td><td><code>(url: string, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>Send DELETE request. Automatically attaches <code>instanceId</code> query parameter.{{ store.lang === "zh" ? "示例：<code>await api.delete('/api/plugins/my-plugin/items/123');</code>" : "Example: <code>await api.delete('/api/plugins/my-plugin/items/123');</code>" }}</td></tr>
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
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "显示全局 Toast 提示消息。消息会在 3 秒后自动消失。如果 <code>msg</code> 是翻译键，会自动翻译。" : "Show global toast. Auto-translates if <code>msg</code> is a key." }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Param</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Default</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">msg</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "提示消息文本或 i18n 翻译键。如果是翻译键（如 <code>\'common.saved\'</code>）会自动翻译；如果不是翻译键则直接显示原文。示例：<code>\'操作成功\'</code>、<code>\'common.error\'</code>" : "Toast message or i18n key. Auto-translates if key (e.g., <code>\'common.saved\'</code>); else shows original. Examples: <code>\'Success\'</code>, <code>\'common.error\'</code>" }}</td></tr>
                                            <tr><td class="font-monospace">type</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"success"</code></td><td>提示类型，决定颜色和图标。合法取值：<code>"success"</code>（绿色，成功）、<code>"danger"</code>（红色，错误）、<code>"warning"</code>（黄色，警告）、<code>"info"</code>（蓝色，信息）。</td></tr>
                                            <tr><td class="font-monospace">params</td><td>object</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>{}</code></td><td>翻译参数对象。当 <code>msg</code> 是翻译键时，用于替换模板中的占位符。示例：<code>{ name: "备份" }</code> 替换 <code>"{name}已完成"</code> 中的 <code>{name}</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>showToast(store.lang === 'zh' ? '保存成功' : 'Saved Successfully');                    // 成功提示（默认绿色）
showToast(store.lang === "zh" ? "操作失败" : "Operation Failed", "danger");           // 错误提示（红色）
showToast(store.lang === 'zh' ? '请注意配置' : 'Check Config', 'warning');
showToast(store.lang === "zh" ? "正在处理中" : "Processing", "info");            // 信息提示（蓝色）
{{ store.lang === "zh" ? "showToast('common.saved', 'success');      // 使用翻译键" : "showToast('common.saved', 'success');" }}
showToast('common.welcome', 'info', { name: 'Admin' }); // With translation params</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">openModal(opts)</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "打开全局模态对话框。支持确认、输入和选择三种模式。支持嵌套模态框（自动处理 z-index）。" : "Open global modal. Supports confirm, input, select modes. Handles nesting." }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数字段" : "Field" }}</th><th>Type</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Default</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">opts.title</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"确认"</code>（翻译后）</td><td>模态框标题。示例：<code>"删除确认"</code>、<code>"输入名称"</code></td></tr>
                                            <tr><td class="font-monospace">opts.message</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>""</code></td><td>模态框正文消息。支持 HTML。示例：<code>"确定要删除此项目吗？此操作不可撤销。"</code></td></tr>
                                            <tr><td class="font-monospace">opts.mode</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"confirm"</code></td><td>模态框模式。合法取值：<code>"confirm"</code>（{{ store.lang === "zh" ? "确认模式" : "Confirm Mode" }}，显示确认/取消按钮）；<code>"input"</code>（输入模式，显示文本输入框和确认/取消按钮）；<code>"select"</code>（{{ store.lang === "zh" ? "选择模式" : "Select Mode" }}，显示选项列表和确认/取消按钮）。</td></tr>
                                            <tr><td class="font-monospace">opts.inputValue</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>""</code></td><td>输入框默认值。仅在 <code>mode: "input"</code> 时有效。示例：<code>"默认名称"</code></td></tr>
                                            <tr><td class="font-monospace">opts.placeholder</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>""</code></td><td>输入框占位符文本。仅在 <code>mode: "input"</code> 时有效。示例：<code>"请输入名称"</code></td></tr>
                                            <tr><td class="font-monospace">opts.options</td><td>string[]</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>[]</code></td><td>选项列表。仅在 <code>mode: "select"</code> 时有效。示例：<code>["选项一", "选项二", "选项三"]</code></td></tr>
                                            <tr><td class="font-monospace">opts.callback</td><td>function</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>null</code></td><td>确认回调函数。用户点击确认时调用，参数为用户输入值或选择值。<code>confirm</code> 模式下参数为 <code>undefined</code>；<code>input</code> 模式下参数为输入框字符串；<code>select</code> 模式下参数为选中的选项字符串。示例：<code>(value) => { console.log('用户输入:', value); }</code></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// {{ store.lang === "zh" ? "确认模式" : "Confirm Mode" }}
openModal({
    title: store.lang === "zh" ? "删除确认" : "Delete Confirmation",
    message: store.lang === 'zh' ? '确定要删除此项目吗？此操作不可撤销。' : 'Are you sure you want to delete this? This cannot be undone.',
    mode: 'confirm',
    callback: () => { showToast(store.lang === 'zh' ? '已删除' : 'Deleted'); }
});

// Input mode
openModal({
    title: store.lang === "zh" ? "重命名" : "Rename",
    message: store.lang === 'zh' ? '请输入新名称：' : 'Please enter new name:',
    mode: 'input',
    inputValue: store.lang === "zh" ? "当前名称" : "Current Name",
    placeholder: store.lang === 'zh' ? '输入新名称' : 'Enter new name',
    callback: (newName) => {
        if (newName) showToast((store.lang === 'zh' ? '已重命名为: ' : 'Renamed to: ') + newName);
    }
});

// {{ store.lang === "zh" ? "选择模式" : "Select Mode" }}
openModal({
    title: store.lang === "zh" ? "选择备份策略" : "Select Backup Policy",
    message: store.lang === 'zh' ? '请选择备份方式：' : 'Please select backup method:',
    mode: 'select',
    options: store.lang === "zh" ? ["面板备份", "模组备份", "手动备份"] : ["Panel Backup", "Mods Backup", "Manual Backup"],
    callback: (choice) => { showToast((store.lang === "zh" ? "选择了: " : "Selected: ") + choice); }
});</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">formatLog(log)</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "格式化 MC 服务器日志文本，为 INFO/WARN/ERROR 标签添加 HTML 高亮标签。" : "Format MC server logs with HTML highlighting for INFO/WARN/ERROR tags." }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>Param</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">log</td><td>string</td><td class="text-danger">Yes</td><td>{{ store.lang === "zh" ? "原始日志文本。示例：<code>\'[12:00:00 INFO]: Server started\'</code>" : "Raw log text. Example: <code>\'[12:00:00 INFO]: Server started\'</code>" }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0"><strong>返回值</strong>：string — 格式化后的 HTML 字符串。<code>/INFO/]</code> → <code>&lt;span class="log-info"&gt;INFO&lt;/span&gt;</code>；<code>/WARN/]</code> → <code>&lt;span class="log-warn"&gt;WARN&lt;/span&gt;</code>；<code>/ERROR/]</code> → <code>&lt;span class="log-error"&gt;ERROR&lt;/span&gt;</code>；<code>{{ store.lang === "zh" ? "[系统]" : "[System]" }}</code> → <code>&lt;span class="log-system"&gt;{{ store.lang === "zh" ? "[系统]" : "[System]" }}&lt;/span&gt;</code>。同时转义 <code>&lt;</code> 为 <code>&amp;lt;</code>。</p>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">waitForPanel(targetPort)</h6>
                                <p class="small text-muted mb-2">Wait for panel to come back online. Used after restart, polls until responsive.</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>{{ store.lang === "zh" ? "默认值" : "Default" }}</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">targetPort</td><td>string|number|null</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>null</code></td><td>目标端口号。如果提供，则探测 <code>protocol://hostname:targetPort/api/system/version</code>；如果为 <code>null</code>，则探测当前页面的 <code>/api/system/version</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0"><strong>Returns</strong>: Promise&lt;void&gt; — Resolves when panel recovers.{{ store.lang === "zh" ? "初始等待 1.5 秒后开始探测，每次探测间隔 1 秒，单次探测超时 2 秒。" : "Initial wait 1.5s, then polls every 1s, timeout 2s per poll." }}</p>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">uploadFileWithChunk(file, options)</h6>
                                <p class="small text-muted mb-2">{{ store.lang === "zh" ? "大文件分片上传。仅当文件 ≥ 100MB 时启用分片上传，小于 100MB 的文件返回 <code>null</code>，需使用普通上传方式。" : "Multipart upload for files ≥ 100MB. Returns <code>null</code> if < 100MB." }}</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数字段" : "Field" }}</th><th>Type</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Default</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">file</td><td>File</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "要上传的文件对象（浏览器 File API）。" : "File object to upload (Browser File API)." }}</td></tr>
                                            <tr><td class="font-monospace">options.initUrl</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "初始化上传的 API 端点。POST 请求，发送 <code>{ fileName, fileSize, totalChunks, ...extraInitData }</code>。后端应返回 <code>{ uploadId: string }</code>。" : "Upload init endpoint. POST <code>{ fileName, fileSize, totalChunks, ...extraInitData }</code>. Should return <code>{ uploadId: string }</code>." }}</td></tr>
                                            <tr><td class="font-monospace">options.uploadUrl</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"/api/files/chunk/upload"</code></td><td>分片上传 API 端点。POST 请求，发送 FormData（含 <code>chunk</code> 文件分片、<code>uploadId</code>、<code>chunkIndex</code>）。</td></tr>
                                            <tr><td class="font-monospace">options.completeUrl</td><td>string</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "—" : "—" }}</td><td>{{ store.lang === "zh" ? "完成上传的 API 端点。POST 请求，发送 <code>{ uploadId }</code>。" : "Upload complete endpoint. POST <code>{ uploadId }</code>." }}</td></tr>
                                            <tr><td class="font-monospace">options.cancelUrl</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"/api/files/chunk/cancel"</code></td><td>取消上传的 API 端点。POST 请求，发送 <code>{ uploadId }</code>。上传失败时自动调用。</td></tr>
                                            <tr><td class="font-monospace">options.fieldName</td><td>string</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>"chunk"</code></td><td>FormData 中分片文件的字段名。</td></tr>
                                            <tr><td class="font-monospace">options.extraInitData</td><td>object</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>{}</code></td><td>初始化请求的额外数据。会合并到 initUrl 的请求体中。</td></tr>
                                            <tr><td class="font-monospace">options.onProgress</td><td>function</td><td>{{ store.lang === "zh" ? "否" : "No" }}</td><td><code>() =&gt; {}</code></td><td>进度回调函数。签名：<code>(uploadedBytes: number, totalBytes: number, chunkIndex: number, totalChunks: number) =&gt; void</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0">{{ store.lang === "zh" ? "<strong>返回值</strong>：Promise&lt;object|null&gt; — 文件 &lt; 100MB 返回 <code>null</code>；≥ 100MB 返回完成请求的响应数据。分片大小为 10MB。上传失败时自动调用取消接口。" : "<strong>Returns</strong>: Promise&lt;object|null&gt; — <code>null</code> if < 100MB; response data if ≥ 100MB. Chunk size 10MB. Auto-cancels on failure." }}</p>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">isLargeFile(file)</h6>
                                <p class="small text-muted mb-2">Check if file is large (≥ 100MB). Used to decide whether to use multipart upload.</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>{{ store.lang === "zh" ? "参数" : "Params" }}</th><th>{{ store.lang === "zh" ? "类型" : "Type" }}</th><th>{{ store.lang === "zh" ? "必须" : "Required" }}</th><th>Description</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">file</td><td>File</td><td>{{ store.lang === "zh" ? "是" : "Yes" }}</td><td>{{ store.lang === "zh" ? "浏览器 File 对象。" : "Browser File object." }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0">{{ store.lang === "zh" ? "<strong>返回值</strong>：boolean — <code>true</code> 表示文件 ≥ 100MB，应使用 <code>uploadFileWithChunk</code>；<code>false</code> 表示文件较小，使用普通上传。" : "<strong>Returns</strong>: boolean — <code>true</code> if ≥ 100MB (use <code>uploadFileWithChunk</code>); <code>false</code> otherwise." }}</p>
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
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>my-plugin/
├── locales/
│   ├── zh.json    # {{ store.lang === "zh" ? "中文翻译" : "Chinese Translation" }}
│   └── en.json    # English
├── component/
│   └── Main.js
└── plugin.json</code></pre>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-code me-2 text-info"></i>Translation Example (zh.json)</h5>
                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>{
    "title": {{ store.lang === "zh" ? "我的插件" : "My Plugin" }},
    "description": store.lang === "zh" ? "这是一个测试插件" : "This is a test plugin",
    "buttons": {
        "start": store.lang === "zh" ? "开始任务" : "Start Task",
        "stop": {{ store.lang === "zh" ? "停止任务" : "Stop Task" }}
    }
}</code></pre>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-tag me-2 text-info"></i>{{ store.lang === "zh" ? "命名空间规则" : "Namespace Rules" }}</h5>
                        <p v-if="store.lang === 'zh'" class="text-muted mb-3">为了避免不同插件之间的词条冲突，系统会将插件的所有翻译自动挂载到 <code>plugins.[pluginId]</code> 命名空间下。</p>
                        <p v-else class="text-muted mb-3">To avoid conflicts between plugins, the system automatically mounts all translations of a plugin under the <code>plugins.[pluginId]</code> namespace.</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <ul v-if="store.lang === 'zh'" class="list-unstyled mb-0 small text-muted lh-lg">
                                    <li><i class="fa-solid fa-check text-success me-2"></i>{{ store.lang === "zh" ? "如果插件 ID 为 <code>my-plugin</code>，翻译文件中有 <code>\'title" : "Hello\'</code>' : 'If plugin ID is <code>my-plugin</code> and translation file has <code>\'title\': \'Hello\'</code>" }}</li>
                                    <li><i class="fa-solid fa-check text-success me-2"></i>{{ store.lang === "zh" ? "前端调用键名为：<code>plugins.my-plugin.title</code>" : "Frontend translation key: <code>plugins.my-plugin.title</code>" }}</li>
                                    <li><i class="fa-solid fa-check text-success me-2"></i>Sidebar <code>labelKey</code> should be: <code>plugins.my-plugin.title</code></li>
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
                                            <tr class="text-white opacity-75 border-bottom"><th>事件名</th><th>Data Structure</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="text-warning font-monospace py-2">status</td><td>{ isRunning: boolean }</td><td>{{ store.lang === "zh" ? "当前活跃实例的运行状态变更。" : "Running state change of current active instance." }}</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">status:{instanceId}</td><td>{ isRunning: boolean }</td><td>Status change of a specific instance.</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">players_update</td><td>string[]</td><td>{{ store.lang === "zh" ? "当前活跃实例的在线玩家列表更新。" : "Online player list update for current active instance." }}</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">players_update:{instanceId}</td><td>string[]</td><td>{{ store.lang === "zh" ? "指定实例的在线玩家列表更新。" : "Online player list update for specified instance." }}</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">system_stats</td><td>object</td><td>{{ store.lang === "zh" ? "System stats update.包含：<code>cpu</code> (string) CPU 使用率；<code>mem</code> (object) 内存信息；<code>mc</code> (object) MC 服务器信息。" : "System stats update. Includes: <code>cpu</code>, <code>mem</code>, <code>mc</code> info." }}</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">instances_update</td><td>object[]</td><td>{{ store.lang === "zh" ? "Instance list update.数据格式同 <code>store.instanceList</code>。" : "Instance list update. Format matches <code>store.instanceList</code>." }}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-code me-2 text-warning"></i>{{ store.lang === "zh" ? "插件自定义 Socket 命名空间" : "Plugin Custom Socket Namespace" }}</h5>
                        <p class="text-muted mb-3 small">Plugin backend creates an independent Socket.IO namespace via <code>api.registerSocket(namespace, handlers)</code>. Frontend connection method:</p>
                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
                            <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                <span class="fw-bold">{{ store.lang === "zh" ? "插件 Socket 前后端通信示例" : "Plugin Socket Communication Example" }}</span>
                                <span class="text-muted opacity-50">Javascript</span>
                            </div>
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
{{ store.lang === "zh" ? "// ns.emit('notification', { msg: store.lang === 'zh' ? '系统维护通知" : "System Notification' });' : '// ns.emit('notification', { msg: store.lang === \'zh\' ? \'系统维护通知\' : \'System Maintenance Notice\' });" }}

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

            // Method 1: Connect to plugin custom namespace
            pluginSocket = ioClient('/plugin/my-plugin/live');
            pluginSocket.on('chat_response', (data) => {
                message.value = data.echo;
            });
            pluginSocket.on('notification', (data) => {
                message.value = data.msg;
            });

            // {{ store.lang === "zh" ? "方式二：使用默认命名空间（监听面板全局事件）" : "Option 2: Use default namespace (listen to global events)" }}
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
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-warning font-monospace small">{{ store.lang === "zh" ? "Socket.IO 客户端 API 参考" : "Socket.IO Client API Reference" }}</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>方法/属性</th><th>Signature</th><th>{{ store.lang === "zh" ? "说明" : "Description" }}</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">ioClient(namespace)</td><td><code>(namespace?: string) =&gt; Socket</code></td><td>{{ store.lang === "zh" ? "连接到指定命名空间。返回 Socket 实例。通过 <code>const { io: ioClient } = await import('/socket.io/socket.io.esm.min.js')</code> 获取。不传参数连接默认命名空间；传入命名空间路径连接指定命名空间，路径必须与后端 <code>registerSocket</code> 注册的路径一致。示例：<code>ioClient('/plugin/my-plugin/live')</code>" : "Connect to namespace. Returns Socket. Via <code>import('/socket.io/socket.io.esm.min.js')</code>. Default if no param; else must match backend <code>registerSocket</code> path. Example: <code>ioClient('/plugin/my-plugin/live')</code>" }}</td></tr>
                                            <tr><td class="font-monospace py-2">socket.on(event, callback)</td><td><code>(event: string, callback: Function) =&gt; void</code></td><td>{{ store.lang === "zh" ? "监听服务端事件。" : "Listen for server-side events." }}<code>callback</code> 参数为事件数据。</td></tr>
                                            <tr><td class="font-monospace py-2">socket.emit(event, data)</td><td><code>(event: string, data: any) =&gt; void</code></td><td>Send events to the server.</td></tr>
                                            <tr><td class="font-monospace py-2">socket.disconnect()</td><td><code>() =&gt; void</code></td><td>{{ store.lang === "zh" ? "断开连接。组件卸载时应调用此方法清理资源。" : "Disconnect. Should be called when component unmounts." }}</td></tr>
                                            <tr><td class="font-monospace py-2">socket.connected</td><td>boolean</td><td>{{ store.lang === "zh" ? "是否已连接。只读属性。" : "Whether connected. Read-only." }}</td></tr>
                                            <tr><td class="font-monospace py-2">socket.id</td><td>string</td><td>Socket connection ID. Read-only property.</td></tr>
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
                        <p class="text-muted mb-4 lh-lg">Plugins go through several lifecycle stages from installation to uninstallation. Understanding these stages is crucial for proper resource management.</p>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>{{ store.lang === "zh" ? "阶段" : "Phase" }}</th><th>{{ store.lang === "zh" ? "触发条件" : "Trigger" }}</th><th>{{ store.lang === "zh" ? "行为" : "Action" }}</th><th>What Developer Should Do</th></tr></thead>
                                        <tbody>
                                            <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "发现 (discover)" : "Discover" }} </td><td> Panel starts or <code>discover()</code> is called </td><td> Scan <code>plugins/</code> directory, read <code>plugin.json</code> in each subdirectory. Verify required fields. Check persistence state. </td><td> {{ store.lang === "zh" ? "确保 <code>plugin.json</code> 格式正确且包含必须字段。" : "Ensure <code>plugin.json</code> format is correct with required fields." }} </td></tr>
                                            <tr><td class="text-danger font-monospace py-2"> Load </td><td> {{ store.lang === "zh" ? "插件已启用且面板启动，或用户手动启用插件" : "Plugin enabled and panel starts, or user enables manually" }} </td><td> {{ store.lang === "zh" ? "使用 <code>require()</code> 加载入口文件（<code>main</code> 字段指定，默认 <code>index.js</code>）。验证导出是否为函数。创建 <code>api</code> 对象并调用入口函数。" : "Load entry via <code>require()</code>. Verify export is a function. Create <code>api</code> and call entry." }} </td><td> {{ store.lang === "zh" ? "入口函数必须导出异步函数。可返回含 <code>destroy</code> 方法的对象。" : "Entry must export an async function. Can return an object with a <code>destroy</code> method." }} </td></tr>
                                            <tr><td class="text-danger font-monospace py-2"> Running </td><td> {{ store.lang === "zh" ? "加载成功后" : "After successful loading" }} </td><td> {{ store.lang === "zh" ? "插件的 HTTP 路由、Socket 命名空间、侧边栏项和组件均已注册并可用。" : "HTTP routes, Sockets, Sidebar items, and Components are registered." }} </td><td> {{ store.lang === "zh" ? "正常提供服务。监听事件、处理请求。" : "Serving normally. Listening to events, handling requests." }} </td></tr>
                                            <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "卸载 (unload)" : "Unload" }} </td><td> {{ store.lang === "zh" ? "User disables plugin, updates plugin, or panel closes" : "User disables, updates, or panel closes" }} </td><td> Call <code>destroy()</code> if exists. Clear <code>require.cache</code>. </td><td>{{ store.lang === "zh" ? "在 <code>destroy()</code> 中清理所有资源：关闭子进程、断开数据库连接、清除定时器、移除监听器。" : "In <code>destroy()</code>, clean up: processes, db, timers, listeners." }}</td></tr>
                                            <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "启用 (enable)" : "Enable" }} </td><td> User clicks "Enable" in plugin manager </td><td> 设置 <code>_enabled = true</code>，持久化状态，然后调用 <code>load()</code>。 </td><td> {{ store.lang === "zh" ? "无需额外操作，系统自动加载。" : "No extra action, auto-loaded by system." }} </td></tr>
                                            <tr><td class="text-danger font-monospace py-2"> Disable </td><td> {{ store.lang === "zh" ? "用户在插件管理界面点击\'禁用\'" : "User clicks \'Disable\' in plugin manager" }} </td><td> Call <code>unload()</code> first, then set <code>_enabled = false</code> and persist state. </td><td> {{ store.lang === "zh" ? "Ensure <code>destroy()</code> cleans up resources correctly." : "Ensure <code>destroy()</code> cleans up correctly." }} </td></tr>
                                            <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "安装 (install)" : "Install" }} </td><td> {{ store.lang === "zh" ? "用户上传 ZIP 或指定目录" : "User uploads ZIP or specifies directory" }} </td><td> Unzip to <code>plugins/[id]/</code>. Uninstall old version if exists. Rescan and auto-load. </td><td> {{ store.lang === "zh" ? "ZIP 包内可直接包含插件文件，或包含一层子目录。" : "ZIP can contain plugin files directly or in a subdirectory." }} </td></tr>
                                            <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "卸载 (uninstall)" : "Uninstall" }} </td><td> {{ store.lang === "zh" ? "用户在插件管理界面点击\'卸载\'" : "User clicks \'Uninstall\' in plugin manager" }} </td><td> {{ store.lang === "zh" ? "先 <code>unload()</code>，然后删除插件目录，清除持久化状态，从内存中移除。" : "Call <code>unload()</code>, delete directory, clear state, remove from memory." }} </td><td> Ensure <code>destroy()</code> cleans up external resources. </td></tr>
                                            <tr><td class="text-danger font-monospace py-2"> {{ store.lang === "zh" ? "更新 (update)" : "Update" }} </td><td> {{ store.lang === "zh" ? "用户上传同 ID 插件的 ZIP" : "User uploads ZIP with same ID" }} </td><td> Same as installation: uninstall old version, copy new files, rescan, and load. </td><td> Store config in <code>api.getDataDir()</code>. Note: this directory is overwritten during update; store persistent data in <code>api.getGlobalDataDir()</code>. </td></tr>
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
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>module.exports = async function(api) {
    let intervalId = null;
    let childProcess = null;
    const sockets = new Set();

    // {{ store.lang === "zh" ? "启动定时任务" : "Start periodic tasks" }}
    intervalId = setInterval(() => {
        api.logger.info('Periodic check...');
    }, 60000);

    {{ store.lang === "zh" ? "// 启动子进程" : "// Start child process" }}
    // childProcess = require('child_process').spawn('some-command');

    {{ store.lang === "zh" ? "// 注册 Socket 命名空间" : "// Register Socket namespace" }}
    const ns = api.registerSocket('/live', {
        'join': (socket) => {
            sockets.add(socket);
            socket.on('disconnect', () => sockets.delete(socket));
        }
    });

    // Return destroy method to ensure resource cleanup
    return {
        destroy: async () => {
            {{ store.lang === "zh" ? "// 1. 清除定时器" : "// 1. Clear timers" }}
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }

            {{ store.lang === "zh" ? "// 2. 终止子进程" : "// 2. Kill child process" }}
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
                                            <li>Use <code>api.getGlobalDataDir()</code> for data shared across plugins</li>
                                            <li>{{ store.lang === "zh" ? "所有 HTTP 路由自动附加认证中间件，无需手动验证" : "Auth middleware auto-attached to all HTTP routes." }}</li>
                                            <li>{{ store.lang === "zh" ? "Always disconnect Socket connections when frontend components are unmounted（<code>onUnmounted</code> 中调用 <code>disconnect()</code>）" : "Always disconnect Socket connections on unmount (call <code>disconnect()</code> in <code>onUnmounted</code>)" }}</li>
                                            <li>{{ store.lang === "zh" ? "使用 <code>api.logger</code> 而非 <code>console.log</code>，便于日志溯源" : "Use <code>api.logger</code> instead of <code>console.log</code> for better log traceability" }}</li>
                                            <li>{{ store.lang === "zh" ? "返回 <code>destroy</code> 方法清理所有资源（定时器、进程、连接）" : "Return <code>destroy</code> to clean up all resources (timers, procs, conns)." }}</li>
                                            <li>{{ store.lang === "zh" ? "前端 API 调用使用 <code>api.get/post/put/delete</code>，自动附加认证和实例 ID" : "Use <code>api.get/post/put/delete</code>; auth/instanceId auto-attached." }}</li>
                                            <li>Use the <code>$t()</code> translation function for multi-language support</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-0 shadow-sm rounded-4 h-100" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                                    <div class="card-body p-4">
                                        <h6 class="fw-bold text-danger mb-3"><i class="fa-solid fa-triangle-exclamation me-2"></i> {{ store.lang === "zh" ? "注意事项" : "Precautions" }} </h6>
                                        <ul class="small text-muted mb-0 ps-3 lh-lg">
                                            <li>Once published, the plugin ID should not be changed, as it is part of the directory name and API path</li>
                                            <li>{{ store.lang === "zh" ? "更新插件时整个目录会被覆盖，data 目录内的文件也会被替换" : "Plugin directory overwritten on update, including data dir." }}</li>
                                            <li>{{ store.lang === "zh" ? "不要直接修改面板核心文件，仅通过 <code>api</code> 对象提供的接口操作" : "Do not modify core files; only use <code>api</code> interfaces." }}</li>
                                            <li>Frontend components must use the ES Module format（<code>export default</code>）</li>
                                            <li>{{ store.lang === "zh" ? "后端入口必须导出函数（<code>module.exports = async function(api) {}</code>）" : "Backend entry must export a function (<code>module.exports = async function(api) {}</code>)." }}</li>
                                            <li>{{ store.lang === "zh" ? "Socket 命名空间路径为 <code>/plugin/[插件ID]/[自定义路径]</code>，前端连接时需使用完整路径" : "Socket namespace path: <code>/plugin/[PluginID]/[CustomPath]</code>. Use full path on frontend." }}</li>
                                            <li>{{ store.lang === "zh" ? "避免在全局作用域创建长连接或定时器" : "Avoid creating long connections or timers in the global scope" }}，应在入口函数内创建并在 <code>destroy</code> 中清理</li>
                                            <li>{{ store.lang === "zh" ? "插件间不要直接通信" : "Do not communicate directly between plugins" }}，通过全局 Socket 事件或共享数据目录间接交互</li>
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

        const toc = [
            { id: "intro", title: store.lang === "zh" ? "快速开始" : "Quick Start", icon: "fa-rocket" },
            { id: "manifest", title: store.lang === "zh" ? "plugin.json 参考" : "plugin.json Reference", icon: "fa-file-code" },
            { id: "dependencies", title: store.lang === "zh" ? "NPM 依赖管理" : "NPM Dependencies", icon: "fa-brands fa-npm" },
            { id: "backend", title: store.lang === "zh" ? "后端开发与 API" : "Backend & API", icon: "fa-server" },
            { id: "frontend", title: store.lang === "zh" ? "前端开发" : "Frontend Development", icon: "fa-display" },
            { id: "i18n", title: store.lang === "zh" ? "国际化 (i18n)" : "Internationalization", icon: "fa-globe" },
            { id: "socket", title: store.lang === "zh" ? "Socket.IO 通信" : "Socket.IO Communication", icon: "fa-plug" },
            { id: "lifecycle", title: store.lang === "zh" ? "插件生命周期" : "Plugin Lifecycle", icon: "fa-heart-pulse" },
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
