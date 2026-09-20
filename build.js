const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NODE_VERSION = 'v24.11.1';
const DIST_ROOT = path.join(__dirname, 'dist');
const BUILD_DIR = path.join(DIST_ROOT, 'temp');
const OUTPUT_DIR = path.join(DIST_ROOT, 'releases');
const CACHE_DIR = path.join(DIST_ROOT, 'cache');

const TARGETS = [
    { name: 'linux-x64', nodeArch: 'linux-x64', ext: '' },
    { name: 'linux-arm64', nodeArch: 'linux-arm64', ext: '' },
];

const downloadFile = (url, dest) => {
    console.log(`Downloading ${url}...`);
    try {
        execSync(`curl -S -L -o "${dest}" "${url}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Failed to download ${url}`);
    }
};

async function prepareBuildDir() {
    console.log('Preparing clean build directory...');
    if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    fs.mkdirSync(DIST_ROOT, { recursive: true });
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    console.log('Copying project files...');
    const manifest = {
        files: ['server.js', 'plugin-loader.js', 'scroll-engine.js', 'package.json', 'server-icon.png'],
        dirs: ['public', 'plugins']
    };
    manifest.files.forEach(f => { 
        if (fs.existsSync(f)) {
            fs.copyFileSync(f, path.join(BUILD_DIR, f));
        } else {
            console.warn(`  Warning: File ${f} not found, skipping.`);
        }
    });
    
    manifest.dirs.forEach(d => { 
        if (fs.existsSync(d)) {
            console.log(`  Copying directory ${d}...`);
            fs.cpSync(d, path.join(BUILD_DIR, d), { recursive: true });
        } else {
            console.warn(`  Warning: Directory ${d} not found, skipping.`);
        }
    });

    console.log('Installing production dependencies...');
    const hasPnpm = fs.existsSync('node_modules/.pnpm') || fs.existsSync('pnpm-lock.yaml');
    if (hasPnpm) {
        console.log('  Detected pnpm node_modules (symlink-based). Using npm install to avoid symlink issues in packaged app...');
        execSync('npm install --omit=dev --no-audit --no-fund', { cwd: BUILD_DIR, stdio: 'inherit' });
    } else if (fs.existsSync('node_modules')) {
        console.log('  Copying node_modules from project root...');
        fs.cpSync('node_modules', path.join(BUILD_DIR, 'node_modules'), { recursive: true });
        console.log('  Pruning devDependencies...');
        execSync('npm prune --omit=dev --no-audit --no-fund', { cwd: BUILD_DIR, stdio: 'inherit' });
    } else {
        execSync('npm install --omit=dev --no-package-lock --no-audit --no-fund', { cwd: BUILD_DIR, stdio: 'inherit' });
    }

    console.log('Pruning...');
    try {
        // 1. 移除 bare-* 等原生依赖中包含的 android, ios, darwin, win32 等非 Linux 预编译二进制
        execSync(`find node_modules -type d -path "*/prebuilds/*" ! -name "linux-*" -exec rm -rf {} +`, { cwd: BUILD_DIR });
        // 2. 移除文档、类型定义、源码映射、日志与冗余测试文件
        execSync(`find node_modules -type f \\( -name "*.ts" -o -name "*.md" -o -name "LICENSE*" -o -name "*.map" -o -name "CHANGELOG*" -o -name "*.d.ts" \\) -delete`, { cwd: BUILD_DIR });
        execSync(`find node_modules -type d \\( -name "test" -o -name "tests" -o -name "example" -o -name "examples" -o -name "docs" -o -name ".github" \\) -exec rm -rf {} +`, { cwd: BUILD_DIR });
    } catch (e) { }
    console.log('Removing all .bin directories...');
    try {
        execSync(`find node_modules -type d -name ".bin" -exec rm -rf {} +`, { cwd: BUILD_DIR });
    } catch (e) {
        console.warn('Failed to recursively remove .bin dirs:', e);
    }
}

async function buildTarget(target) {
    console.log(`\n=== Building for ${target.name} ===`);

    const ext = '.tar.xz';
    const distName = `node-${NODE_VERSION}-${target.nodeArch}`;
    const fileName = `${distName}${ext}`;
    const filePath = path.join(CACHE_DIR, fileName);
    const url = `https://nodejs.org/dist/${NODE_VERSION}/${fileName}`;
    const localNodeBin = path.join(BUILD_DIR, 'node');

    if (fs.existsSync(filePath)) console.log(`Using cached ${fileName}`);
    else downloadFile(url, filePath);

    console.log('Extracting Node.js...');
    try {
        execSync(`tar -xf "${filePath}" -C "${CACHE_DIR}"`);
        fs.copyFileSync(path.join(CACHE_DIR, distName, 'bin', 'node'), localNodeBin);
        fs.rmSync(path.join(CACHE_DIR, distName), { recursive: true, force: true });
        fs.chmodSync(localNodeBin, '755');
    } catch (e) {
        console.error(`Failed to extract/setup node for ${target.name}`, e);
        return;
    }

    const pkg = require('./package.json');
    const outputName = `MWP-${pkg.version.replace(/\./g, '')}-${target.name}${target.ext}`;
    const outputPath = path.join(OUTPUT_DIR, outputName);
    console.log(`Packaging to ${outputName}...`);

    const stubMap = {
        'linux-x64': 'stub--linux--x64',
        'linux-arm64': 'stub--linux--arm64'
    };
    const stubName = stubMap[target.name];
    const caxaPkgPath = path.join(path.dirname(require.resolve('caxa')), '..');
    const stubPath = path.join(caxaPkgPath, 'stubs', stubName);

    if (!fs.existsSync(stubPath)) {
        console.error(`Stub not found for ${target.name}: ${stubPath}`);
        return;
    }

    try {
        const caxaPath = path.join(__dirname, 'node_modules', '.bin', 'caxa');
        execSync(`"${caxaPath}" --no-include-node --no-dedupe --stub "${stubPath}" --input "${BUILD_DIR}" --output "${outputPath}" -- "{{caxa}}/node" "{{caxa}}/server.js"`, { stdio: 'inherit' });

        console.log(`Success: ${outputPath}`);
    } catch (e) {
        console.error(`Build failed for ${target.name}`, e);
    }
}

async function main() {
    await prepareBuildDir();
    for (const target of TARGETS) await buildTarget(target);
    console.log('\nAll builds finished.');
    console.log(`Outputs available in: ${OUTPUT_DIR}`);

    // Optional: Keep temp dir for debugging, or remove it
    // if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}

main();
