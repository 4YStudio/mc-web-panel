import { ref, watch, toRefs, computed, onUnmounted } from '/js/vue.esm-browser.js';

// 全局 UUID 缓存与成功源缓存
const playerUuidCache = new Map();
const playerFavSourceCache = new Map();

// 内置默认 Steve 经典像素面孔 (SVG Data URL，0网络依赖，100%兜底)
const STEVE_SVG_DATA_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="64" height="64" shape-rendering="crispEdges">
  <rect width="8" height="8" fill="#b47f63"/>
  <rect width="8" height="3" fill="#271e11"/>
  <rect x="0" y="3" width="1" height="1" fill="#271e11"/>
  <rect x="7" y="3" width="1" height="1" fill="#271e11"/>
  <rect x="1" y="4" width="1" height="1" fill="#ffffff"/>
  <rect x="2" y="4" width="1" height="1" fill="#2a3b8f"/>
  <rect x="5" y="4" width="1" height="1" fill="#2a3b8f"/>
  <rect x="6" y="4" width="1" height="1" fill="#ffffff"/>
  <rect x="3" y="5" width="2" height="1" fill="#95634c"/>
  <rect x="2" y="6" width="4" height="1" fill="#593922"/>
  <rect x="1" y="7" width="1" height="1" fill="#593922"/>
  <rect x="6" y="7" width="1" height="1" fill="#593922"/>
  <rect x="2" y="7" width="4" height="1" fill="#c48a6a"/>
</svg>
`.trim());

// 内置默认 Alex 经典像素面孔
const ALEX_SVG_DATA_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="64" height="64" shape-rendering="crispEdges">
  <rect width="8" height="8" fill="#dfaa78"/>
  <rect width="8" height="3" fill="#b25324"/>
  <rect x="0" y="3" width="1" height="1" fill="#b25324"/>
  <rect x="7" y="3" width="1" height="1" fill="#b25324"/>
  <rect x="1" y="4" width="1" height="1" fill="#ffffff"/>
  <rect x="2" y="4" width="1" height="1" fill="#357850"/>
  <rect x="5" y="4" width="1" height="1" fill="#357850"/>
  <rect x="6" y="4" width="1" height="1" fill="#ffffff"/>
  <rect x="3" y="5" width="2" height="1" fill="#d38965"/>
  <rect x="2" y="6" width="4" height="1" fill="#9e4e2b"/>
  <rect x="2" y="7" width="4" height="1" fill="#e7b98d"/>
</svg>
`.trim());

