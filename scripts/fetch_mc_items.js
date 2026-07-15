const https = require('https');
const fs = require('fs');
const path = require('path');

const MAX_ITEMS_TO_CRAWL = 600; // Increase to 600 items for a truly comprehensive inventory!
const CONCURRENCY = 15; // Concurrency limit

const LEGACY_MAP = {
    '14': 'minecraft:stone_bricks',
    '15': 'minecraft:chiseled_stone_bricks',
    '22': 'minecraft:cobweb',
    '23': 'minecraft:wither_skeleton_skull',
    '47': 'minecraft:red_bed',
    '58': 'minecraft:oak_button',
    '931': 'minecraft:melon',
    '11014': 'minecraft:oak_pressure_plate',
    '11041': 'minecraft:mossy_stone_bricks',
    '11042': 'minecraft:cracked_stone_bricks',
    '11210': 'minecraft:skeleton_skull',
    '11212': 'minecraft:zombie_head',
    '11213': 'minecraft:player_head',
    '11214': 'minecraft:creeper_head',
    '33819': 'minecraft:dragon_head',
    '222723': 'minecraft:oak_door',
    '222724': 'minecraft:oak_trapdoor',
    '1002': 'minecraft:cod',
    '1003': 'minecraft:cooked_cod',
    '1014': 'minecraft:bone_meal',
    '1015': 'minecraft:light_gray_dye',
    '1016': 'minecraft:gray_dye',
    '1017': 'minecraft:ink_sac',
    '1018': 'minecraft:pink_dye',
    '1019': 'minecraft:red_dye',
    '1020': 'minecraft:orange_dye',
    '1021': 'minecraft:yellow_dye',
    '1022': 'minecraft:lime_dye',
    '1023': 'minecraft:green_dye',
    '1024': 'minecraft:light_blue_dye',
    '1025': 'minecraft:cyan_dye',
    '1026': 'minecraft:lapis_lazuli',
    '1027': 'minecraft:purple_dye',
    '1028': 'minecraft:magenta_dye',
    '1029': 'minecraft:cocoa_beans',
    '7308': 'minecraft:tropical_fish',
    '7311': 'minecraft:pufferfish'
};


const OUTPUT_JSON_PATH = path.join(__dirname, '../public/js/items.json');
const IMG_DIR = path.join(__dirname, '../public/img/items');

// Ensure image directory exists
if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
}

// Copy default logo as fallback image 0.png
try {
    const logoSrc = path.join(__dirname, '../public/logo.png');
    const logoDest = path.join(IMG_DIR, '0.png');
    if (fs.existsSync(logoSrc)) {
        fs.copyFileSync(logoSrc, logoDest);
    }
} catch (e) {
    console.error("Failed to copy default logo:", e);
}

function fetchUrl(url) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            let chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', (err) => {
                console.error(`[Crawler] Response stream error for ${url}:`, err.message);
                resolve(null);
            });
        });
        req.on('error', (err) => {
            console.error(`[Crawler] Request error for ${url}:`, err.message);
            resolve(null);
        });
    });
}

function downloadImage(url, destPath) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                resolve(false);
                return;
            }
            const fileStream = fs.createWriteStream(destPath);
            res.pipe(fileStream);
            
            res.on('error', (err) => {
                console.error(`[Crawler] Image response stream error for ${url}:`, err.message);
                fileStream.close();
                fs.unlink(destPath, () => {});
                resolve(false);
            });
            
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(true);
            });
            
            fileStream.on('error', (err) => {
                console.error(`[Crawler] Image file stream error for ${destPath}:`, err.message);
                fileStream.close();
                fs.unlink(destPath, () => {});
                resolve(false);
            });
        });
        
        req.on('error', (err) => {
            console.error(`[Crawler] Image request error for ${url}:`, err.message);
            resolve(false);
        });
    });
}

function getCategory(id) {
    id = id.toLowerCase();
    if (id.includes('sword') || id.includes('helmet') || id.includes('chestplate') || id.includes('leggings') || id.includes('boots') || id.includes('shield') || id.includes('bow') || id.includes('crossbow') || id.includes('trident')) {
        return 'combat';
    }
    if (id.includes('pickaxe') || id.includes('axe') || id.includes('shovel') || id.includes('hoe') || id.includes('fishing_rod') || id.includes('shears') || id.includes('flint_and_steel') || id.includes('compass') || id.includes('clock') || id.includes('lead') || id.includes('elytra')) {
        return 'tools';
    }
    if (id.includes('cooked') || id.includes('apple') || id.includes('bread') || id.includes('cake') || id.includes('cookie') || id.includes('beef') || id.includes('porkchop') || id.includes('mutton') || id.includes('chicken') || id.includes('potato') || id.includes('carrot') || id.includes('melon') || id.includes('pumpkin') || id.includes('pie') || id.includes('stew') || id.includes('soup') || id.includes('honey_bottle') || id.includes('milk_bucket') || id.includes('fish') || id.includes('mutton') || id.includes('rabbit') || id === 'minecraft:cookie' || id === 'minecraft:sweet_berries') {
        return 'food';
    }
    if (id.includes('ore') || id === 'minecraft:diamond' || id === 'minecraft:emerald' || id === 'minecraft:coal' || id.includes('ingot') || id.includes('redstone') || id.includes('lapis') || id.includes('shard') || id.includes('dust') || id.includes('nugget') || id === 'minecraft:quartz') {
        return 'materials';
    }
    if (id.includes('egg') || id.includes('potion') || id.includes('experience') || id.includes('book') || id === 'minecraft:saddle' || id === 'minecraft:name_tag' || id.includes('totem') || id.includes('tnt') || id.includes('repeater') || id.includes('comparator') || id.includes('piston') || id.includes('slime')) {
        return 'special';
    }
    return 'building';
}

