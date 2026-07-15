import { ref, computed, watch, onMounted, onUnmounted, getCurrentInstance, nextTick } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal } from '../utils.js';
import Avatar from './Avatar.js';

const LEGACY_ITEMS = {
    'minecraft:stone_bricks': { id: 'minecraft:stonebrick', data: 0 },
    'minecraft:mossy_stone_bricks': { id: 'minecraft:stonebrick', data: 1 },
    'minecraft:cracked_stone_bricks': { id: 'minecraft:stonebrick', data: 2 },
    'minecraft:chiseled_stone_bricks': { id: 'minecraft:stonebrick', data: 3 },
    'minecraft:cobweb': { id: 'minecraft:web', data: 0 },
    'minecraft:red_bed': { id: 'minecraft:bed', data: 14 },
    'minecraft:oak_button': { id: 'minecraft:wooden_button', data: 0 },
    'minecraft:melon': { id: 'minecraft:melon_block', data: 0 },
    'minecraft:oak_pressure_plate': { id: 'minecraft:wooden_pressure_plate', data: 0 },
    'minecraft:skeleton_skull': { id: 'minecraft:skull', data: 0 },
    'minecraft:wither_skeleton_skull': { id: 'minecraft:skull', data: 1 },
    'minecraft:zombie_head': { id: 'minecraft:skull', data: 2 },
    'minecraft:player_head': { id: 'minecraft:skull', data: 3 },
    'minecraft:creeper_head': { id: 'minecraft:skull', data: 4 },
    'minecraft:dragon_head': { id: 'minecraft:skull', data: 5 },
    'minecraft:oak_door': { id: 'minecraft:wooden_door', data: 0 },
    'minecraft:oak_trapdoor': { id: 'minecraft:trapdoor', data: 0 },
    'minecraft:cod': { id: 'minecraft:fish', data: 0 },
    'minecraft:salmon': { id: 'minecraft:fish', data: 1 },
    'minecraft:pufferfish': { id: 'minecraft:fish', data: 2 },
    'minecraft:tropical_fish': { id: 'minecraft:fish', data: 3 },
    'minecraft:cooked_cod': { id: 'minecraft:cooked_fish', data: 0 },
    'minecraft:cooked_salmon': { id: 'minecraft:cooked_fish', data: 1 },
    'minecraft:ink_sac': { id: 'minecraft:dye', data: 0 },
    'minecraft:red_dye': { id: 'minecraft:dye', data: 1 },
    'minecraft:green_dye': { id: 'minecraft:dye', data: 2 },
    'minecraft:cocoa_beans': { id: 'minecraft:dye', data: 3 },
    'minecraft:lapis_lazuli': { id: 'minecraft:dye', data: 4 },
    'minecraft:purple_dye': { id: 'minecraft:dye', data: 5 },
    'minecraft:cyan_dye': { id: 'minecraft:dye', data: 6 },
    'minecraft:light_gray_dye': { id: 'minecraft:dye', data: 7 },
    'minecraft:gray_dye': { id: 'minecraft:dye', data: 8 },
    'minecraft:pink_dye': { id: 'minecraft:dye', data: 9 },
    'minecraft:lime_dye': { id: 'minecraft:dye', data: 10 },
    'minecraft:yellow_dye': { id: 'minecraft:dye', data: 11 },
    'minecraft:light_blue_dye': { id: 'minecraft:dye', data: 12 },
    'minecraft:magenta_dye': { id: 'minecraft:dye', data: 13 },
    'minecraft:orange_dye': { id: 'minecraft:dye', data: 14 },
    'minecraft:bone_meal': { id: 'minecraft:dye', data: 15 }
};

const UNGIVEABLE_IDS = new Set([
    'minecraft:air',
    'minecraft:cave_air',
    'minecraft:void_air',
    'minecraft:water',
    'minecraft:lava',
    'minecraft:nether_portal',
    'minecraft:portal',
    'minecraft:end_portal',
    'minecraft:end_gateway',
    'minecraft:fire',
    'minecraft:soul_fire',
    'minecraft:moving_piston',
    'minecraft:frosted_ice',
    'minecraft:bubble_column'
]);

const ENCHANTMENTS = [
    { id: 'minecraft:protection', namecn: '保护', nameen: 'Protection', maxLvl: 4 },
    { id: 'minecraft:fire_protection', namecn: '火焰保护', nameen: 'Fire Protection', maxLvl: 4 },
    { id: 'minecraft:feather_falling', namecn: '摔落保护', nameen: 'Feather Falling', maxLvl: 4 },
    { id: 'minecraft:blast_protection', namecn: '爆炸保护', nameen: 'Blast Protection', maxLvl: 4 },
    { id: 'minecraft:projectile_protection', namecn: '弹射物保护', nameen: 'Projectile Protection', maxLvl: 4 },
    { id: 'minecraft:respiration', namecn: '水下呼吸', nameen: 'Respiration', maxLvl: 3 },
    { id: 'minecraft:aqua_affinity', namecn: '水下速掘', nameen: 'Aqua Affinity', maxLvl: 1 },
    { id: 'minecraft:thorns', namecn: '荆棘', nameen: 'Thorns', maxLvl: 3 },
    { id: 'minecraft:depth_strider', namecn: '深海探索者', nameen: 'Depth Strider', maxLvl: 3 },
    { id: 'minecraft:frost_walker', namecn: '冰霜行者', nameen: 'Frost Walker', maxLvl: 2 },
    { id: 'minecraft:binding_curse', namecn: '绑定诅咒', nameen: 'Binding Curse', maxLvl: 1 },
    { id: 'minecraft:sharpness', namecn: '锋利', nameen: 'Sharpness', maxLvl: 5 },
    { id: 'minecraft:smite', namecn: '亡灵杀手', nameen: 'Smite', maxLvl: 5 },
    { id: 'minecraft:bane_of_arthropods', namecn: '节肢杀手', nameen: 'Bane of Arthropods', maxLvl: 5 },
    { id: 'minecraft:knockback', namecn: '击退', nameen: 'Knockback', maxLvl: 2 },
    { id: 'minecraft:fire_aspect', namecn: '火焰附加', nameen: 'Fire Aspect', maxLvl: 2 },
    { id: 'minecraft:looting', namecn: '抢夺', nameen: 'Looting', maxLvl: 3 },
    { id: 'minecraft:sweeping', namecn: '横扫之刃', nameen: 'Sweeping Edge', maxLvl: 3 },
    { id: 'minecraft:efficiency', namecn: '效率', nameen: 'Efficiency', maxLvl: 5 },
    { id: 'minecraft:silk_touch', namecn: '精准采集', nameen: 'Silk Touch', maxLvl: 1 },
    { id: 'minecraft:unbreaking', namecn: '耐久', nameen: 'Unbreaking', maxLvl: 3 },
    { id: 'minecraft:fortune', namecn: '时运', nameen: 'Fortune', maxLvl: 3 },
    { id: 'minecraft:power', namecn: '力量', nameen: 'Power', maxLvl: 5 },
    { id: 'minecraft:punch', namecn: '冲击', nameen: 'Punch', maxLvl: 2 },
    { id: 'minecraft:flame', namecn: '火矢', nameen: 'Flame', maxLvl: 1 },
    { id: 'minecraft:infinity', namecn: '无限', nameen: 'Infinity', maxLvl: 1 },
    { id: 'minecraft:luck_of_the_sea', namecn: '海之眷顾', nameen: 'Luck of the Sea', maxLvl: 3 },
    { id: 'minecraft:lure', namecn: '饵钓', nameen: 'Lure', maxLvl: 3 },
    { id: 'minecraft:mending', namecn: '经验修补', nameen: 'Mending', maxLvl: 1 },
    { id: 'minecraft:vanishing_curse', namecn: '消失诅咒', nameen: 'Vanishing Curse', maxLvl: 1 }
];

