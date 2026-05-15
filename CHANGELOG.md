# MC Web Panel 更新日志

所有重要的项目变更都会记录在此文件中。

---

## [2.1.4] - 2026-05-15

### 🐛 Bug 修复

- **实例设置对话框布局**：修复了实例详情页右上角设置按钮弹出的对话框中，"服务器启动文件"下拉框和"刷新"按钮换行显示的问题，改为同一行并排显示
  - 将 `input-group` 布局改为 `d-flex gap-2 align-items-center` 布局
  - `CustomSelect` 组件包裹在 `flex:1; min-width:0` 的 div 中自动填充剩余空间
  - 刷新按钮添加 `flex-shrink-0` 防止被压缩
- **JVM 参数修改不生效**：修复了在实例设置对话框中修改 JVM 参数后对服务器运行没有影响的问题
  - **后端**：`/api/instances/update` 中 `javaArgs`/`jarName`/`javaPath` 的更新条件从 truthy 检查改为 `!== undefined`，确保空数组/空字符串也能正确保存
  - **后端**：`/api/server/start` 和新建实例逻辑中，`javaArgs` 回退条件从 `instConf.javaArgs || appConfig.javaArgs` 改为 `(instConf.javaArgs && instConf.javaArgs.length) ? ... : ...`，确保空数组时能正确回退到全局默认值
  - **前端**：Dashboard 的 `saveStartupSettings` 中，移除了 `if (payload.javaArgs)` 判断，改为始终将字符串按行分割并过滤为空数组，确保后端始终接收到数组而非字符串

---

## [2.1.3] - 2026-05-15

### 🐛 Bug 修复

- **FRP 管理器下载 404 错误**：修复了在中国网络环境下 FRP 插件下载失败返回 404 的问题
  - 新增 `nativeHttpGet` 函数，使用 Node.js 原生 `https`/`http` 模块作为 axios 的备选下载方式，解决打包后 axios 兼容性问题
  - 修复 `applyGithubProxy` 代理 URL 拼接逻辑：旧实现用 `url.replace()` 替换域名，改为正确的代理 URL 拼接方式（`proxy + url`）
  - 重写下载逻辑，添加多源回退机制：依次尝试 GitHub 源站 → 用户配置的 GitHub 代理 → 内置镜像源（ghfast.top、mirror.ghproxy.com、gh-proxy.com），每个源先尝试 axios，失败后用 native HTTP 重试
  - 改进 `/releases` 端点：GitHub API 不可达时自动尝试代理获取版本列表
  - 添加连接超时控制（15 秒），快速失败并回退到下一个源
  - 简化前端下载逻辑，移除冗余的 URL 探测代码（后端已自动处理回退）
- **中文文件名上传乱码**：修复了 `fixFileName` 函数对已经是正确 UTF-8 的文件名进行双重编码的 bug
  - 根本原因：新版浏览器（Chrome/Firefox）发送 `filename*=UTF-8''...`（RFC 5987），busboy 会正确解码为 UTF-8，但 `fixFileName` 仍然对它做 latin1→utf8 转换，导致双重编码
  - 新增字符码点检测逻辑：如果字符串包含码点 > 0xFF 的字符（如中文字符），说明已经是正确的 UTF-8，不需要修复；如果只包含 0x80-0xFF 范围的 latin1 扩展字符，才尝试 latin1→utf8 修复
- **删除遗留前端文件**：移除了 `public/js/components/FrpManager.js`，该文件使用错误的 API 路径 `/api/frp/*`（正确路径为 `/api/plugins/mc-panel-plugin-frp/*`），实际使用的是插件自带的 `frontend/FrpManager.js`

### 🔧 优化

- **FRP 下载日志增强**：每次下载尝试都有详细日志记录（源、方式、状态码、文件大小），方便排查网络问题
- **FRP 下载进度提示**：显示当前正在使用的下载源名称（如"正在从GitHub代理下载..."），用户可感知回退过程

---

## [2.1.2] - 2026-05-14

### 🐛 Bug 修复

