# MC Web Panel

[English](#english) | [中文](#chinese)

<a name="english"></a>
## 🇺🇸 English

### Introduction
MC Web Panel is a lightweight, modern, and high-performance Minecraft server management panel built with Node.js and Vue 3. It provides a beautiful web interface to manage your Fabric server, players, files, and more.

### Features
- **Dashboard**: Real-time server status, CPU/RAM usage, and console output.
- **File Manager**: Web-based file management with upload, download, edit, and unzip capabilities.
- **Player Manager**: Manage whitelist, OPs, bans, and kick/ban/teleport online players.
- **Mod Manager**: Easily upload and deleting mods.
- **Backup Manager**: Create and restore backups (snapshots/differential).
- **Security**: 2FA (Google Authenticator) support.
- **Multi-Platform**: Runs on Linux (x64/ARM64) and Windows (x64).
- **One-Click Update**: Automatically download and apply the latest version.

### Supported Mods
This panel features dedicated GUI integration for the following mods:
*   **Simple Voice Chat**: Configure voice chat settings (port, password, etc.) directly from the panel.
*   **Easy Auth**: Manage registered users, change passwords, and unregister users.
*   **Advanced Backup**: Create and restore backups (snapshots/differential).

### Installation & Usage
1.  Download the executable for your platform from the Releases page.
2.  Place it in an empty directory (recommended).
3.  Run the executable:
    *   **Linux**: `./mc-web-panel-linux-x64 start`
    *   **Windows**: Double-click `mc-web-panel-win-x64.exe`
4.  Open your browser and visit `http://localhost:3000`.
5.  Follow the setup wizard to install a Minecraft server or point it to your existing server jar.

### CLI Commands

| Command | Description |
|---|---|
| `start` | Start the panel (runs in background, default) |
| `stop` | Stop the panel |
| `restart` | Restart the panel |
| `host <port>` | Change the panel port (e.g., `host 3001`) |
| `reset` | Reset the 2FA key and print the new secret |
| `help` | Show help information |

**Examples:**
```bash
./mc-web-panel-linux-x64 start       # Start panel in background
./mc-web-panel-linux-x64 stop        # Stop the panel
./mc-web-panel-linux-x64 restart     # Restart the panel
./mc-web-panel-linux-x64 host 8080   # Change port to 8080
./mc-web-panel-linux-x64 reset       # Reset 2FA credentials
```

---

<a name="chinese"></a>
## 🇨🇳 中文

### 简介
MC Web Panel 是一个基于 Node.js 和 Vue 3 构建的轻量级、现代化且高性能的 Minecraft 服务器管理面板。它提供了一个美观的 Web 界面来管理您的 Fabric 服务器、玩家、文件等。

### 功能特性
- **通过 Web 管理**: 实时查看服务器状态、CPU/内存使用率和控制台输出。
- **文件管理**: 支持在线上传、下载、编辑和解压文件。
- **玩家管理**: 管理白名单、管理员 (OP)、黑名单，以及踢出/封禁/传送在线玩家。
- **模组管理**: 轻松上传和删除模组。
- **备份管理**: 创建和还原备份（支持快照和增量备份）。
- **安全**: 支持 2FA (Google 身份验证器) 双重验证。
- **多平台支持**: 支持 Linux (x64/ARM64) 和 Windows (x64)。
- **一键更新**: 自动下载并应用最新版本。

### 模组兼容性
本面板为以下模组提供了专属的图形化管理界面：
*   **Simple Voice Chat (简单语音聊天)**: 直接在面板中配置语音聊天设置（端口、密码等）。
*   **Easy Auth (简单认证)**: 管理已注册用户、修改密码和注销用户。
*   **Advanced Backup (高级备份)**: 创建和还原备份（支持快照和增量备份）。

### 安装与使用
1.  从 Release 页面下载对应平台的执行文件。
2.  将其放置在一个空目录中（推荐）。
3.  运行可执行文件：
    *   **Linux**: `./mc-web-panel-linux-x64 start`
    *   **Windows**: 双击 `mc-web-panel-win-x64.exe`
4.  打开浏览器访问 `http://localhost:3000`。
5.  跟随设置向导安装新的 Minecraft 服务器，或指定现有的服务端 JAR 文件。

### 命令行管理

| 命令 | 说明 |
|---|---|
| `start` | 启动面板（后台运行，默认行为） |
| `stop` | 停止面板 |
| `restart` | 重启面板 |
| `host <端口>` | 修改面板端口（如 `host 3001`） |
| `reset` | 重置 2FA 密钥并打印新密钥 |
| `help` | 显示帮助信息 |

**使用示例：**
```bash
./mc-web-panel-linux-x64 start       # 后台启动面板
./mc-web-panel-linux-x64 stop        # 停止面板
./mc-web-panel-linux-x64 restart     # 重启面板
./mc-web-panel-linux-x64 host 8080   # 将端口改为 8080
./mc-web-panel-linux-x64 reset       # 重置 2FA 密钥
```