export default {
    props: {
        player: { type: String, required: true },
        size: { type: Number, default: 64 }
    },
    template: `
    <div class="position-relative d-inline-block rounded overflow-hidden flex-shrink-0" 
         :style="{width: size+'px', height: size+'px', background: 'rgba(255,255,255,0.06)'}">
        
        <img 
            :src="currentSrc" 
            :width="size" 
            :height="size"
            @error="handleImgError"
            @load="handleImgLoad"
            :style="{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                imageRendering: 'pixelated',
                opacity: isLoaded ? 1 : 0,
                transition: 'opacity 0.15s ease-in'
            }"
            :alt="player"
        >

        <!-- 加载中占位 -->
        <div v-if="!isLoaded" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center text-white-50" 
             :style="{fontSize: (size*0.35)+'px'}">
            <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
    </div>
    `,
    setup(props) {
        const { player, size } = toRefs(props);
        const sourceIndex = ref(0);
        const isLoaded = ref(false);
        const candidateList = ref([]);

        // 默认兜底头像
        const defaultSvg = computed(() => {
            const name = player.value || '';
            const isAlex = (name.charCodeAt(0) + name.length) % 2 === 1;
            return isAlex ? ALEX_SVG_DATA_URL : STEVE_SVG_DATA_URL;
        });

        // 构造候选源链路
        const updateCandidates = (name, uuid) => {
            if (!name) {
                candidateList.value = [defaultSvg.value];
                return;
            }

            const cleanName = encodeURIComponent(name);
            const targetId = uuid ? encodeURIComponent(uuid) : cleanName;
            const sz = size.value || 64;
            const list = [];

            // 1. 面板本地代理与缓存 (0ms 磁盘极速，已配置为纯 2D 正面头像)
            list.push(`/api/avatar?player=${cleanName}&size=${sz}`);

            // 2. Crafthead 2D 正面头像 (Cloudflare 边缘极速，含帽子层 Overlay)
            list.push(`https://crafthead.net/avatar/${targetId}/${sz}`);

            // 3. MC-Heads 2D 正面头像 (老牌超稳定，含帽子层)
            list.push(`https://mc-heads.net/avatar/${targetId}/${sz}`);

            // 4. LittleSkin 玩家 2D 正面头像 (国内最大第三方皮肤站)
            list.push(`https://littleskin.cn/avatar/player/${cleanName}?size=${sz}`);

            // 5. Minotar 2D 正面头像 (带 Helm 帽子层)
            list.push(`https://minotar.net/helm/${cleanName}/${sz}`);

            // 6. Crafatar 2D 正面头像 (备用候选源)
            if (uuid) {
                list.push(`https://crafatar.com/avatars/${encodeURIComponent(uuid)}?size=${sz}&overlay`);
            }

            // 7. 终极兜底：本地 Steve / Alex 经典 2D 像素面孔 SVG
            list.push(defaultSvg.value);

            // 如果该玩家此前已有成功记录的源类型，优先尝试该源
            const favUrl = playerFavSourceCache.get(name);
            if (favUrl && list.includes(favUrl)) {
                const idx = list.indexOf(favUrl);
                if (idx > 0) {
                    list.splice(idx, 1);
                    list.unshift(favUrl);
                }
            }

            candidateList.value = list;
            sourceIndex.value = 0;
            isLoaded.value = false;
        };

        const currentSrc = computed(() => {
            if (!candidateList.value.length) return defaultSvg.value;
            return candidateList.value[sourceIndex.value] || defaultSvg.value;
        });

        let isDisposed = false;
        onUnmounted(() => {
            isDisposed = true;
        });

        const handleImgError = () => {
            if (isDisposed) return;
            if (sourceIndex.value < candidateList.value.length - 1) {
                sourceIndex.value++;
            } else {
                // 如果所有网络源都失败，显示默认兜底
                isLoaded.value = true;
            }
        };

        const handleImgLoad = () => {
            if (isDisposed) return;
            isLoaded.value = true;
            const current = currentSrc.value;
            // 记住该玩家成功的源
            if (current && !current.startsWith('data:') && player.value) {
                playerFavSourceCache.set(player.value, current);
            }
        };

        // 异步尝试获取精确 Mojang UUID（非阻塞）
        const resolveUuid = async (name) => {
            if (isDisposed || !name || playerUuidCache.has(name)) {
                if (!isDisposed && playerUuidCache.has(name)) {
                    const uuid = playerUuidCache.get(name);
                    if (uuid) updateCandidates(name, uuid);
                }
                return;
            }

            try {
                const res = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(name)}`);
                if (isDisposed) return;
                const data = await res.json();
                if (isDisposed) return;
                if (data.success && data.code === 'player.found') {
                    const uuid = data.data.player.raw_id || data.data.player.id;
                    playerUuidCache.set(name, uuid);
                    // 仅当当前还未成功加载或是兜底时，或者为了更高画质更新 candidates
                    updateCandidates(name, uuid);
                } else {
                    playerUuidCache.set(name, '');
                }
            } catch {
                if (!isDisposed) playerUuidCache.set(name, '');
            }
        };

        watch(player, (newVal) => {
            if (newVal) {
                updateCandidates(newVal, playerUuidCache.get(newVal) || '');
                resolveUuid(newVal);
            } else {
                candidateList.value = [defaultSvg.value];
                isLoaded.value = true;
            }
        }, { immediate: true });

        watch(size, () => {
            if (player.value) {
                updateCandidates(player.value, playerUuidCache.get(player.value) || '');
            }
        });

        return {
            currentSrc,
            isLoaded,
            handleImgError,
            handleImgLoad
        };
    }
};