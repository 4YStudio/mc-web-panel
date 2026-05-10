import { ref, onMounted, onUnmounted, getCurrentInstance } from '/js/vue.esm-browser.js';
import { store } from '../store.js';

export default {
    template: `
    <div class="plugin-dev-guide p-0 p-md-3 animate-in">
        <div class="d-flex shadow-lg border border-secondary rounded-4 overflow-hidden w-100" style="background: var(--c-surface) !important;">
            <!-- Sidebar: Only takes space on LG screens -->
            <div class="guide-sidebar border-end border-secondary d-none d-lg-block flex-shrink-0" style="flex-basis: 260px; width: 260px; background: rgba(0,0,0,0.05);">
                <div style="position: sticky; top: 0; padding: 0 1rem 1rem 1rem;">
                    <div class="rounded-4 p-3" style="margin-top: 1.5rem; background: rgba(var(--c-bg-base-rgb), 0.3); border: 1px solid var(--c-border); box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        <h6 class="text-uppercase small fw-bold text-muted px-2 mb-3 tracking-wider" style="font-size: 0.7rem; letter-spacing: 0.1em;">{{ $t('plugins.guide_toc') || '文档目录' }}</h6>
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
                                <p class="text-muted small m-0 mt-1 opacity-75">几分钟内创建您的第一个面板扩展</p>
                            </div>
                        </div>
                        <p class="text-muted mb-4 lh-lg">云语面板采用模块化架构，插件可以深度介入后端逻辑与前端 UI。每个插件都是一个独立的目录，包含元数据清单、后端入口和前端资源。打包时请将目录内容直接压缩为 ZIP 即可。</p>
                        
                        <div class="row g-4 mb-4">
                            <div class="col-md-6">
                                <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border">
                                    <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                        <span class="fw-bold">Directory Structure</span>
                                        <span class="text-muted opacity-50">Tree</span>
                                    </div>
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>my-plugin/
├── plugin.json       # 核心清单文件 (必须)
├── index.js          # 后端逻辑入口 (可选)
├── component/        # 前端组件目录 (可选)
│   └── Main.js       # 前端 Vue 组件
└── data/             # 插件私有数据 (自动创建)
    └── ...           # 运行时生成的数据文件</code></pre>
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
  "name": "我的插件",
  "version": "1.0.0",
  "author": "Antigravity",
  "description": "一个示例插件",
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
                                <h3 class="fw-bold m-0 tracking-tight">plugin.json 完整参考</h3>
                                <p class="text-muted small m-0 mt-1 opacity-75">每个字段的类型、是否必须、默认值与合法取值</p>
                            </div>
                        </div>
                        <p class="text-muted mb-4 lh-lg"><code>plugin.json</code> 是插件的元数据清单文件，位于插件根目录下，是唯一必须存在的文件。系统通过此文件识别、加载和展示插件。</p>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-3 small text-uppercase text-secondary tracking-wider" style="font-size: 0.75rem;">字段详细说明</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead>
                                            <tr class="text-white opacity-75 border-bottom"><th>字段</th><th>类型</th><th>必须</th><th>默认值</th><th>说明</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="text-info font-monospace py-2">id</td><td>string</td><td class="text-danger">是</td><td>—</td><td>插件唯一标识符。只能包含小写字母 (<code>a-z</code>)、数字 (<code>0-9</code>)、连字符 (<code>-</code>) 和下划线 (<code>_</code>)。安装后作为目录名，且用于 API 路径前缀。合法值示例：<code>"mc-panel-plugin-backup"</code>、<code>"my-custom-tool"</code>。非法值：<code>"My Plugin"</code>（含空格）、<code>"插件1"</code>（含中文）。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">name</td><td>string</td><td class="text-danger">是</td><td>—</td><td>插件显示名称，展示在插件管理列表和侧边栏中。支持任意 Unicode 字符。合法值示例：<code>"面板备份管理器"</code>、<code>"FRP 内网穿透"</code>。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">version</td><td>string</td><td class="text-danger">是</td><td>—</td><td>语义化版本号，建议遵循 SemVer 格式 <code>MAJOR.MINOR.PATCH</code>。合法格式：<code>"1.0.0"</code>、<code>"2.3.1"</code>、<code>"0.1.0-beta"</code>。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">description</td><td>string</td><td>否</td><td><code>""</code></td><td>插件功能描述，展示在插件卡片上。建议简明扼要，100 字以内。合法值示例：<code>"提供面板配置与实例的全局备份、还原与管理功能。"</code></td></tr>
                                            <tr><td class="text-info font-monospace py-2">author</td><td>string</td><td>否</td><td><code>""</code></td><td>作者名称。合法值示例：<code>"Antigravity"</code>、<code>"MC Web Panel Team"</code>。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">icon</td><td>string</td><td>否</td><td><code>"fa-puzzle-piece"</code></td><td>FontAwesome 6 Free 实心图标类名（不含 <code>fa-solid</code> 前缀）。合法取值为 FontAwesome 6 Free 中存在的图标名。常用值：<code>"fa-rocket"</code>、<code>"fa-box-archive"</code>、<code>"fa-network-wired"</code>、<code>"fa-shield-halved"</code>、<code>"fa-database"</code>、<code>"fa-gear"</code>、<code>"fa-chart-line"</code>、<code>"fa-bell"</code>、<code>"fa-code"</code>、<code>"fa-terminal"</code>、<code>"fa-cloud"</code>、<code>"fa-server"</code>、<code>"fa-plug"</code>、<code>"fa-tower-broadcast"</code>、<code>"fa-download"</code>、<code>"fa-clock-rotate-left"</code>、<code>"fa-folder-open"</code>、<code>"fa-microchip"</code>、<code>"fa-cloud-arrow-down"</code>、<code>"fa-sliders"</code>、<code>"fa-puzzle-piece"</code>（默认值）。完整列表见 <a href="https://fontawesome.com/icons" target="_blank">FontAwesome 官网</a>。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">color</td><td>string</td><td>否</td><td><code>"primary"</code></td><td>插件主题色，用于插件卡片图标背景和侧边栏图标着色。支持两种格式：<br>1. CSS 颜色关键字：<code>"primary"</code>（面板主色调）<br>2. HEX 颜色值：以 <code>#</code> 开头的 6 位十六进制码。常用值：<code>"#f1c40f"</code>（金黄）、<code>"#6366f1"</code>（靛蓝）、<code>"#ef4444"</code>（红色）、<code>"#22c55e"</code>（绿色）、<code>"#f97316"</code>（橙色）、<code>"#3b82f6"</code>（蓝色）、<code>"#8b5cf6"</code>（紫色）、<code>"#ec4899"</code>（粉色）、<code>"#14b8a6"</code>（青色）、<code>"#4caf50"</code>（Material 绿）。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">main</td><td>string</td><td>否</td><td><code>"index.js"</code></td><td>后端入口文件路径，相对于插件根目录。该文件必须导出一个异步函数 <code>async function(api) { ... }</code> 或 <code>module.exports = async function(api) { ... }</code>。也支持 ES Module 的 <code>export default async function(api) { ... }</code>。如果不需要后端逻辑，可以省略此字段。路径示例：<code>"index.js"</code>、<code>"src/main.js"</code>。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">defaultEnabled</td><td>boolean</td><td>否</td><td><code>true</code></td><td>插件首次安装后是否默认启用。合法取值：<code>true</code>（安装后自动启用）、<code>false</code>（安装后需手动启用）。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">official</td><td>boolean</td><td>否</td><td><code>false</code></td><td>是否标记为官方插件。官方插件在管理界面会显示"官方"徽章。合法取值：<code>true</code>、<code>false</code>。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">permissions</td><td>string[]</td><td>否</td><td><code>[]</code></td><td>插件声明的权限列表。合法取值（可组合使用）：<code>"execute_command"</code>（执行系统命令）、<code>"file_system"</code>（文件系统读写）、<code>"network_access"</code>（网络访问）。示例：<code>["execute_command", "file_system"]</code></td></tr>
                                            <tr><td class="text-info font-monospace py-2">homepage</td><td>string</td><td>否</td><td><code>""</code></td><td>插件主页 URL。必须是合法的 HTTP/HTTPS URL。示例：<code>"https://github.com/user/my-plugin"</code></td></tr>
                                            <tr><td class="text-info font-monospace py-2">license</td><td>string</td><td>否</td><td><code>""</code></td><td>开源许可证标识。常用值：<code>"MIT"</code>、<code>"Apache-2.0"</code>、<code>"GPL-3.0"</code>、<code>"BSD-3-Clause"</code>、<code>"ISC"</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border">
                            <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                <span class="fw-bold">完整 plugin.json 示例</span>
                                <span class="text-muted opacity-50">JSON</span>
                            </div>
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>{
  "id": "my-awesome-plugin",
  "name": "我的超棒插件",
  "version": "1.2.0",
  "description": "一个功能丰富的示例插件，展示所有可用配置",
  "author": "Developer",
  "icon": "fa-rocket",
  "color": "#6366f1",
  "main": "index.js",
  "defaultEnabled": true,
  "official": false,
  "permissions": ["execute_command", "file_system", "network_access"],
  "homepage": "https://github.com/user/my-awesome-plugin",
  "license": "MIT"
}</code></pre>
                        </div>
                    </section>

                    <hr class="my-5 opacity-10">

                    <section id="section-backend" class="doc-section mb-5">
                        <div class="d-flex align-items-center mb-4">
                            <div class="section-icon-box bg-info bg-opacity-10 text-info rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
                                <i class="fa-solid fa-server" style="font-size: 1.5rem;"></i>
                            </div>
                            <div>
                                <h3 class="fw-bold m-0 tracking-tight">后端开发与 API</h3>
                                <p class="text-muted small m-0 mt-1 opacity-75">利用 Node.js 扩展面板核心功能</p>
                            </div>
                        </div>
                        <p class="text-muted mb-4 lh-lg">插件后端脚本需导出一个异步函数，系统会自动注入 <code>api</code> 对象。该对象封装了所有可操作的接口。后端运行在 Node.js 环境中，可以使用所有 Node.js 内置模块和面板已安装的 npm 包（如 <code>express</code>、<code>fs-extra</code>、<code>axios</code>、<code>adm-zip</code>、<code>archiver</code>、<code>multer</code>、<code>child_process</code> 等）。</p>

                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
                            <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                <span class="fw-bold">入口函数签名</span>
                                <span class="text-muted opacity-50">Javascript</span>
                            </div>
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>// index.js — 插件后端入口
module.exports = async function(api) {
    // api 对象包含以下所有属性和方法
    
    // 可选：返回一个包含 destroy 方法的对象
    // 当插件被禁用或卸载时，destroy() 会被自动调用
    return {
        destroy: async () => {
            // 清理资源：关闭进程、断开连接、清理定时器等
        }
    };
};</code></pre>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info me-2 text-info"></i>api 对象只读属性</h5>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead>
                                            <tr class="text-white opacity-75 border-bottom"><th>属性</th><th>类型</th><th>说明</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="text-info font-monospace py-2">api.id</td><td>string</td><td>插件 ID，与 plugin.json 中的 <code>id</code> 一致。例如：<code>"my-plugin"</code></td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.manifest</td><td>object</td><td>完整的 plugin.json 清单对象。包含所有清单字段以及系统追加的内部字段：<code>_dir</code> (string) 插件绝对路径；<code>_enabled</code> (boolean) 是否启用；<code>_installed</code> (boolean) 是否已安装（始终为 true）。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.io</td><td>SocketIO.Server</td><td>面板的 Socket.IO 服务端实例。可用于全局广播：<code>api.io.emit('event', data)</code>。插件命名空间路径：<code>/plugin/[插件ID]/[自定义路径]</code>。常用方法：<code>api.io.emit(event, data)</code>（向所有已连接客户端广播）、<code>api.io.of(namespace)</code>（获取命名空间）。</td></tr>
                                            <tr><td class="text-info font-monospace py-2">api.context</td><td>object</td><td>面板注入的上下文对象，包含运行时环境信息（详见下方 context 章节）。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-box-open me-2 text-info"></i>api.context 上下文对象</h5>
                        <p class="text-muted mb-3 small">通过 <code>api.context</code> 访问，也可以直接解构：<code>const { instancesDir, baseDir } = api.context;</code>。以下为所有可用字段：</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead>
                                            <tr class="text-white opacity-75 border-bottom"><th>字段</th><th>类型</th><th>说明</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">instancesDir</td><td>string</td><td>所有 MC 实例的根目录绝对路径。例如：<code>"/opt/mc-panel/instances"</code>。每个实例的目录名为实例 ID，如 <code>"default"</code>、<code>"survival"</code>。</td></tr>
                                            <tr><td class="font-monospace py-2">baseDir</td><td>string</td><td>面板基础目录绝对路径。例如：<code>"/opt/mc-panel"</code>。面板的根工作目录。</td></tr>
                                            <tr><td class="font-monospace py-2">dataDir</td><td>string</td><td>面板数据目录绝对路径。例如：<code>"/opt/mc-panel/data"</code>。存放配置文件（如 <code>instances.json</code>、<code>app-config.json</code>）、Java 安装等。</td></tr>
                                            <tr><td class="font-monospace py-2">globalBackupDir</td><td>string</td><td>全局备份目录绝对路径。例如：<code>"/opt/mc-panel/data/backups/global"</code>。用于存放跨实例的全局备份 ZIP 文件。</td></tr>
                                            <tr><td class="font-monospace py-2">pluginsDir</td><td>string</td><td>插件安装目录绝对路径。例如：<code>"/opt/mc-panel/plugins"</code>。每个插件以 ID 为目录名安装在此目录下。</td></tr>
                                            <tr><td class="font-monospace py-2">getConfig</td><td>function</td><td>获取面板配置对象的函数。调用方式：<code>const config = api.context.getConfig()</code> 或 <code>const config = api.getConfig()</code>。返回值详见 <code>api.getConfig()</code> 方法说明。</td></tr>
                                            <tr><td class="font-monospace py-2">instancesState</td><td>Map&lt;string, object&gt;</td><td>所有实例的运行时状态 Map。键为实例 ID (string)，值为实例状态对象，包含以下字段：<code>process</code> (ChildProcess|null) MC 服务器进程；<code>logHistory</code> (string[]) 控制台日志历史；<code>onlinePlayers</code> (Set&lt;string&gt;) 在线玩家集合；<code>detectedVersion</code> (object) 检测到的版本信息 <code>{ mc: string, loader: string }</code>。使用示例：<code>const state = instancesState.get('default');</code></td></tr>
                                            <tr><td class="font-monospace py-2">appendLog</td><td>function</td><td>向实例控制台追加日志的函数。签名：<code>appendLog(instanceId: string, message: string)</code>。<code>instanceId</code> 为目标实例 ID；<code>message</code> 为日志文本（通常以 <code>\\n</code> 结尾）。使用示例：<code>appendLog('default', '[系统] 插件操作完成\\n');</code></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-code me-2 text-info"></i>api 方法完整参考</h5>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerRoutes(prefix, setupFn)</h6>
                                <p class="small text-muted mb-2">注册 HTTP API 路由。所有路由自动添加认证中间件，最终路径为 <code>/api/plugins/[插件ID][prefix]</code>。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">prefix</td><td>string</td><td class="text-danger">是</td><td>路由前缀。建议以 <code>/</code> 开头。最终路径 = <code>/api/plugins/[插件ID]</code> + <code>prefix</code>。示例：<code>"/"</code> → <code>/api/plugins/my-plugin/</code>；<code>"/api"</code> → <code>/api/plugins/my-plugin/api</code>。如果 prefix 不以 <code>/</code> 开头，系统会自动补全。</td></tr>
                                            <tr><td class="font-monospace">setupFn</td><td>express.Router | function</td><td class="text-danger">是</td><td>两种形式：<br>1. <strong>express.Router 实例</strong>（推荐）：直接传入已配置好路由的 Router 对象。<br>2. <strong>无参函数</strong>：传入一个无参函数，函数内部创建并返回 Router 对象。系统会自动调用该函数获取 Router。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 方式一：直接传入 Router（推荐）
const router = express.Router();
router.get('/hello', (req, res) => res.json({ msg: 'Hello' }));
router.post('/data', (req, res) => res.json({ received: req.body }));
api.registerRoutes('/', router);
// 前端调用：GET /api/plugins/my-plugin/hello

// 方式二：传入无参函数
api.registerRoutes('/api', () => {
    const router = express.Router();
    router.get('/status', (req, res) => res.json({ ok: true }));
    return router;
});
// 前端调用：GET /api/plugins/my-plugin/api/status

// 文件上传（需引入 multer）
const upload = multer({ dest: path.join(DATA_DIR, 'tmp_uploads') });
router.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    res.json({ success: true, filename: file.originalname });
});

// 流式下载
router.get('/download', (req, res) => {
    const filePath = '/path/to/file';
    res.download(filePath);
});</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerSocket(namespace, handlers)</h6>
                                <p class="small text-muted mb-2">注册 WebSocket 命名空间和事件处理器。返回 Socket.IO Namespace 实例。命名空间路径为 <code>/plugin/[插件ID][namespace]</code>。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">namespace</td><td>string</td><td class="text-danger">是</td><td>命名空间路径。建议以 <code>/</code> 开头。最终路径 = <code>/plugin/[插件ID]</code> + <code>namespace</code>。示例：<code>"/live"</code> → <code>/plugin/my-plugin/live</code>。</td></tr>
                                            <tr><td class="font-monospace">handlers</td><td>object</td><td class="text-danger">是</td><td>事件处理器映射对象。键为事件名称 (string)，值为处理函数。函数签名：<code>(socket, ...args) => void</code>。<code>socket</code> 为 Socket.IO Socket 实例；<code>...args</code> 为客户端发送的数据参数。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-2"><strong>返回值</strong>：Socket.IO Namespace 实例。可用于向该命名空间的所有客户端广播：<code>ns.emit('event', data)</code>。</p>
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

// 后端主动广播示例（可在任何地方调用）
ns.emit('notification', { msg: '系统维护通知' });

// 前端连接方式：
// const socket = io('/plugin/my-plugin/live');
// socket.on('chat_response', (data) => console.log(data));
// socket.emit('chat', 'Hello!');</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.registerSidebarItem(item)</h6>
                                <p class="small text-muted mb-2">注册前端侧边栏导航项。根据 <code>location</code> 的不同，显示在不同的位置。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数字段</th><th>类型</th><th>必须</th><th>默认值</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">item.id</td><td>string</td><td class="text-danger">是</td><td>—</td><td>侧边栏项唯一标识符。建议格式：<code>"[插件ID]-[功能名]"</code>。示例：<code>"backup-manager"</code>、<code>"frp-manager"</code></td></tr>
                                            <tr><td class="font-monospace">item.labelKey</td><td>string</td><td class="text-danger">是</td><td>—</td><td>显示文本的 i18n 翻译键。系统通过 <code>$t(item.labelKey)</code> 翻译显示。如翻译键不存在则直接显示键名。示例：<code>"plugins.backup_manager.title"</code>、<code>"sidebar.frp_manager"</code></td></tr>
                                            <tr><td class="font-monospace">item.icon</td><td>string</td><td class="text-danger">是</td><td>—</td><td>FontAwesome 6 Free 实心图标类名（不含 <code>fa-solid</code> 前缀）。合法取值同 plugin.json 的 icon 字段。</td></tr>
                                            <tr><td class="font-monospace">item.color</td><td>string</td><td>否</td><td>—</td><td>图标颜色。支持 CSS 颜色关键字或 HEX 值。示例：<code>"#f1c40f"</code>、<code>"primary"</code></td></tr>
                                            <tr><td class="font-monospace">item.view</td><td>string</td><td class="text-danger">是</td><td>—</td><td>视图名称。点击后 <code>store.view</code> 设为此值，系统查找同名组件渲染。<strong>必须与 registerComponent 的 name 参数一致</strong>。命名建议：<code>"plugin-[插件ID]-[功能名]"</code> 或简洁的 PascalCase 如 <code>"FrpManager"</code></td></tr>
                                            <tr><td class="font-monospace">item.location</td><td>string</td><td>否</td><td><code>"instance"</code></td><td>侧边栏项显示位置。合法取值：<br><code>"instance"</code>（默认）— 显示在实例侧边栏中，仅在管理某个实例时可见；<br><code>"global"</code> — 显示在实例管理器页面的下拉菜单中，无需选择实例即可访问；<br><code>"both"</code> — 同时显示在实例侧边栏和全局下拉菜单中。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 实例级侧边栏项（默认，仅在实例内可见）
api.registerSidebarItem({
    id: 'backup-manager',
    labelKey: 'plugins.backup_manager.title',
    icon: 'fa-box-archive',
    color: '#f1c40f',
    view: 'plugin-mc-panel-plugin-backup-main',
    location: 'instance'
});

// 全局级侧边栏项（无需选择实例即可访问）
api.registerSidebarItem({
    id: 'frp-manager',
    labelKey: 'sidebar.frp_manager',
    icon: 'fa-network-wired',
    color: '#6366f1',
    view: 'frp-manager',
    location: 'global'
});

// 两处都显示
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
                                <p class="small text-muted mb-2">注册前端 Vue 组件。系统会自动通过动态 import 加载组件文件并注册为全局组件。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">name</td><td>string</td><td class="text-danger">是</td><td>组件注册名称。<strong>必须与 registerSidebarItem 的 view 值一致</strong>，否则点击侧边栏无法渲染组件。命名建议：<code>"plugin-[插件ID]-main"</code> 或 PascalCase 如 <code>"FrpManager"</code>。示例：<code>"plugin-mc-panel-plugin-backup-main"</code>、<code>"FrpManager"</code></td></tr>
                                            <tr><td class="font-monospace">componentPath</td><td>string</td><td class="text-danger">是</td><td>组件文件路径，相对于插件根目录。该文件必须是一个 ES Module，导出 Vue 3 组件选项对象（含 <code>template</code> 和 <code>setup</code>）。示例：<code>"component/Main.js"</code>、<code>"frontend/FrpManager.js"</code></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-2"><strong>组件加载机制</strong>：系统通过 <code>/api/plugins/[插件ID]/component/[组件名]</code> 端点提供组件文件服务，前端使用 <code>import()</code> 动态加载。组件必须使用 <code>export default</code> 导出。</p>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>api.registerComponent('plugin-my-plugin-main', 'component/Main.js');
// 组件文件 component/Main.js 需使用 export default 导出：
// export default { template: '...', setup() { ... } }</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.getDataDir()</h6>
                                <p class="small text-muted mb-2">获取插件私有数据目录路径。如果目录不存在会自动创建。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>项目</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">参数</td><td>无</td></tr>
                                            <tr><td class="font-monospace">返回值</td><td>string — 插件私有数据目录绝对路径。路径格式：<code>[插件目录]/data</code>。例如：<code>"/opt/mc-panel/plugins/my-plugin/data"</code></td></tr>
                                            <tr><td class="font-monospace">副作用</td><td>如果目录不存在，会自动调用 <code>fs.ensureDirSync()</code> 创建</td></tr>
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
                                <p class="small text-muted mb-2">获取面板全局数据目录路径。适合存放跨插件共享或需要持久化的数据。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>项目</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">参数</td><td>无</td></tr>
                                            <tr><td class="font-monospace">返回值</td><td>string — 面板全局数据目录绝对路径。路径格式：<code>[baseDir]/data</code>。例如：<code>"/opt/mc-panel/data"</code>。如果 <code>baseDir</code> 未配置，则回退到 <code>api.getDataDir()</code>。</td></tr>
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
                                <p class="small text-muted mb-2">获取 MC 实例根目录路径。等同于 <code>api.context.instancesDir</code>。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>项目</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">参数</td><td>无</td></tr>
                                            <tr><td class="font-monospace">返回值</td><td>string — 实例根目录绝对路径。例如：<code>"/opt/mc-panel/instances"</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.getBaseDir()</h6>
                                <p class="small text-muted mb-2">获取面板基础目录路径。等同于 <code>api.context.baseDir</code>。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>项目</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">参数</td><td>无</td></tr>
                                            <tr><td class="font-monospace">返回值</td><td>string — 面板基础目录绝对路径。例如：<code>"/opt/mc-panel"</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-info font-monospace small">api.getConfig()</h6>
                                <p class="small text-muted mb-2">获取面板配置对象。返回当前面板的完整配置，包含运行时参数。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>项目</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">参数</td><td>无</td></tr>
                                            <tr><td class="font-monospace">返回值</td><td>object — 面板配置对象（详见下方字段说明）</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <h6 class="fw-bold mb-2 small text-muted">返回对象字段</h6>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>字段</th><th>类型</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">isSetup</td><td>boolean</td><td>面板是否已完成初始设置（2FA 配置）。</td></tr>
                                            <tr><td class="font-monospace py-2">sessionSecret</td><td>string</td><td>会话加密密钥。</td></tr>
                                            <tr><td class="font-monospace py-2">sessionTimeout</td><td>number</td><td>会话超时时间（天数）。</td></tr>
                                            <tr><td class="font-monospace py-2">githubProxy</td><td>string</td><td>GitHub 代理地址。为空字符串表示不使用代理。示例：<code>"https://mirror.example.com"</code></td></tr>
                                            <tr><td class="font-monospace py-2">modrinthApi</td><td>string</td><td>Modrinth API 基础 URL。默认：<code>"https://api.modrinth.com/v2"</code></td></tr>
                                            <tr><td class="font-monospace py-2">port</td><td>number</td><td>面板监听端口。默认：<code>3000</code></td></tr>
                                            <tr><td class="font-monospace py-2">consoleInfoPosition</td><td>string</td><td>控制台信息面板位置。合法取值：<code>"top"</code>、<code>"sidebar"</code>、<code>"hide"</code>。</td></tr>
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
                                <p class="small text-muted mb-2">插件专用日志记录器。所有输出自动添加 <code>[Plugin:插件名]</code> 前缀，便于在面板日志中区分来源。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>方法</th><th>签名</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">api.logger.info</td><td><code>(...args: any[]) => void</code></td><td>输出信息级别日志。输出格式：<code>[Plugin:插件名] 消息内容</code></td></tr>
                                            <tr><td class="font-monospace py-2">api.logger.warn</td><td><code>(...args: any[]) => void</code></td><td>输出警告级别日志。</td></tr>
                                            <tr><td class="font-monospace py-2">api.logger.error</td><td><code>(...args: any[]) => void</code></td><td>输出错误级别日志。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>api.logger.info('Plugin initialized successfully');
// 输出: [Plugin:我的插件] Plugin initialized successfully

api.logger.warn('Configuration not found, using defaults');
api.logger.error('Failed to connect:', error.message);</code></pre>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-code me-2 text-info"></i>后端完整示例</h5>
                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border">
                            <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                <span class="fw-bold">index.js — 完整后端示例</span>
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
                                <h3 class="fw-bold m-0 tracking-tight">前端开发</h3>
                                <p class="text-muted small m-0 mt-1 opacity-75">使用 Vue 3 构建插件界面</p>
                            </div>
                        </div>
                        <p class="text-muted mb-4 lh-lg">插件前端使用 Vue 3 组件（ES Module 格式），通过 <code>api.registerComponent()</code> 注册后，系统会自动动态加载。组件文件必须使用 <code>export default</code> 导出组件选项对象。</p>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-puzzle-piece me-2 text-success"></i>可用导入模块</h5>
                        <p class="text-muted mb-3 small">以下是插件前端组件中可以使用的所有导入：</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>导入语句</th><th>来源</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">import { ref, reactive, computed, onMounted, onUnmounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js'</td><td>Vue 3</td><td>Vue 3 Composition API。可用导出：<code>ref</code>、<code>reactive</code>、<code>computed</code>、<code>watch</code>、<code>watchEffect</code>、<code>onMounted</code>、<code>onUnmounted</code>、<code>onBeforeUnmount</code>、<code>nextTick</code>、<code>getCurrentInstance</code> 等 Vue 3 Composition API 全部导出。</td></tr>
                                            <tr><td class="font-monospace py-2">import { store } from '/js/store.js'</td><td>面板</td><td>全局响应式状态对象。Vue 3 <code>reactive()</code> 对象，所有属性均为响应式。详见下方 store 参考表。</td></tr>
                                            <tr><td class="font-monospace py-2">import { api } from '/js/api.js'</td><td>面板</td><td>认证 API 请求封装。基于 axios，自动附加 <code>instanceId</code> 参数。详见下方 api 参考表。</td></tr>
                                            <tr><td class="font-monospace py-2">import { showToast, openModal, formatLog, waitForPanel, uploadFileWithChunk, isLargeFile } from '/js/utils.js'</td><td>面板</td><td>工具函数集合。详见下方工具函数参考表。</td></tr>
                                            <tr><td class="font-monospace py-2">import { socket } from '/js/socket.js'</td><td>面板</td><td>Socket.IO 客户端实例（默认命名空间）。用于监听面板全局事件。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-code me-2 text-success"></i>前端组件模板</h5>
                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
                            <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                <span class="fw-bold">component/Main.js — 前端组件完整模板</span>
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
                &lt;i class="fa-solid fa-refresh me-1"&gt;&lt;/i&gt;刷新
            &lt;/button&gt;
        &lt;/div&gt;
        &lt;div v-if="loading" class="text-center py-5"&gt;
            &lt;div class="spinner-border text-primary"&gt;&lt;/div&gt;
        &lt;/div&gt;
        &lt;div v-else&gt;
            &lt;!-- 你的内容 --&gt;
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

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-database me-2 text-success"></i>store 全局状态完整参考</h5>
                        <p class="text-muted mb-3 small">通过 <code>import { store } from '/js/store.js'</code> 导入。Vue 3 reactive 对象，所有属性响应式。可直接读取和修改。</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead>
                                            <tr class="text-white opacity-75 border-bottom"><th>属性</th><th>类型</th><th>说明</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td class="text-success font-monospace py-2">store.auth</td><td>object</td><td>认证状态对象，包含以下字段：<br><code>loggedIn</code> (boolean) 是否已登录；<code>isSetup</code> (boolean) 是否完成 2FA 设置；<code>qrCode</code> (string) 二维码 Data URL（仅设置阶段有值）；<code>secret</code> (string) 2FA 密钥（仅设置阶段有值）；<code>token</code> (string) 验证码。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.isSetup</td><td>boolean</td><td>面板是否已完成初始设置。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.lang</td><td>string</td><td>当前界面语言。合法取值：<code>"zh"</code>（中文，默认）、<code>"en"</code>（英文）。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.onlinePlayers</td><td>string[]</td><td>当前实例在线玩家名称列表。示例：<code>["Steve", "Alex"]</code></td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.stats</td><td>object</td><td>系统与服务器状态对象，包含以下字段：<br><code>cpu</code> (string) CPU 使用率百分比，如 <code>"45.2"</code>；<code>mem</code> (object) 内存信息：<code>{ total: "15.9" (GB), used: "8.3" (GB), percentage: "52.3" (%) }</code>；<code>mc</code> (object) MC 服务器信息：<code>{ online: 5 (当前在线人数), maxPlayers: 20 (最大玩家数), port: "25565" (端口号), motd: "A Minecraft Server" (MOTD) }</code></td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.isRunning</td><td>boolean</td><td>当前实例 MC 服务器是否运行中。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.hasBackupMod</td><td>boolean</td><td>当前实例是否安装备份模组。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.hasEasyAuth</td><td>boolean</td><td>当前实例是否安装 EasyAuth 模组。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.hasVoicechat</td><td>boolean</td><td>当前实例是否安装语音聊天模组。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.logs</td><td>string[]</td><td>当前实例控制台日志行数组。最多 1000 条。每条为纯文本字符串。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.view</td><td>string</td><td>当前视图名称。设置此值可切换页面。内置视图：<code>"instance-manager"</code>（实例列表）、<code>"dashboard"</code>（控制台）、<code>"properties"</code>（server.properties）、<code>"mods"</code>（模组管理）、<code>"modrinth"</code>（Modrinth 浏览）、<code>"files"</code>（文件管理）、<code>"backups"</code>（备份管理）、<code>"easyauth"</code>（EasyAuth）、<code>"voicechat"</code>（语音聊天）、<code>"players"</code>（玩家管理）、<code>"java"</code>（Java 管理）、<code>"about"</code>（关于）、<code>"plugins"</code>（插件管理）、<code>"panel-settings"</code>（面板设置）。插件视图为 registerSidebarItem 的 view 值。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.prevView</td><td>string</td><td>上一个视图名称。用于返回按钮。示例：<code>store.view = store.prevView</code></td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.consoleInfoPosition</td><td>string</td><td>控制台信息面板位置。合法取值：<code>"top"</code>（控制台上方，默认）、<code>"sidebar"</code>（侧边栏中）、<code>"hide"</code>（隐藏）。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.currentInstanceId</td><td>string|null</td><td>当前管理的实例 ID。<code>null</code> 表示在实例列表页。示例：<code>"default"</code>、<code>"survival"</code></td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.instanceList</td><td>object[]</td><td>所有实例列表。每个元素包含：<code>id</code> (string) 实例 ID；<code>name</code> (string) 实例显示名；<code>dir</code> (string) 实例目录绝对路径；<code>hasBackupMod</code> (boolean) 是否有备份模组；<code>backupStrategy</code> (string) 备份策略，合法值：<code>"panel"</code>、<code>"mod"</code>；<code>isRunning</code> (boolean) 是否运行中；<code>onlinePlayers</code> (number) 在线人数；<code>port</code> (string) 端口号。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.javaInstallations</td><td>object[]</td><td>已安装 Java 列表。每个元素包含：<code>id</code> (string) Java 安装 ID；<code>featureVersion</code> (number) 主版本号，如 <code>17</code>、<code>21</code>；<code>path</code> (string) 可执行文件绝对路径；<code>source</code> (string) 安装来源，合法值：<code>"local"</code>（手动添加）、<code>"panel"</code>（面板安装）。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.customLogoUrl</td><td>string</td><td>自定义 Logo URL。空字符串使用默认。格式：<code>"/api/appearance/logo"</code> 或完整 URL。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.customBgUrl</td><td>string</td><td>自定义背景图 URL。空字符串使用默认。格式：<code>"/api/appearance/background"</code> 或完整 URL。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.task</td><td>object</td><td>全局任务进度状态对象，包含以下字段：<br><code>visible</code> (boolean) 是否显示进度条；<code>title</code> (string) 任务标题；<code>message</code> (string) 主消息；<code>subMessage</code> (string) 副消息；<code>percent</code> (number) 进度百分比 0-100；<code>speed</code> (number) 速度（字节/秒）。用于显示全屏遮罩式进度提示。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.pluginSidebarItems</td><td>object[]</td><td>所有插件注册的侧边栏项列表。每个元素包含：<code>id</code> (string) 侧边栏项 ID；<code>labelKey</code> (string) 翻译键；<code>icon</code> (string) FontAwesome 图标名；<code>color</code> (string) 图标颜色；<code>view</code> (string) 视图名称；<code>location</code> (string) 显示位置，合法值：<code>"instance"</code>、<code>"global"</code>、<code>"both"</code>；<code>pluginId</code> (string) 所属插件 ID；<code>component</code> (string) 关联组件名。</td></tr>
                                            <tr><td class="text-success font-monospace py-2">store.pluginComponents</td><td>object</td><td>所有插件注册的前端组件映射。键为组件名 (string)，值为组件信息对象：<code>{ pluginId: string, path: string }</code>。通常不需要直接操作此属性，系统会根据 <code>store.view</code> 自动加载对应组件。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-globe me-2 text-success"></i>前端 API 请求参考</h5>
                        <p class="text-muted mb-3 small">通过 <code>import { api } from '/js/api.js'</code> 导入。基于 axios 封装，自动附加 <code>instanceId</code> 参数和认证信息。</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>方法</th><th>签名</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="text-success font-monospace py-2">api.get</td><td><code>(url: string, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>发送 GET 请求。<code>config</code> 可选，支持 axios 所有配置项（如 <code>params</code>、<code>headers</code>、<code>responseType</code> 等）。自动附加 <code>instanceId</code> 查询参数。示例：<code>const res = await api.get('/api/plugins/my-plugin/items');</code></td></tr>
                                            <tr><td class="text-success font-monospace py-2">api.post</td><td><code>(url: string, data?: any, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>发送 POST 请求。<code>data</code> 为请求体（自动 JSON 序列化）；如果 <code>data</code> 是 <code>FormData</code> 则以 multipart 发送。自动附加 <code>instanceId</code> 到请求体。示例：<code>await api.post('/api/plugins/my-plugin/items', { name: 'test' });</code></td></tr>
                                            <tr><td class="text-success font-monospace py-2">api.put</td><td><code>(url: string, data?: any, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>发送 PUT 请求。参数同 <code>api.post</code>。示例：<code>await api.put('/api/plugins/my-plugin/config', { key: 'value' });</code></td></tr>
                                            <tr><td class="text-success font-monospace py-2">api.delete</td><td><code>(url: string, config?: AxiosRequestConfig) =&gt; Promise&lt;AxiosResponse&gt;</code></td><td>发送 DELETE 请求。自动附加 <code>instanceId</code> 查询参数。示例：<code>await api.delete('/api/plugins/my-plugin/items/123');</code></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0 mt-3"><strong>请求拦截器行为</strong>：所有请求自动附加 <code>store.currentInstanceId</code> 作为参数。GET/DELETE 请求附加到 URL 查询参数；POST/PUT 请求附加到请求体（FormData 使用 <code>append</code>，JSON 对象使用展开运算符）。响应数据通过 <code>res.data</code> 获取。</p>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-wrench me-2 text-success"></i>工具函数完整参考</h5>
                        <p class="text-muted mb-3 small">通过 <code>import { showToast, openModal, formatLog, waitForPanel, uploadFileWithChunk, isLargeFile } from '/js/utils.js'</code> 导入。</p>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">showToast(msg, type, params)</h6>
                                <p class="small text-muted mb-2">显示全局 Toast 提示消息。消息会在 3 秒后自动消失。如果 <code>msg</code> 是翻译键，会自动翻译。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数</th><th>类型</th><th>必须</th><th>默认值</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">msg</td><td>string</td><td class="text-danger">是</td><td>—</td><td>提示消息文本或 i18n 翻译键。如果是翻译键（如 <code>"common.saved"</code>）会自动翻译；如果不是翻译键则直接显示原文。示例：<code>"操作成功"</code>、<code>"common.error"</code></td></tr>
                                            <tr><td class="font-monospace">type</td><td>string</td><td>否</td><td><code>"success"</code></td><td>提示类型，决定颜色和图标。合法取值：<code>"success"</code>（绿色，成功）、<code>"danger"</code>（红色，错误）、<code>"warning"</code>（黄色，警告）、<code>"info"</code>（蓝色，信息）。</td></tr>
                                            <tr><td class="font-monospace">params</td><td>object</td><td>否</td><td><code>{}</code></td><td>翻译参数对象。当 <code>msg</code> 是翻译键时，用于替换模板中的占位符。示例：<code>{ name: "备份" }</code> 替换 <code>"{name}已完成"</code> 中的 <code>{name}</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>showToast('保存成功');                    // 成功提示（默认绿色）
showToast('操作失败', 'danger');           // 错误提示（红色）
showToast('请注意配置', 'warning');         // 警告提示（黄色）
showToast('正在处理中', 'info');            // 信息提示（蓝色）
showToast('common.saved', 'success');      // 使用翻译键
showToast('common.welcome', 'info', { name: 'Admin' }); // 带翻译参数</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">openModal(opts)</h6>
                                <p class="small text-muted mb-2">打开全局模态对话框。支持确认、输入和选择三种模式。支持嵌套模态框（自动处理 z-index）。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数字段</th><th>类型</th><th>必须</th><th>默认值</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">opts.title</td><td>string</td><td>否</td><td><code>"确认"</code>（翻译后）</td><td>模态框标题。示例：<code>"删除确认"</code>、<code>"输入名称"</code></td></tr>
                                            <tr><td class="font-monospace">opts.message</td><td>string</td><td>否</td><td><code>""</code></td><td>模态框正文消息。支持 HTML。示例：<code>"确定要删除此项目吗？此操作不可撤销。"</code></td></tr>
                                            <tr><td class="font-monospace">opts.mode</td><td>string</td><td>否</td><td><code>"confirm"</code></td><td>模态框模式。合法取值：<code>"confirm"</code>（确认模式，显示确认/取消按钮）；<code>"input"</code>（输入模式，显示文本输入框和确认/取消按钮）；<code>"select"</code>（选择模式，显示选项列表和确认/取消按钮）。</td></tr>
                                            <tr><td class="font-monospace">opts.inputValue</td><td>string</td><td>否</td><td><code>""</code></td><td>输入框默认值。仅在 <code>mode: "input"</code> 时有效。示例：<code>"默认名称"</code></td></tr>
                                            <tr><td class="font-monospace">opts.placeholder</td><td>string</td><td>否</td><td><code>""</code></td><td>输入框占位符文本。仅在 <code>mode: "input"</code> 时有效。示例：<code>"请输入名称"</code></td></tr>
                                            <tr><td class="font-monospace">opts.options</td><td>string[]</td><td>否</td><td><code>[]</code></td><td>选项列表。仅在 <code>mode: "select"</code> 时有效。示例：<code>["选项一", "选项二", "选项三"]</code></td></tr>
                                            <tr><td class="font-monospace">opts.callback</td><td>function</td><td>否</td><td><code>null</code></td><td>确认回调函数。用户点击确认时调用，参数为用户输入值或选择值。<code>confirm</code> 模式下参数为 <code>undefined</code>；<code>input</code> 模式下参数为输入框字符串；<code>select</code> 模式下参数为选中的选项字符串。示例：<code>(value) => { console.log('用户输入:', value); }</code></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="code-block-wrapper rounded-3 overflow-hidden border">
                                    <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface); overflow-x: auto; white-space: pre;"><code>// 确认模式
openModal({
    title: '删除确认',
    message: '确定要删除此项目吗？此操作不可撤销。',
    mode: 'confirm',
    callback: () => { showToast('已删除'); }
});

// 输入模式
openModal({
    title: '重命名',
    message: '请输入新名称：',
    mode: 'input',
    inputValue: '当前名称',
    placeholder: '输入新名称',
    callback: (newName) => {
        if (newName) showToast('已重命名为: ' + newName);
    }
});

// 选择模式
openModal({
    title: '选择备份策略',
    message: '请选择备份方式：',
    mode: 'select',
    options: ['面板备份', '模组备份', '手动备份'],
    callback: (choice) => { showToast('选择了: ' + choice); }
});</code></pre>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">formatLog(log)</h6>
                                <p class="small text-muted mb-2">格式化 MC 服务器日志文本，为 INFO/WARN/ERROR 标签添加 HTML 高亮标签。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">log</td><td>string</td><td class="text-danger">是</td><td>原始日志文本。示例：<code>"[12:00:00 INFO]: Server started"</code></td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0"><strong>返回值</strong>：string — 格式化后的 HTML 字符串。<code>/INFO/]</code> → <code>&lt;span class="log-info"&gt;INFO&lt;/span&gt;</code>；<code>/WARN/]</code> → <code>&lt;span class="log-warn"&gt;WARN&lt;/span&gt;</code>；<code>/ERROR/]</code> → <code>&lt;span class="log-error"&gt;ERROR&lt;/span&gt;</code>；<code>[系统]</code> → <code>&lt;span class="log-system"&gt;[系统]&lt;/span&gt;</code>。同时转义 <code>&lt;</code> 为 <code>&amp;lt;</code>。</p>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">waitForPanel(targetPort)</h6>
                                <p class="small text-muted mb-2">等待面板重新上线。通常在面板重启后使用，会持续探测直到面板恢复响应。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数</th><th>类型</th><th>必须</th><th>默认值</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">targetPort</td><td>string|number|null</td><td>否</td><td><code>null</code></td><td>目标端口号。如果提供，则探测 <code>protocol://hostname:targetPort/api/system/version</code>；如果为 <code>null</code>，则探测当前页面的 <code>/api/system/version</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0"><strong>返回值</strong>：Promise&lt;void&gt; — 面板恢复后 resolve。初始等待 1.5 秒后开始探测，每次探测间隔 1 秒，单次探测超时 2 秒。</p>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">uploadFileWithChunk(file, options)</h6>
                                <p class="small text-muted mb-2">大文件分片上传。仅当文件 ≥ 100MB 时启用分片上传，小于 100MB 的文件返回 <code>null</code>，需使用普通上传方式。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数字段</th><th>类型</th><th>必须</th><th>默认值</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">file</td><td>File</td><td class="text-danger">是</td><td>—</td><td>要上传的文件对象（浏览器 File API）。</td></tr>
                                            <tr><td class="font-monospace">options.initUrl</td><td>string</td><td class="text-danger">是</td><td>—</td><td>初始化上传的 API 端点。POST 请求，发送 <code>{ fileName, fileSize, totalChunks, ...extraInitData }</code>。后端应返回 <code>{ uploadId: string }</code>。</td></tr>
                                            <tr><td class="font-monospace">options.uploadUrl</td><td>string</td><td>否</td><td><code>"/api/files/chunk/upload"</code></td><td>分片上传 API 端点。POST 请求，发送 FormData（含 <code>chunk</code> 文件分片、<code>uploadId</code>、<code>chunkIndex</code>）。</td></tr>
                                            <tr><td class="font-monospace">options.completeUrl</td><td>string</td><td class="text-danger">是</td><td>—</td><td>完成上传的 API 端点。POST 请求，发送 <code>{ uploadId }</code>。</td></tr>
                                            <tr><td class="font-monospace">options.cancelUrl</td><td>string</td><td>否</td><td><code>"/api/files/chunk/cancel"</code></td><td>取消上传的 API 端点。POST 请求，发送 <code>{ uploadId }</code>。上传失败时自动调用。</td></tr>
                                            <tr><td class="font-monospace">options.fieldName</td><td>string</td><td>否</td><td><code>"chunk"</code></td><td>FormData 中分片文件的字段名。</td></tr>
                                            <tr><td class="font-monospace">options.extraInitData</td><td>object</td><td>否</td><td><code>{}</code></td><td>初始化请求的额外数据。会合并到 initUrl 的请求体中。</td></tr>
                                            <tr><td class="font-monospace">options.onProgress</td><td>function</td><td>否</td><td><code>() =&gt; {}</code></td><td>进度回调函数。签名：<code>(uploadedBytes: number, totalBytes: number, chunkIndex: number, totalChunks: number) =&gt; void</code>。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0"><strong>返回值</strong>：Promise&lt;object|null&gt; — 文件 &lt; 100MB 返回 <code>null</code>；≥ 100MB 返回完成请求的响应数据。分片大小为 10MB。上传失败时自动调用取消接口。</p>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-success font-monospace small">isLargeFile(file)</h6>
                                <p class="small text-muted mb-2">判断文件是否为大文件（≥ 100MB）。用于决定是否启用分片上传。</p>
                                <div class="table-responsive mb-3">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="border-bottom"><th>参数</th><th>类型</th><th>必须</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace">file</td><td>File</td><td class="text-danger">是</td><td>浏览器 File 对象。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p class="small text-muted mb-0"><strong>返回值</strong>：boolean — <code>true</code> 表示文件 ≥ 100MB，应使用 <code>uploadFileWithChunk</code>；<code>false</code> 表示文件较小，使用普通上传。</p>
                            </div>
                        </div>
                    </section>

                    <hr class="my-5 opacity-10">

                    <section id="section-socket" class="doc-section mb-5">
                        <div class="d-flex align-items-center mb-4">
                            <div class="section-icon-box bg-warning bg-opacity-10 text-warning rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
                                <i class="fa-solid fa-plug" style="font-size: 1.5rem;"></i>
                            </div>
                            <div>
                                <h3 class="fw-bold m-0 tracking-tight">Socket.IO 实时通信</h3>
                                <p class="text-muted small m-0 mt-1 opacity-75">前后端实时双向通信参考</p>
                            </div>
                        </div>
                        <p class="text-muted mb-4 lh-lg">面板使用 Socket.IO 实现前后端实时通信。前端通过 <code>import { socket } from '/js/socket.js'</code> 导入默认命名空间客户端实例。插件后端通过 <code>api.registerSocket()</code> 创建自己的命名空间。</p>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-satellite-dish me-2 text-warning"></i>面板全局 Socket 事件</h5>
                        <p class="text-muted mb-3 small">以下事件通过默认命名空间（<code>socket</code>）广播，前端可直接监听。部分事件支持实例级路由（带 <code>:instanceId</code> 后缀）。</p>
                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>事件名</th><th>数据类型</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="text-warning font-monospace py-2">console</td><td>string</td><td>当前活跃实例的控制台日志行。全局事件，仅在活跃实例时触发。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">console:{instanceId}</td><td>string</td><td>指定实例的控制台日志行。<code>{instanceId}</code> 替换为实例 ID，如 <code>console:default</code>。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">console_history</td><td>string[]</td><td>当前活跃实例的日志历史数组。连接时自动发送。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">console_history:{instanceId}</td><td>string[]</td><td>指定实例的日志历史数组。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">status</td><td>{ isRunning: boolean }</td><td>当前活跃实例的运行状态变更。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">status:{instanceId}</td><td>{ isRunning: boolean }</td><td>指定实例的运行状态变更。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">players_update</td><td>string[]</td><td>当前活跃实例的在线玩家列表更新。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">players_update:{instanceId}</td><td>string[]</td><td>指定实例的在线玩家列表更新。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">system_stats</td><td>object</td><td>系统状态更新。包含：<code>cpu</code> (string) CPU 使用率；<code>mem</code> (object) 内存信息；<code>mc</code> (object) MC 服务器信息；<code>hasBackupMod</code> (boolean, 可选)；<code>hasEasyAuth</code> (boolean, 可选)；<code>hasVoicechat</code> (boolean, 可选)；<code>isSetup</code> (boolean, 可选)。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">instances_update</td><td>object[]</td><td>实例列表更新。数据格式同 <code>store.instanceList</code>。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">restore_progress:{instanceId}</td><td>{ percent: number, message: string }</td><td>回档进度更新。<code>percent</code> 为 0-100 的进度百分比。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">restore_completed:{instanceId}</td><td>void</td><td>回档完成通知。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">restore_error:{instanceId}</td><td>string</td><td>回档错误通知。数据为错误消息字符串。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">java_install_progress</td><td>{ featureVersion: number, step: string, percent: number, message: string }</td><td>Java 安装进度。<code>step</code> 合法值：<code>"downloading"</code>、<code>"extracting"</code>、<code>"done"</code>、<code>"error"</code>。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">update_status</td><td>{ step: string, message: string }</td><td>面板更新状态。<code>step</code> 合法值：<code>"downloading"</code>、<code>"applying"</code>、<code>"restarting"</code>、<code>"cancelled"</code>、<code>"error"</code>。</td></tr>
                                            <tr><td class="text-warning font-monospace py-2">update_progress</td><td>{ progress: number, speed: number }</td><td>面板更新下载进度。<code>progress</code> 为已下载字节数；<code>speed</code> 为下载速度（字节/秒）。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <h5 class="fw-bold mb-3"><i class="fa-solid fa-code me-2 text-warning"></i>插件自定义 Socket 命名空间</h5>
                        <p class="text-muted mb-3 small">插件后端通过 <code>api.registerSocket(namespace, handlers)</code> 创建独立的 Socket.IO 命名空间。前端连接方式：</p>
                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border mb-4">
                            <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                <span class="fw-bold">插件 Socket 前后端通信示例</span>
                                <span class="text-muted opacity-50">Javascript</span>
                            </div>
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>// === 后端 index.js ===
const ns = api.registerSocket('/live', {
    'chat': (socket, message) => {
        api.logger.info('Chat received:', message);
        ns.emit('chat_response', { echo: message, from: socket.id });
    },
    'request_data': (socket, params) => {
        socket.emit('data_response', { result: 'processed', params });
    }
});

// 主动向所有连接的客户端广播
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

            // 方式一：连接插件自定义命名空间
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
                        </div>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <h6 class="fw-bold mb-2 text-warning font-monospace small">Socket.IO 客户端 API 参考</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>方法/属性</th><th>签名</th><th>说明</th></tr></thead>
                                        <tbody>
                                            <tr><td class="font-monospace py-2">ioClient(namespace)</td><td><code>(namespace?: string) =&gt; Socket</code></td><td>连接到指定命名空间。返回 Socket 实例。通过 <code>const { io: ioClient } = await import('/socket.io/socket.io.esm.min.js')</code> 获取。不传参数连接默认命名空间；传入命名空间路径连接指定命名空间，路径必须与后端 <code>registerSocket</code> 注册的路径一致。示例：<code>ioClient('/plugin/my-plugin/live')</code></td></tr>
                                            <tr><td class="font-monospace py-2">socket.on(event, callback)</td><td><code>(event: string, callback: Function) =&gt; void</code></td><td>监听服务端事件。<code>callback</code> 参数为事件数据。</td></tr>
                                            <tr><td class="font-monospace py-2">socket.emit(event, data)</td><td><code>(event: string, data: any) =&gt; void</code></td><td>向服务端发送事件。</td></tr>
                                            <tr><td class="font-monospace py-2">socket.disconnect()</td><td><code>() =&gt; void</code></td><td>断开连接。组件卸载时应调用此方法清理资源。</td></tr>
                                            <tr><td class="font-monospace py-2">socket.connected</td><td>boolean</td><td>是否已连接。只读属性。</td></tr>
                                            <tr><td class="font-monospace py-2">socket.id</td><td>string</td><td>Socket 连接 ID。只读属性。</td></tr>
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
                                <h3 class="fw-bold m-0 tracking-tight">插件生命周期</h3>
                                <p class="text-muted small m-0 mt-1 opacity-75">加载、运行、销毁的完整流程</p>
                            </div>
                        </div>
                        <p class="text-muted mb-4 lh-lg">插件从安装到卸载经历以下生命周期阶段。理解这些阶段对正确管理资源至关重要。</p>

                        <div class="card border-0 shadow-sm rounded-4 mb-4" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                            <div class="card-body p-4">
                                <div class="table-responsive">
                                    <table class="table table-sm dev-table mb-0 small text-muted">
                                        <thead><tr class="text-white opacity-75 border-bottom"><th>阶段</th><th>触发条件</th><th>行为</th><th>开发者应做什么</th></tr></thead>
                                        <tbody>
                                            <tr><td class="text-danger font-monospace py-2">发现 (discover)</td><td>面板启动或调用 <code>discover()</code></td><td>扫描 <code>plugins/</code> 目录，读取每个子目录的 <code>plugin.json</code>。验证 <code>id</code>、<code>name</code>、<code>version</code> 三个必须字段。读取持久化状态确定是否启用。</td><td>确保 <code>plugin.json</code> 格式正确且包含必须字段。</td></tr>
                                            <tr><td class="text-danger font-monospace py-2">加载 (load)</td><td>插件已启用且面板启动，或用户手动启用插件</td><td>使用 <code>require()</code> 加载入口文件（<code>main</code> 字段指定，默认 <code>index.js</code>）。验证导出是否为函数。创建 <code>api</code> 对象并调用入口函数。</td><td>入口函数必须导出异步函数。可返回含 <code>destroy</code> 方法的对象。</td></tr>
                                            <tr><td class="text-danger font-monospace py-2">运行 (running)</td><td>加载成功后</td><td>插件的 HTTP 路由、Socket 命名空间、侧边栏项和组件均已注册并可用。</td><td>正常提供服务。监听事件、处理请求。</td></tr>
                                            <tr><td class="text-danger font-monospace py-2">卸载 (unload)</td><td>用户禁用插件、更新插件或面板关闭</td><td>调用插件返回对象的 <code>destroy()</code> 方法（如果存在）。清除 <code>require.cache</code> 中的模块缓存。</td><td>在 <code>destroy()</code> 中清理所有资源：关闭子进程、断开数据库连接、清除定时器、移除监听器。</td></tr>
                                            <tr><td class="text-danger font-monospace py-2">启用 (enable)</td><td>用户在插件管理界面点击"启用"</td><td>设置 <code>_enabled = true</code>，持久化状态，然后调用 <code>load()</code>。</td><td>无需额外操作，系统自动加载。</td></tr>
                                            <tr><td class="text-danger font-monospace py-2">禁用 (disable)</td><td>用户在插件管理界面点击"禁用"</td><td>先调用 <code>unload()</code>，然后设置 <code>_enabled = false</code> 并持久化状态。</td><td>确保 <code>destroy()</code> 正确清理资源。</td></tr>
                                            <tr><td class="text-danger font-monospace py-2">安装 (install)</td><td>用户上传 ZIP 或指定目录</td><td>解压到 <code>plugins/[id]/</code> 目录。如果已存在则先卸载旧版本。重新扫描并自动加载（如果启用）。</td><td>ZIP 包内可直接包含插件文件，或包含一层子目录。</td></tr>
                                            <tr><td class="text-danger font-monospace py-2">卸载 (uninstall)</td><td>用户在插件管理界面点击"卸载"</td><td>先 <code>unload()</code>，然后删除插件目录，清除持久化状态，从内存中移除。</td><td>确保 <code>destroy()</code> 清理所有外部资源（插件目录会被整体删除）。</td></tr>
                                            <tr><td class="text-danger font-monospace py-2">更新 (update)</td><td>用户上传同 ID 插件的 ZIP</td><td>等同于安装流程：先卸载旧版，复制新版文件，重新扫描并加载。</td><td>确保配置文件存放在 <code>api.getDataDir()</code> 返回的 data 目录中（该目录在更新时会被覆盖，重要数据应存放在 <code>api.getGlobalDataDir()</code> 下）。</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="code-block-wrapper shadow-sm rounded-4 overflow-hidden border">
                            <div class="code-header d-flex justify-content-between px-3 py-2 small bg-dark bg-opacity-10 border-bottom">
                                <span class="fw-bold">生命周期管理最佳实践</span>
                                <span class="text-muted opacity-50">Javascript</span>
                            </div>
                            <pre v-pre class="p-3 small mb-0 dev-code-block" style="background: var(--c-surface-elevated); overflow-x: auto; white-space: pre;"><code>module.exports = async function(api) {
    let intervalId = null;
    let childProcess = null;
    const sockets = new Set();

    // 启动定时任务
    intervalId = setInterval(() => {
        api.logger.info('Periodic check...');
    }, 60000);

    // 启动子进程
    // childProcess = require('child_process').spawn('some-command');

    // 注册 Socket 命名空间
    const ns = api.registerSocket('/live', {
        'join': (socket) => {
            sockets.add(socket);
            socket.on('disconnect', () => sockets.delete(socket));
        }
    });

    // 返回 destroy 方法，确保资源正确清理
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

            // 3. 断开所有 Socket 连接
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
                                <h3 class="fw-bold m-0 tracking-tight">开发技巧与注意事项</h3>
                                <p class="text-muted small m-0 mt-1 opacity-75">常见问题、最佳实践与安全须知</p>
                            </div>
                        </div>

                        <div class="row g-4">
                            <div class="col-md-6">
                                <div class="card border-0 shadow-sm rounded-4 h-100" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                                    <div class="card-body p-4">
                                        <h6 class="fw-bold text-success mb-3"><i class="fa-solid fa-check-circle me-2"></i>最佳实践</h6>
                                        <ul class="small text-muted mb-0 ps-3 lh-lg">
                                            <li>使用 <code>api.getDataDir()</code> 存放插件私有数据，系统会自动创建目录</li>
                                            <li>跨插件共享数据使用 <code>api.getGlobalDataDir()</code></li>
                                            <li>所有 HTTP 路由自动附加认证中间件，无需手动验证</li>
                                            <li>前端组件卸载时务必断开 Socket 连接（<code>onUnmounted</code> 中调用 <code>disconnect()</code>）</li>
                                            <li>使用 <code>api.logger</code> 而非 <code>console.log</code>，便于日志溯源</li>
                                            <li>返回 <code>destroy</code> 方法清理所有资源（定时器、进程、连接）</li>
                                            <li>前端 API 调用使用 <code>api.get/post/put/delete</code>，自动附加认证和实例 ID</li>
                                            <li>使用 <code>$t()</code> 翻译函数支持多语言</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-0 shadow-sm rounded-4 h-100" style="background: var(--c-surface-elevated); border: 1px solid rgba(255,255,255,0.05) !important;">
                                    <div class="card-body p-4">
                                        <h6 class="fw-bold text-danger mb-3"><i class="fa-solid fa-triangle-exclamation me-2"></i>注意事项</h6>
                                        <ul class="small text-muted mb-0 ps-3 lh-lg">
                                            <li>插件 ID 一旦发布不应更改，它作为目录名和 API 路径的一部分</li>
                                            <li>更新插件时整个目录会被覆盖，data 目录内的文件也会被替换</li>
                                            <li>不要直接修改面板核心文件，仅通过 <code>api</code> 对象提供的接口操作</li>
                                            <li>前端组件必须使用 ES Module 格式（<code>export default</code>）</li>
                                            <li>后端入口必须导出函数（<code>module.exports = async function(api) {}</code>）</li>
                                            <li>Socket 命名空间路径为 <code>/plugin/[插件ID]/[自定义路径]</code>，前端连接时需使用完整路径</li>
                                            <li>避免在全局作用域创建长连接或定时器，应在入口函数内创建并在 <code>destroy</code> 中清理</li>
                                            <li>插件间不要直接通信，通过全局 Socket 事件或共享数据目录间接交互</li>
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
            { id: 'intro', title: '快速开始', icon: 'fa-rocket' },
            { id: 'manifest', title: 'plugin.json 参考', icon: 'fa-file-code' },
            { id: 'backend', title: '后端开发与 API', icon: 'fa-server' },
            { id: 'frontend', title: '前端开发', icon: 'fa-display' },
            { id: 'socket', title: 'Socket.IO 通信', icon: 'fa-plug' },
            { id: 'lifecycle', title: '插件生命周期', icon: 'fa-heart-pulse' },
            { id: 'tips', title: '开发技巧', icon: 'fa-lightbulb' }
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
