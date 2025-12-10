const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const NODE_VERSION = 'v24.11.1';
const BUILD_DIR = 'dist_build';
const SQLITE_VERSION = 'v5.1.7';
const NAPI_VERSION = 'napi-v6';

// Note: Node.js v24+ only supports Windows x64 and arm64. 32-bit (x86) is NOT supported.
const TARGETS = [
    { name: 'linux-x64', nodeArch: 'linux-x64', ext: '', sqliteArch: 'linux-x64' },
    { name: 'linux-arm64', nodeArch: 'linux-arm64', ext: '', sqliteArch: 'linux-arm64' },
    { name: 'win-x64', nodeArch: 'win-x64', ext: '.exe', sqliteArch: 'win32-x64' },
    { name: 'win-arm64', nodeArch: 'win-arm64', ext: '.exe', sqliteArch: 'win32-arm64' },
    { name: 'macos-x64', nodeArch: 'darwin-x64', ext: '', sqliteArch: 'darwin-x64' },
    { name: 'macos-arm64', nodeArch: 'darwin-arm64', ext: '', sqliteArch: 'darwin-arm64' }
];

const downloadFile = (url, dest) => {
    console.log(`Downloading ${url}...`);
    try {
        execSync(`curl -S -L -o "${dest}" "${url}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Failed to download ${url}`);
    }
};

async function fetchSqliteBindings(target, buildPath) {
    const bindingDir = path.join(buildPath, 'node_modules', 'sqlite3', 'lib', 'binding', `${NAPI_VERSION}-${target.sqliteArch}`);
    const bindingFile = path.join(bindingDir, 'node_sqlite3.node');

    if (fs.existsSync(bindingFile)) return;

    fs.mkdirSync(bindingDir, { recursive: true });

    const tarName = `sqlite3-${SQLITE_VERSION}-${NAPI_VERSION}-${target.sqliteArch}.tar.gz`;
    const url = `https://github.com/TryGhost/node-sqlite3/releases/download/${SQLITE_VERSION}/${tarName}`;
    const tmpTar = path.join(buildPath, tarName);

    downloadFile(url, tmpTar);

    if (fs.existsSync(tmpTar)) {
        console.log(`Extracting ${tarName}...`);
        try {
            const tmpExtract = path.join(buildPath, 'sqlite_tmp_' + target.name);
            fs.mkdirSync(tmpExtract, { recursive: true });
            execSync(`tar -xf "${tmpTar}" -C "${tmpExtract}"`);

            const findCmd = `find "${tmpExtract}" -name "node_sqlite3.node"`;
            let foundPath = '';
            try { foundPath = execSync(findCmd).toString().trim(); } catch (e) { }

            if (foundPath) {
                fs.copyFileSync(foundPath, bindingFile);
                console.log(`Placed sqlite3 binding for ${target.name}`);
            } else {
                console.error(`Could not find node_sqlite3.node in ${tarName}`);
            }

            fs.rmSync(tmpExtract, { recursive: true, force: true });
            fs.unlinkSync(tmpTar);
        } catch (e) {
            console.error(`Failed to extract sqlite binding for ${target.name}`, e);
        }
    }
}

async function prepareBuildDir() {
    console.log('Preparing clean build directory...');
    if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    fs.mkdirSync(BUILD_DIR);

    console.log('Copying project files...');
    const manifest = {
        files: ['server.js', 'package.json'],
        dirs: ['public', 'api']
    };
    manifest.files.forEach(f => { if (fs.existsSync(f)) fs.copyFileSync(f, path.join(BUILD_DIR, f)); });
    manifest.dirs.forEach(d => { if (fs.existsSync(d)) fs.cpSync(d, path.join(BUILD_DIR, d), { recursive: true }); });

    console.log('Installing production dependencies...');
    execSync('npm install --omit=dev --no-package-lock --no-audit --no-fund', { cwd: BUILD_DIR, stdio: 'inherit' });

    console.log('Pruning...');
    try {
        execSync(`find node_modules -type f \\( -name "*.ts" -o -name "*.md" -o -name "LICENSE" -o -name "*.map" \\) -delete`, { cwd: BUILD_DIR });
        execSync(`find node_modules -type d \\( -name "test" -o -name "tests" -o -name "example" -o -name "examples" -o -name "docs" \\) -exec rm -rf {} +`, { cwd: BUILD_DIR });
    } catch (e) { }
}

async function buildTarget(target) {
    console.log(`\n=== Building for ${target.name} ===`);

    // Check if target already exists to skip? No, always rebuild as user might have changed code.

    const isWin = target.name.startsWith('win');
    const ext = isWin ? '.zip' : '.tar.xz';
    const distName = `node-${NODE_VERSION}-${target.nodeArch}`;
    const fileName = `${distName}${ext}`;
    const url = `https://nodejs.org/dist/${NODE_VERSION}/${fileName}`;
    const nodeBinName = isWin ? 'node.exe' : 'node';
    const localNodeBin = path.join(BUILD_DIR, nodeBinName);

    if (fs.existsSync(fileName)) console.log(`Using cached ${fileName}`);
    else downloadFile(url, fileName);

    console.log('Extracting Node.js...');
    try {
        if (isWin) {
            if (fs.existsSync(distName)) fs.rmSync(distName, { recursive: true, force: true });
            execSync(`unzip -q ${fileName}`);
            fs.copyFileSync(path.join(distName, 'node.exe'), localNodeBin);
            fs.rmSync(distName, { recursive: true, force: true });
        } else {
            execSync(`tar -xf ${fileName}`);
            fs.copyFileSync(path.join(distName, 'bin', 'node'), localNodeBin);
            fs.rmSync(distName, { recursive: true, force: true });
        }
        fs.chmodSync(localNodeBin, '755');
    } catch (e) {
        console.error(`Failed to extract/setup node for ${target.name}`, e);
        return;
    }

    await fetchSqliteBindings(target, BUILD_DIR);

    const outputName = `mc-web-panel-${target.name}${target.ext}`;
    console.log(`Packaging to ${outputName}...`);

    try {
        const caxaPath = path.join(__dirname, 'node_modules', '.bin', 'caxa');
        execSync(`"${caxaPath}" --no-dedupe --input "${BUILD_DIR}" --output "${outputName}" -- "{{caxa}}/${nodeBinName}" "{{caxa}}/server.js"`, { stdio: 'inherit' });

        console.log(`Success: ${outputName}`);
    } catch (e) {
        console.error(`Build failed for ${target.name}`, e);
    }
}

async function main() {
    await prepareBuildDir();
    for (const target of TARGETS) await buildTarget(target);
    console.log('\nAll builds finished.');
}

main();