async function worker(idQueue, results) {
    while (idQueue.length > 0) {
        if (results.length >= MAX_ITEMS_TO_CRAWL) {
            break;
        }
        const id = idQueue.shift();
        
        try {
            const html = await fetchUrl(`https://www.mcmod.cn/item/${id}.html`);
            if (!html) continue;
            
            // check original MC
            const isOriginal = html.includes('[MC]我的世界原版 (Minecraft)');
            if (!isOriginal) continue;
            
            // Parse title
            const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
            if (!titleMatch) continue;
            const titlePart = titleMatch[1].split(' - ')[0].trim();
            
            // Match "NameCN (NameEN)"
            const nameMatch = titlePart.match(/^([^\(]+)\s*\(([^)]+)\)/);
            if (!nameMatch) continue;
            
            const namecn = nameMatch[1].trim();
            const nameen = nameMatch[2].trim();
            
            // Extract item ID from give command
            const cmdMatch = html.match(/data-command="\/give @p ([a-zA-Z0-9_:]+)/);
            if (!cmdMatch) continue;
            let itemId = cmdMatch[1].trim();
            if (LEGACY_MAP[String(id)]) {
                itemId = LEGACY_MAP[String(id)];
            }

            
            // Categorize
            const category = getCategory(itemId);
            
            // Download image
            const folder = Math.floor(id / 10000);
            const imgUrl = `https://i.mcmod.cn/item/icon/128x128/${folder}/${id}.png`;
            const destPath = path.join(IMG_DIR, `${id}.png`);
            
            const imgSuccess = await downloadImage(imgUrl, destPath);
            
            if (imgSuccess) {
                results.push({
                    no: id,
                    id: itemId,
                    namecn: namecn,
                    nameen: nameen,
                    category: category
                });
                console.log(`[Crawler] Successfully crawled ID ${id}: ${namecn} (${itemId}) [Total: ${results.length}]`);
            }
            
            // Polite delay
            await new Promise(r => setTimeout(r, 60));
            
        } catch (e) {
            // Silently catch error
        }
    }
}

async function run() {
    console.log("Step 1: Gathering original items with priorities from list pages 1 to 10...");
    const priorityItems = new Map();
    const normalItems = new Map();
    
    // We scan categories 1 to 10
    for (let cat = 1; cat <= 10; cat++) {
        try {
            const html = await fetchUrl(`https://www.mcmod.cn/item/list/1-${cat}.html`);
            if (!html) continue;
            
            // Match all items
            const regex = /<a[^>]*href="\/item\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
                const id = parseInt(match[1]);
                const name = match[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
                if (!name) continue;
                
                // If it is a stair, slab, fence, door, wall, gate, button, pressure plate, etc.
                const isPriority = name.includes('门') || 
                                   name.includes('活板') || 
                                   name.includes('栅栏') || 
                                   name.includes('楼梯') || 
                                   name.includes('台阶') || 
                                   name.includes('墙') || 
                                   name.includes('告示牌') || 
                                   name.includes('纽扣') || 
                                   name.includes('按钮') || 
                                   name.includes('压力板');
                
                if (isPriority) {
                    priorityItems.set(id, name);
                } else {
                    normalItems.set(id, name);
                }
            }
            console.log(`Category ${cat} parsed. Priorities: ${priorityItems.size}, Normals: ${normalItems.size}`);
        } catch (e) {
            console.error(`Error parsing category ${cat}:`, e.message);
        }
    }
    
    // De-duplicate priority and normal items
    // Construct final queue: priorities first, then normals
    const sortedPriorityIds = Array.from(priorityItems.keys()).sort((a, b) => a - b);
    const sortedNormalIds = Array.from(normalItems.keys()).sort((a, b) => a - b);
    
    const idQueue = [...sortedPriorityIds, ...sortedNormalIds];
    console.log(`\nQueue structured. Priority count: ${sortedPriorityIds.length}, Normal count: ${sortedNormalIds.length}. Total queue length: ${idQueue.length}`);
    console.log(`\nStep 2: Crawling detail pages (Target limit: ${MAX_ITEMS_TO_CRAWL})...`);
    
    const results = [];
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(worker(idQueue, results));
    }
    
    await Promise.all(workers);
    
    // Sort results by no
    results.sort((a, b) => a.no - b.no);
    
    // Write results to JSON
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(results, null, 4));
    console.log(`\nCrawler completed successfully!`);
    console.log(`Total crawled items: ${results.length}`);
    console.log(`Output saved to: ${OUTPUT_JSON_PATH}`);
}

run();
