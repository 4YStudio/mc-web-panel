import { ref, watch, toRefs, computed } from '/js/vue.esm-browser.js';

// 全局缓存
const skinSourceCache = new Map();

export default {
    props: {
        player: { type: String, required: true },
        size: { type: Number, default: 64 }
    },
    template: `
    <div class="position-relative d-inline-block rounded bg-secondary overflow-hidden" 
         :style="{width: size+'px', height: size+'px'}">
        
        <!-- 模式A: 正版玩家 (直接使用图片链接) -->
        <img 
            v-if="sourceType === 'official'"
            :src="officialSrc" 
            :width="size" 
            :height="size"
            style="object-fit: cover; image-rendering: pixelated;"
            :alt="player"
        >

        <!-- 模式B: LittleSkin/盗版 (使用 CSS 裁剪皮肤源文件) -->
        <!-- 原理：将64x64的皮肤图放大8倍，然后通过偏移位置，只让头部区域露出来 -->
        <div v-else-if="sourceType === 'littleskin'" class="w-100 h-100 position-relative">
            <!-- 第一层：面部 (Face) -->
            <div class="position-absolute top-0 start-0 w-100 h-100"
                 :style="getSkinStyle(8, 8)"></div>
            
            <!-- 第二层：帽子/头发 (Overlay/Hat) -->
            <div class="position-absolute top-0 start-0 w-100 h-100"
                 :style="getSkinStyle(40, 8)"></div>
        </div>

        <!-- 加载中/默认 -->
        <div v-else class="w-100 h-100 d-flex align-items-center justify-content-center text-white-50" 
             :style="{fontSize: size*0.4+'px'}">
            <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
    </div>
    `,
    setup(props) {
        const { player, size } = toRefs(props);
        const sourceType = ref(''); // '' | 'official' | 'littleskin'
        
        const officialSrc = computed(() => `https://minotar.net/helm/${player.value}/${size.value}`);
        const littleSkinSrc = computed(() => `https://littleskin.cn/skin/${player.value}.png`);

        // --- CSS 裁剪核心算法 ---
        const getSkinStyle = (srcX, srcY) => {
            // MC皮肤标准：宽64px，头部宽8px。
            // 我们容器宽 size (例如64px)。
            // 比例 = size / 8。
            // 背景图总宽 = 64 * 比例 = size * 8。
            const scale = size.value * 8;
            
            // 偏移量 = -源坐标 * 比例
            const ratio = size.value / 8;
            const posX = -(srcX * ratio);
            const posY = -(srcY * ratio);

            return {
                backgroundImage: `url('${littleSkinSrc.value}')`,
                backgroundSize: `${scale}px`, // 放大背景图
                backgroundPosition: `${posX}px ${posY}px`, // 偏移以显示头部
                imageRendering: 'pixelated', // 像素风，防模糊
                backgroundRepeat: 'no-repeat'
            };
        };

        // --- 来源检测 ---
        const checkSource = async (name) => {
            if (skinSourceCache.has(name)) {
                sourceType.value = skinSourceCache.get(name);
                return;
            }

            try {
                // 1. 尝试 PlayerDB 检测正版
                const res = await fetch(`https://playerdb.co/api/player/minecraft/${name}`);
                const data = await res.json();

                if (data.success && data.code === 'player.found') {
                    skinSourceCache.set(name, 'official');
                    sourceType.value = 'official';
                } else {
                    // 2. 不是正版 -> 判定为 LittleSkin
                    // 即使 LittleSkin 也没有这个皮肤，显示的也是透明或错位图，比显示 loading 好
                    skinSourceCache.set(name, 'littleskin');
                    sourceType.value = 'littleskin';
                }
            } catch (e) {
                // 网络错误默认回退到 LittleSkin
                skinSourceCache.set(name, 'littleskin');
                sourceType.value = 'littleskin';
            }
        };

        watch(player, (val) => {
            sourceType.value = '';
            if (val) checkSource(val);
        }, { immediate: true });

        return { sourceType, officialSrc, getSkinStyle };
    }
};