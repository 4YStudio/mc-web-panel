const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT_DIR = path.resolve(__dirname, '..');
const PLUGINS_DIR = path.join(ROOT_DIR, 'plugins');
const SHOP_DIR = path.join(ROOT_DIR, 'docs', 'plugins_shop');
const UPDATE_SCRIPT = path.join(SHOP_DIR, 'update.js');

// 绝对黑名单：任何情况下严禁打包的文件或目录
const FORBIDDEN_DIRS = new Set([
    'data',
    'node_modules',
    '.git',
    '.vscode',
    '.idea',
    'extract-tmp',
    'tmp',
    'temp',
    '__pycache__'
]);

const FORBIDDEN_FILES = new Set([
    'config.json',
    'frp.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.DS_Store',
    'Thumbs.db',
    '.gitignore',
    '.packignore'
]);

const FORBIDDEN_EXTENSIONS = new Set([
    '.log',
    '.tmp',
    '.temp',
    '.bak',
    '.swp',
    '.db',
    '.sqlite',
    '.sqlite3',
    '.key',
    '.pem',
    '.crt',
    '.pfx',
    '.token',
    '.exe',
    '.dll',
    '.so',
    '.dylib'
]);

// 特定二进制可执行程序名称
const FORBIDDEN_BINARIES = new Set([
    'frpc',
    'frpc.exe',
    'frps',
    'frps.exe'
]);

/**
 * 判断相对路径是否应该被忽略
 */
function shouldIgnore(relPath, customIgnores = []) {
    // 统一转换为正斜杠
    const normalized = relPath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const fileName = parts[parts.length - 1];
    const ext = path.extname(fileName).toLowerCase();

    // 1. 检查各级目录是否在黑名单中
    for (let i = 0; i < parts.length - 1; i++) {
        if (FORBIDDEN_DIRS.has(parts[i].toLowerCase())) {
            return { ignore: true, reason: `黑名单目录: ${parts[i]}` };
        }
    }

    // 2. 检查文件名黑名单
    if (FORBIDDEN_FILES.has(fileName)) {
        return { ignore: true, reason: `黑名单文件: ${fileName}` };
    }

    // 3. 检查敏感后缀
    if (FORBIDDEN_EXTENSIONS.has(ext)) {
        return { ignore: true, reason: `黑名单后缀 (${ext}): ${fileName}` };
    }

    // 4. 检查二进制可执行文件
    if (FORBIDDEN_BINARIES.has(fileName.toLowerCase())) {
        return { ignore: true, reason: `二进制可执行程序: ${fileName}` };
    }

    // 5. 检查隐藏文件（以点开头，除了允许的特殊项）
    if (fileName.startsWith('.') && fileName !== '.package-lock.json') {
        return { ignore: true, reason: `隐藏文件: ${fileName}` };
    }

    // 6. 检查环境配置文件
    if (fileName.startsWith('.env')) {
        return { ignore: true, reason: `环境变量配置文件: ${fileName}` };
    }

    // 7. 自定义 .packignore 规则
    for (const rule of customIgnores) {
        if (rule && (normalized === rule || normalized.startsWith(rule + '/') || fileName === rule)) {
            return { ignore: true, reason: `.packignore 规则: ${rule}` };
        }
    }

    return { ignore: false };
}

/**
 * 加载插件目录下的 .packignore 规则
 */
function loadCustomIgnores(pluginDir) {
    const packIgnorePath = path.join(pluginDir, '.packignore');
    if (!fs.existsSync(packIgnorePath)) return [];
    try {
        const content = fs.readFileSync(packIgnorePath, 'utf8');
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch {
        return [];
    }
}

/**
 * 递归收集插件内所有合格的文件
 */
function collectPluginFiles(pluginDir, currentRelDir = '', customIgnores = []) {
    const collected = [];
    const skipped = [];
    const dir = path.join(pluginDir, currentRelDir);

    if (!fs.existsSync(dir)) return { collected, skipped };

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const relPath = currentRelDir ? `${currentRelDir}/${entry.name}` : entry.name;
        const check = shouldIgnore(relPath, customIgnores);

        if (check.ignore) {
            skipped.push({ path: relPath, reason: check.reason });
            continue;
        }

        if (entry.isDirectory()) {
            const sub = collectPluginFiles(pluginDir, relPath, customIgnores);
            collected.push(...sub.collected);
            skipped.push(...sub.skipped);
        } else if (entry.isFile()) {
            collected.push({
                relPath: relPath.replace(/\\/g, '/'),
                fullPath: path.join(dir, entry.name)
            });
        }
    }

    return { collected, skipped };
}

/**
 * 打包单个插件
 */
