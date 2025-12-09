# MC Web Panel (Fabric Edition)

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Node.js](https://img.shields.io/badge/node-%3E%3D20-green.svg) ![Vue.js](https://img.shields.io/badge/vue-3.x-emerald.svg)

这是一个基于 Node.js 构建的轻量级、现代化 Minecraft 服务器网页管理面板。专为 **Fabric** 模组服务器设计，深度集成了 **Advanced Backups** 和 **EasyAuth** 等常用模组的管理功能。

面板采用前后端分离架构（Node.js + Vue 3 ESM），无需构建工具，开箱即用。

## ✨ 主要功能

### 🖥️ 仪表盘 & 控制台
*   **实时控制台**：支持彩色日志输出，实时查看服务器运行状态。
*   **资源监控**：实时显示 CPU、内存占用率以及在线玩家/最大玩家数进度条。
*   **历史日志**：刷新页面后自动拉取最近的历史日志，不会丢失上下文。
*   **电源控制**：启动、停止、强制关闭服务器。

### 📂 文件与模组管理
*   **全功能文件管理器**：支持上传（拖拽/多选）、下载、复制、移动、删除文件。
*   **在线编辑**：支持编辑 `.json`, `.properties`, `.toml`, `.conf` 等配置文件，提供全屏编辑器体验。
*   **模组管理**：
    *   **一键开关**：点击按钮即可禁用/启用模组（自动添加/移除 `.disabled` 后缀）。
    *   **批量操作**：支持批量上传模组、批量删除。
*   **压缩/解压**：支持将多个文件打包为 `.zip` 下载。

### 👥 玩家管理
*   **在线玩家操作**：
    *   踢出、封禁、清空背包、击杀。
    *   **模式切换**：通过弹窗快速切换生存/创造/旁观模式。
    *   **传送**：支持传送到坐标或指定玩家。
*   **智能头像显示**：
    *   自动检测正版账号，优先显示 **Minotar** 正版头像。
    *   非正版账号自动回退到 **LittleSkin**，并使用 CSS 技术裁剪皮肤源文件，完美还原头像（包括帽子层）。
*   **名单管理**：图形化管理白名单、OP 管理员、封禁名单。

### 🛡️ EasyAuth 认证集成
*   **自动识别**：检测到 `EasyAuth` 模组后自动显示管理菜单。
*   **账号管理**：查看已注册玩家，支持**注销（删除）**玩家账号。
*   **密码重置**：管理员可直接修改玩家密码（自动 BCrypt 加密）。
*   **配置管理**：支持 **图形化/文本双模式** 编辑 `main.conf` 等配置文件。

### 💾 备份管理 (Advanced Backups)
*   **深度集成**：专为 **Advanced Backups** 模组设计。
*   **智能回档**：
    *   自动识别 **全量 (Full)** 和 **差量 (Partial)** 备份。
    *   点击回档时，系统会自动停止服务器，备份当前地图，并**自动融合**最近的全量包和选中的差量包，一键恢复。
*   **在线备份**：在面板上一键触发 `/backup start`。
*   **配置管理**：图形化界面调整备份频率、保留策略等。

### 🔐 安全性
*   **2FA 双重验证**：首次启动生成二维码，必须使用 Google Authenticator 或类似应用绑定。
*   **登录保护**：必须输入正确的 TOTP 动态验证码才能访问面板。

## 🛠️ 安装与部署

### 1. 环境要求
*   **Node.js**: v20 或 v22 (LTS 版本推荐，以确保 `sqlite3` 兼容性)
*   **系统**: Linux (推荐 Ubuntu/Debian) / Windows / macOS

### 2. 安装依赖
```bash
# 克隆或下载本项目到本地
git clone https://github.com/4YStudio/mc-web-panel.git
cd mc-web-panel

# 安装 npm 依赖
npm install
```

> **注意**：本项目使用了 `sqlite3` 和 `bcryptjs`。如果你切换了 Node 版本，请务必执行 `npm rebuild` 或删除 `node_modules` 重新安装。

### 3. 准备服务器文件
将你的 Minecraft 服务端核心文件放入项目根目录下的 `mc_server` 文件夹中。

```text
mc-web-panel/
├── mc_server/
│   ├── fabric-server-launch.jar  <-- 你的启动核心
│   ├── eula.txt                  <-- eula=true
│   ├── server.properties
│   ├── mods/
│   └── ...
├── public/
├── server.js
└── ...
```

*如果你还没有服务端文件，运行一次面板，它会自动创建 `mc_server` 文件夹，你只需把 jar 包放进去即可。*

### 4. 修改配置
首次运行后，面板会在 `data/` 目录下自动生成 `config.json` 配置文件。您可以编辑此文件来修改面板设置：

| 配置项 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `port` | `3000` | 面板运行端口 |
| `defaultLang` | `'zh'` | 默认语言 ('zh' / 'en') |
| `theme` | `'auto'` | 默认主题 ('light' / 'dark' / 'auto') |
| `jarName` | `'fabric-server-launch.jar'` | 服务端核心文件名 |
| `javaPath` | `'java'` | **(new)** Java 可执行文件路径 (如 `/usr/bin/java`) |
| `javaArgs` | `['-Xms1G', '-Xmx4G']` | Java 启动内存参数等 |
| `sessionTimeout` | `7` | 登录状态保持天数 |
| `maxLogHistory` | `1000` | 控制台日志保留行数 |
| `monitorInterval` | `2000` | 系统状态监控刷新间隔(ms) |

> **注意**：`sessionSecret` 是自动生成的敏感字段，请勿随意修改，否则会导致所有已登录用户掉线。

## 🚀 启动面板

```bash
node server.js

//为了保证面板的完整性和安全性，建议使用PM2来管理面板

//安装PM2
npm install -g pm2

//启动面板
pm2 start server.js

//设置开机自启动
pm2 startup
pm2 save

//查看面板状态
pm2 status

//停止面板
pm2 stop mc_panel

//重启面板
pm2 restart mc_panel
```

启动成功后，控制台会输出访问地址，默认为：
`http://localhost:3000`

### 首次登录
1.  打开浏览器访问面板。
2.  页面会显示一个 **二维码**。
3.  使用手机上的 **Google Authenticator (身份验证器)** 或 **Microsoft Authenticator** 扫描二维码。
4.  输入手机上显示的 6 位数字代码进行登录。
5.  *注意：二维码仅在首次未配置时显示，密钥会保存在 `data/config.json` 中。*

## 📁 目录结构说明

```text
.
├── data/               # 面板数据 (config.json, panel.log)
├── mc_server/          # Minecraft 服务器核心目录
├── public/             # 前端静态资源
│   ├── css/            # 样式表
│   ├── js/             # 前端逻辑 (Vue组件, Store, API)
│   ├── js/             # 前端逻辑 (Vue组件, Store, API)
│   │   ├── components/ # 模块化组件 (Backup, EasyAuth等)
│   │   └── ...
│   └── index.html      # 入口页面
└── server.js           # 后端核心程序 (Express + Socket.io)
```

## 🧩 常见问题 (FAQ)

**Q: 为什么 EasyAuth 管理界面报错 500？**
A: 请检查你的 Node.js 版本。`sqlite3` 依赖需要与 Node 版本匹配。建议使用 `nvm` 切换到 Node v20 LTS，并重新运行 `npm install`。

**Q: 回档进度条不动？**
A: 回档涉及解压大文件，如果服务器磁盘读写较慢，请耐心等待。不要关闭页面，回档完成后会弹出提示。

**Q: 头像显示为 Steve？**
A: 面板会先检测 PlayerDB 正版库，再检测 LittleSkin。如果两者都无数据，或者网络连接失败，则显示默认 Steve。

## 📄 许可证

MIT License. 欢迎 Fork 和提交 PR！
