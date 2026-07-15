const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const SHOP_DIR = __dirname;
const OUTPUT_FILE = path.join(SHOP_DIR, 'plugins.json');

console.log('Scanning ZIP files in:', SHOP_DIR);
const plugins = [];

if (fs.existsSync(SHOP_DIR)) {
    const files = fs.readdirSync(SHOP_DIR);
    for (const file of files) {
        if (file.endsWith('.zip')) {
            const zipPath = path.join(SHOP_DIR, file);
            const stat = fs.statSync(zipPath);
            try {
                const zip = new AdmZip(zipPath);
                const entry = zip.getEntry('plugin.json');
                if (!entry) {
                    console.warn(`  Warning: plugin.json not found in ${file}`);
                    continue;
                }
                
                const metaContent = entry.getData().toString('utf8');
                const meta = JSON.parse(metaContent);
                
                // Extract properties
                const nameZh = typeof meta.name === 'object' ? meta.name.zh : meta.name;
                const descZh = typeof meta.description === 'object' ? meta.description.zh : meta.description;
                
                // Derive category based on ID or keywords
                let category = 'tools'; // default
                if (meta.id.includes('backup')) {
                    category = 'backups';
                } else if (meta.id.includes('frp')) {
                    category = 'network';
                } else if (meta.id.includes('auth') || meta.id.includes('easyauth')) {
                    category = 'security';
                }
                
                plugins.push({
                    id: meta.id,
                    name: nameZh || meta.id,
                    version: meta.version || '1.0.0',
                    author: meta.author || 'MWP Official',
                    description: descZh || '',
                    category: category,
                    permissions: meta.permissions || [],
                    icon: meta.icon || 'fa-puzzle-piece',
                    fileSize: stat.size,
                    downloadUrl: `./plugins_shop/${file}`
                });
                console.log(`  Successfully processed: ${file} (${(stat.size / 1024).toFixed(1)} KB)`);
            } catch (e) {
                console.error(`  Error parsing zip ${file}:`, e);
            }
        }
    }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(plugins, null, 4), 'utf8');
console.log('Successfully generated docs/plugins_shop/plugins.json');
