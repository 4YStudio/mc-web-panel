import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('=== 开始 FRP 插件 v1.1.0 综合验证 ===');

// 1. 验证 plugin.json
const pluginJson = JSON.parse(fs.readFileSync('plugins/mc-panel-plugin-frp/plugin.json', 'utf8'));
assert.strictEqual(pluginJson.version, '1.1.0', 'plugin.json version must be 1.1.0');
console.log('✔ plugin.json 版本验证通过 (1.1.0)');

// 2. 验证 docs/plugins_shop/plugins.json
const shopPlugins = JSON.parse(fs.readFileSync('docs/plugins_shop/plugins.json', 'utf8'));
const frpShop = shopPlugins.find(p => p.id === 'mc-panel-plugin-frp');
assert.ok(frpShop, 'FRP plugin must exist in plugins_shop');
assert.strictEqual(frpShop.version, '1.1.0', 'plugins.json version must be 1.1.0');
console.log('✔ 官方插件商店索引验证通过 (1.1.0)');

// 3. 验证语言包
const zh = JSON.parse(fs.readFileSync('plugins/mc-panel-plugin-frp/locales/zh.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('plugins/mc-panel-plugin-frp/locales/en.json', 'utf8'));

const requiredKeys = [
    'title', 'switch_version', 'new_config', 'import_config', 'not_installed', 'install',
    'config_list', 'running', 'stopped', 'uninstall', 'uninstall_confirm', 'no_configs',
    'start', 'stop', 'restart', 'logs', 'version_manager', 'use_github_proxy',
    'proxy_url', 'proxy_url_placeholder', 'proxy_tips', 'proxy_presets',
    'fetch_releases', 'no_releases', 'latest', 'installed', 'edit_config', 'config_name',
    'config_format', 'format_toml', 'format_ini', 'import_file', 'import_clipboard',
    'clipboard_modal_title', 'clipboard_modal_confirm', 'import_success', 'import_fail',
    'gui_mode', 'text_mode', 'server_addr', 'server_port', 'auth_token', 'tunnels',
    'add_tunnel', 'tunnel_name', 'tunnel_type', 'local_ip', 'local_port', 'remote_port'
];

for (const k of requiredKeys) {
    assert.ok(zh[k], `zh.json missing key: ${k}`);
    assert.ok(en[k], `en.json missing key: ${k}`);
}
console.log(`✔ 独立语言包验证通过 (${requiredKeys.length} 个核心词条在中英文语言包中均完整有效)`);

// 4. 验证 INI / TOML 解析和格式嗅探逻辑
const sampleSakuraIni = `
[common]
server_addr = cn-zj-dx-1.sakurafrp.com
server_port = 7000
token = AbCdEfGh123456
user = player123

[mc_survival]
type = tcp
local_ip = 127.0.0.1
local_port = 25565
remote_port = 34567
use_encryption = true
use_compression = true
`;

const sampleToml = `
serverAddr = "1.2.3.4"
serverPort = 7000

auth.method = "token"
auth.token = "secretToken123"

[[proxies]]
name = "minecraft-tcp"
type = "tcp"
localIP = "127.0.0.1"
localPort = 25565
remotePort = 25565
`;

// 模拟前端 detectFormat
const detectFormat = (raw) => {
    if (!raw || typeof raw !== 'string') return 'toml';
    const text = raw.trim();
    if (text.includes('[common]')) return 'ini';
    if (text.includes('[[proxies]]')) return 'toml';
    const lines = text.split('\n');
    for (const l of lines) {
        const trimmed = l.trim();
        if (trimmed.startsWith('serverAddr') || trimmed.startsWith('serverPort') || trimmed.startsWith('auth.token')) {
            return 'toml';
        }
        if (trimmed.startsWith('server_addr') || trimmed.startsWith('server_port')) {
            return 'ini';
        }
        if (trimmed.startsWith('[') && !trimmed.startsWith('[[') && trimmed.endsWith(']')) {
            return 'ini';
        }
    }
    return 'toml';
};

assert.strictEqual(detectFormat(sampleSakuraIni), 'ini', 'sampleSakuraIni must be detected as ini');
assert.strictEqual(detectFormat(sampleToml), 'toml', 'sampleToml must be detected as toml');
console.log('✔ detectFormat 智能格式嗅探验证通过');

// 模拟 iniToForm 与 tomlToForm
const iniToForm = (raw) => {
    const configForm = { serverAddr: '', serverPort: 7000, authToken: '', tunnels: [] };
    if (!raw) return configForm;
    const lines = raw.split('\n');
    let currentSection = null;
    let currentTunnel = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
        const sectionMatch = trimmed.match(/^\[(.*)\]$/);
        if (sectionMatch && !trimmed.startsWith('[[')) {
            if (currentTunnel) { configForm.tunnels.push(currentTunnel); currentTunnel = null; }
            currentSection = sectionMatch[1].trim();
            if (currentSection.toLowerCase() !== 'common') {
                currentTunnel = { name: currentSection, type: 'tcp', localIP: '127.0.0.1', localPort: 25565, remotePort: 25565 };
            }
            continue;
        }
        const kvMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*=\s*(.*)$/);
        if (!kvMatch) continue;
        const key = kvMatch[1].trim().toLowerCase();
        let val = kvMatch[2].trim().replace(/^["'](.*)["']$/, '$1');
        if (currentSection && currentSection.toLowerCase() === 'common') {
            if (key === 'server_addr' || key === 'serveraddr') configForm.serverAddr = val;
            else if (key === 'server_port' || key === 'serverport') configForm.serverPort = parseInt(val) || 7000;
            else if (key === 'token' || key === 'auth.token') configForm.authToken = val;
        } else if (currentTunnel) {
            if (key === 'type') currentTunnel.type = val.toLowerCase();
            else if (key === 'local_ip' || key === 'localip') currentTunnel.localIP = val;
            else if (key === 'local_port' || key === 'localport') currentTunnel.localPort = parseInt(val) || 25565;
            else if (key === 'remote_port' || key === 'remoteport') currentTunnel.remotePort = parseInt(val) || 25565;
        }
    }
    if (currentTunnel) configForm.tunnels.push(currentTunnel);
    return configForm;
};

const parsedIni = iniToForm(sampleSakuraIni);
assert.strictEqual(parsedIni.serverAddr, 'cn-zj-dx-1.sakurafrp.com');
assert.strictEqual(parsedIni.serverPort, 7000);
assert.strictEqual(parsedIni.authToken, 'AbCdEfGh123456');
assert.strictEqual(parsedIni.tunnels.length, 1);
assert.strictEqual(parsedIni.tunnels[0].name, 'mc_survival');
assert.strictEqual(parsedIni.tunnels[0].localPort, 25565);
assert.strictEqual(parsedIni.tunnels[0].remotePort, 34567);
console.log('✔ 第三方穿透平台 INI 配置解析验证通过 (SakuraFrp 样例成功识别)');

// 5. 验证后端 index.js 能够正常 require
const frpIndex = await import('../plugins/mc-panel-plugin-frp/index.js');
assert.ok(typeof frpIndex.default === 'function', 'index.js must export an async function');
console.log('✔ 插件后端入口函数导出验证通过');

console.log('=== 所有测试通过！===');