- **剪切/复制按钮消息显示变量名**：修复了点击工具栏剪切按钮时，Toast 提示显示原始翻译键而非实际文字的问题，补充了缺失的 `clipboard_msg` 国际化翻译键
- **拖拽上传仅上传单个文件**：修复了从资源管理器多选文件拖入面板时只上传了一个文件的问题，改进了 `handleDrop` 和 `collectFilesFromEntry` 的逻辑，确保多文件和混合文件/文件夹拖拽均能正确处理
- **大目录读取不完整**：修复了 `webkitGetAsEntry` 的 `readEntries` API 一次最多返回 100 条目时，大目录内文件丢失的问题，改为循环读取直到无更多条目
- **中文文件名上传后乱码**：修复了上传含中文文件名的文件后，在面板上显示为乱码的问题。前端在 FormData 中额外传递正确编码的 `fileNames` JSON 数组，后端优先使用该数组而非 multer 解析的 `originalname`
- **ZIP 压缩包中文文件名乱码**：修复了解压含中文文件名的 ZIP 压缩包时文件名乱码的问题。解压时检查 ZIP 条目的 UTF-8 标志位（flag bit 11），未设置时尝试用 GBK 解码文件名（兼容 Windows 中文 ZIP）
- **下载和图片预览缺少 instanceId**：修复了 `downloadFile` 和图片预览 URL 缺少 `instanceId` 参数，导致多实例环境下请求失败的问题

### ✨ 新功能

- **解压对话框交互**：解压文件时现在会弹出对话框，用户可选择解压目标目录，默认为去掉扩展名的同名文件夹（之前是直接解压到同名目录，无交互）
- **压缩/解压进度显示**：压缩和解压操作现在会显示进度条（不确定进度模式），包含操作标题和文件名信息
- **图片预览**：点击图片文件名（PNG/JPG/GIF/WebP/BMP/SVG/ICO）可进入图片预览视图，支持缩放和自适应显示
- **压缩包预览**：点击压缩包文件名可进入压缩包内容列表预览，显示文件名、大小、压缩大小，支持直接点击"解压"按钮
- **新增后端 API**：
  - `GET /api/files/archive-list` — 列出压缩包内的文件列表（支持 GBK 文件名解码）
  - `GET /api/files/preview-image` — 图片流式预览（支持 MIME 类型识别和缓存头）
- **解压支持指定目标目录**：后端 `/api/files/operate` 的 `extract` 操作现在支持 `destination` 参数，允许指定解压目标路径

### 🔧 优化

- **文件图标增强**：图片文件（PNG/JPG/GIF 等）现在显示专属的图片图标（`fa-file-image`），而非通用文件图标
- **fixFileName 更健壮**：改进了文件名编码修复函数，添加安全检查，只在解码结果有效时才替换，避免破坏已正确编码的文件名
- **ZIP 解压路径安全**：解压时对每个条目的输出路径进行路径遍历检查（`startsWith` 验证），防止恶意 ZIP 文件的路径穿越攻击

---

## [2.1.0] - 2026-05-12

### ✨ 新功能

- **插件权限系统**：插件现在需要在 `plugin.json` 中声明所需的权限，运行时进行权限检查
- **插件设置系统**：支持插件自定义设置界面，用户可在面板中配置插件参数
- **插件存储系统**：插件拥有独立的键值对存储空间，支持持久化数据
- **插件事件系统**：插件可监听和触发自定义事件，实现插件间通信
- **插件状态监控**：支持查询插件的运行状态和生命周期
- **插件依赖管理**：插件可声明对其他插件的依赖关系
- **插件 API 版本控制**：引入 API 版本号，确保向后兼容性
- **新增后端 API**：
  - `GET /api/plugins/:id/permissions` — 查询插件权限
  - `GET /api/plugins/:id/settings` — 获取插件设置
  - `POST /api/plugins/:id/settings` — 保存插件设置
  - `GET /api/plugins/:id/storage` — 读取插件存储
  - `POST /api/plugins/:id/storage` — 写入插件存储
  - `DELETE /api/plugins/:id/storage/:key` — 删除插件存储项
  - `GET /api/plugins/:id/status` — 查询插件状态
  - `POST /api/plugins/:id/emit` — 触发插件事件