const POTION_EFFECTS = [
    {
        id: 'healing',
        namecn: '治疗 (Instant Health)',
        nameen: 'Healing',
        variants: [
            { id: 'minecraft:healing', namecn: '治疗药水 I', nameen: 'Healing I' },
            { id: 'minecraft:strong_healing', namecn: '治疗药水 II', nameen: 'Healing II' }
        ]
    },
    {
        id: 'harming',
        namecn: '伤害 (Instant Damage)',
        nameen: 'Harming',
        variants: [
            { id: 'minecraft:harming', namecn: '伤害药水 I', nameen: 'Harming I' },
            { id: 'minecraft:strong_harming', namecn: '伤害药水 II', nameen: 'Harming II' }
        ]
    },
    {
        id: 'swiftness',
        namecn: '迅捷 (Speed)',
        nameen: 'Swiftness',
        variants: [
            { id: 'minecraft:swiftness', namecn: '迅捷药水 I (3:00)', nameen: 'Swiftness I' },
            { id: 'minecraft:long_swiftness', namecn: '迅捷药水 I (延长 - 8:00)', nameen: 'Swiftness I (Extended)' },
            { id: 'minecraft:strong_swiftness', namecn: '迅捷药水 II (1:30)', nameen: 'Swiftness II' }
        ]
    },
    {
        id: 'slowness',
        namecn: '缓慢 (Slowness)',
        nameen: 'Slowness',
        variants: [
            { id: 'minecraft:slowness', namecn: '缓慢药水 I (1:30)', nameen: 'Slowness I' },
            { id: 'minecraft:long_slowness', namecn: '缓慢药水 I (延长 - 4:00)', nameen: 'Slowness I (Extended)' },
            { id: 'minecraft:strong_slowness', namecn: '缓慢药水 IV (0:20)', nameen: 'Slowness IV' }
        ]
    },
    {
        id: 'strength',
        namecn: '力量 (Strength)',
        nameen: 'Strength',
        variants: [
            { id: 'minecraft:strength', namecn: '力量药水 I (3:00)', nameen: 'Strength I' },
            { id: 'minecraft:long_strength', namecn: '力量药水 I (延长 - 8:00)', nameen: 'Strength I (Extended)' },
            { id: 'minecraft:strong_strength', namecn: '力量药水 II (1:30)', nameen: 'Strength II' }
        ]
    },
    {
        id: 'regeneration',
        namecn: '再生 (Regeneration)',
        nameen: 'Regeneration',
        variants: [
            { id: 'minecraft:regeneration', namecn: '再生药水 I (0:45)', nameen: 'Regeneration I' },
            { id: 'minecraft:long_regeneration', namecn: '再生药水 I (延长 - 1:30)', nameen: 'Regeneration I (Extended)' },
            { id: 'minecraft:strong_regeneration', namecn: '再生药水 II (0:22)', nameen: 'Regeneration II' }
        ]
    },
    {
        id: 'poison',
        namecn: '剧毒 (Poison)',
        nameen: 'Poison',
        variants: [
            { id: 'minecraft:poison', namecn: '剧毒药水 I (0:45)', nameen: 'Poison I' },
            { id: 'minecraft:long_poison', namecn: '剧毒药水 I (延长 - 1:30)', nameen: 'Poison I (Extended)' },
            { id: 'minecraft:strong_poison', namecn: '剧毒药水 II (0:21)', nameen: 'Poison II' }
        ]
    },
    {
        id: 'fire_resistance',
        namecn: '抗火 (Fire Resistance)',
        nameen: 'Fire Resistance',
        variants: [
            { id: 'minecraft:fire_resistance', namecn: '抗火药水 (3:00)', nameen: 'Fire Resistance' },
            { id: 'minecraft:long_fire_resistance', namecn: '抗火药水 (延长 - 8:00)', nameen: 'Fire Resistance (Extended)' }
        ]
    },
    {
        id: 'night_vision',
        namecn: '夜视 (Night Vision)',
        nameen: 'Night Vision',
        variants: [
            { id: 'minecraft:night_vision', namecn: '夜视药水 (3:00)', nameen: 'Night Vision' },
            { id: 'minecraft:long_night_vision', namecn: '夜视药水 (延长 - 8:00)', nameen: 'Night Vision (Extended)' }
        ]
    },
    {
        id: 'invisibility',
        namecn: '隐形 (Invisibility)',
        nameen: 'Invisibility',
        variants: [
            { id: 'minecraft:invisibility', namecn: '隐形药水 (3:00)', nameen: 'Invisibility' },
            { id: 'minecraft:long_invisibility', namecn: '隐形药水 (延长 - 8:00)', nameen: 'Invisibility (Extended)' }
        ]
    },
    {
        id: 'water_breathing',
        namecn: '水下呼吸 (Water Breathing)',
        nameen: 'Water Breathing',
        variants: [
            { id: 'minecraft:water_breathing', namecn: '水下呼吸药水 (3:00)', nameen: 'Water Breathing' },
            { id: 'minecraft:long_water_breathing', namecn: '水下呼吸药水 (延长 - 8:00)', nameen: 'Water Breathing (Extended)' }
        ]
    },
    {
        id: 'weakness',
        namecn: '虚弱 (Weakness)',
        nameen: 'Weakness',
        variants: [
            { id: 'minecraft:weakness', namecn: '虚弱药水 (1:30)', nameen: 'Weakness' },
            { id: 'minecraft:long_weakness', namecn: '虚弱药水 (延长 - 4:00)', nameen: 'Weakness (Extended)' }
        ]
    },
    {
        id: 'slow_falling',
        namecn: '缓降 (Slow Falling)',
        nameen: 'Slow Falling',
        variants: [
            { id: 'minecraft:slow_falling', namecn: '缓降药水 (1:30)', nameen: 'Slow Falling' },
            { id: 'minecraft:long_slow_falling', namecn: '缓降药水 (延长 - 4:00)', nameen: 'Slow Falling (Extended)' }
        ]
    },
    {
        id: 'water',
        namecn: '基础/粗制 (Base)',
        nameen: 'Base Potions',
        variants: [
            { id: 'minecraft:water', namecn: '普通水瓶', nameen: 'Water Bottle' },
            { id: 'minecraft:mundane', namecn: '平凡的药水', nameen: 'Mundane Potion' },
            { id: 'minecraft:thick', namecn: '浓稠的药水', nameen: 'Thick Potion' },
            { id: 'minecraft:awkward', namecn: '粗制药水', nameen: 'Awkward Potion' }
        ]
    }
];
const STATUS_EFFECTS = [
    { id: 'minecraft:speed', namecn: '速度 (Speed)', nameen: 'Speed' },
    { id: 'minecraft:slowness', namecn: '缓慢 (Slowness)', nameen: 'Slowness' },
    { id: 'minecraft:haste', namecn: '急迫 (Haste)', nameen: 'Haste' },
    { id: 'minecraft:mining_fatigue', namecn: '挖掘疲劳 (Mining Fatigue)', nameen: 'Mining Fatigue' },
    { id: 'minecraft:strength', namecn: '力量 (Strength)', nameen: 'Strength' },
    { id: 'minecraft:instant_health', namecn: '瞬间治疗 (Instant Health)', nameen: 'Instant Health' },
    { id: 'minecraft:instant_damage', namecn: '瞬间伤害 (Instant Damage)', nameen: 'Instant Damage' },
    { id: 'minecraft:jump_boost', namecn: '提升弹跳力 (Jump Boost)', nameen: 'Jump Boost' },
    { id: 'minecraft:regeneration', namecn: '生命恢复 (Regeneration)', nameen: 'Regeneration' },
    { id: 'minecraft:resistance', namecn: '抗性提升 (Resistance)', nameen: 'Resistance' },
    { id: 'minecraft:fire_resistance', namecn: '抗火 (Fire Resistance)', nameen: 'Fire Resistance' },
    { id: 'minecraft:water_breathing', namecn: '水下呼吸 (Water Breathing)', nameen: 'Water Breathing' },
    { id: 'minecraft:invisibility', namecn: '隐形 (Invisibility)', nameen: 'Invisibility' },
    { id: 'minecraft:blindness', namecn: '失明 (Blindness)', nameen: 'Blindness' },
    { id: 'minecraft:night_vision', namecn: '夜视 (Night Vision)', nameen: 'Night Vision' },
    { id: 'minecraft:hunger', namecn: '饥饿 (Hunger)', nameen: 'Hunger' },
    { id: 'minecraft:weakness', namecn: '虚弱 (Weakness)', nameen: 'Weakness' },
    { id: 'minecraft:poison', namecn: '中毒 (Poison)', nameen: 'Poison' },
    { id: 'minecraft:wither', namecn: '凋零 (Wither)', nameen: 'Wither' },
    { id: 'minecraft:health_boost', namecn: '生命值提升 (Health Boost)', nameen: 'Health Boost' },
    { id: 'minecraft:absorption', namecn: '伤害吸收 (Absorption)', nameen: 'Absorption' },
    { id: 'minecraft:saturation', namecn: '饱和 (Saturation)', nameen: 'Saturation' },
    { id: 'minecraft:glowing', namecn: '发光 (Glowing)', nameen: 'Glowing' },
    { id: 'minecraft:levitation', namecn: '飘浮 (Levitation)', nameen: 'Levitation' },
    { id: 'minecraft:slow_falling', namecn: '缓降 (Slow Falling)', nameen: 'Slow Falling' },
    { id: 'minecraft:conduit_power', namecn: '潮汐能量 (Conduit Power)', nameen: 'Conduit Power' },
    { id: 'minecraft:dolphins_grace', namecn: '海豚恩惠 (Dolphins Grace)', nameen: 'Dolphins Grace' },
    { id: 'minecraft:bad_omen', namecn: '不祥之兆 (Bad Omen)', nameen: 'Bad Omen' },
    { id: 'minecraft:hero_of_the_village', namecn: '村庄英雄 (Hero of the Village)', nameen: 'Hero of the Village' },
    { id: 'minecraft:darkness', namecn: '黑暗 (Darkness)', nameen: 'Darkness' }
];

