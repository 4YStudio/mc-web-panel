const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

const NODE_VERSION = 'v24.11.1';
const BUILD_DIR = 'dist_build';
const SQLITE_VERSION = 'v5.1.7';
const NAPI_VERSION = 'napi-v6';

// Map our target names to Node.js dist names and Sqlite3 asset names
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
        // throw e; // Don't crash for one failed target, potentially?
    }
};

async function prepareLogo() {
    if (!fs.existsSync('logo.png')) {
        console.warn('logo.png not found, skipping icon generation.');
        return;
    }
    console.log('Generating logo.ico...');
    try {
        const buf = await pngToIco('logo.png');
        fs.writeFileSync('logo.ico', buf);
    } catch (e) {
        console.error('Failed to generate ico:', e);
    }
}

// Download sqlite3 prebuilt binary for a specific platform and place it where bindings can find it
// Usually: node_modules/sqlite3/lib/binding/{napi_version}-{platform}-{arch}/node_sqlite3.node
// For N-API: napi-v6-{platform}-{arch} (e.g. napi-v6-win32-x64)
async function fetchSqliteBindings(target, buildPath) {
    const bindingDir = path.join(buildPath, 'node_modules', 'sqlite3', 'lib', 'binding', `${NAPI_VERSION}-${target.sqliteArch}`);
    const bindingFile = path.join(bindingDir, 'node_sqlite3.node');

    if (fs.existsSync(bindingFile)) return;

    fs.mkdirSync(bindingDir, { recursive: true });

    // URL format: https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/napi-v6-linux-x64.tar.gz
    // Note: It's a tar.gz containing contents? Or just the .node?
    // node-pre-gyp usually packages it as: {module_name}-v{version}-{napi_build_version}-{platform}-{arch}.tar.gz
    // Inside tar: lib/binding/napi-v6-{platform}-{arch}/node_sqlite3.node  <-- Need to verify structure or extract flatten
    // Let's try downloading the tar.gz and extracting.

    const tarName = `${NAPI_VERSION}-${target.sqliteArch}.tar.gz`;
    const url = `https://github.com/TryGhost/node-sqlite3/releases/download/${SQLITE_VERSION}/${tarName}`;
    const tmpTar = path.join(buildPath, tarName);

    downloadFile(url, tmpTar);

    if (fs.existsSync(tmpTar)) {
        console.log(`Extracting ${tarName}...`);
        try {
            // Unpack to temp dir then move
            const tmpExtract = path.join(buildPath, 'sqlite_tmp_' + target.name);
            fs.mkdirSync(tmpExtract, { recursive: true });
            execSync(`tar -xf "${tmpTar}" -C "${tmpExtract}"`);

            // Find the .node file
            // The tar usually contains `lib/binding/...` structure or just the file.
            // We use `find` to locate node_sqlite3.node
            const findCmd = `find "${tmpExtract}" -name "node_sqlite3.node"`;
            const foundPath = execSync(findCmd).toString().trim();

            if (foundPath) {
                fs.copyFileSync(foundPath, bindingFile);
                console.log(`Placed sqlite3 binding for ${target.name}`);
            } else {
                console.error(`Could not find node_sqlite3.node in ${tarName}`);
            }

            // Cleanup
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

    // Copy project files
    console.log('Copying project files...');
    const manifest = {
        files: ['server.js', 'package.json'],
        dirs: ['public', 'api']
    };
    manifest.files.forEach(f => { if (fs.existsSync(f)) fs.copyFileSync(f, path.join(BUILD_DIR, f)); });
    manifest.dirs.forEach(d => { if (fs.existsSync(d)) fs.cpSync(d, path.join(BUILD_DIR, d), { recursive: true }); });

    // Install prod dependencies
    console.log('Installing production dependencies...');
    execSync('npm install --omit=dev --no-package-lock --no-audit --no-fund', { cwd: BUILD_DIR, stdio: 'inherit' });

    // Prune
    console.log('Pruning...');
    try {
        execSync(`find node_modules -type f \\( -name "*.ts" -o -name "*.md" -o -name "LICENSE" -o -name "*.map" \\) -delete`, { cwd: BUILD_DIR });
        execSync(`find node_modules -type d \\( -name "test" -o -name "tests" -o -name "example" -o -name "examples" -o -name "docs" \\) -exec rm -rf {} +`, { cwd: BUILD_DIR });
    } catch (e) { }
}

async function buildTarget(target) {
    console.log(`\n=== Building for ${target.name} ===`);

    // 1. Download/Setup Node binary
    // Linux/Mac: tar.xz. Windows: zip.
    const isWin = target.name.startsWith('win');
    const ext = isWin ? '.zip' : '.tar.xz';
    const distName = `node-${NODE_VERSION}-${target.nodeArch}`;
    const fileName = `${distName}${ext}`;
    const url = `https://nodejs.org/dist/${NODE_VERSION}/${fileName}`;
    const nodeBinName = isWin ? 'node.exe' : 'node';
    const localNodeBin = path.join(BUILD_DIR, nodeBinName); // We reuse this name but overwrite it for each target

    // Download Node
    if (fs.existsSync(fileName)) {
        console.log(`Using cached ${fileName}`);
    } else {
        downloadFile(url, fileName);
    }

    // Extract Node
    console.log('Extracting Node.js...');
    try {
        if (isWin) {
            // unzip
            if (fs.existsSync(distName)) fs.rmSync(distName, { recursive: true, force: true });
            execSync(`unzip -q ${fileName}`);
            // Windows zip usually: node-v.../node.exe
            fs.copyFileSync(path.join(distName, 'node.exe'), localNodeBin);
            fs.rmSync(distName, { recursive: true, force: true });
        } else {
            // tar
            execSync(`tar -xf ${fileName}`);
            // Linux/Mac tar usually: node-v.../bin/node
            fs.copyFileSync(path.join(distName, 'bin', 'node'), localNodeBin);
            fs.rmSync(distName, { recursive: true, force: true });
        }
        fs.chmodSync(localNodeBin, '755');
    } catch (e) {
        console.error(`Failed to extract/setup node for ${target.name}`, e);
        return;
    }

    // 2. Fetch Sqlite3 Bindings
    await fetchSqliteBindings(target, BUILD_DIR);

    // 3. Run Caxa
    const outputName = `mc-web-panel-${target.name}${target.ext}`;
    console.log(`Packaging to ${outputName}...`);

    try {
        const caxaPath = path.join(__dirname, 'node_modules', '.bin', 'caxa');
        // Command construction
        // Windows needs double backslashes? No, caxa handles paths.
        // We use BUILD_DIR as input.
        // For Windows, we might need to ensure the stub matches? Caxa auto-detects based on extension?
        // Caxa docs: "In macOS and Linux, may have no extension... On Windows, must end in .exe"

        execSync(`"${caxaPath}" --no-dedupe --input "${BUILD_DIR}" --output "${outputName}" -- "{{caxa}}/${nodeBinName}" "{{caxa}}/server.js"`, { stdio: 'inherit' });

        // 4. Post-processing (Windows Icon)
        if (isWin && fs.existsSync('logo.ico')) {
            console.log('Injecting icon...');
            const resedit = path.join(__dirname, 'node_modules', '.bin', 'resedit');
            // resedit-cli: resedit -i logo.ico -o out.exe in.exe ? 
            // Check usage: resedit [options] <input>
            // Actually usually: resedit --icon logo.ico --output out.exe in.exe
            // Let's try in-place?
            // resedit-cli docs: --icon <file> <file>
            execSync(`"${resedit}" --icon logo.ico --output "${outputName}" "${outputName}"`);
        }

        console.log(`Success: ${outputName}`);
    } catch (e) {
        console.error(`Build failed for ${target.name}`, e);
    }
}

async function main() {
    await prepareLogo();
    await prepareBuildDir();

    for (const target of TARGETS) {
        await buildTarget(target);
    }

    console.log('\nAll builds finished.');
}

main();
