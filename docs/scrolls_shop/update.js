const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const SHOP_DIR = __dirname;
const OUTPUT_FILE = path.join(SHOP_DIR, 'scrolls.json');

console.log('Scanning Scroll ZIP files in:', SHOP_DIR);
const scrolls = [];

if (fs.existsSync(SHOP_DIR)) {
    const files = fs.readdirSync(SHOP_DIR);
    for (const file of files) {
        if (file.endsWith('.zip')) {
            const zipPath = path.join(SHOP_DIR, file);
            const stat = fs.statSync(zipPath);
            try {
                const zip = new AdmZip(zipPath);
                const entry = zip.getEntry('scroll.json');
                if (!entry) {
                    console.warn(`  Warning: scroll.json not found in ${file}`);
                    continue;
                }
                
                const metaContent = entry.getData().toString('utf8');
                const meta = JSON.parse(metaContent);
                
                // Extract properties
                const nameZh = typeof meta.name === 'object' ? meta.name.zh : meta.name;
                const nameEn = typeof meta.name === 'object' ? meta.name.en : meta.name;
                const descZh = typeof meta.description === 'object' ? meta.description.zh : meta.description;
                const descEn = typeof meta.description === 'object' ? meta.description.en : meta.description;
                
                let category = meta.category || 'tools';
                if (!meta.category) {
                    if (meta.id.includes('clean') || meta.id.includes('manage')) {
                        category = 'tools';
                    } else if (meta.id.includes('welcome') || meta.id.includes('chat') || meta.id.includes('sleep')) {
                        category = 'interactive';
                    } else {
                        category = 'utility';
                    }
                }
                
                scrolls.push({
                    id: meta.id,
                    name: meta.name || nameZh,
                    version: meta.version || '1.0.0',
                    author: meta.author || '4YStudio',
                    description: meta.description || descZh,
                    category: category,
                    icon: meta.icon || 'fa-scroll',
                    color: meta.color || '#8b5cf6',
                    configSchema: meta.configSchema || {},
                    fileSize: stat.size,
                    downloadUrl: `./scrolls_shop/${file}`
                });
                console.log(`  Successfully processed scroll: ${file} (${(stat.size / 1024).toFixed(1)} KB)`);
            } catch (e) {
                console.error(`  Error parsing zip ${file}:`, e);
            }
        }
    }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(scrolls, null, 4), 'utf8');
console.log('Successfully generated docs/scrolls_shop/scrolls.json with', scrolls.length, 'scrolls');
