# MC Web Panel v6.0

Modern, feature-rich Minecraft server management panel built with Node.js and Vue.js 3.

## Features

- **Dashboard**: Real-time server status, CPU/RAM monitoring, and console control.
- **Server Management**:
    - Start/Stop/Restart control.
    - Setup Wizard for installing Minecraft (Fabric/Vanilla) servers.
    - Server Properties editor (GUI & Text mode).
    - Server Icon management.
- **File Manager**: Web-based file browser with upload, delete, move, copy, and compress/decompress capabilities.
- **Mod Management**: Upload and manage mods.
- **Backup System**: 
    - Full & Differential backups.
    - One-click restore.
    - Scheduled snapshots (snapshots not yet fully implemented).
- **Player Management**: Manage whitelist, ops, and EasyAuth integration (change passwords, unregister).
- **Voice Chat**: Simple configuration editor for Voice Chat mod.
- **Multi-Platform Support**: Binaries for Linux, Windows, and macOS (x64/ARM64).

## Getting Started

### Validating Requirements
- Node.js v18+ (if running from source)
- Minecraft Server (or use built-in installer)

### Running from Source
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the development server:
   ```bash
   pnpm start
   ```
3. Access: `http://localhost:3000`

### Running from Binary
Download the appropriate executable for your platform from the releases.
- **Linux**: `./mc-web-panel-linux-x64`
- **Windows**: `mc-web-panel-win-x64.exe`
- **macOS**: `mc-web-panel-macos-x64`

When run, the panel will create the following directories in the same location:
- `data/`: Contains config files and logs.
- `mc_server/`: The directory where the Minecraft server runs.

## Building

This project uses `caxa` to bundle the Node.js runtime (v24.11.1) with the application.

1. Ensure requirements are met:
   ```bash
   pnpm install
   # On Linux/macOS, ensure tar/curl/unzip are available.
   ```
2. Run the build script:
   ```bash
   pnpm run build
   ```
   This will automatically:
   - Download Node.js binaries for Linux (x64/arm64), Windows (x64/arm64), and macOS (x64/arm64).
   - Fetch necessary `sqlite3` native bindings (N-API).
   - Generate `logo.ico` (requires `logo.png`).
   - Bundle self-extracting executables for all platforms.

## Localization
Supports English and Chinese (Simplified). Auto-detects based on browser or configurable in settings.

## License
MIT