function packPlugin(pluginId) {
    const pluginDir = path.join(PLUGINS_DIR, pluginId);
    if (!fs.existsSync(pluginDir)) {
        console.error(`❌ 错误: 插件目录不存在: ${pluginDir}`);
        return false;
    }

    const manifestFile = path.join(pluginDir, 'plugin.json');
    if (!fs.existsSync(manifestFile)) {
        console.error(`❌ 错误: 未找到 plugin.json 清单文件: ${manifestFile}`);
        return false;
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch (e) {
        console.error(`❌ 错误: 解析 plugin.json 失败: ${e.message}`);
        return false;
    }

    console.log(`\n📦 开始安全打包: ${manifest.name?.zh || manifest.name || pluginId} (ID: ${pluginId}, 版本: ${manifest.version || '1.0.0'})`);

    const customIgnores = loadCustomIgnores(pluginDir);
    const { collected, skipped } = collectPluginFiles(pluginDir, '', customIgnores);

    if (collected.length === 0) {
        console.error(`❌ 错误: 插件中未发现有效源码文件！`);
        return false;
    }

    if (skipped.length > 0) {
        console.log(`  🛡️ 已安全过滤并拦截 ${skipped.length} 个非源码/敏感文件:`);
        const showCount = Math.min(skipped.length, 8);
        for (let i = 0; i < showCount; i++) {
            console.log(`     - [拦截] ${skipped[i].path} (${skipped[i].reason})`);
        }
        if (skipped.length > showCount) {
            console.log(`     ... 以及其余 ${skipped.length - showCount} 个条目`);
        }
    }

    // 构建 ZIP
    if (!fs.existsSync(SHOP_DIR)) {
        fs.mkdirSync(SHOP_DIR, { recursive: true });
    }
    const targetZip = path.join(SHOP_DIR, `${pluginId}.zip`);
    const zip = new AdmZip();

    for (const file of collected) {
        const fileContent = fs.readFileSync(file.fullPath);
        const zipEntryDir = path.dirname(file.relPath);
        const zipEntryName = path.basename(file.relPath);
        zip.addFile(
            zipEntryDir === '.' ? zipEntryName : `${zipEntryDir}/${zipEntryName}`,
            fileContent
        );
    }

    zip.writeZip(targetZip);

    // 打包后二次安全完整性审计
    const verifyZip = new AdmZip(targetZip);
    const zipEntries = verifyZip.getEntries().map(e => e.entryName);
    const dangerousEntries = zipEntries.filter(entry => {
        const check = shouldIgnore(entry);
        return check.ignore;
    });

    if (dangerousEntries.length > 0) {
        console.error(`🚨 安全审计失败！ZIP 中依然检测到违规条目:`, dangerousEntries);
        fs.unlinkSync(targetZip);
        console.error(`❌ 已紧急销毁生成的危险包: ${targetZip}`);
        return false;
    }

    const stat = fs.statSync(targetZip);
    console.log(`  ✅ 打包成功! 文件数: ${collected.length}, 包大小: ${(stat.size / 1024).toFixed(1)} KB -> ${targetZip}`);
    return true;
}

/**
 * 主执行流程
 */
function main() {
    const args = process.argv.slice(2);
    const target = args[0] || 'all';

    console.log(`========================================`);
    console.log(`🚀 云语面板插件安全打包构建工具`);
    console.log(`========================================`);

    let successCount = 0;
    let failCount = 0;

    if (target === 'all') {
        if (!fs.existsSync(PLUGINS_DIR)) {
            console.error(`❌ plugins 目录不存在: ${PLUGINS_DIR}`);
            process.exit(1);
        }

        const plugins = fs.readdirSync(PLUGINS_DIR).filter(item => {
            const pPath = path.join(PLUGINS_DIR, item);
            return fs.statSync(pPath).isDirectory() && fs.existsSync(path.join(pPath, 'plugin.json'));
        });

        console.log(`🔍 扫描到 ${plugins.length} 个待打包插件...`);

        for (const p of plugins) {
            const ok = packPlugin(p);
            if (ok) successCount++;
            else failCount++;
        }
    } else {
        // 单个插件打包（支持简写，如 "frp" 或完整 "mc-panel-plugin-frp"）
        let pluginId = target;
        if (!fs.existsSync(path.join(PLUGINS_DIR, pluginId))) {
            const match = fs.readdirSync(PLUGINS_DIR).find(p => p.includes(target));
            if (match) pluginId = match;
        }

        const ok = packPlugin(pluginId);
        if (ok) successCount++;
        else failCount++;
    }

    console.log(`\n----------------------------------------`);
    console.log(`📊 打包总结: 成功 ${successCount} 个, 失败 ${failCount} 个`);

    if (successCount > 0 && fs.existsSync(UPDATE_SCRIPT)) {
        console.log(`🔄 正在更新插件商店索引 (plugins.json)...`);
        try {
            // 通过子进程或直接执行 update.js
            const cp = require('child_process');
            cp.execSync(`node "${UPDATE_SCRIPT}"`, { stdio: 'inherit' });
        } catch (e) {
            console.error(`⚠️ 更新索引失败: ${e.message}`);
        }
    }

    console.log(`🎉 全部完成！`);
    if (failCount > 0) {
        process.exit(1);
    }
}

main();