export default {
    components: { Avatar },
    template: `
    <div>
        <div class="page-header d-flex justify-content-between align-items-center">
            <h3 class="m-0 fw-bold"><i class="fa-solid fa-users me-2 text-primary"></i>{{ $t('players.title') }}</h3>
        </div>

        <div class="card mb-4 border-primary" :class="{'player-section-open': activeMenu}" :style="activeMenu ? {position:'relative', zIndex:'1040'} : {}">
            <div class="card-header bg-primary-subtle fw-bold d-flex justify-content-between align-items-center">
                <span><i class="fa-solid fa-signal me-2"></i>{{ $t('players.online_players') }}</span>
                <span class="badge bg-primary fs-6">{{ filteredOnline.length }}{{ store.onlinePlayers.length !== filteredOnline.length ? ' / ' + store.onlinePlayers.length : '' }}</span>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-body-tertiary border-end-0"><i class="fa-solid fa-search text-muted"></i></span>
                        <input type="text" class="form-control border-start-0" :placeholder="$t('players.search_player')" v-model="onlineFilter">
                    </div>
                </div>
                <div v-if="store.onlinePlayers.length === 0" class="text-center text-muted py-4">
                    <i class="fa-solid fa-user-slash fa-2x mb-2 opacity-25"></i>
                    <div>{{ $t('players.no_online') }}</div>
                </div>
                <div v-else class="row g-2">
                    <div v-for="p in filteredOnline" :key="p" class="col-12 col-sm-6 col-lg-4">
                        <div class="card player-card h-100" :class="{'menu-open': activeMenu === p}">
                            <div class="card-body p-2 d-flex align-items-center gap-2">
                                <avatar :player="p" :size="36"></avatar>
                                <div class="flex-grow-1 min-w-0">
                                    <div class="fw-bold text-truncate">{{ p }}</div>
                                    <div v-if="playerPings[p] !== undefined" class="small text-muted d-flex align-items-center gap-1">
                                        <i class="fa-solid fa-wifi" :class="pingClass(playerPings[p])" style="font-size:0.7rem"></i>
                                        <span>{{ playerPings[p] }}ms</span>
                                    </div>
                                </div>
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-outline-secondary border-0" @click.stop="toggleMenu(p)" :title="$t('players.more_actions')">
                                        <i class="fa-solid fa-ellipsis-vertical"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end" :class="{show: activeMenu === p}">
                                        <li><a class="dropdown-item" @click="askTeleport(p)"><i class="fa-solid fa-location-dot me-2 text-primary"></i>{{ $t('players.teleport') }}</a></li>
                                        <li><a class="dropdown-item" @click="askGamemode(p)"><i class="fa-solid fa-gamepad me-2 text-info"></i>{{ $t('players.gamemode') }}</a></li>
                                        <li><a class="dropdown-item" @click="askGiveItem(p)"><i class="fa-solid fa-gift me-2 text-success"></i>{{ $t('players.give_item') }}</a></li>
                                        <li><a class="dropdown-item" @click="askEffect(p)"><i class="fa-solid fa-flask me-2 text-purple"></i>{{ $t('players.effect') }}</a></li>
                                        <li><a class="dropdown-item" @click="askExperience(p)"><i class="fa-solid fa-star me-2 text-warning"></i>{{ $t('players.experience') }}</a></li>
                                        <li><a class="dropdown-item" @click="askTitle(p)"><i class="fa-solid fa-heading me-2 text-indigo"></i>{{ $t('players.title_action') }}</a></li>
                                        <li><a class="dropdown-item" @click="askMessage(p)"><i class="fa-solid fa-envelope me-2 text-cyan"></i>{{ $t('players.message') }}</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item" @click="sendCmd('clear ' + p)"><i class="fa-solid fa-broom me-2 text-warning"></i>{{ $t('players.clear_inv') }}</a></li>
                                        <li><a class="dropdown-item" @click="sendCmd('kill ' + p)"><i class="fa-solid fa-skull me-2 text-danger"></i>{{ $t('players.kill') }}</a></li>
                                        <li><a class="dropdown-item" @click="sendCmd('spawnpoint ' + p)"><i class="fa-solid fa-house me-2 text-secondary"></i>{{ $t('players.spawnpoint') }}</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item" @click="askWhitelist(p, 'add')"><i class="fa-solid fa-shield-halved me-2 text-success"></i>{{ $t('players.whitelist_add') }}</a></li>
                                        <li><a class="dropdown-item" @click="askOp(p)"><i class="fa-solid fa-crown me-2 text-warning"></i>{{ $t('players.op_give') }}</a></li>
                                        <li><a class="dropdown-item" @click="askDeop(p)"><i class="fa-solid fa-crown me-2 text-secondary" style="opacity:0.5"></i>{{ $t('players.op_remove') }}</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item text-warning" @click="sendCmd('kick ' + p)"><i class="fa-solid fa-right-from-bracket me-2"></i>{{ $t('players.kick') }}</a></li>
                                        <li><a class="dropdown-item text-danger" @click="askBan(p)"><i class="fa-solid fa-gavel me-2"></i>{{ $t('players.ban') }}</a></li>
                                        <li><a class="dropdown-item text-danger" @click="askBanIp(p)"><i class="fa-solid fa-network-wired me-2"></i>{{ $t('players.ban_ip') }}</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header bg-body-tertiary py-2 px-3">
                <ul class="nav nav-tabs card-header-tabs flex-nowrap overflow-auto no-scrollbar" style="margin: -0.5rem -0.75rem; padding: 0.5rem 0.75rem;">
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: listType==='whitelist'}" @click="listType='whitelist'; loadLists()">
                            <i class="fa-solid fa-shield-halved me-1"></i>{{ $t('players.whitelist') }}
                            <span v-if="listType==='whitelist'" class="badge bg-secondary ms-1">{{ listData.length }}</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: listType==='ops'}" @click="listType='ops'; loadLists()">
                            <i class="fa-solid fa-crown me-1"></i>{{ $t('players.ops') }}
                            <span v-if="listType==='ops'" class="badge bg-secondary ms-1">{{ listData.length }}</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" :class="{active: listType==='banned-players'}" @click="listType='banned-players'; loadLists()">
                            <i class="fa-solid fa-ban me-1"></i>{{ $t('players.bans') }}
                            <span v-if="listType==='banned-players'" class="badge bg-secondary ms-1">{{ listData.length }}</span>
                        </a>
                    </li>
                </ul>
            </div>
            <div class="card-body">
                <div class="d-flex gap-2 mb-3">
                    <div class="input-group input-group-sm flex-grow-1">
                        <span class="input-group-text bg-body-tertiary border-end-0"><i class="fa-solid fa-search text-muted"></i></span>
                        <input type="text" class="form-control border-start-0" :placeholder="$t('players.search_player')" v-model="listFilter">
                    </div>
                    <div class="input-group input-group-sm" style="max-width: 300px;">
                        <input type="text" class="form-control" v-model="newPlayerName" :placeholder="$t('common.player_name')" @keyup.enter="modifyList('add')">
                        <button class="btn btn-outline-success" @click="modifyList('add')"><i class="fa-solid fa-plus me-1"></i>{{ $t('common.add') }}</button>
                    </div>
                </div>
                <div v-if="filteredList.length === 0" class="text-center text-muted py-3">
                    <i class="fa-solid fa-inbox fa-2x mb-2 opacity-25"></i>
                    <div>{{ $t('players.empty') }}</div>
                </div>
                <div v-else class="row g-2">
                    <div v-for="p in filteredList" :key="p.name || p" class="col-12 col-sm-6 col-lg-4">
                        <div class="card player-card h-100">
                            <div class="card-body p-2 d-flex align-items-center gap-2">
                                <avatar :player="p.name || p" :size="32"></avatar>
                                <div class="flex-grow-1 min-w-0">
                                    <div class="fw-bold text-truncate">{{ p.name || p }}</div>
                                    <div v-if="listType==='banned-players'" class="small text-muted text-truncate">
                                        <span v-if="p.reason">{{ p.reason }}</span>
                                        <span v-else class="opacity-50">-</span>
                                        <span v-if="p.expires" class="ms-1">({{ p.expires === 'forever' ? $t('players.permanent') : p.expires }})</span>
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-outline-danger border-0 flex-shrink-0" @click="removeListUser(p.name||p)" :title="$t('common.remove')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- MC 创造模式物品给予弹窗 -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div class="modal fade show" v-if="showGiveModal" style="display: block; z-index: 1050;">
                    <div class="modal-backdrop fade show" @click="closeGiveModal" style="z-index: -1;"></div>
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
                            <div class="modal-header border-bottom pb-3 pt-3 px-4 d-flex justify-content-between align-items-center">
                                <h5 class="modal-title fw-bold text-body">
                                    <i class="fa-solid fa-gift me-2 text-primary"></i>
                                    <span>{{ $t('players.give_item') }}: {{ targetPlayer }}</span>
                                </h5>
                                <button type="button" class="btn-close" @click="closeGiveModal"></button>
                            </div>
                            <div class="modal-body px-4 py-3">
                                <!-- 搜索与分类页签 -->
                                <div class="mb-3">
                                    <div class="position-relative">
                                        <i class="fa-solid fa-magnifying-glass position-absolute text-muted" style="left: 14px; top: 50%; transform: translateY(-50%); z-index: 10;"></i>
                                        <input type="text" class="form-control ps-5 py-2 rounded-pill" :placeholder="$t('players.search_item_placeholder')" v-model="itemSearchQuery">
                                    </div>
                                </div>
                                <div class="mc-tabs-container mb-3">
                                    <div class="mc-tabs d-flex gap-2 overflow-auto no-scrollbar py-1">
                                        <button v-for="tab in tabs" :key="tab.id" class="mc-tab-btn flex-shrink-0" :class="{active: activeTab === tab.id}" @click="activeTab = tab.id; itemSearchQuery=''">
                                            {{ tab.icon }} <span class="ms-1">{{ $t('players.tab_' + tab.id) }}</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- 网格物品槽区域 -->
                                <div class="mc-slots-container mb-3">
                                    <div class="mc-slots-grid">
                                        <div v-for="item in filteredItems" :key="item.no" 
                                             class="mc-item-slot" 
                                             :class="{active: selectedItem && selectedItem.id === item.id}"
                                             @click="selectItem(item)">
                                            <img :src="'/img/items/' + item.no + '.png'" class="mc-item-img" width="34" height="34" onerror="this.src='/img/items/0.png'">
                                            <div class="mc-item-tooltip">
                                                <div class="fw-bold">{{ store.lang === 'zh' ? item.namecn : item.nameen }}</div>
                                                <div class="small text-muted" style="font-size:0.7rem; margin-bottom: 2px;">{{ store.lang === 'zh' ? item.nameen : item.namecn }}</div>
                                                <small class="text-primary">{{ item.id }}</small>
                                            </div>
                                        </div>
                                        
                                        <!-- 空白网格填充 -->
                                        <div v-for="n in emptySlotsCount" :key="'empty-'+n" class="mc-item-slot empty"></div>
                                    </div>
                                </div>

                                <!-- 额外参数配置 (附魔书、药水、装备附魔、玩家头颅) -->
                                <div v-if="selectedItem && (selectedItem.id === 'minecraft:enchanted_book' || ['minecraft:potion', 'minecraft:splash_potion', 'minecraft:lingering_potion'].includes(selectedItem.id) || isEnchantable || selectedItem.id === 'minecraft:player_head')" 
                                     class="p-3 rounded-3 mb-3 border" style="background: rgba(var(--c-primary-rgb), 0.03); border-color: rgba(var(--c-primary-rgb), 0.15) !important;">
                                    
                                    <!-- 玩家头颅配置 -->
                                    <div v-if="selectedItem.id === 'minecraft:player_head'" class="row g-2 align-items-center">
                                        <div class="col-12">
                                            <label class="form-label small fw-bold text-muted mb-1">自定义皮肤拥有者名称 (Player Skin Name)</label>
                                            <input type="text" class="form-control form-control-sm" placeholder="输入玩家游戏名 (如: Steve / Alex)" v-model="skullOwner">
                                        </div>
                                    </div>

                                    <!-- 普通装备附魔开关 -->
                                    <div v-if="isEnchantable && selectedItem.id !== 'minecraft:enchanted_book'" class="form-check form-switch mb-2">
                                        <input class="form-check-input" type="checkbox" role="switch" id="attachEnchantSwitch" v-model="attachEnchantment">
                                        <label class="form-check-label small fw-bold text-muted" for="attachEnchantSwitch">附加附魔属性 (Attach Enchantment)</label>
                                    </div>

                                    <!-- 附魔配置 (附魔书，或装备启用了附加附魔) -->
                                    <div v-if="selectedItem.id === 'minecraft:enchanted_book' || (isEnchantable && attachEnchantment && selectedItem.id !== 'minecraft:enchanted_book')" class="row g-2 align-items-center">
                                        <div class="col-sm-6">
                                            <label class="form-label small fw-bold text-muted mb-1">选择附魔属性</label>
                                            <select class="form-select form-select-sm" v-model="selectedEnchantment">
                                                <option v-for="ench in ENCHANTMENTS" :key="ench.id" :value="ench.id">
                                                    {{ store.lang === 'zh' ? ench.namecn : ench.nameen }} ({{ ench.id.split(':')[1] }})
                                                </option>
                                            </select>
                                        </div>
                                        <div class="col-sm-6">
                                            <label class="form-label small fw-bold text-muted mb-1">选择附魔等级</label>
                                            <select class="form-select form-select-sm" v-model="enchantmentLevel">
                                                <option v-for="lvl in currentEnchantmentLevels" :key="lvl" :value="lvl">
                                                    等级 {{ romanize(lvl) }} (Level {{ lvl }})
                                                </option>
                                            </select>
                                        </div>
                                    </div>

                                    <!-- 药水配置 -->
                                    <div v-if="['minecraft:potion', 'minecraft:splash_potion', 'minecraft:lingering_potion'].includes(selectedItem.id)" class="row g-2 align-items-center">
                                        <div class="col-sm-6">
                                            <label class="form-label small fw-bold text-muted mb-1">选择药水效果</label>
                                            <select class="form-select form-select-sm" v-model="selectedPotionEffect">
                                                <option v-for="eff in POTION_EFFECTS" :key="eff.id" :value="eff.id">
                                                    {{ store.lang === 'zh' ? eff.namecn : eff.nameen }}
                                                </option>
                                            </select>
                                        </div>
                                        <div class="col-sm-6">
                                            <label class="form-label small fw-bold text-muted mb-1">选择药水类型/时长</label>
                                            <select class="form-select form-select-sm" v-model="selectedPotionVariant">
                                                <option v-for="v in currentPotionVariants" :key="v.id" :value="v.id">
                                                    {{ store.lang === 'zh' ? v.namecn : v.nameen }}
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- 当前选中物品详细信息及自定义输入 -->
                                <div class="mc-selection-details p-3 rounded-3 mb-3 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3">
                                    <div class="d-flex align-items-center gap-3 min-w-0 w-100">
                                        <div class="mc-selected-icon-box">
                                            <img v-if="selectedItem && selectedItem.no !== 'custom'" :src="'/img/items/' + selectedItem.no + '.png'" class="mc-item-img" width="36" height="36" onerror="this.src='/img/items/0.png'">
                                            <span v-else class="fs-3">❓</span>
                                        </div>
                                        <div class="min-w-0">
                                            <label class="form-label small fw-bold text-muted mb-1">{{ $t('players.selected_item') }}</label>
                                            <div class="fw-bold text-body text-truncate">{{ selectedItem ? (store.lang === 'zh' ? selectedItem.namecn : selectedItem.nameen) : $t('players.no_selection') }}</div>
                                            <div class="text-muted small text-truncate" style="font-family: monospace; font-size: 0.72rem;">{{ selectedItem ? selectedItem.id : 'None' }}</div>
                                        </div>
                                    </div>
                                    
                                    <div class="d-flex flex-column gap-1 w-100" style="max-width: 320px;">
                                        <label class="form-label small fw-bold text-muted mb-0">{{ $t('players.custom_item_id_label') }}</label>
                                        <input type="text" class="form-control form-control-sm" placeholder="e.g. minecraft:beacon" v-model="customItemId" @input="onCustomIdInput">
                                    </div>
                                </div>

                                <!-- 数量选择器 -->
                                <div class="row align-items-center g-3">
                                    <div class="col-sm-7">
                                        <div class="d-flex align-items-center gap-3">
                                            <label class="form-label small fw-bold text-muted mb-0" style="white-space: nowrap;">{{ $t('players.quantity_label') }}</label>
                                            <input type="range" class="form-range flex-grow-1" min="1" max="64" v-model.number="giveQuantity">
                                            <input type="number" class="form-control form-control-sm text-center fw-bold" style="width: 75px;" min="1" max="999" v-model.number="giveQuantity">
                                        </div>
                                    </div>
                                    <div class="col-sm-5">
                                        <div class="d-flex gap-1 justify-content-sm-end">
                                            <button class="btn btn-sm btn-outline-secondary" style="min-width: 56px;" @click="giveQuantity = 1">1 {{ $t('players.qty_unit') }}</button>
                                            <button class="btn btn-sm btn-outline-secondary" style="min-width: 56px;" @click="giveQuantity = 16">16 {{ $t('players.qty_unit') }}</button>
                                            <button class="btn btn-sm btn-outline-secondary" style="min-width: 56px;" @click="giveQuantity = 64">64 {{ $t('players.qty_unit') }}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer border-top pt-3 px-4 pb-4">
                                <button class="btn btn-outline-secondary rounded-pill px-4" @click="closeGiveModal">{{ $t('cancel') }}</button>
                                <button class="btn btn-primary rounded-pill px-4 fw-bold shadow" @click="confirmGiveItem" :disabled="!selectedItem || !giveQuantity">
                                    <i class="fa-solid fa-circle-check me-1"></i> {{ $t('players.give_item') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- MC 效果给予弹窗 -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div class="modal fade show" v-if="showEffectModal" style="display: block; z-index: 1050;">
                    <div class="modal-backdrop fade show" @click="closeEffectModal" style="z-index: -1;"></div>
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
                            <div class="modal-header border-bottom pb-3 pt-3 px-4 d-flex justify-content-between align-items-center">
                                <h5 class="modal-title fw-bold text-body">
                                    <i class="fa-solid fa-flask me-2 text-purple"></i>
                                    <span>{{ $t('players.effect') }}: {{ effectTargetPlayer }}</span>
                                </h5>
                                <button type="button" class="btn-close" @click="closeEffectModal"></button>
                            </div>
                            <div class="modal-body px-4 py-3">
                                <!-- 效果选择 -->
                                <div class="mb-3">
                                    <label class="form-label fw-semibold text-muted small mb-1">{{ $t('players.effect_type') }}</label>
                                    <select class="form-select" v-model="selectedEffect">
                                        <option v-for="eff in STATUS_EFFECTS" :key="eff.id" :value="eff.id">
                                            {{ store.lang === 'zh' ? eff.namecn : eff.nameen }}
                                        </option>
                                    </select>
                                </div>
                                <div class="row g-3 mb-3">
                                    <!-- 持续时间 -->
                                    <div class="col-6">
                                        <label class="form-label fw-semibold text-muted small mb-1">{{ $t('players.effect_duration') }}</label>
                                        <div class="input-group input-group-sm">
                                            <input type="number" class="form-control" min="1" max="999999" v-model.number="effectDuration">
                                            <span class="input-group-text">{{ $t('players.seconds') }}</span>
                                        </div>
                                    </div>
                                    <!-- 效果等级 -->
                                    <div class="col-6">
                                        <label class="form-label fw-semibold text-muted small mb-1">{{ $t('players.effect_level') }}</label>
                                        <select class="form-select form-select-sm" v-model.number="effectLevel">
                                            <option v-for="l in 10" :key="l" :value="l">{{ l }} {{ $t('players.level_unit') }}</option>
                                            <option :value="255">255 {{ $t('players.level_unit') }} (Max)</option>
                                        </select>
                                    </div>
                                </div>
                                <!-- 快捷时间按钮 -->
                                <div class="d-flex gap-1 mb-3 flex-wrap">
                                    <button class="btn btn-xs btn-outline-secondary py-1 px-2 text-xs" @click="effectDuration = 30">30s</button>
                                    <button class="btn btn-xs btn-outline-secondary py-1 px-2 text-xs" @click="effectDuration = 60">1m</button>
                                    <button class="btn btn-xs btn-outline-secondary py-1 px-2 text-xs" @click="effectDuration = 300">5m</button>
                                    <button class="btn btn-xs btn-outline-secondary py-1 px-2 text-xs" @click="effectDuration = 1800">30m</button>
                                    <button class="btn btn-xs btn-outline-secondary py-1 px-2 text-xs" @click="effectDuration = 99999">永久 (Infinite)</button>
                                </div>
                                <!-- 选项选项 -->
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="hideParticlesCheck" v-model="hideParticles">
                                    <label class="form-check-label fw-semibold text-muted small" for="hideParticlesCheck">
                                        {{ $t('players.hide_particles') }}
                                    </label>
                                </div>
                            </div>
                            <div class="modal-footer border-top pt-3 px-4 pb-4 d-flex justify-content-between align-items-center">
                                <button class="btn btn-outline-danger rounded-pill px-3" @click="clearAllEffects">
                                    <i class="fa-solid fa-trash me-1"></i> {{ $t('players.clear_effects') }}
                                </button>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-outline-secondary rounded-pill px-3" @click="closeEffectModal">{{ $t('cancel') }}</button>
                                    <button class="btn btn-primary rounded-pill px-3 fw-bold shadow" @click="confirmGiveEffect">
                                        <i class="fa-solid fa-circle-check me-1"></i> {{ $t('common.confirm') }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
    `,
    setup() {
        const listType = ref('whitelist');
        const listData = ref([]);
        const newPlayerName = ref('');
        const onlineFilter = ref('');
        const listFilter = ref('');
        const activeMenu = ref(null);
        const playerPings = ref({});
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        // 创造模式背包状态
        const showGiveModal = ref(false);
        const targetPlayer = ref('');
        const selectedItem = ref(null);
        const giveQuantity = ref(64);
        const itemSearchQuery = ref('');
        const activeTab = ref('building');
        const customItemId = ref('');
        const creativeItems = ref([]);

        // 状态效果给予状态
        const showEffectModal = ref(false);
        const effectTargetPlayer = ref('');
        const selectedEffect = ref('minecraft:speed');
        const effectDuration = ref(600);
        const effectLevel = ref(1);
        const hideParticles = ref(false);

        const selectedEnchantment = ref('minecraft:protection');
        const enchantmentLevel = ref(1);
        const selectedPotionEffect = ref('healing');
        const selectedPotionVariant = ref('minecraft:healing');
        const skullOwner = ref('');
        const attachEnchantment = ref(false);

        const isEnchantable = computed(() => {
            if (!selectedItem.value) return false;
            const id = selectedItem.value.id;
            if (id === 'minecraft:enchanted_book') return true;
            const keywords = ['sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'helmet', 'chestplate', 'leggings', 'boots', 'bow', 'crossbow', 'trident', 'shield', 'elytra', 'fishing_rod', 'shears', 'flint_and_steel', 'brush', 'mace'];
            return keywords.some(k => id.includes(k));
        });

        const currentEnchantmentLevels = computed(() => {
            const ench = ENCHANTMENTS.find(e => e.id === selectedEnchantment.value);
            if (!ench) return [1];
            const lvls = [];
            for (let i = 1; i <= ench.maxLvl; i++) {
                lvls.push(i);
            }
            return lvls;
        });

        const currentPotionVariants = computed(() => {
            const effect = POTION_EFFECTS.find(e => e.id === selectedPotionEffect.value);
            return effect ? effect.variants : [];
        });

        const romanize = (num) => {
            const lookup = { X: 10, IX: 9, V: 5, IV: 4, I: 1 };
            let roman = '';
            for (let i in lookup) {
                while (num >= lookup[i]) {
                    roman += i;
                    num -= lookup[i];
                }
            }
            return roman;
        };

        watch(selectedEnchantment, (newEnch) => {
            const ench = ENCHANTMENTS.find(e => e.id === newEnch);
            if (ench && enchantmentLevel.value > ench.maxLvl) {
                enchantmentLevel.value = ench.maxLvl;
            }
        });

        watch(selectedPotionEffect, (newEffect) => {
            const effect = POTION_EFFECTS.find(e => e.id === newEffect);
            if (effect && effect.variants.length > 0) {
                selectedPotionVariant.value = effect.variants[0].id;
            }
        });

        const tabs = [
            { id: 'building', name: '建筑', icon: '🧱' },
            { id: 'combat', name: '战斗', icon: '⚔️' },
            { id: 'tools', name: '工具', icon: '🛠️' },
            { id: 'food', name: '食品', icon: '🍕' },
            { id: 'materials', name: '材料', icon: '💎' },
            { id: 'special', name: '特殊', icon: '🧪' }
        ];

        const filteredOnline = computed(() => {
            const f = onlineFilter.value.toLowerCase().trim();
            if (!f) return store.onlinePlayers;
            return store.onlinePlayers.filter(p => p.toLowerCase().includes(f));
        });

        const filteredList = computed(() => {
            const f = listFilter.value.toLowerCase().trim();
            if (!f) return listData.value;
            return listData.value.filter(p => (p.name || p).toLowerCase().includes(f));
        });

        // 动态加载 items.json
        const loadCreativeItems = async () => {
            try {
                const response = await fetch('/js/items.json');
                creativeItems.value = await response.json();
            } catch (e) {
                console.error("Failed to load items.json:", e);
            }
        };

        // 创造模式过滤
        const filteredItems = computed(() => {
            const query = itemSearchQuery.value.toLowerCase().trim();
            let list = creativeItems.value;
            // Filter out ungiveable items
            list = list.filter(item => !UNGIVEABLE_IDS.has(item.id));
            if (query) {
                return list.filter(item => 
                    item.namecn.toLowerCase().includes(query) || 
                    item.nameen.toLowerCase().includes(query) || 
                    item.id.toLowerCase().includes(query)
                );
            }
            return list.filter(item => item.category === activeTab.value);
        });

        // 空网格数量填充，使其呈现完美的 MC 方格布局
        const emptySlotsCount = computed(() => {
            const count = filteredItems.value.length;
            const minSlots = 27; // 保持最少三行
            if (count < minSlots) {
                return minSlots - count;
            }
            const remainder = count % 9;
            return remainder === 0 ? 0 : 9 - remainder;
        });

        const pingClass = (ping) => {
            if (ping < 50) return 'text-success';
            if (ping < 150) return 'text-warning';
            return 'text-danger';
        };

        const toggleMenu = (player) => {
            activeMenu.value = activeMenu.value === player ? null : player;
        };

        const closeMenu = (e) => {
            if (activeMenu.value && !e.target.closest('.dropdown')) {
                activeMenu.value = null;
            }
        };

        const sendCmd = async (c) => {
            if (!store.isRunning) {
                showToast('common.server_offline', 'warning');
                return;
            }
            await api.post('/api/server/command', { command: c });
            showToast($t('common.success'));
            activeMenu.value = null;
        };

        const loadLists = async () => {
            try {
                const res = await api.get(`/api/lists/${listType.value}`);
                listData.value = res.data;
            } catch (e) { }
        };

        const modifyList = async (action) => {
            if (!newPlayerName.value) return;
            const n = newPlayerName.value;
            const cmd = listType.value === 'whitelist' ? `whitelist ${action} ${n}` :
                listType.value === 'ops' ? (action === 'add' ? `op ${n}` : `deop ${n}`) :
                    (action === 'add' ? `ban ${n}` : `pardon ${n}`);
            await sendCmd(cmd);
            newPlayerName.value = '';
            setTimeout(loadLists, 1000);
        };
        const removeListUser = (n) => { newPlayerName.value = n; modifyList('remove'); };

        const askTeleport = (player) => openModal({
            title: `${$t('players.teleport')} ${player}`, message: 'Coords (x y z) or Player:', mode: 'input', inputValue: '~ ~ ~',
            callback: (val) => sendCmd(`tp ${player} ${val}`)
        });
        const askGamemode = (player) => openModal({
            title: `${$t('players.gamemode')} ${player}`, message: 'Mode:', mode: 'select', inputValue: 'survival',
            options: [{ label: 'Survival', value: 'survival' }, { label: 'Creative', value: 'creative' }, { label: 'Adventure', value: 'adventure' }, { label: 'Spectator', value: 'spectator' }],
            callback: (val) => sendCmd(`gamemode ${val} ${player}`)
        });

        // 重构“给予物品”激活创造模式背包
        const askGiveItem = (player) => {
            targetPlayer.value = player;
            if (creativeItems.value.length > 0) {
                // 默认选择第一个建筑方块
                const firstBuilding = creativeItems.value.find(i => i.category === 'building') || creativeItems.value[0];
                selectedItem.value = firstBuilding;
                customItemId.value = firstBuilding.id;
            } else {
                selectedItem.value = null;
                customItemId.value = '';
            }
            giveQuantity.value = 64;
            itemSearchQuery.value = '';
            activeTab.value = 'building';
            skullOwner.value = '';
            attachEnchantment.value = false;
            showGiveModal.value = true;
            activeMenu.value = null;
        };

        const closeGiveModal = () => {
            showGiveModal.value = false;
        };

        const selectItem = (item) => {
            selectedItem.value = item;
            customItemId.value = item.id;
        };

        const onCustomIdInput = () => {
            const val = customItemId.value.trim().toLowerCase();
            if (val) {
                const found = creativeItems.value.find(i => i.id === val);
                if (found) {
                    selectedItem.value = found;
                } else {
                    selectedItem.value = {
                        id: val,
                        namecn: '自定义物品',
                        nameen: 'Custom Item',
                        no: 'custom'
                    };
                }
            } else {
                selectedItem.value = null;
            }
        };

        const confirmGiveItem = async () => {
            if (!selectedItem.value || !giveQuantity.value) return;
            const itemId = selectedItem.value.id.trim();
            const qty = giveQuantity.value;
            
            // Detect version details
            let isLegacy = false;
            let isModernComponent = false; // 1.20.5+
            const versionStr = store.stats.version ? (store.stats.version.mc || store.stats.version) : '';
            if (versionStr) {
                if (typeof versionStr === 'string') {
                    const match = versionStr.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
                    if (match) {
                        const major = parseInt(match[1]);
                        const minor = parseInt(match[2]);
                        const patch = match[3] ? parseInt(match[3]) : 0;
                        if (major < 1 || (major === 1 && minor < 13)) {
                            isLegacy = true;
                        }
                        if (major > 1 || (major === 1 && (minor > 20 || (minor === 20 && patch >= 5)))) {
                            isModernComponent = true;
                        }
                    }
                }
            }

            let giveCmd = '';
            
            if (itemId === 'minecraft:enchanted_book') {
                const ench = selectedEnchantment.value;
                const shortEnch = ench.replace('minecraft:', '');
                const lvl = enchantmentLevel.value;
                if (isModernComponent) {
                    // Use unnamespaced short ID directly as key under stored_enchantments (no levels wrapper)
                    giveCmd = `give ${targetPlayer.value} minecraft:enchanted_book[stored_enchantments={${shortEnch}:${lvl}}] ${qty}`;
                } else if (isLegacy) {
                    giveCmd = `give ${targetPlayer.value} minecraft:enchanted_book ${qty} 0 {StoredEnchantments:[{id:"${ench}",lvl:${lvl}s}]}`;
                } else {
                    giveCmd = `give ${targetPlayer.value} minecraft:enchanted_book{StoredEnchantments:[{id:"${ench}",lvl:${lvl}s}]} ${qty}`;
                }
            } else if (['minecraft:potion', 'minecraft:splash_potion', 'minecraft:lingering_potion'].includes(itemId)) {
                const pot = selectedPotionVariant.value;
                if (isModernComponent) {
                    giveCmd = `give ${targetPlayer.value} ${itemId}[potion_contents={potion:"${pot}"}] ${qty}`;
                } else if (isLegacy) {
                    giveCmd = `give ${targetPlayer.value} ${itemId} ${qty} 0 {Potion:"${pot}"}`;
                } else {
                    giveCmd = `give ${targetPlayer.value} ${itemId}{Potion:"${pot}"} ${qty}`;
                }
            } else if (itemId === 'minecraft:player_head') {
                const owner = skullOwner.value.trim();
                if (owner) {
                    if (isModernComponent) {
                        giveCmd = `give ${targetPlayer.value} minecraft:player_head[profile="${owner}"] ${qty}`;
                    } else if (isLegacy) {
                        giveCmd = `give ${targetPlayer.value} minecraft:skull ${qty} 3 {SkullOwner:"${owner}"}`;
                    } else {
                        giveCmd = `give ${targetPlayer.value} minecraft:player_head{SkullOwner:"${owner}"} ${qty}`;
                    }
                } else {
                    if (isLegacy) {
                        giveCmd = `give ${targetPlayer.value} minecraft:skull ${qty} 3`;
                    } else {
                        giveCmd = `give ${targetPlayer.value} minecraft:player_head ${qty}`;
                    }
                }
            } else if (attachEnchantment.value && isEnchantable.value) {
                const ench = selectedEnchantment.value;
                const shortEnch = ench.replace('minecraft:', '');
                const lvl = enchantmentLevel.value;
                if (isModernComponent) {
                    // Use unnamespaced short ID directly as key under enchantments (no levels wrapper)
                    giveCmd = `give ${targetPlayer.value} ${itemId}[enchantments={${shortEnch}:${lvl}}] ${qty}`;
                } else if (isLegacy) {
                    const mapped = LEGACY_ITEMS[itemId];
                    const legId = mapped ? mapped.id : itemId;
                    const legData = mapped ? mapped.data : 0;
                    giveCmd = `give ${targetPlayer.value} ${legId} ${qty} ${legData} {ench:[{id:"${ench}",lvl:${lvl}s}]}`;
                } else {
                    giveCmd = `give ${targetPlayer.value} ${itemId}{Enchantments:[{id:"${ench}",lvl:${lvl}s}]} ${qty}`;
                }
            } else {
                if (isLegacy) {
                    const mapped = LEGACY_ITEMS[itemId];
                    if (mapped) {
                        giveCmd = `give ${targetPlayer.value} ${mapped.id} ${qty} ${mapped.data}`;
                    } else {
                        giveCmd = `give ${targetPlayer.value} ${itemId} ${qty}`;
                    }
                } else {
                    giveCmd = `give ${targetPlayer.value} ${itemId} ${qty}`;
                }
            }

            await sendCmd(giveCmd);
            showGiveModal.value = false;
        };

        const askEffect = (player) => {
            effectTargetPlayer.value = player;
            selectedEffect.value = 'minecraft:speed';
            effectDuration.value = 600;
            effectLevel.value = 1;
            hideParticles.value = false;
            showEffectModal.value = true;
            activeMenu.value = null;
        };

        const closeEffectModal = () => {
            showEffectModal.value = false;
        };

        const confirmGiveEffect = async () => {
            if (!effectTargetPlayer.value || !selectedEffect.value) return;
            const target = effectTargetPlayer.value;
            const eff = selectedEffect.value;
            const duration = effectDuration.value || 600;
            const amp = Math.max(0, effectLevel.value - 1);
            const hide = hideParticles.value ? 'true' : 'false';
            await sendCmd(`effect give ${target} ${eff} ${duration} ${amp} ${hide}`);
            showEffectModal.value = false;
        };

        const clearAllEffects = async () => {
            if (!effectTargetPlayer.value) return;
            await sendCmd(`effect clear ${effectTargetPlayer.value}`);
            showEffectModal.value = false;
        };
        const askExperience = (player) => openModal({
            title: `${$t('players.experience')} ${player}`, message: $t('players.experience_prompt'), mode: 'input', inputValue: '100',
            callback: (val) => sendCmd(`experience add ${player} ${val}`)
        });
        const askTitle = (player) => openModal({
            title: `${$t('players.title_action')} ${player}`, message: $t('players.title_prompt'), mode: 'input', inputValue: 'Hello!',
            callback: (val) => sendCmd(`title ${player} title "${val.replace(/"/g, '\\"')}"`)
        });
        const askMessage = (player) => openModal({
            title: `${$t('players.message')} ${player}`, message: $t('players.message_prompt'), mode: 'input', inputValue: '',
            callback: (val) => sendCmd(`msg ${player} ${val}`)
        });
        const askWhitelist = (player, action) => {
            sendCmd(`whitelist ${action} ${player}`);
            setTimeout(loadLists, 1000);
        };
        const askOp = (player) => {
            sendCmd(`op ${player}`);
            setTimeout(loadLists, 1000);
        };
        const askDeop = (player) => {
            sendCmd(`deop ${player}`);
            setTimeout(loadLists, 1000);
        };
        const askBan = (player) => openModal({
            title: `${$t('players.ban')} ${player}`, message: $t('players.ban_reason_prompt'), mode: 'input', inputValue: '',
            placeholder: $t('players.ban_reason_placeholder'),
            callback: (val) => { sendCmd(`ban ${player}${val ? ' ' + val : ''}`); setTimeout(loadLists, 1000); }
        });
        const askBanIp = (player) => openModal({
            title: `${$t('players.ban_ip')} ${player}`, message: $t('players.ban_reason_prompt'), mode: 'input', inputValue: '',
            placeholder: $t('players.ban_reason_placeholder'),
            callback: (val) => { sendCmd(`ban-ip ${player}${val ? ' ' + val : ''}`); setTimeout(loadLists, 1000); }
        });

        const fetchPlayerPings = async () => {
            if (!store.isRunning || store.onlinePlayers.length === 0) return;
            try {
                const res = await api.get('/api/server/player-pings');
                if (res.data && typeof res.data === 'object') {
                    playerPings.value = res.data;
                }
            } catch (e) { }
        };

        let pingInterval = null;

        onMounted(() => {
            sendCmd('list');
            loadLists();
            loadCreativeItems();
            document.addEventListener('click', closeMenu);
            fetchPlayerPings();
            pingInterval = setInterval(fetchPlayerPings, 5000);

            // 动态加入 Minecraft 创造模式风格 CSS
            if (!document.getElementById('mc-creative-inv-style')) {
                const style = document.createElement('style');
                style.id = 'mc-creative-inv-style';
                style.innerHTML = `
                    .mc-tabs-container {
                        width: 100%;
                        overflow: hidden;
                    }
                    .mc-tabs {
                        background: var(--c-bg-base);
                        border: 1px solid var(--c-border);
                        border-radius: 8px;
                        padding: 4px;
                        display: flex;
                        gap: 6px;
                        overflow-x: auto;
                        white-space: nowrap;
                        width: 100%;
                        -webkit-overflow-scrolling: touch;
                    }
                    .mc-tabs::-webkit-scrollbar {
                        display: none;
                    }
                    .mc-tab-btn {
                        background: transparent;
                        border: none;
                        color: var(--c-text-secondary);
                        padding: 6px 12px;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 0.85rem;
                        transition: all 0.15s ease;
                        white-space: nowrap;
                    }
                    .mc-tab-btn:hover {
                        color: var(--c-text-primary);
                        background: rgba(var(--c-primary-rgb), 0.05);
                    }
                    .mc-tab-btn.active {
                        background: var(--c-primary) !important;
                        color: #ffffff !important;
                        box-shadow: var(--focus-ring);
                    }
                    .mc-slots-container {
                        background: var(--c-bg-base) !important;
                        border: 1px solid var(--c-border) !important;
                        border-radius: 12px;
                        padding: 10px;
                        height: 290px;
                        overflow-y: auto;
                    }
                    .mc-slots-grid {
                        display: grid;
                        grid-template-columns: repeat(9, 1fr);
                        gap: 8px;
                    }
                    .mc-item-slot {
                        aspect-ratio: 1;
                        background: var(--c-surface);
                        border: 1px solid var(--c-border);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        position: relative;
                        transition: all 0.15s ease;
                        border-radius: 8px;
                    }
                    .mc-item-slot:hover {
                        background: var(--c-bg-base);
                        border-color: var(--c-primary);
                        transform: translateY(-2px);
                    }
                    .mc-item-slot.active {
                        background: var(--c-primary-subtle) !important;
                        border-color: var(--c-primary) !important;
                        border-width: 2px !important;
                    }
                    .mc-item-slot.empty {
                        cursor: default;
                        background: transparent;
                        border: 1px dashed var(--c-border);
                        opacity: 0.25;
                    }
                    .mc-item-slot.empty:hover {
                        background: transparent;
                        transform: none;
                        border-color: var(--c-border);
                    }
                    .mc-item-img {
                        object-fit: contain;
                        image-rendering: pixelated;
                        image-rendering: crisp-edges;
                        user-select: none;
                    }
                    .mc-item-slot .mc-item-tooltip {
                        visibility: hidden;
                        background: var(--c-surface-elevated);
                        border: 1px solid var(--c-border);
                        color: var(--c-text-primary);
                        text-align: center;
                        border-radius: 8px;
                        padding: 8px 12px;
                        position: absolute;
                        z-index: 1100;
                        bottom: 125%;
                        left: 50%;
                        transform: translateX(-50%);
                        white-space: nowrap;
                        box-shadow: var(--card-shadow-hover);
                        font-size: 0.75rem;
                        line-height: 1.4;
                    }
                    .mc-item-slot:hover .mc-item-tooltip {
                        visibility: visible;
                    }
                    .mc-selection-details {
                        background: var(--c-bg-base) !important;
                        border: 1px solid var(--c-border) !important;
                        border-radius: 12px;
                    }
                    .mc-selected-icon-box {
                        width: 50px;
                        height: 50px;
                        background: var(--c-surface);
                        border: 1px solid var(--c-border);
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    @media (max-width: 768px) {
                        .mc-slots-grid {
                            grid-template-columns: repeat(6, 1fr);
                        }
                    }
                    @media (max-width: 480px) {
                        .mc-slots-grid {
                            grid-template-columns: repeat(4, 1fr);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
        });

        onUnmounted(() => {
            document.removeEventListener('click', closeMenu);
            if (pingInterval) clearInterval(pingInterval);
            const style = document.getElementById('mc-creative-inv-style');
            if (style) style.remove();
        });

        return {
            store, listType, listData, newPlayerName, loadLists, modifyList, removeListUser,
            sendCmd, askTeleport, askGamemode, askGiveItem, askEffect, askExperience,
            askTitle, askMessage, askWhitelist, askOp, askDeop, askBan, askBanIp,
            onlineFilter, listFilter, filteredOnline, filteredList,
            activeMenu, toggleMenu, playerPings, pingClass,
            
            // 创造背包相关返回
            showGiveModal, targetPlayer, selectedItem, giveQuantity, itemSearchQuery, activeTab,
            customItemId, tabs, filteredItems, emptySlotsCount, closeGiveModal, selectItem,
            onCustomIdInput, confirmGiveItem,
            selectedEnchantment, enchantmentLevel, selectedPotionEffect, selectedPotionVariant, 
            ENCHANTMENTS, POTION_EFFECTS, currentEnchantmentLevels, currentPotionVariants, romanize,
            skullOwner, attachEnchantment, isEnchantable,

            // 状态效果相关返回
            STATUS_EFFECTS, showEffectModal, effectTargetPlayer, selectedEffect, effectDuration,
            effectLevel, hideParticles, closeEffectModal, confirmGiveEffect, clearAllEffects
        };
    }
};
