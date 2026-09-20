import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, formatLog, t, openModal } from '../utils.js';
import { messages } from '../i18n.js';
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from '/js/vue.esm-browser.js';
import SetupWizard from './SetupWizard.js';

const COMMAND_SCHEMAS = {
    gamemode: {
        titlecn: '修改游戏模式',
        titleen: 'Change Game Mode',
        params: [
            {
                key: 'gamemode',
                labelcn: '游戏模式',
                labelen: 'Game Mode',
                type: 'select',
                options: [
                    { value: 'survival', labelcn: '生存模式 (Survival)', labelen: 'Survival' },
                    { value: 'creative', labelcn: '创造模式 (Creative)', labelen: 'Creative' },
                    { value: 'adventure', labelcn: '冒险模式 (Adventure)', labelen: 'Adventure' },
                    { value: 'spectator', labelcn: '旁观模式 (Spectator)', labelen: 'Spectator' }
                ]
            },
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                optional: true,
                default: '@s'
            }
        ],
        assemble: (p) => `gamemode ${p.gamemode} ${p.target || '@s'}`
    },
    give: {
        titlecn: '给予物品 (Give)',
        titleen: 'Give Item',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'item',
                labelcn: '物品 ID',
                labelen: 'Item ID',
                type: 'select_input',
                options: [
                    { value: 'minecraft:diamond', labelcn: '钻石 (diamond)', labelen: 'diamond' },
                    { value: 'minecraft:iron_ingot', labelcn: '铁锭 (iron_ingot)', labelen: 'iron_ingot' },
                    { value: 'minecraft:gold_ingot', labelcn: '金锭 (gold_ingot)', labelen: 'gold_ingot' },
                    { value: 'minecraft:netherite_ingot', labelcn: '下界合金锭 (netherite_ingot)', labelen: 'netherite_ingot' },
                    { value: 'minecraft:coal', labelcn: '煤炭 (coal)', labelen: 'coal' },
                    { value: 'minecraft:stone', labelcn: '石头 (stone)', labelen: 'stone' }
                ],
                placeholder: 'e.g. minecraft:diamond'
            },
            {
                key: 'count',
                labelcn: '数量',
                labelen: 'Count',
                type: 'number',
                default: 1
            }
        ],
        assemble: (p) => `give ${p.target} ${p.item} ${p.count}`
    },
    effect: {
        titlecn: '管理玩家状态效果 (Effect)',
        titleen: 'Manage Status Effects',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'give', labelcn: '给予效果 (give)', labelen: 'give' },
                    { value: 'clear', labelcn: '清除效果 (clear)', labelen: 'clear' }
                ]
            },
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'effect',
                labelcn: '效果 ID',
                labelen: 'Effect ID',
                type: 'select_input',
                vif: (p) => p.action === 'give',
                options: [
                    { value: 'minecraft:speed', labelcn: '速度 (speed)', labelen: 'speed' },
                    { value: 'minecraft:slowness', labelcn: '缓慢 (slowness)', labelen: 'slowness' },
                    { value: 'minecraft:haste', labelcn: '急迫 (haste)', labelen: 'haste' },
                    { value: 'minecraft:strength', labelcn: '力量 (strength)', labelen: 'strength' },
                    { value: 'minecraft:instant_health', labelcn: '治疗 (instant_health)', labelen: 'instant_health' },
                    { value: 'minecraft:instant_damage', labelcn: '伤害 (instant_damage)', labelen: 'instant_damage' },
                    { value: 'minecraft:invisibility', labelcn: '隐形 (invisibility)', labelen: 'invisibility' },
                    { value: 'minecraft:night_vision', labelcn: '夜视 (night_vision)', labelen: 'night_vision' }
                ],
                placeholder: 'e.g. minecraft:speed'
            },
            {
                key: 'duration',
                labelcn: '持续时间 (秒)',
                labelen: 'Duration (seconds)',
                type: 'number',
                vif: (p) => p.action === 'give',
                default: 600
            },
            {
                key: 'amplifier',
                labelcn: '效果等级',
                labelen: 'Amplifier/Level',
                type: 'number',
                vif: (p) => p.action === 'give',
                default: 0,
                placeholder: '0 代表等级 I (0 means level I)'
            }
        ],
        assemble: (p) => {
            if (p.action === 'clear') return `effect clear ${p.target}`;
            return `effect give ${p.target} ${p.effect} ${p.duration} ${p.amplifier}`;
        }
    },
    difficulty: {
        titlecn: '修改游戏难度',
        titleen: 'Change Difficulty',
        params: [
            {
                key: 'difficulty',
                labelcn: '游戏难度',
                labelen: 'Difficulty',
                type: 'select',
                options: [
                    { value: 'peaceful', labelcn: '和平 (Peaceful)', labelen: 'Peaceful' },
                    { value: 'easy', labelcn: '简单 (Easy)', labelen: 'Easy' },
                    { value: 'normal', labelcn: '普通 (Normal)', labelen: 'Normal' },
                    { value: 'hard', labelcn: '困难 (Hard)', labelen: 'Hard' }
                ]
            }
        ],
        assemble: (p) => `difficulty ${p.difficulty}`
    },
    time: {
        titlecn: '修改游戏时间',
        titleen: 'Change Time',
        params: [
            {
                key: 'action',
                labelcn: '操作',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'set', labelcn: '设为 (Set)', labelen: 'Set' },
                    { value: 'add', labelcn: '增加 (Add)', labelen: 'Add' }
                ]
            },
            {
                key: 'value',
                labelcn: '时间数值/预设',
                labelen: 'Time Value/Preset',
                type: 'select_input',
                options: [
                    { value: 'day', labelcn: '白天 (Day - 1000)', labelen: 'Day (1000)' },
                    { value: 'noon', labelcn: '正午 (Noon - 6000)', labelen: 'Noon (6000)' },
                    { value: 'night', labelcn: '夜晚 (Night - 13000)', labelen: 'Night (13000)' },
                    { value: 'midnight', labelcn: '午夜 (Midnight - 18000)', labelen: 'Midnight (18000)' }
                ],
                placeholder: 'e.g. 1000 or day'
            }
        ],
        assemble: (p) => `time ${p.action} ${p.value}`
    },
    weather: {
        titlecn: '修改天气',
        titleen: 'Change Weather',
        params: [
            {
                key: 'weather',
                labelcn: '天气类型',
                labelen: 'Weather Type',
                type: 'select',
                options: [
                    { value: 'clear', labelcn: '晴天 (Clear)', labelen: 'Clear' },
                    { value: 'rain', labelcn: '雨天 (Rain)', labelen: 'Rain' },
                    { value: 'thunder', labelcn: '雷雨 (Thunder)', labelen: 'Thunder' }
                ]
            },
            {
                key: 'duration',
                labelcn: '持续时间 (秒)',
                labelen: 'Duration (seconds)',
                type: 'number',
                optional: true,
                placeholder: '默认 (Default)'
            }
        ],
        assemble: (p) => `weather ${p.weather}${p.duration ? ' ' + p.duration : ''}`
    },
    gamerule: {
        titlecn: '修改游戏规则',
        titleen: 'Change Game Rule',
        params: [
            {
                key: 'rule',
                labelcn: '规则名称',
                labelen: 'Rule Name',
                type: 'select',
                options: [
                    { value: 'keepInventory', labelcn: '死亡不掉落 (keepInventory)', labelen: 'keepInventory' },
                    { value: 'mobGriefing', labelcn: '生物破坏地形 (mobGriefing)', labelen: 'mobGriefing' },
                    { value: 'doDaylightCycle', labelcn: '时间流动 (doDaylightCycle)', labelen: 'doDaylightCycle' },
                    { value: 'doWeatherCycle', labelcn: '天气流动 (doWeatherCycle)', labelen: 'doWeatherCycle' },
                    { value: 'doMobSpawning', labelcn: '自然生成生物 (doMobSpawning)', labelen: 'doMobSpawning' },
                    { value: 'doFireTick', labelcn: '火焰蔓延与熄灭 (doFireTick)', labelen: 'doFireTick' },
                    { value: 'doImmediateRespawn', labelcn: '立即复活 (doImmediateRespawn)', labelen: 'doImmediateRespawn' },
                    { value: 'showDeathMessages', labelcn: '显示死亡消息 (showDeathMessages)', labelen: 'showDeathMessages' },
                    { value: 'commandBlockOutput', labelcn: '命令方块日志输出 (commandBlockOutput)', labelen: 'commandBlockOutput' }
                ]
            },
            {
                key: 'value',
                labelcn: '设定值',
                labelen: 'Value',
                type: 'select',
                options: [
                    { value: 'true', labelcn: '开启 (true)', labelen: 'True' },
                    { value: 'false', labelcn: '关闭 (false)', labelen: 'False' }
                ]
            }
        ],
        assemble: (p) => `gamerule ${p.rule} ${p.value}`
    },
    clear: {
        titlecn: '清空玩家背包',
        titleen: 'Clear Player Inventory',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'item',
                labelcn: '指定物品 ID',
                labelen: 'Item ID',
                type: 'text',
                optional: true,
                placeholder: '留空清空全部 (Empty to clear all)'
            }
        ],
        assemble: (p) => `clear ${p.target}${p.item ? ' ' + p.item : ''}`
    },
    teleport: {
        titlecn: '传送玩家 (Teleport)',
        titleen: 'Teleport Player',
        params: [
            {
                key: 'target',
                labelcn: '传送目标 (谁被传送)',
                labelen: 'Entity to Teleport',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'type',
                labelcn: '传送类型',
                labelen: 'Teleport Type',
                type: 'select',
                options: [
                    { value: 'coords', labelcn: '传送到指定坐标', labelen: 'To Coordinates' },
                    { value: 'player', labelcn: '传送到其他玩家处', labelen: 'To Target Player' }
                ]
            },
            {
                key: 'destination',
                labelcn: '目的地玩家名称',
                labelen: 'Destination Player',
                type: 'player_select',
                vif: (p) => p.type === 'player'
            },
            {
                key: 'coords',
                labelcn: '目标坐标 (X Y Z)',
                labelen: 'Coordinates (X Y Z)',
                type: 'text',
                placeholder: 'e.g. 100 64 -200 or ~ ~ ~',
                vif: (p) => p.type === 'coords'
            }
        ],
        assemble: (p) => `tp ${p.target} ${p.type === 'coords' ? p.coords : p.destination}`
    },
    experience: {
        titlecn: '修改经验值/等级',
        titleen: 'Modify Experience/Levels',
        params: [
            {
                key: 'action',
                labelcn: '操作类型',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'add', labelcn: '增加 (Add)', labelen: 'Add' },
                    { value: 'set', labelcn: '设定 (Set)', labelen: 'Set' }
                ]
            },
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'amount',
                labelcn: '数量',
                labelen: 'Amount',
                type: 'number',
                default: 10
            },
            {
                key: 'unit',
                labelcn: '单位',
                labelen: 'Unit',
                type: 'select',
                options: [
                    { value: 'levels', labelcn: '等级 (Levels)', labelen: 'Levels' },
                    { value: 'points', labelcn: '经验点 (Points)', labelen: 'Points' }
                ]
            }
        ],
        assemble: (p) => `xp ${p.action} ${p.target} ${p.amount} ${p.unit}`
    },
    kick: {
        titlecn: '踢出玩家',
        titleen: 'Kick Player',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select'
            },
            {
                key: 'reason',
                labelcn: '踢出原因',
                labelen: 'Reason',
                type: 'text',
                optional: true,
                placeholder: '违规踢出 (Kicked for violating rules)'
            }
        ],
        assemble: (p) => `kick ${p.target}${p.reason ? ' ' + p.reason : ''}`
    },
    ban: {
        titlecn: '封禁玩家 (Ban)',
        titleen: 'Ban Player',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select'
            },
            {
                key: 'reason',
                labelcn: '封禁原因',
                labelen: 'Reason',
                type: 'text',
                optional: true,
                placeholder: '违规封禁 (Banned)'
            }
        ],
        assemble: (p) => `ban ${p.target}${p.reason ? ' ' + p.reason : ''}`
    },
    summon: {
        titlecn: '召唤实体/生物 (Summon)',
        titleen: 'Summon Entity',
        params: [
            {
                key: 'entity',
                labelcn: '实体类型',
                labelen: 'Entity Type',
                type: 'select_input',
                options: [
                    { value: 'minecraft:zombie', labelcn: '僵尸 (Zombie)', labelen: 'Zombie' },
                    { value: 'minecraft:skeleton', labelcn: '骷髅 (Skeleton)', labelen: 'Skeleton' },
                    { value: 'minecraft:creeper', labelcn: '苦力怕 (Creeper)', labelen: 'Creeper' },
                    { value: 'minecraft:ender_dragon', labelcn: '末影龙 (Ender Dragon)', labelen: 'Ender Dragon' },
                    { value: 'minecraft:cow', labelcn: '牛 (Cow)', labelen: 'Cow' },
                    { value: 'minecraft:iron_golem', labelcn: '铁傀儡 (Iron Golem)', labelen: 'Iron Golem' }
                ],
                placeholder: 'e.g. minecraft:zombie'
            },
            {
                key: 'coords',
                labelcn: '召唤位置坐标 (X Y Z)',
                labelen: 'Coordinates (X Y Z)',
                type: 'text',
                default: '~ ~ ~',
                placeholder: 'e.g. ~ ~ ~'
            }
        ],
        assemble: (p) => `summon ${p.entity} ${p.coords}`
    },
    say: {
        titlecn: '全服公告广播 (Say)',
        titleen: 'Broadcast Message',
        params: [
            {
                key: 'message',
                labelcn: '公告内容',
                labelen: 'Message',
                type: 'text',
                placeholder: 'e.g. 服务器将在 5 分钟后进行维护...'
            }
        ],
        assemble: (p) => `say ${p.message}`
    },
    advancement: {
        titlecn: '管理玩家进度 (Advancement)',
        titleen: 'Manage Advancements',
        params: [
            {
                key: 'action',
                labelcn: '操作类型',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'grant', labelcn: '授予 (Grant)', labelen: 'Grant' },
                    { value: 'revoke', labelcn: '剥夺 (Revoke)', labelen: 'Revoke' }
                ]
            },
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'mode',
                labelcn: '范围模式',
                labelen: 'Mode',
                type: 'select',
                options: [
                    { value: 'everything', labelcn: '所有进度 (everything)', labelen: 'everything' },
                    { value: 'only', labelcn: '仅此进度 (only)', labelen: 'only' },
                    { value: 'from', labelcn: '以此为根的子进度 (from)', labelen: 'from' },
                    { value: 'through', labelcn: '相关前后进度 (through)', labelen: 'through' },
                    { value: 'until', labelcn: '此进度前的进度 (until)', labelen: 'until' }
                ]
            },
            {
                key: 'advancement',
                labelcn: '特定进度 ID',
                labelen: 'Advancement ID',
                type: 'text',
                vif: (p) => p.mode !== 'everything',
                placeholder: 'e.g. minecraft:story/mine_stone'
            }
        ],
        assemble: (p) => `advancement ${p.action} ${p.target} ${p.mode}${p.mode !== 'everything' && p.advancement ? ' ' + p.advancement : ''}`
    },
    attribute: {
        titlecn: '修改玩家属性 (Attribute)',
        titleen: 'Modify Attributes',
        params: [
            {
                key: 'target',
                labelcn: '目标实体/玩家',
                labelen: 'Target Entity',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'attribute',
                labelcn: '属性类型',
                labelen: 'Attribute',
                type: 'select_input',
                options: [
                    { value: 'generic.max_health', labelcn: '最大生命值 (generic.max_health)', labelen: 'generic.max_health' },
                    { value: 'generic.movement_speed', labelcn: '移动速度 (generic.movement_speed)', labelen: 'generic.movement_speed' },
                    { value: 'generic.attack_damage', labelcn: '攻击伤害 (generic.attack_damage)', labelen: 'generic.attack_damage' },
                    { value: 'generic.armor', labelcn: '护甲值 (generic.armor)', labelen: 'generic.armor' },
                    { value: 'generic.luck', labelcn: '幸运值 (generic.luck)', labelen: 'generic.luck' }
                ],
                placeholder: 'e.g. generic.max_health'
            },
            {
                key: 'action',
                labelcn: '修改操作',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'base get', labelcn: '获取基础值 (base get)', labelen: 'base get' },
                    { value: 'base set', labelcn: '设置基础值 (base set)', labelen: 'base set' },
                    { value: 'get', labelcn: '获取实际值 (get)', labelen: 'get' }
                ]
            },
            {
                key: 'value',
                labelcn: '设定数值',
                labelen: 'Value',
                type: 'number',
                vif: (p) => p.action === 'base set',
                default: 20
            }
        ],
        assemble: (p) => `attribute ${p.target} ${p.attribute} ${p.action}${p.action === 'base set' ? ' ' + p.value : ''}`
    },
    damage: {
        titlecn: '对玩家/实体造成伤害',
        titleen: 'Damage Entity',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家/实体',
                labelen: 'Target Entity',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'amount',
                labelcn: '伤害量',
                labelen: 'Amount',
                type: 'number',
                default: 1
            },
            {
                key: 'type',
                labelcn: '伤害类型',
                labelen: 'Damage Type',
                type: 'select_input',
                options: [
                    { value: 'minecraft:generic', labelcn: '普通伤害 (generic)', labelen: 'generic' },
                    { value: 'minecraft:fall', labelcn: '掉落伤害 (fall)', labelen: 'fall' },
                    { value: 'minecraft:lava', labelcn: '岩浆伤害 (lava)', labelen: 'lava' },
                    { value: 'minecraft:drown', labelcn: '溺水伤害 (drown)', labelen: 'drown' },
                    { value: 'minecraft:wither', labelcn: '凋零伤害 (wither)', labelen: 'wither' }
                ],
                placeholder: 'e.g. minecraft:generic'
            }
        ],
        assemble: (p) => `damage ${p.target} ${p.amount} ${p.type}`
    },
    datapack: {
        titlecn: '数据包管理 (Datapack)',
        titleen: 'Manage Datapacks',
        params: [
            {
                key: 'action',
                labelcn: '操作',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'list', labelcn: '列出所有数据包 (list)', labelen: 'list' },
                    { value: 'enable', labelcn: '启用数据包 (enable)', labelen: 'enable' },
                    { value: 'disable', labelcn: '禁用数据包 (disable)', labelen: 'disable' }
                ]
            },
            {
                key: 'name',
                labelcn: '数据包名称',
                labelen: 'Datapack Name',
                type: 'text',
                vif: (p) => p.action !== 'list',
                placeholder: 'e.g. "vanilla"'
            }
        ],
        assemble: (p) => `datapack ${p.action}${p.action !== 'list' && p.name ? ' ' + p.name : ''}`
    },
    defaultgamemode: {
        titlecn: '修改默认游戏模式',
        titleen: 'Change Default Game Mode',
        params: [
            {
                key: 'gamemode',
                labelcn: '游戏模式',
                labelen: 'Game Mode',
                type: 'select',
                options: [
                    { value: 'survival', labelcn: '生存模式 (Survival)', labelen: 'Survival' },
                    { value: 'creative', labelcn: '创造模式 (Creative)', labelen: 'Creative' },
                    { value: 'adventure', labelcn: '冒险模式 (Adventure)', labelen: 'Adventure' },
                    { value: 'spectator', labelcn: '旁观模式 (Spectator)', labelen: 'Spectator' }
                ]
            }
        ],
        assemble: (p) => `defaultgamemode ${p.gamemode}`
    },
    enchant: {
        titlecn: '给装备附魔 (Enchant)',
        titleen: 'Enchant Item in Hand',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'enchantment',
                labelcn: '附魔属性',
                labelen: 'Enchantment',
                type: 'select_input',
                options: [
                    { value: 'minecraft:sharpness', labelcn: '锋利 (Sharpness)', labelen: 'Sharpness' },
                    { value: 'minecraft:efficiency', labelcn: '效率 (Efficiency)', labelen: 'Efficiency' },
                    { value: 'minecraft:unbreaking', labelcn: '耐久 (Unbreaking)', labelen: 'Unbreaking' },
                    { value: 'minecraft:protection', labelcn: '保护 (Protection)', labelen: 'Protection' },
                    { value: 'minecraft:fortune', labelcn: '时运 (Fortune)', labelen: 'Fortune' },
                    { value: 'minecraft:silk_touch', labelcn: '精准采集 (Silk Touch)', labelen: 'Silk Touch' }
                ],
                placeholder: 'e.g. minecraft:sharpness'
            },
            {
                key: 'level',
                labelcn: '附魔等级',
                labelen: 'Level',
                type: 'number',
                default: 1
            }
        ],
        assemble: (p) => `enchant ${p.target} ${p.enchantment} ${p.level}`
    },
    locate: {
        titlecn: '定位结构/群系/兴趣点',
        titleen: 'Locate Feature/Biome',
        params: [
            {
                key: 'type',
                labelcn: '定位类型',
                labelen: 'Locate Type',
                type: 'select',
                options: [
                    { value: 'structure', labelcn: '结构 (Structure)', labelen: 'Structure' },
                    { value: 'biome', labelcn: '群系 (Biome)', labelen: 'Biome' },
                    { value: 'poi', labelcn: '兴趣点 (POI)', labelen: 'POI' }
                ]
            },
            {
                key: 'name',
                labelcn: '名称 ID',
                labelen: 'Name ID',
                type: 'select_input',
                options: [
                    { value: 'minecraft:village_plains', labelcn: '平原村庄 (village_plains)', labelen: 'village_plains' },
                    { value: 'minecraft:mansion', labelcn: '林地府邸 (mansion)', labelen: 'mansion' },
                    { value: 'minecraft:monument', labelcn: '海底遗迹 (monument)', labelen: 'monument' },
                    { value: 'minecraft:fortress', labelcn: '下界要塞 (fortress)', labelen: 'fortress' },
                    { value: 'minecraft:stronghold', labelcn: '末地要塞 (stronghold)', labelen: 'stronghold' }
                ],
                placeholder: 'e.g. minecraft:village_plains'
            }
        ],
        assemble: (p) => `locate ${p.type} ${p.name}`
    },
    playsound: {
        titlecn: '播放声音 (Playsound)',
        titleen: 'Play Audio/Sound',
        params: [
            {
                key: 'sound',
                labelcn: '声音 ID',
                labelen: 'Sound ID',
                type: 'select_input',
                options: [
                    { value: 'minecraft:entity.generic.explode', labelcn: '爆炸声 (explode)', labelen: 'explode' },
                    { value: 'minecraft:entity.lightning_bolt.thunder', labelcn: '雷鸣声 (thunder)', labelen: 'thunder' },
                    { value: 'minecraft:entity.experience_orb.pickup', labelcn: '经验球拾取 (experience_orb.pickup)', labelen: 'experience_orb.pickup' },
                    { value: 'minecraft:block.portal.travel', labelcn: '穿越传送门 (portal.travel)', labelen: 'portal.travel' }
                ],
                placeholder: 'e.g. minecraft:ui.button.click'
            },
            {
                key: 'source',
                labelcn: '声音音轨/来源',
                labelen: 'Source/Channel',
                type: 'select',
                options: [
                    { value: 'master', labelcn: '主音量 (master)', labelen: 'master' },
                    { value: 'music', labelcn: '音乐 (music)', labelen: 'music' },
                    { value: 'record', labelcn: '唱片机 (record)', labelen: 'record' },
                    { value: 'weather', labelcn: '天气 (weather)', labelen: 'weather' },
                    { value: 'block', labelcn: '方块 (block)', labelen: 'block' },
                    { value: 'hostile', labelcn: '敌对生物 (hostile)', labelen: 'hostile' },
                    { value: 'neutral', labelcn: '友好生物 (neutral)', labelen: 'neutral' },
                    { value: 'player', labelcn: '玩家 (player)', labelen: 'player' },
                    { value: 'ambient', labelcn: '环境 (ambient)', labelen: 'ambient' },
                    { value: 'voice', labelcn: '语音 (voice)', labelen: 'voice' }
                ]
            },
            {
                key: 'target',
                labelcn: '目标听众玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@a'
            },
            {
                key: 'pos',
                labelcn: '发生坐标 (X Y Z)',
                labelen: 'Position (X Y Z)',
                type: 'text',
                default: '~ ~ ~'
            }
        ],
        assemble: (p) => `playsound ${p.sound} ${p.source} ${p.target} ${p.pos}`
    },
    recipe: {
        titlecn: '给予/剥夺合成配方',
        titleen: 'Give/Take Crafting Recipes',
        params: [
            {
                key: 'action',
                labelcn: '操作',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'give', labelcn: '解锁配方 (give)', labelen: 'give' },
                    { value: 'take', labelcn: '锁上配方 (take)', labelen: 'take' }
                ]
            },
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'recipe',
                labelcn: '配方名称 ID',
                labelen: 'Recipe ID',
                type: 'select_input',
                options: [
                    { value: '*', labelcn: '全部配方 (*)', labelen: 'All (*)' },
                    { value: 'minecraft:diamond_sword', labelcn: '钻石剑 (diamond_sword)', labelen: 'diamond_sword' },
                    { value: 'minecraft:chest', labelcn: '箱子 (chest)', labelen: 'chest' }
                ],
                placeholder: 'e.g. *'
            }
        ],
        assemble: (p) => `recipe ${p.action} ${p.target} ${p.recipe}`
    },
    setblock: {
        titlecn: '放置/改变方块 (Setblock)',
        titleen: 'Place Block',
        params: [
            {
                key: 'coords',
                labelcn: '放置坐标 (X Y Z)',
                labelen: 'Coordinates (X Y Z)',
                type: 'text',
                default: '~ ~ ~',
                placeholder: 'e.g. ~ ~ ~'
            },
            {
                key: 'block',
                labelcn: '方块 ID',
                labelen: 'Block ID',
                type: 'select_input',
                options: [
                    { value: 'minecraft:stone', labelcn: '石头 (stone)', labelen: 'stone' },
                    { value: 'minecraft:grass_block', labelcn: '草方块 (grass_block)', labelen: 'grass_block' },
                    { value: 'minecraft:diamond_block', labelcn: '钻石块 (diamond_block)', labelen: 'diamond_block' },
                    { value: 'minecraft:obsidian', labelcn: '黑曜石 (obsidian)', labelen: 'obsidian' },
                    { value: 'minecraft:air', labelcn: '空气/清除 (air)', labelen: 'air' },
                    { value: 'minecraft:tnt', labelcn: 'TNT (tnt)', labelen: 'tnt' }
                ],
                placeholder: 'e.g. minecraft:stone'
            },
            {
                key: 'mode',
                labelcn: '放置模式',
                labelen: 'Place Mode',
                type: 'select',
                options: [
                    { value: 'replace', labelcn: '直接替换 (replace)', labelen: 'replace' },
                    { value: 'destroy', labelcn: '破坏旧方块 (destroy)', labelen: 'destroy' },
                    { value: 'keep', labelcn: '仅在空气处放置 (keep)', labelen: 'keep' }
                ]
            }
        ],
        assemble: (p) => `setblock ${p.coords} ${p.block} ${p.mode}`
    },
    setworldspawn: {
        titlecn: '设置世界出生点',
        titleen: 'Set World Spawnpoint',
        params: [
            {
                key: 'coords',
                labelcn: '出生坐标 (X Y Z)',
                labelen: 'Coordinates (X Y Z)',
                type: 'text',
                default: '~ ~ ~',
                placeholder: 'e.g. ~ ~ ~'
            },
            {
                key: 'angle',
                labelcn: '视线旋转角度',
                labelen: 'Facing Angle',
                type: 'number',
                optional: true,
                placeholder: '留空 (Empty)'
            }
        ],
        assemble: (p) => `setworldspawn ${p.coords}${p.angle !== undefined && p.angle !== '' ? ' ' + p.angle : ''}`
    },
    spawnpoint: {
        titlecn: '设置玩家出生点 (Spawnpoint)',
        titleen: 'Set Player Spawnpoint',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'coords',
                labelcn: '个人出生点坐标 (X Y Z)',
                labelen: 'Coordinates (X Y Z)',
                type: 'text',
                default: '~ ~ ~',
                placeholder: 'e.g. ~ ~ ~'
            }
        ],
        assemble: (p) => `spawnpoint ${p.target} ${p.coords}`
    },
    spreadplayers: {
        titlecn: '随机散布玩家 (Spreadplayers)',
        titleen: 'Spread Players randomly',
        params: [
            {
                key: 'center',
                labelcn: '中心位置 (X Z)',
                labelen: 'Center (X Z)',
                type: 'text',
                default: '0 0',
                placeholder: 'e.g. 0 0'
            },
            {
                key: 'spreadDistance',
                labelcn: '最小间距',
                labelen: 'Min Distance',
                type: 'number',
                default: 10
            },
            {
                key: 'maxRange',
                labelcn: '最大散布半径',
                labelen: 'Max Range',
                type: 'number',
                default: 100
            },
            {
                key: 'respectTeams',
                labelcn: '保持同队伍散布',
                labelen: 'Respect Teams',
                type: 'select',
                options: [
                    { value: 'false', labelcn: '否 (false)', labelen: 'false' },
                    { value: 'true', labelcn: '是 (true)', labelen: 'true' }
                ]
            },
            {
                key: 'targets',
                labelcn: '被散布的目标玩家',
                labelen: 'Target Players',
                type: 'player_select',
                default: '@a'
            }
        ],
        assemble: (p) => `spreadplayers ${p.center} ${p.spreadDistance} ${p.maxRange} ${p.respectTeams} ${p.targets}`
    },
    stopsound: {
        titlecn: '停止播放声音 (Stopsound)',
        titleen: 'Stop playing Sound',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@a'
            },
            {
                key: 'source',
                labelcn: '声音来源频道',
                labelen: 'Sound Source',
                type: 'select',
                options: [
                    { value: '*', labelcn: '全部通道 (*)', labelen: 'All (*)' },
                    { value: 'master', labelcn: '主音轨 (master)', labelen: 'master' },
                    { value: 'music', labelcn: '音乐 (music)', labelen: 'music' },
                    { value: 'voice', labelcn: '语音 (voice)', labelen: 'voice' },
                    { value: 'ambient', labelcn: '环境音 (ambient)', labelen: 'ambient' }
                ]
            },
            {
                key: 'sound',
                labelcn: '指定声音 ID',
                labelen: 'Sound ID',
                type: 'text',
                optional: true,
                placeholder: '留空停止全部 (Empty to stop all)'
            }
        ],
        assemble: (p) => `stopsound ${p.target}${p.source !== '*' ? ' ' + p.source : ''}${p.sound ? ' ' + p.sound : ''}`
    },
    tag: {
        titlecn: '管理实体标签 (Tag)',
        titleen: 'Manage Entity Tags',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家/实体',
                labelen: 'Target Entity',
                type: 'player_select',
                default: '@s'
            },
            {
                key: 'action',
                labelcn: '操作',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'list', labelcn: '列出所有标签 (list)', labelen: 'list' },
                    { value: 'add', labelcn: '添加标签 (add)', labelen: 'add' },
                    { value: 'remove', labelcn: '移除标签 (remove)', labelen: 'remove' }
                ]
            },
            {
                key: 'name',
                labelcn: '标签名称',
                labelen: 'Tag Name',
                type: 'text',
                vif: (p) => p.action !== 'list',
                placeholder: 'e.g. VIP'
            }
        ],
        assemble: (p) => `tag ${p.target} ${p.action}${p.action !== 'list' && p.name ? ' ' + p.name : ''}`
    },
    team: {
        titlecn: '管理计分板队伍 (Team)',
        titleen: 'Manage Teams',
        params: [
            {
                key: 'action',
                labelcn: '操作',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'list', labelcn: '列出所有队伍 (list)', labelen: 'list' },
                    { value: 'add', labelcn: '添加队伍 (add)', labelen: 'add' },
                    { value: 'remove', labelcn: '删除队伍 (remove)', labelen: 'remove' },
                    { value: 'empty', labelcn: '清空队伍成员 (empty)', labelen: 'empty' },
                    { value: 'join', labelcn: '加入队伍 (join)', labelen: 'join' },
                    { value: 'leave', labelcn: '离开队伍 (leave)', labelen: 'leave' }
                ]
            },
            {
                key: 'name',
                labelcn: '队伍 ID 名称',
                labelen: 'Team ID/Name',
                type: 'text',
                vif: (p) => p.action !== 'list' && p.action !== 'leave',
                placeholder: 'e.g. red_team'
            },
            {
                key: 'targets',
                labelcn: '目标实体/玩家',
                labelen: 'Target Entities',
                type: 'player_select',
                vif: (p) => p.action === 'join' || p.action === 'leave',
                default: '@s'
            }
        ],
        assemble: (p) => {
            if (p.action === 'list') return `team list`;
            if (p.action === 'leave') return `team leave ${p.targets}`;
            if (p.action === 'join') return `team join ${p.name} ${p.targets}`;
            return `team ${p.action} ${p.name}`;
        }
    },
    title: {
        titlecn: '在玩家屏幕显示大标题 (Title)',
        titleen: 'Display Title on Screen',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家',
                labelen: 'Target Player',
                type: 'player_select',
                default: '@a'
            },
            {
                key: 'action',
                labelcn: '显示动作/类型',
                labelen: 'Action Type',
                type: 'select',
                options: [
                    { value: 'title', labelcn: '显示主标题 (title)', labelen: 'title' },
                    { value: 'subtitle', labelcn: '显示副标题 (subtitle)', labelen: 'subtitle' },
                    { value: 'actionbar', labelcn: '显示快捷栏上方小字 (actionbar)', labelen: 'actionbar' },
                    { value: 'clear', labelcn: '清除所有标题 (clear)', labelen: 'clear' },
                    { value: 'reset', labelcn: '重置标题时间样式 (reset)', labelen: 'reset' }
                ]
            },
            {
                key: 'message',
                labelcn: '文本内容',
                labelen: 'Text Message',
                type: 'text',
                vif: (p) => ['title', 'subtitle', 'actionbar'].includes(p.action),
                placeholder: '请输入要显示的纯文本 (如: 欢迎来到服务器！)'
            }
        ],
        assemble: (p) => {
            if (['clear', 'reset'].includes(p.action)) return `title ${p.target} ${p.action}`;
            const jsonText = JSON.stringify({ text: p.message || '' });
            return `title ${p.target} ${p.action} ${jsonText}`;
        }
    },
    worldborder: {
        titlecn: '控制世界边界 (Worldborder)',
        titleen: 'Control World Border',
        params: [
            {
                key: 'action',
                labelcn: '边界操作',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'get', labelcn: '获取当前边界宽度 (get)', labelen: 'get' },
                    { value: 'set', labelcn: '设置边界宽度 (set)', labelen: 'set' },
                    { value: 'add', labelcn: '扩展/缩小边界宽度 (add)', labelen: 'add' },
                    { value: 'center', labelcn: '设置边界中心坐标 (center)', labelen: 'center' }
                ]
            },
            {
                key: 'value',
                labelcn: '宽度数值 / 坐标 X Z',
                labelen: 'Value / Coords',
                type: 'text',
                vif: (p) => p.action !== 'get',
                placeholder: 'e.g. 10000 or center coords e.g. 0 0'
            }
        ],
        assemble: (p) => `worldborder ${p.action}${p.action !== 'get' && p.value ? ' ' + p.value : ''}`
    },
    op: {
        titlecn: '给予玩家管理员权限 (OP)',
        titleen: 'Promote Player to OP',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家名',
                labelen: 'Target Player',
                type: 'player_select'
            }
        ],
        assemble: (p) => `op ${p.target}`
    },
    deop: {
        titlecn: '撤销玩家管理员权限 (Deop)',
        titleen: 'Demote Player from OP',
        params: [
            {
                key: 'target',
                labelcn: '目标玩家名',
                labelen: 'Target Player',
                type: 'player_select'
            }
        ],
        assemble: (p) => `deop ${p.target}`
    },
    banlist: {
        titlecn: '查看封禁列表',
        titleen: 'View Ban List',
        params: [
            {
                key: 'type',
                labelcn: '封禁类型',
                labelen: 'Ban Type',
                type: 'select',
                options: [
                    { value: 'players', labelcn: '被封禁玩家 (players)', labelen: 'players' },
                    { value: 'ips', labelcn: '被封禁 IP (ips)', labelen: 'ips' }
                ]
            }
        ],
        assemble: (p) => `banlist ${p.type}`
    },
    pardon: {
        titlecn: '解封玩家 (Pardon)',
        titleen: 'Unban/Pardon Player',
        params: [
            {
                key: 'target',
                labelcn: '要解封的玩家名',
                labelen: 'Player Username',
                type: 'text',
                placeholder: 'e.g. Henvei'
            }
        ],
        assemble: (p) => `pardon ${p.target}`
    },
    'ban-ip': {
        titlecn: '封禁 IP 地址',
        titleen: 'Ban IP Address',
        params: [
            {
                key: 'target',
                labelcn: '目标 IP 或玩家名',
                labelen: 'Target IP/Player',
                type: 'text',
                placeholder: 'e.g. 192.168.1.100 or Username'
            },
            {
                key: 'reason',
                labelcn: '封禁原因',
                labelen: 'Reason',
                type: 'text',
                optional: true,
                placeholder: '留空 (Empty)'
            }
        ],
        assemble: (p) => `ban-ip ${p.target}${p.reason ? ' ' + p.reason : ''}`
    },
    'pardon-ip': {
        titlecn: '解封 IP 地址',
        titleen: 'Unban IP Address',
        params: [
            {
                key: 'target',
                labelcn: '解封的目标 IP',
                labelen: 'Target IP',
                type: 'text',
                placeholder: 'e.g. 192.168.1.100'
            }
        ],
        assemble: (p) => `pardon-ip ${p.target}`
    },
    setidletimeout: {
        titlecn: '设置挂机踢出时间',
        titleen: 'Set AFK Idle Timeout',
        params: [
            {
                key: 'minutes',
                labelcn: '挂机时长上限 (分钟)',
                labelen: 'Idle Timeout (minutes)',
                type: 'number',
                default: 10
            }
        ],
        assemble: (p) => `setidletimeout ${p.minutes}`
    },
    tick: {
        titlecn: '调控游戏刻速率 (Tick)',
        titleen: 'Control Tick Rate',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'query', labelcn: '查询当前刻速率 (query)', labelen: 'query' },
                    { value: 'rate', labelcn: '设定每秒刻速率 (rate)', labelen: 'rate' },
                    { value: 'freeze', labelcn: '冻结游戏刻 (freeze)', labelen: 'freeze' },
                    { value: 'unfreeze', labelcn: '解冻游戏刻 (unfreeze)', labelen: 'unfreeze' }
                ]
            },
            {
                key: 'value',
                labelcn: '数值/速率 (每秒刻数)',
                labelen: 'Tick Rate Value',
                type: 'number',
                vif: (p) => p.action === 'rate',
                default: 20
            }
        ],
        assemble: (p) => `tick ${p.action}${p.action === 'rate' ? ' ' + p.value : ''}`
    },
    kill: {
        titlecn: '清除实体/自杀 (Kill)',
        titleen: 'Kill Entities',
        params: [
            {
                key: 'target',
                labelcn: '目标实体',
                labelen: 'Target Entity',
                type: 'select_input',
                options: [
                    { value: '@s', labelcn: '自己 (自杀 @s)', labelen: 'Self (@s)' },
                    { value: '@e[type=!player]', labelcn: '清除所有非玩家实体 (@e[type=!player])', labelen: 'All non-player entities' },
                    { value: '@e[type=monster]', labelcn: '清除所有怪物 (@e[type=monster])', labelen: 'All monsters' },
                    { value: '@e[type=item]', labelcn: '清除所有掉落物 (@e[type=item])', labelen: 'All dropped items' },
                    { value: '@a', labelcn: '所有玩家 (@a)', labelen: 'All players (@a)' }
                ],
                default: '@s',
                placeholder: 'e.g. @s 或 @e[type=!player]'
            }
        ],
        assemble: (p) => `kill ${p.target || '@s'}`
    },
    whitelist: {
        titlecn: '管理服务器白名单',
        titleen: 'Manage Server Whitelist',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'list', labelcn: '查看白名单列表 (list)', labelen: 'List players' },
                    { value: 'add', labelcn: '添加玩家 (add)', labelen: 'Add player' },
                    { value: 'remove', labelcn: '移除玩家 (remove)', labelen: 'Remove player' },
                    { value: 'on', labelcn: '开启白名单 (on)', labelen: 'Turn on' },
                    { value: 'off', labelcn: '关闭白名单 (off)', labelen: 'Turn off' },
                    { value: 'reload', labelcn: '重新加载配置 (reload)', labelen: 'Reload config' }
                ],
                default: 'list'
            },
            {
                key: 'player',
                labelcn: '目标玩家',
                labelen: 'Player Name',
                type: 'text',
                vif: (p) => p.action === 'add' || p.action === 'remove',
                placeholder: '玩家游戏名 (Player name)'
            }
        ],
        assemble: (p) => `whitelist ${p.action}${p.action === 'add' || p.action === 'remove' ? ' ' + (p.player || '') : ''}`
    },
    fill: {
        titlecn: '填充区域方块 (Fill)',
        titleen: 'Fill Blocks in Region',
        params: [
            { key: 'from', labelcn: '起始坐标', labelen: 'From Coords', type: 'text', default: '~ ~ ~', placeholder: 'e.g. ~ ~ ~' },
            { key: 'to', labelcn: '结束坐标', labelen: 'To Coords', type: 'text', default: '~5 ~5 ~5', placeholder: 'e.g. ~5 ~5 ~5' },
            {
                key: 'block',
                labelcn: '方块 ID',
                labelen: 'Block ID',
                type: 'select_input',
                options: [
                    { value: 'minecraft:stone', labelcn: '石头 (stone)', labelen: 'stone' },
                    { value: 'minecraft:air', labelcn: '空气/清除 (air)', labelen: 'air' },
                    { value: 'minecraft:dirt', labelcn: '泥土 (dirt)', labelen: 'dirt' },
                    { value: 'minecraft:glass', labelcn: '玻璃 (glass)', labelen: 'glass' },
                    { value: 'minecraft:oak_planks', labelcn: '橡木木板 (oak_planks)', labelen: 'oak_planks' },
                    { value: 'minecraft:obsidian', labelcn: '黑曜石 (obsidian)', labelen: 'obsidian' },
                    { value: 'minecraft:water', labelcn: '水 (water)', labelen: 'water' },
                    { value: 'minecraft:lava', labelcn: '岩浆 (lava)', labelen: 'lava' }
                ],
                default: 'minecraft:stone',
                placeholder: 'e.g. minecraft:stone'
            },
            {
                key: 'mode',
                labelcn: '填充模式',
                labelen: 'Fill Mode',
                type: 'select',
                options: [
                    { value: 'replace', labelcn: '替换现有方块 (replace)', labelen: 'replace' },
                    { value: 'keep', labelcn: '仅填充空气格 (keep)', labelen: 'keep' },
                    { value: 'destroy', labelcn: '破坏方块掉落 (destroy)', labelen: 'destroy' },
                    { value: 'hollow', labelcn: '中空结构 (hollow)', labelen: 'hollow' },
                    { value: 'outline', labelcn: '仅保留外框 (outline)', labelen: 'outline' }
                ],
                default: 'replace'
            }
        ],
        assemble: (p) => `fill ${p.from || '~ ~ ~'} ${p.to || '~ ~ ~'} ${p.block || 'minecraft:stone'} ${p.mode || 'replace'}`
    },
    clone: {
        titlecn: '复制区域方块 (Clone)',
        titleen: 'Clone Blocks in Region',
        params: [
            { key: 'begin', labelcn: '起始坐标', labelen: 'Begin Coords', type: 'text', default: '~ ~ ~', placeholder: 'e.g. ~ ~ ~' },
            { key: 'end', labelcn: '结束坐标', labelen: 'End Coords', type: 'text', default: '~5 ~5 ~5', placeholder: 'e.g. ~5 ~5 ~5' },
            { key: 'destination', labelcn: '粘贴目标坐标', labelen: 'Destination Coords', type: 'text', default: '~10 ~ ~', placeholder: 'e.g. ~10 ~ ~' },
            {
                key: 'mask',
                labelcn: '遮罩模式',
                labelen: 'Mask Mode',
                type: 'select',
                options: [
                    { value: 'replace', labelcn: '完全覆盖包含空气 (replace)', labelen: 'replace' },
                    { value: 'masked', labelcn: '忽略源区域空气方块 (masked)', labelen: 'masked' }
                ],
                default: 'replace'
            },
            {
                key: 'mode',
                labelcn: '复制模式',
                labelen: 'Clone Mode',
                type: 'select',
                options: [
                    { value: 'normal', labelcn: '常规复制 (normal)', labelen: 'normal' },
                    { value: 'force', labelcn: '重叠强制覆盖 (force)', labelen: 'force' },
                    { value: 'move', labelcn: '剪切移动 (move)', labelen: 'move' }
                ],
                default: 'normal'
            }
        ],
        assemble: (p) => `clone ${p.begin || '~ ~ ~'} ${p.end || '~ ~ ~'} ${p.destination || '~ ~ ~'} ${p.mask || 'replace'} ${p.mode || 'normal'}`
    },
    msg: {
        titlecn: '向玩家发送私聊 (Msg/Tell)',
        titleen: 'Send Private Message',
        params: [
            { key: 'target', labelcn: '目标玩家', labelen: 'Target Player', type: 'player_select', default: '@s' },
            { key: 'message', labelcn: '私聊内容', labelen: 'Message', type: 'text', placeholder: '输入私聊内容', default: '你好！' }
        ],
        assemble: (p) => `msg ${p.target || '@s'} ${p.message || ''}`
    },
    particle: {
        titlecn: '生成粒子特效 (Particle)',
        titleen: 'Spawn Particle Effects',
        params: [
            {
                key: 'particle',
                labelcn: '粒子类型',
                labelen: 'Particle ID',
                type: 'select_input',
                options: [
                    { value: 'minecraft:flame', labelcn: '火焰粒子 (flame)', labelen: 'flame' },
                    { value: 'minecraft:heart', labelcn: '爱心 (heart)', labelen: 'heart' },
                    { value: 'minecraft:happy_villager', labelcn: '村民开心绿色十字 (happy_villager)', labelen: 'happy_villager' },
                    { value: 'minecraft:portal', labelcn: '传送门紫色粒子 (portal)', labelen: 'portal' },
                    { value: 'minecraft:explosion', labelcn: '爆炸烟雾 (explosion)', labelen: 'explosion' },
                    { value: 'minecraft:totem_of_undying', labelcn: '不死图腾金绿闪光 (totem)', labelen: 'totem' },
                    { value: 'minecraft:enchant', labelcn: '附魔符文光芒 (enchant)', labelen: 'enchant' },
                    { value: 'minecraft:campfire_cosy_smoke', labelcn: '篝火浓烟 (smoke)', labelen: 'smoke' }
                ],
                default: 'minecraft:happy_villager',
                placeholder: 'e.g. minecraft:flame'
            },
            { key: 'coords', labelcn: '生成坐标', labelen: 'Coords', type: 'text', default: '~ ~1 ~', placeholder: 'e.g. ~ ~1 ~' },
            { key: 'count', labelcn: '粒子数量', labelen: 'Count', type: 'number', default: 30 },
            { key: 'speed', labelcn: '运动速度', labelen: 'Speed', type: 'number', default: 0.1 }
        ],
        assemble: (p) => `particle ${p.particle || 'minecraft:flame'} ${p.coords || '~ ~1 ~'} 0.5 0.5 0.5 ${p.speed || 0.1} ${p.count || 20} normal`
    },
    bossbar: {
        titlecn: '管理屏幕顶部 Boss 栏 (Bossbar)',
        titleen: 'Manage Screen Bossbar',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'list', labelcn: '查看所有 Boss 栏 (list)', labelen: 'list' },
                    { value: 'add', labelcn: '创建新 Boss 栏 (add)', labelen: 'add' },
                    { value: 'set_players', labelcn: '设置可见玩家 (set players)', labelen: 'set players' },
                    { value: 'set_value', labelcn: '设置进度数值 (set value)', labelen: 'set value' },
                    { value: 'set_max', labelcn: '设置最大数值 (set max)', labelen: 'set max' },
                    { value: 'set_color', labelcn: '设置条形颜色 (set color)', labelen: 'set color' },
                    { value: 'remove', labelcn: '删除 Boss 栏 (remove)', labelen: 'remove' }
                ],
                default: 'list'
            },
            { key: 'id', labelcn: 'Boss 栏 ID', labelen: 'Bar ID', type: 'text', vif: (p) => p.action !== 'list', default: 'custom:event_bar', placeholder: 'e.g. custom:event_bar' },
            { key: 'name', labelcn: '显示文本', labelen: 'Title Text', type: 'text', vif: (p) => p.action === 'add', default: '全服活动进行中', placeholder: '输入标题' },
            { key: 'target', labelcn: '可见玩家', labelen: 'Players', type: 'player_select', vif: (p) => p.action === 'set_players', default: '@a' },
            { key: 'value', labelcn: '数值', labelen: 'Value', type: 'number', vif: (p) => p.action === 'set_value' || p.action === 'set_max', default: 100 },
            {
                key: 'color',
                labelcn: '条形颜色',
                labelen: 'Color',
                type: 'select',
                vif: (p) => p.action === 'set_color',
                options: [
                    { value: 'blue', labelcn: '蓝色 (blue)', labelen: 'blue' },
                    { value: 'purple', labelcn: '紫色 (purple)', labelen: 'purple' },
                    { value: 'red', labelcn: '红色 (red)', labelen: 'red' },
                    { value: 'green', labelcn: '绿色 (green)', labelen: 'green' },
                    { value: 'yellow', labelcn: '黄色 (yellow)', labelen: 'yellow' },
                    { value: 'white', labelcn: '白色 (white)', labelen: 'white' }
                ],
                default: 'blue'
            }
        ],
        assemble: (p) => {
            if (p.action === 'list') return 'bossbar list';
            if (p.action === 'add') return `bossbar add ${p.id || 'custom:bar'} {"text":"${p.name || ''}"}`;
            if (p.action === 'set_players') return `bossbar set ${p.id || 'custom:bar'} players ${p.target || '@a'}`;
            if (p.action === 'set_value') return `bossbar set ${p.id || 'custom:bar'} value ${p.value || 100}`;
            if (p.action === 'set_max') return `bossbar set ${p.id || 'custom:bar'} max ${p.value || 100}`;
            if (p.action === 'set_color') return `bossbar set ${p.id || 'custom:bar'} color ${p.color || 'blue'}`;
            if (p.action === 'remove') return `bossbar remove ${p.id || 'custom:bar'}`;
            return 'bossbar list';
        }
    },
    forceload: {
        titlecn: '区块常载保持 (Forceload)',
        titleen: 'Force Load Chunks',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'query', labelcn: '查询已常载区块 (query)', labelen: 'query' },
                    { value: 'add', labelcn: '开启常载指定区块 (add)', labelen: 'add' },
                    { value: 'remove', labelcn: '取消常载指定区块 (remove)', labelen: 'remove' },
                    { value: 'remove all', labelcn: '清除所有常载区块 (remove all)', labelen: 'remove all' }
                ],
                default: 'query'
            },
            { key: 'coords', labelcn: '区块坐标 (X Z)', labelen: 'Chunk Coords', type: 'text', vif: (p) => p.action === 'add' || p.action === 'remove', default: '~ ~', placeholder: '当前区块 ~ ~ 或输入 X Z' }
        ],
        assemble: (p) => `forceload ${p.action}${p.coords && p.action !== 'remove all' && p.action !== 'query' ? ' ' + p.coords : ''}`
    },
    item: {
        titlecn: '修改实体或容器槽位物品 (Item)',
        titleen: 'Modify Slot Item',
        params: [
            { key: 'target', labelcn: '目标玩家或实体', labelen: 'Target Entity', type: 'player_select', default: '@s' },
            {
                key: 'slot',
                labelcn: '槽位类型',
                labelen: 'Slot',
                type: 'select_input',
                options: [
                    { value: 'weapon.mainhand', labelcn: '主手手持 (weapon.mainhand)', labelen: 'weapon.mainhand' },
                    { value: 'weapon.offhand', labelcn: '副手副武器 (weapon.offhand)', labelen: 'weapon.offhand' },
                    { value: 'armor.head', labelcn: '头部/头盔 (armor.head)', labelen: 'armor.head' },
                    { value: 'armor.chest', labelcn: '胸部/胸甲 (armor.chest)', labelen: 'armor.chest' },
                    { value: 'armor.legs', labelcn: '腿部/护腿 (armor.legs)', labelen: 'armor.legs' },
                    { value: 'armor.feet', labelcn: '脚部/靴子 (armor.feet)', labelen: 'armor.feet' }
                ],
                default: 'weapon.mainhand'
            },
            {
                key: 'item',
                labelcn: '物品 ID',
                labelen: 'Item ID',
                type: 'select_input',
                options: [
                    { value: 'minecraft:diamond_sword', labelcn: '钻石剑 (diamond_sword)', labelen: 'diamond_sword' },
                    { value: 'minecraft:netherite_chestplate', labelcn: '下界合金胸甲', labelen: 'netherite_chestplate' },
                    { value: 'minecraft:elytra', labelcn: '鞘翅 (elytra)', labelen: 'elytra' },
                    { value: 'minecraft:shield', labelcn: '盾牌 (shield)', labelen: 'shield' },
                    { value: 'minecraft:air', labelcn: '清空槽位 (air)', labelen: 'air' }
                ],
                default: 'minecraft:diamond_sword'
            },
            { key: 'count', labelcn: '数量', labelen: 'Count', type: 'number', default: 1 }
        ],
        assemble: (p) => `item replace entity ${p.target || '@s'} ${p.slot || 'weapon.mainhand'} with ${p.item || 'minecraft:diamond_sword'} ${p.count || 1}`
    },
    spectate: {
        titlecn: '附身实体旁观视角 (Spectate)',
        titleen: 'Spectate an Entity',
        params: [
            { key: 'target', labelcn: '附身目标实体或玩家', labelen: 'Target Entity', type: 'text', default: '@e[type=zombie,limit=1]', placeholder: '玩家名 或 @e[type=...]' },
            { key: 'player', labelcn: '执行旁观的玩家', labelen: 'Spectator Player', type: 'player_select', default: '@s' }
        ],
        assemble: (p) => `spectate ${p.target || '@e[limit=1]'} ${p.player || '@s'}`
    },
    ride: {
        titlecn: '实体骑乘与脱离载具 (Ride)',
        titleen: 'Mount or Dismount',
        params: [
            { key: 'target', labelcn: '骑手 (执行骑乘的实体)', labelen: 'Rider', type: 'player_select', default: '@s' },
            {
                key: 'action',
                labelcn: '动作',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'mount', labelcn: '骑乘载具 (mount)', labelen: 'mount' },
                    { value: 'dismount', labelcn: '脱离下车 (dismount)', labelen: 'dismount' }
                ],
                default: 'mount'
            },
            { key: 'vehicle', labelcn: '被骑乘目标 (载具)', labelen: 'Vehicle', type: 'text', vif: (p) => p.action === 'mount', default: '@e[type=horse,limit=1]', placeholder: 'e.g. @e[type=horse,limit=1]' }
        ],
        assemble: (p) => `ride ${p.target || '@s'} ${p.action}${p.action === 'mount' ? ' ' + (p.vehicle || '@e[limit=1]') : ''}`
    },
    rotate: {
        titlecn: '旋转实体视角朝向 (Rotate)',
        titleen: 'Rotate Entity Facing',
        params: [
            { key: 'target', labelcn: '目标实体/玩家', labelen: 'Target', type: 'player_select', default: '@s' },
            {
                key: 'mode',
                labelcn: '朝向模式',
                labelen: 'Mode',
                type: 'select',
                options: [
                    { value: 'facing', labelcn: '面向指定坐标 (facing coords)', labelen: 'facing coords' },
                    { value: 'facing_entity', labelcn: '面向指定实体 (facing entity)', labelen: 'facing entity' },
                    { value: 'angles', labelcn: '水平角与俯仰角 (yaw pitch)', labelen: 'yaw pitch' }
                ],
                default: 'facing'
            },
            { key: 'value', labelcn: '坐标 / 实体 / 角度值', labelen: 'Value', type: 'text', default: '~ ~ ~', placeholder: '~ ~ ~ 或 @p 或 0 0' }
        ],
        assemble: (p) => p.mode === 'facing' ? `rotate ${p.target || '@s'} facing ${p.value || '~ ~ ~'}` : (p.mode === 'facing_entity' ? `rotate ${p.target || '@s'} facing entity ${p.value || '@p'}` : `rotate ${p.target || '@s'} ${p.value || '0 0'}`)
    },
    place: {
        titlecn: '原地生成结构与地貌特征 (Place)',
        titleen: 'Place Structure/Feature',
        params: [
            {
                key: 'type',
                labelcn: '生成类型',
                labelen: 'Type',
                type: 'select',
                options: [
                    { value: 'structure', labelcn: '大型世界结构 (structure)', labelen: 'structure' },
                    { value: 'feature', labelcn: '单个地貌植物 (feature)', labelen: 'feature' }
                ],
                default: 'structure'
            },
            {
                key: 'id',
                labelcn: '结构/特征 ID',
                labelen: 'ID',
                type: 'select_input',
                options: [
                    { value: 'minecraft:village_plains', labelcn: '平原村庄 (village_plains)', labelen: 'village_plains' },
                    { value: 'minecraft:ancient_city', labelcn: '远古之城 (ancient_city)', labelen: 'ancient_city' },
                    { value: 'minecraft:bastion_remnant', labelcn: '猪灵残骸堡垒 (bastion_remnant)', labelen: 'bastion_remnant' },
                    { value: 'minecraft:end_city', labelcn: '末地城 (end_city)', labelen: 'end_city' },
                    { value: 'minecraft:oak', labelcn: '橡树 (oak)', labelen: 'oak' }
                ],
                default: 'minecraft:village_plains'
            },
            { key: 'coords', labelcn: '生成坐标', labelen: 'Coords', type: 'text', default: '~ ~ ~', placeholder: 'e.g. ~ ~ ~' }
        ],
        assemble: (p) => `place ${p.type || 'structure'} ${p.id || 'minecraft:village_plains'} ${p.coords || '~ ~ ~'}`
    },
    loot: {
        titlecn: '战利品表生成与掉落 (Loot)',
        titleen: 'Loot Tables and Drops',
        params: [
            {
                key: 'action',
                labelcn: '发放方式',
                labelen: 'Method',
                type: 'select',
                options: [
                    { value: 'give', labelcn: '直接放入玩家背包 (give)', labelen: 'give' },
                    { value: 'spawn', labelcn: '在地面生成掉落物 (spawn)', labelen: 'spawn' }
                ],
                default: 'give'
            },
            { key: 'target', labelcn: '目标玩家或掉落坐标', labelen: 'Target', type: 'text', default: '@s', placeholder: '玩家名/@s 或 坐标 ~ ~ ~' },
            {
                key: 'source',
                labelcn: '战利品来源表',
                labelen: 'Source',
                type: 'select_input',
                options: [
                    { value: 'loot minecraft:chests/simple_dungeon', labelcn: '地牢宝箱战利品' },
                    { value: 'loot minecraft:chests/end_city_treasure', labelcn: '末地城宝藏战利品' },
                    { value: 'loot minecraft:chests/ancient_city', labelcn: '远古之城战利品' },
                    { value: 'fish minecraft:gameplay/fishing', labelcn: '钓鱼战利品' }
                ],
                default: 'loot minecraft:chests/simple_dungeon'
            }
        ],
        assemble: (p) => `loot ${p.action || 'give'} ${p.target || '@s'} ${p.source || 'loot minecraft:chests/simple_dungeon'}`
    },
    random: {
        titlecn: '随机数发生器与掷骰 (Random)',
        titleen: 'Random Value Generator',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'value', labelcn: '生成指定范围随机整数 (value)', labelen: 'value' },
                    { value: 'roll', labelcn: '模拟掷骰子投点 (roll)', labelen: 'roll' },
                    { value: 'reset', labelcn: '重置随机数序列 (reset)', labelen: 'reset' }
                ],
                default: 'value'
            },
            { key: 'range', labelcn: '随机数范围', labelen: 'Range', type: 'text', vif: (p) => p.action !== 'reset', default: '1..100', placeholder: 'e.g. 1..100 或 1..6' }
        ],
        assemble: (p) => `random ${p.action}${p.action !== 'reset' ? ' ' + (p.range || '1..100') : ''}`
    },
    'save-all': {
        titlecn: '保存服务器世界存档 (Save-All)',
        titleen: 'Save World to Disk',
        params: [
            {
                key: 'mode',
                labelcn: '保存方式',
                labelen: 'Mode',
                type: 'select',
                options: [
                    { value: 'save-all', labelcn: '正常保存所有世界数据 (save-all)', labelen: 'save-all' },
                    { value: 'save-all flush', labelcn: '强制深度刷写所有区块到硬盘 (save-all flush)', labelen: 'save-all flush' }
                ],
                default: 'save-all'
            }
        ],
        assemble: (p) => p.mode || 'save-all'
    },
    'save-off': {
        titlecn: '关闭世界自动保存 (Save-Off)',
        titleen: 'Disable Auto-Save',
        params: [],
        assemble: () => 'save-off'
    },
    'save-on': {
        titlecn: '恢复世界自动保存 (Save-On)',
        titleen: 'Enable Auto-Save',
        params: [],
        assemble: () => 'save-on'
    },
    stop: {
        titlecn: '安全关闭服务器 (Stop)',
        titleen: 'Stop Server Safely',
        params: [],
        assemble: () => 'stop'
    },
    seed: {
        titlecn: '查看当前世界生成种子 (Seed)',
        titleen: 'Display World Seed',
        params: [],
        assemble: () => 'seed'
    },
    list: {
        titlecn: '列出当前在线玩家 (List)',
        titleen: 'List Online Players',
        params: [
            {
                key: 'mode',
                labelcn: '显示模式',
                labelen: 'Mode',
                type: 'select',
                options: [
                    { value: 'list', labelcn: '仅列出玩家名字 (list)', labelen: 'list' },
                    { value: 'list uuids', labelcn: '附带玩家 UUID 详情 (list uuids)', labelen: 'list uuids' }
                ],
                default: 'list'
            }
        ],
        assemble: (p) => p.mode || 'list'
    },
    help: {
        titlecn: '服务端指令帮助手册 (Help)',
        titleen: 'Command Help',
        params: [
            { key: 'cmd', labelcn: '查询具体指令', labelen: 'Command Name', type: 'text', optional: true, placeholder: '留空列出所有，或输入如 gamemode' }
        ],
        assemble: (p) => p.cmd ? `help ${p.cmd}` : 'help'
    },
    fillbiome: {
        titlecn: '批量填充生物群系 (FillBiome)',
        titleen: 'Fill Biome in Region',
        params: [
            { key: 'from', labelcn: '起始坐标', labelen: 'From', type: 'text', default: '~-10 ~-5 ~-10' },
            { key: 'to', labelcn: '结束坐标', labelen: 'To', type: 'text', default: '~10 ~5 ~10' },
            {
                key: 'biome',
                labelcn: '目标生物群系',
                labelen: 'Biome',
                type: 'select_input',
                options: [
                    { value: 'minecraft:plains', labelcn: '平原 (plains)', labelen: 'plains' },
                    { value: 'minecraft:cherry_grove', labelcn: '樱花林 (cherry_grove)', labelen: 'cherry_grove' },
                    { value: 'minecraft:desert', labelcn: '沙漠 (desert)', labelen: 'desert' },
                    { value: 'minecraft:snowy_plains', labelcn: '雪原 (snowy_plains)', labelen: 'snowy_plains' },
                    { value: 'minecraft:jungle', labelcn: '丛林 (jungle)', labelen: 'jungle' },
                    { value: 'minecraft:mushroom_fields', labelcn: '蘑菇岛 (mushroom_fields)', labelen: 'mushroom_fields' }
                ],
                default: 'minecraft:cherry_grove'
            }
        ],
        assemble: (p) => `fillbiome ${p.from || '~ ~ ~'} ${p.to || '~ ~ ~'} ${p.biome || 'minecraft:plains'}`
    },
    scoreboard: {
        titlecn: '计分板与排行榜系统 (Scoreboard)',
        titleen: 'Scoreboard System',
        params: [
            {
                key: 'category',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'setdisplay sidebar', labelcn: '侧边栏显示榜单 (setdisplay sidebar)', labelen: 'setdisplay sidebar' },
                    { value: 'setdisplay below_name', labelcn: '玩家名字下方显示 (setdisplay below_name)', labelen: 'setdisplay below_name' },
                    { value: 'setdisplay list', labelcn: 'Tab 键列表显示 (setdisplay list)', labelen: 'setdisplay list' },
                    { value: 'objectives list', labelcn: '列出全部计分项 (objectives list)', labelen: 'objectives list' },
                    { value: 'objectives add', labelcn: '创建新计分项 (objectives add)', labelen: 'objectives add' },
                    { value: 'objectives remove', labelcn: '删除计分项 (objectives remove)', labelen: 'objectives remove' },
                    { value: 'players add', labelcn: '增加玩家分数 (players add)', labelen: 'players add' },
                    { value: 'players set', labelcn: '设置玩家分数 (players set)', labelen: 'players set' },
                    { value: 'players reset', labelcn: '清空/重置玩家分数 (players reset)', labelen: 'players reset' },
                    { value: 'players list', labelcn: '查看玩家得分 (players list)', labelen: 'players list' }
                ],
                default: 'setdisplay sidebar'
            },
            { key: 'objective', labelcn: '计分项名称', labelen: 'Objective', type: 'text', default: 'coins', placeholder: 'e.g. coins / deaths / kills' },
            {
                key: 'criteria',
                labelcn: '计分准则',
                labelen: 'Criteria',
                type: 'select_input',
                vif: (p) => p.category === 'objectives add',
                options: [
                    { value: 'dummy', labelcn: '虚拟记分 (dummy，插件/脚本常用)', labelen: 'dummy' },
                    { value: 'deathCount', labelcn: '死亡次数 (deathCount)', labelen: 'deathCount' },
                    { value: 'playerKillCount', labelcn: '击杀玩家数 (playerKillCount)', labelen: 'playerKillCount' },
                    { value: 'totalKillCount', labelcn: '总击杀数 (totalKillCount)', labelen: 'totalKillCount' },
                    { value: 'health', labelcn: '玩家生命值 (health)', labelen: 'health' }
                ],
                default: 'dummy'
            },
            { key: 'target', labelcn: '目标玩家', labelen: 'Target', type: 'player_select', vif: (p) => (p.category || '').startsWith('players '), default: '@s' },
            { key: 'score', labelcn: '分数值', labelen: 'Score', type: 'number', vif: (p) => p.category === 'players add' || p.category === 'players set', default: 10 }
        ],
        assemble: (p) => {
            const cat = p.category || 'setdisplay sidebar';
            if (cat === 'objectives list') return 'scoreboard objectives list';
            if (cat === 'objectives add') return `scoreboard objectives add ${p.objective || 'coins'} ${p.criteria || 'dummy'}`;
            if (cat === 'objectives remove') return `scoreboard objectives remove ${p.objective || 'coins'}`;
            if (cat.startsWith('setdisplay')) return `scoreboard ${cat} ${p.objective || 'coins'}`;
            if (cat === 'players list') return `scoreboard players list ${p.target || '@s'}`;
            if (cat === 'players reset') return `scoreboard players reset ${p.target || '@s'} ${p.objective || ''}`;
            return `scoreboard ${cat} ${p.target || '@s'} ${p.objective || 'coins'} ${p.score || 0}`;
        }
    },
    data: {
        titlecn: 'NBT 数据实体与方块读写 (Data)',
        titleen: 'NBT Data Manipulation',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'get entity', labelcn: '读取实体 NBT 数据 (get entity)', labelen: 'get entity' },
                    { value: 'get block', labelcn: '读取方块 NBT 数据 (get block)', labelen: 'get block' },
                    { value: 'merge entity', labelcn: '修改实体 NBT 标签 (merge entity)', labelen: 'merge entity' },
                    { value: 'merge block', labelcn: '修改方块 NBT 标签 (merge block)', labelen: 'merge block' }
                ],
                default: 'get entity'
            },
            { key: 'target', labelcn: '目标实体或方块坐标', labelen: 'Target', type: 'text', default: '@s', placeholder: '@s 或 坐标 X Y Z' },
            { key: 'path', labelcn: 'NBT 标签路径 (可选)', labelen: 'Path', type: 'text', vif: (p) => (p.action || '').startsWith('get '), optional: true, placeholder: '可留空或输入如 Pos, Health, Inventory' },
            { key: 'nbt', labelcn: 'NBT 数据体', labelen: 'NBT Tag', type: 'text', vif: (p) => (p.action || '').startsWith('merge '), default: '{NoAI:1b}', placeholder: 'e.g. {NoAI:1b,Invulnerable:1b}' }
        ],
        assemble: (p) => {
            const act = p.action || 'get entity';
            if (act.startsWith('get ')) return `data ${act} ${p.target || '@s'}${p.path ? ' ' + p.path : ''}`;
            return `data ${act} ${p.target || '@s'} ${p.nbt || '{}'}`;
        }
    },
    tellraw: {
        titlecn: '向玩家发送高级富文本 (Tellraw)',
        titleen: 'Send Formatted JSON Message',
        params: [
            { key: 'target', labelcn: '接收玩家', labelen: 'Target', type: 'player_select', default: '@a' },
            {
                key: 'color',
                labelcn: '文字颜色',
                labelen: 'Color',
                type: 'select',
                options: [
                    { value: 'gold', labelcn: '金色 (gold)', labelen: 'gold' },
                    { value: 'yellow', labelcn: '黄色 (yellow)', labelen: 'yellow' },
                    { value: 'green', labelcn: '绿色 (green)', labelen: 'green' },
                    { value: 'aqua', labelcn: '青色 (aqua)', labelen: 'aqua' },
                    { value: 'red', labelcn: '红色 (red)', labelen: 'red' },
                    { value: 'light_purple', labelcn: '粉紫色 (light_purple)', labelen: 'light_purple' },
                    { value: 'white', labelcn: '白色 (white)', labelen: 'white' }
                ],
                default: 'gold'
            },
            {
                key: 'bold',
                labelcn: '文字加粗',
                labelen: 'Bold',
                type: 'select',
                options: [
                    { value: 'true', labelcn: '加粗 (bold)', labelen: 'bold' },
                    { value: 'false', labelcn: '常规字体 (normal)', labelen: 'normal' }
                ],
                default: 'true'
            },
            { key: 'text', labelcn: '公告内容', labelen: 'Message Text', type: 'text', default: '【系统公告】服务器即将进行维护', placeholder: '输入要发送的公告内容' }
        ],
        assemble: (p) => `tellraw ${p.target || '@a'} [{"text":"${p.text || ''}","color":"${p.color || 'gold'}","bold":${p.bold === 'true'}}]`
    },
    schedule: {
        titlecn: '延时与定时任务调度 (Schedule)',
        titleen: 'Schedule Function',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'function', labelcn: '延迟执行函数 (function)', labelen: 'function' },
                    { value: 'clear', labelcn: '清除已计划的任务 (clear)', labelen: 'clear' }
                ],
                default: 'function'
            },
            { key: 'name', labelcn: '函数命名空间路径', labelen: 'Function Path', type: 'text', default: 'custom:timer', placeholder: 'e.g. custom:daily_reward' },
            { key: 'time', labelcn: '延时时长', labelen: 'Delay Time', type: 'text', vif: (p) => p.action === 'function', default: '10s', placeholder: 'e.g. 5s / 1d / 20t' }
        ],
        assemble: (p) => p.action === 'clear' ? `schedule clear ${p.name || ''}` : `schedule function ${p.name || ''} ${p.time || '10s'}`
    },
    function: {
        titlecn: '执行数据包函数脚本 (Function)',
        titleen: 'Run Datapack Function',
        params: [
            { key: 'name', labelcn: '函数命名空间路径', labelen: 'Function Path', type: 'text', default: 'custom:start', placeholder: 'e.g. custom:start' }
        ],
        assemble: (p) => `function ${p.name || ''}`
    },
    trigger: {
        titlecn: '触发自定义计分扳机 (Trigger)',
        titleen: 'Trigger Custom Score',
        params: [
            { key: 'objective', labelcn: '扳机计分项名称', labelen: 'Objective', type: 'text', default: 'rtp', placeholder: 'e.g. rtp / home' },
            {
                key: 'action',
                labelcn: '方式',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'set', labelcn: '设为指定数值 (set)', labelen: 'set' },
                    { value: 'add', labelcn: '增加指定数值 (add)', labelen: 'add' }
                ],
                default: 'set'
            },
            { key: 'value', labelcn: '数值', labelen: 'Value', type: 'number', default: 1 }
        ],
        assemble: (p) => `trigger ${p.objective || 'rtp'} ${p.action || 'set'} ${p.value || 1}`
    },
    debug: {
        titlecn: '服务端性能分析调试 (Debug)',
        titleen: 'Server Debug Profiler',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'start', labelcn: '开始记录分析 (start)', labelen: 'start' },
                    { value: 'stop', labelcn: '停止记录并输出结果 (stop)', labelen: 'stop' }
                ],
                default: 'start'
            }
        ],
        assemble: (p) => `debug ${p.action || 'start'}`
    },
    perf: {
        titlecn: '专用服务端性能分析 (Perf)',
        titleen: 'Performance Profiling',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'start', labelcn: '开始性能采样 (start)', labelen: 'start' },
                    { value: 'stop', labelcn: '停止采样并输出报告 (stop)', labelen: 'stop' }
                ],
                default: 'start'
            }
        ],
        assemble: (p) => `perf ${p.action || 'start'}`
    },
    jfr: {
        titlecn: 'Java 飞行记录仪采样 (JFR)',
        titleen: 'Java Flight Recorder',
        params: [
            {
                key: 'action',
                labelcn: '操作类别',
                labelen: 'Action',
                type: 'select',
                options: [
                    { value: 'start', labelcn: '开启 JFR 采样 (start)', labelen: 'start' },
                    { value: 'stop', labelcn: '停止 JFR 并导出记录 (stop)', labelen: 'stop' }
                ],
                default: 'start'
            }
        ],
        assemble: (p) => `jfr ${p.action || 'start'}`
    },
    publish: {
        titlecn: '发布为局域网联机 (Publish)',
        titleen: 'Publish World to LAN',
        params: [
            { key: 'port', labelcn: '联机端口', labelen: 'Port', type: 'number', optional: true, placeholder: '默认 25565' }
        ],
        assemble: (p) => p.port ? `publish ${p.port}` : 'publish'
    },
    me: {
        titlecn: '发送动作叙述消息 (Me)',
        titleen: 'Send Action Message',
        params: [
            { key: 'action', labelcn: '动作内容', labelen: 'Action Text', type: 'text', default: '挥了挥手向大家打招呼', placeholder: 'e.g. 挥了挥手' }
        ],
        assemble: (p) => `me ${p.action || ''}`
    },
    teammsg: {
        titlecn: '向队伍发送队内消息 (Teammsg)',
        titleen: 'Send Message to Team',
        params: [
            { key: 'message', labelcn: '队内消息', labelen: 'Message', type: 'text', default: '准备集合进攻！', placeholder: '输入队伍频道消息' }
        ],
        assemble: (p) => `teammsg ${p.message || ''}`
    },
    return: {
        titlecn: '函数控制流返回值 (Return)',
        titleen: 'Return Value',
        params: [
            { key: 'value', labelcn: '返回值', labelen: 'Value', type: 'number', default: 1 }
        ],
        assemble: (p) => `return ${p.value || 1}`
    },
    execute: {
        titlecn: '复合条件链式执行 (Execute)',
        titleen: 'Execute Condition Runner',
        params: [
            { key: 'as', labelcn: '执行身份 (as)', labelen: 'As Entity', type: 'player_select', default: '@a' },
            {
                key: 'at',
                labelcn: '执行坐标环境 (at)',
                labelen: 'At Location',
                type: 'select_input',
                options: [
                    { value: '@s', labelcn: '自身当前位置 (@s)', labelen: '@s' },
                    { value: '~ ~ ~', labelcn: '当前基准坐标 (~ ~ ~)', labelen: '~ ~ ~' }
                ],
                default: '@s'
            },
            { key: 'subcmd', labelcn: '要运行的命令 (run)', labelen: 'Subcommand', type: 'text', default: 'run tellraw @s "Hi"', placeholder: 'e.g. run give @s diamond 1' }
        ],
        assemble: (p) => `execute as ${p.as || '@a'} at ${p.at || '@s'} ${p.subcmd || 'run help'}`
    },
    reload: {
        titlecn: '重新加载服务端数据 (Reload)',
        titleen: 'Reload Datapacks and Resources',
        params: [],
        assemble: () => 'reload'
    }
};

// 指令模式别名映射
COMMAND_SCHEMAS.tp = COMMAND_SCHEMAS.teleport;
COMMAND_SCHEMAS.xp = COMMAND_SCHEMAS.experience;
COMMAND_SCHEMAS.tell = COMMAND_SCHEMAS.msg;
COMMAND_SCHEMAS.w = COMMAND_SCHEMAS.msg;

const COMMAND_ALIASES = {
    time: [
        '时间', '改时间', '调时间', '修改时间', '设置时间', '换时间', '变白天', '变黑夜',
        '白天', '白昼', '黑夜', '夜晚', '晚上', '正午', '午夜', '日出', '日落', '早晨', '清晨', '半夜',
        'day', 'night', 'noon', 'midnight', 'sunrise', 'sunset', 'time'
    ],
    weather: [
        '天气', '改天气', '设置天气', '调天气', '换天气',
        '晴天', '大晴天', '放晴', '下雨', '雨天', '暴雨', '大雨', '停雨',
        '雷雨', '打雷', '雷暴', '暴风雨',
        'clear', 'rain', 'thunder', 'storm', 'weather'
    ],
    gamemode: [
        '模式', '改模式', '游戏模式', '切换模式', '换模式', '调模式', '设置模式',
        '创造', '创造模式', '生存', '生存模式', '冒险', '冒险模式', '旁观模式', '旁观者',
        '上帝模式', '无敌', '飞行', 'gm', 'gmc', 'gms', 'gma', 'gmsp',
        'creative', 'survival', 'adventure', 'spectator', 'gamemode'
    ],
    defaultgamemode: [
        '默认模式', '默认游戏模式', '初始模式', '进服模式', '默认生存', '默认创造'
    ],
    difficulty: [
        '难度', '改难度', '调难度', '游戏难度', '设置难度',
        '和平', '简单', '普通', '困难', '怪物生成', '怪物攻击', '禁止生成怪物',
        'peaceful', 'easy', 'normal', 'hard', 'difficulty'
    ],
    clear: [
        '清空', '清背包', '清空背包', '清理背包', '清除背包', '清除物品', '删背包', '没收背包', '垃圾', '清空物品',
        'clear inventory', 'clean', 'clear'
    ],
    experience: [
        '经验', '加经验', '经验值', '等级', '升到', '升级', '调等级', '经验球', '经验条', '加级', '修改等级',
        'xp', 'exp', 'level', 'experience'
    ],
    teleport: [
        '传送', '传送到', 'tp', '拉人', '找人', '回家', '坐标', '瞬间移动', '飞到', '瞬移', '传人', '移动到',
        'teleport', 'tpa', 'tpahere'
    ],
    spreadplayers: [
        '随机传送', '散布', '分散', '散开', '随机散布', 'rtp', '传送到随机位置'
    ],
    spawnpoint: [
        '出生点', '重生点', '复活点', '设家', '老家', '个人出生点', '设置复活点'
    ],
    setworldspawn: [
        '世界出生点', '主城出生点', '全服出生点', '世界重生点', '主城', '设置世界出生点'
    ],
    gamerule: [
        '规则', '游戏规则', '修改规则', '改规则', '设置规则',
        '死亡不掉落', '不掉落', '防爆', '防苦力怕', '生物破坏', '时间流动', '停止时间', '天气流动', '自然生成', '立即复活', '保留背包', '命令方块日志',
        'keepinventory', 'mobgriefing', 'dodaylightcycle', 'doweathercycle', 'domobspawning', 'gamerule'
    ],
    give: [
        '给物品', '发东西', '给予', '刷物品', '发钻石', '拿物品', '刷东西', '获取物品', '给装备', '发装备', '发道具', '刷铁',
        'item', 'diamond', 'give'
    ],
    summon: [
        '召唤', '生成', '刷怪', '生成生物', '生成实体', '招怪', '刷村民', '刷僵尸', '刷末影龙', '刷凋零', '召生物', '造怪',
        'spawn', 'mob', 'summon'
    ],
    kill: [
        '杀死', '自杀', '处决', '清除实体', '清怪', '杀怪', '消灭', '秒杀', '杀人', '清除所有生物', '清实体',
        'suicide', 'slay', 'kill'
    ],
    damage: [
        '伤害', '扣血', '掉血', '造成伤害', '扣生命', '打人', '攻击', '打血',
        'hurt', 'wound', 'damage'
    ],
    effect: [
        '药水', '效果', '状态', '药水效果', 'buff', 'debuff', '加速', '速度', '夜视', '力量', '隐形', '急迫', '跳跃提升', '缓慢', '抗性提升', '发光', '生命恢复', '虚弱',
        'potion', 'speed', 'strength', 'invisibility', 'night_vision', 'effect'
    ],
    enchant: [
        '附魔', '魔咒', '附魔书', '强化', '武器附魔', '装备附魔', '锋利', '保护', '击退', '时运', '精准采集', '力量', '无限', '火焰附加',
        'sharpness', 'protection', 'fortune', 'enchant'
    ],
    kick: [
        '踢出', '踢人', '移除玩家', '请离', '踢掉', '断开连接', 'kick'
    ],
    ban: [
        '封禁', '封号', '拉黑', '黑名单', '封人', '禁入', '永久封禁', '封禁玩家', 'ban'
    ],
    'ban-ip': [
        '封ip', '封禁ip', '拉黑ip', '禁ip', 'ip封禁', 'ban-ip'
    ],
    banlist: [
        '封禁列表', '黑名单列表', '查封禁', '解封列表', '查黑名单', 'banlist'
    ],
    pardon: [
        '解封', '解禁', '特赦', '放出来', '解除封号', '解封玩家', '取消封禁', 'unban', 'pardon'
    ],
    'pardon-ip': [
        '解封ip', '解除ip封禁', 'ip解封', '特赦ip', 'pardon-ip'
    ],
    op: [
        '管理员', '给管理', '设为管理', '给权', '给op', '提权', '腐竹', '服主', '权限', '设置管理员', '加管理', 'op'
    ],
    deop: [
        '撤销管理', '取消管理', '降权', '撤op', '移除管理员', '下管理', '撤销权限', 'deop'
    ],
    whitelist: [
        '白名单', '进服名单', '准入名单', '开启白名单', '加白名单', '移出白名单', '加白', '审核名单', 'whitelist'
    ],
    'save-all': [
        '保存', '存档', '防回档', '保存世界', '存盘', '保存地图', '写入磁盘', '立即保存', 'save-all', 'save'
    ],
    'save-off': [
        '关闭自动保存', '暂停保存', 'save-off'
    ],
    'save-on': [
        '开启自动保存', '恢复保存', 'save-on'
    ],
    stop: [
        '关闭服务器', '关服', '停服', '停止', '关闭', '下线', '重启服务器', 'stop'
    ],
    seed: [
        '种子', '世界种子', '地图种子', '查种子', '地形种子', 'seed'
    ],
    locate: [
        '寻找', '定位', '找村庄', '找要塞', '找神殿', '找末地', '找地狱堡垒', '找遗迹', '找群系', '群系', '结构', '最近的', '导航',
        'village', 'fortress', 'mansion', 'monument', 'stronghold', 'locate'
    ],
    say: [
        '全服公告', '公告', '广播', '说话', '全服喊话', '发消息', '喇叭', '通知', 'say'
    ],
    msg: [
        '私聊', '密聊', '悄悄话', '私信', '密语', 'tell', 'whisper', 'msg'
    ],
    tellraw: [
        '彩色字', 'json消息', '富文本', '高亮消息', '点击消息', '高级文本', 'tellraw'
    ],
    title: [
        '大标题', '屏幕大字', '标题', '字幕', '屏幕显示', '居中文字', 'actionbar', 'title'
    ],
    playsound: [
        '播放声音', '播放音效', '声音', '音乐', '放歌', '音效', '唱片', '播放音频', 'playsound'
    ],
    stopsound: [
        '停止声音', '停止音乐', '静音', '关声音', '停音效', 'stopsound'
    ],
    particle: [
        '粒子', '粒子效果', '特效', '烟花', '光效', '爱心', '爆炸', 'particle'
    ],
    setblock: [
        '放置方块', '放方块', '改方块', '替换方块', '生成方块', '下落方块', 'setblock'
    ],
    fill: [
        '填充', '铺地', '整地', '大面积填方块', '挖坑', '造墙', '填平', 'fill'
    ],
    fillbiome: [
        '改生物群系', '填充群系', '改环境', '换群系', 'fillbiome'
    ],
    clone: [
        '复制', '克隆', '复制建筑', '搬家', '平移建筑', '搬迁', 'clone'
    ],
    worldborder: [
        '世界边界', '边界', '边境', '缩圈', '毒圈', '世界限制', '扩大边界', '缩小边界', 'worldborder'
    ],
    scoreboard: [
        '记分板', '计分板', '积分', '分数', '排行榜', '杀敌数', '死亡数', 'scoreboard'
    ],
    bossbar: [
        '血条', 'boss条', '顶栏血条', '顶部显示', '进度条', 'boss栏', 'bossbar'
    ],
    tick: [
        '刻', '游戏刻', '加速时间', '冻结时间', '时间流速', '暂停游戏', 'tps', 'tick速率', 'tick'
    ],
    datapack: [
        '数据包', 'datapack管理', '启用数据包', '禁用数据包', '模组包', 'datapack'
    ],
    reload: [
        '重载', '刷新', '重新加载', '刷新配置', '重载函数', '重载数据包', 'reload'
    ],
    list: [
        '在线玩家', '查人', '玩家列表', '查在线', '谁在线', '查看在线', 'list'
    ],
    advancement: [
        '进度', '成就', '解锁成就', '获得成就', '完成进度', '进度授予', 'advancement'
    ],
    attribute: [
        '属性', '生命上限', '血量上限', '移动速度', '攻击力', '修改属性', '实体属性', 'attribute'
    ],
    item: [
        '修改物品', '替换物品', '修改装备', '主手', '副手', '头盔', '胸甲', 'item'
    ],
    setidletimeout: [
        '挂机', '挂机踢出', '超时踢出', '空闲时间', '自动踢出', '挂机时间', 'setidletimeout'
    ],
    tag: [
        '标签', '添加标签', '移除标签', '实体标记', 'tag'
    ],
    team: [
        '队伍', '分队', '团队', '队伍颜色', '同队伤害', '友军伤害', 'team'
    ],
    ride: [
        '骑乘', '骑马', '下马', '骑生物', '下坐骑', 'ride'
    ],
    spectate: [
        '旁观', '幽灵观察', '观战', '第一视角', 'spectate'
    ],
    recipe: [
        '配方', '合成表', '解锁配方', '合成配方', 'recipe'
    ],
    rotate: [
        '旋转', '转身', '朝向', '旋转朝向', 'rotate'
    ],
    forceload: [
        '常载区块', '强制加载', '强载', '区块常驻', '保持加载', 'forceload'
    ],
    function: [
        '函数', '执行函数', '运行函数', 'mcfunction', 'function'
    ],
    execute: [
        '高级执行', '条件执行', 'execute', 'run', '作为执行'
    ],
    data: [
        'nbt', '数据修改', '实体数据', '方块数据', '查看nbt', 'data'
    ],
    debug: [
        '调试', '性能分析', '卡顿排查', 'debug'
    ],
    help: [
        '帮助', '指令帮助', '命令列表', 'help'
    ],
    tp: [
        'tp', '传送', '传送到', '瞬移', '拉人', '飞到'
    ],
    xp: [
        'xp', '经验', '加经验', '经验等级', '升级', 'exp'
    ],
    tell: [
        'tell', '私聊', '密聊', '私信'
    ],
    w: [
        'w', '私聊', '密聊', '私信'
    ],
    me: [
        'me', '动作', '动作消息', '动作叙述'
    ],
    perf: [
        'perf', '性能', '性能分析', '服务端采样'
    ],
    jfr: [
        'jfr', '飞行记录仪', '性能记录', 'java采样'
    ],
    publish: [
        'publish', '局域网', '开放局域网', '局域网联机', '单机开服'
    ],
    return: [
        'return', '返回', '函数返回', '返回值'
    ]
};

const MC_COMMANDS = [
    { name: 'advancement', syntax: '/advancement (grant|revoke) <targets> <advancement>', desc: 'advancement_desc', category: 'player', quick: true, template: 'advancement grant @s everything' },
    { name: 'attribute', syntax: '/attribute <target> <attribute> (get|base|modifier)', desc: 'attribute_desc', category: 'player', quick: false },
    { name: 'clear', syntax: '/clear [<targets>] [<item>] [<maxCount>]', desc: 'clear_desc', category: 'player', quick: true, template: 'clear @s' },
    { name: 'clone', syntax: '/clone <begin> <end> <destination>', desc: 'clone_desc', category: 'world', quick: false },
    { name: 'damage', syntax: '/damage <target> <amount> [<damageType>]', desc: 'damage_desc', category: 'player', quick: true, template: 'damage @s 1 minecraft:generic' },
    { name: 'data', syntax: '/data (merge|get|remove|modify) <target>', desc: 'data_desc', category: 'advanced', quick: false },
    { name: 'datapack', syntax: '/datapack (enable|disable|list|create) <name>', desc: 'datapack_desc', category: 'server', quick: true, template: 'datapack list' },
    { name: 'debug', syntax: '/debug (start|stop|function)', desc: 'debug_desc', category: 'server', quick: true, template: 'debug start' },
    { name: 'defaultgamemode', syntax: '/defaultgamemode <gamemode>', desc: 'defaultgamemode_desc', category: 'server', quick: true, template: 'defaultgamemode survival' },
    { name: 'difficulty', syntax: '/difficulty [peaceful|easy|normal|hard]', desc: 'difficulty_desc', category: 'server', quick: true, template: 'difficulty normal' },
    { name: 'effect', syntax: '/effect (give|clear) <targets> [<effect>]', desc: 'effect_desc', category: 'player', quick: true, template: 'effect give @s minecraft:speed 600 1' },
    { name: 'enchant', syntax: '/enchant <targets> <enchantment> [<level>]', desc: 'enchant_desc', category: 'player', quick: true, template: 'enchant @s minecraft:sharpness 5' },
    { name: 'experience', syntax: '/experience (add|set|query) <targets> <amount>', desc: 'experience_desc', category: 'player', quick: true, template: 'experience add @s 100' },
    { name: 'fill', syntax: '/fill <from> <to> <block> [outline|hollow|destroy|replace|keep]', desc: 'fill_desc', category: 'world', quick: false },
    { name: 'fillbiome', syntax: '/fillbiome <from> <to> <biome> [replace]', desc: 'fillbiome_desc', category: 'world', quick: false },
    { name: 'forceload', syntax: '/forceload (add|remove|query)', desc: 'forceload_desc', category: 'world', quick: false },
    { name: 'function', syntax: '/function <name> [<arguments>|with]', desc: 'function_desc', category: 'advanced', quick: false },
    { name: 'gamemode', syntax: '/gamemode <gamemode> [<target>]', desc: 'gamemode_desc', category: 'player', quick: true, template: 'gamemode creative' },
    { name: 'gamerule', syntax: '/gamerule <rule> [<value>]', desc: 'gamerule_desc', category: 'server', quick: true, template: 'gamerule keepInventory true' },
    { name: 'give', syntax: '/give <targets> <item> [<count>]', desc: 'give_desc', category: 'player', quick: true, template: 'give @s minecraft:diamond 1' },
    { name: 'help', syntax: '/help [<command>]', desc: 'help_desc', category: 'server', quick: true, template: 'help' },
    { name: 'item', syntax: '/item (replace|modify) <target>', desc: 'item_desc', category: 'player', quick: false },
    { name: 'kick', syntax: '/kick <targets> [<reason>]', desc: 'kick_desc', category: 'player', quick: true, template: 'kick ' },
    { name: 'kill', syntax: '/kill [<targets>]', desc: 'kill_desc', category: 'player', quick: true, template: 'kill @s' },
    { name: 'list', syntax: '/list [uuids]', desc: 'list_desc', category: 'server', quick: true, template: 'list' },
    { name: 'locate', syntax: '/locate (structure|biome|poi) <name>', desc: 'locate_desc', category: 'world', quick: true, template: 'locate structure minecraft:village_plains' },
    { name: 'loot', syntax: '/loot (replace|insert|give|spawn)', desc: 'loot_desc', category: 'advanced', quick: false },
    { name: 'msg', syntax: '/msg <targets> <message>', desc: 'msg_desc', category: 'player', quick: true, template: 'msg ' },
    { name: 'particle', syntax: '/particle <name> [<pos>]', desc: 'particle_desc', category: 'world', quick: true, template: 'particle minecraft:happy_villager ~ ~1 ~' },
    { name: 'place', syntax: '/place (feature|jigsaw|structure|template)', desc: 'place_desc', category: 'world', quick: false },
    { name: 'playsound', syntax: '/playsound <sound> [source] <targets> [<pos>]', desc: 'playsound_desc', category: 'world', quick: false },
    { name: 'random', syntax: '/random (value|roll|reset)', desc: 'random_desc', category: 'advanced', quick: false },
    { name: 'reload', syntax: '/reload', desc: 'reload_desc', category: 'server', quick: true, template: 'reload' },
    { name: 'recipe', syntax: '/recipe (give|take) <targets> <recipe>', desc: 'recipe_desc', category: 'player', quick: false },
    { name: 'ride', syntax: '/ride <target> (mount|dismount)', desc: 'ride_desc', category: 'player', quick: false },
    { name: 'rotate', syntax: '/rotate <target> (<rotation>|facing)', desc: 'rotate_desc', category: 'player', quick: false },
    { name: 'say', syntax: '/say <message>', desc: 'say_desc', category: 'server', quick: true, template: 'say ' },
    { name: 'schedule', syntax: '/schedule (function|clear) <name>', desc: 'schedule_desc', category: 'advanced', quick: false },
    { name: 'scoreboard', syntax: '/scoreboard (objectives|players)', desc: 'scoreboard_desc', category: 'advanced', quick: false },
    { name: 'seed', syntax: '/seed', desc: 'seed_desc', category: 'server', quick: true, template: 'seed' },
    { name: 'setblock', syntax: '/setblock <pos> <block> [destroy|keep|replace]', desc: 'setblock_desc', category: 'world', quick: false },
    { name: 'setworldspawn', syntax: '/setworldspawn [<pos>]', desc: 'setworldspawn_desc', category: 'world', quick: false },
    { name: 'spawnpoint', syntax: '/spawnpoint [<targets>] [<pos>]', desc: 'spawnpoint_desc', category: 'player', quick: true, template: 'spawnpoint @s' },
    { name: 'spectate', syntax: '/spectate [<target>]', desc: 'spectate_desc', category: 'player', quick: false },
    { name: 'spreadplayers', syntax: '/spreadplayers <center> <spreadDistance> <maxRange> (<respectTeams>|under)', desc: 'spreadplayers_desc', category: 'world', quick: false },
    { name: 'stopsound', syntax: '/stopsound <targets> [*|source]', desc: 'stopsound_desc', category: 'player', quick: false },
    { name: 'summon', syntax: '/summon <entity> [<pos>] [<nbt>]', desc: 'summon_desc', category: 'world', quick: true, template: 'summon minecraft:zombie ~ ~ ~' },
    { name: 'tag', syntax: '/tag <targets> (add|remove|list) <name>', desc: 'tag_desc', category: 'player', quick: false },
    { name: 'team', syntax: '/team (list|add|remove|empty|join|leave|modify)', desc: 'team_desc', category: 'advanced', quick: false },
    { name: 'teammsg', syntax: '/teammsg <message>', desc: 'teammsg_desc', category: 'player', quick: false },
    { name: 'teleport', syntax: '/teleport (<location>|<destination>|<targets>)', desc: 'teleport_desc', category: 'player', quick: true, template: 'tp @s ~ ~ ~' },
    { name: 'tellraw', syntax: '/tellraw <targets> <message>', desc: 'tellraw_desc', category: 'advanced', quick: false },
    { name: 'time', syntax: '/time (set|add|pause|resume|rate|query) <value>', desc: 'time_desc', category: 'server', quick: true, template: 'time set day' },
    { name: 'title', syntax: '/title <targets> (clear|reset|title|subtitle|actionbar|times)', desc: 'title_desc', category: 'player', quick: true, template: 'title @s title "Hello"' },
    { name: 'trigger', syntax: '/trigger <objective> [add|set] <value>', desc: 'trigger_desc', category: 'advanced', quick: false },
    { name: 'weather', syntax: '/weather (clear|rain|thunder) [<duration>]', desc: 'weather_desc', category: 'server', quick: true, template: 'weather clear 6000' },
    { name: 'worldborder', syntax: '/worldborder (add|set|center|damage|get|warning)', desc: 'worldborder_desc', category: 'world', quick: false },
    { name: 'ban', syntax: '/ban <targets> [<reason>]', desc: 'ban_desc', category: 'admin', quick: true, template: 'ban ' },
    { name: 'ban-ip', syntax: '/ban-ip <target> [<reason>]', desc: 'ban_ip_desc', category: 'admin', quick: true, template: 'ban-ip ' },
    { name: 'banlist', syntax: '/banlist [ips|players]', desc: 'banlist_desc', category: 'admin', quick: true, template: 'banlist' },
    { name: 'deop', syntax: '/deop <targets>', desc: 'deop_desc', category: 'admin', quick: true, template: 'deop ' },
    { name: 'op', syntax: '/op <targets>', desc: 'op_desc', category: 'admin', quick: true, template: 'op ' },
    { name: 'pardon', syntax: '/pardon <targets>', desc: 'pardon_desc', category: 'admin', quick: true, template: 'pardon ' },
    { name: 'pardon-ip', syntax: '/pardon-ip <target>', desc: 'pardon_ip_desc', category: 'admin', quick: true, template: 'pardon-ip ' },
    { name: 'save-all', syntax: '/save-all [flush]', desc: 'save_all_desc', category: 'admin', quick: true, template: 'save-all' },
    { name: 'save-off', syntax: '/save-off', desc: 'save_off_desc', category: 'admin', quick: true, template: 'save-off' },
    { name: 'save-on', syntax: '/save-on', desc: 'save_on_desc', category: 'admin', quick: true, template: 'save-on' },
    { name: 'setidletimeout', syntax: '/setidletimeout <minutes>', desc: 'setidletimeout_desc', category: 'admin', quick: true, template: 'setidletimeout 10' },
    { name: 'stop', syntax: '/stop', desc: 'stop_desc', category: 'admin', quick: true, template: 'stop' },
    { name: 'whitelist', syntax: '/whitelist (on|off|list|add|remove|reload)', desc: 'whitelist_desc', category: 'admin', quick: true, template: 'whitelist list' },
    { name: 'execute', syntax: '/execute (run|if|unless|as|at|store|positioned|rotated|facing|align|anchored|in|summon|on)', desc: 'execute_desc', category: 'advanced', quick: false },
    { name: 'bossbar', syntax: '/bossbar (add|remove|list|set|get)', desc: 'bossbar_desc', category: 'advanced', quick: false },
    { name: 'tick', syntax: '/tick (query|rate|step|sprint|unfreeze|freeze)', desc: 'tick_desc', category: 'advanced', quick: true, template: 'tick query' },
    { name: 'tp', syntax: '/tp (<location>|<destination>|<targets>)', desc: 'tp_desc', category: 'player', quick: true, template: 'tp @s ~ ~ ~' },
    { name: 'xp', syntax: '/xp (add|set|query) <targets> <amount>', desc: 'xp_desc', category: 'player', quick: true, template: 'xp add @s 100 points' },
    { name: 'tell', syntax: '/tell <targets> <message>', desc: 'tell_desc', category: 'player', quick: true, template: 'tell ' },
    { name: 'w', syntax: '/w <targets> <message>', desc: 'w_desc', category: 'player', quick: true, template: 'w ' },
    { name: 'me', syntax: '/me <action>', desc: 'me_desc', category: 'player', quick: true, template: 'me ' },
    { name: 'perf', syntax: '/perf (start|stop)', desc: 'perf_desc', category: 'advanced', quick: true, template: 'perf start' },
    { name: 'jfr', syntax: '/jfr (start|stop)', desc: 'jfr_desc', category: 'advanced', quick: true, template: 'jfr start' },
    { name: 'publish', syntax: '/publish [<port>]', desc: 'publish_desc', category: 'server', quick: true, template: 'publish' },
    { name: 'return', syntax: '/return <value>', desc: 'return_desc', category: 'advanced', quick: false },
];

export default {
    components: { SetupWizard },
    template: `
    <div class="h-100 d-flex flex-column overflow-hidden">
        <!-- Setup Wizard -->
        <SetupWizard v-if="!store.isSetup" @setup-complete="onSetupComplete" />

        <!-- Normal Dashboard -->
        <div v-else class="h-100 d-flex flex-column animate-in delay-100">
            <div class="page-header d-flex justify-content-between align-items-center flex-shrink-0">
                <h3 class="fw-bold m-0 tracking-tight">{{ $t('dashboard.console_title') }}</h3>
                <div class="d-flex gap-2">
                    <button @click="openStartupSettings" class="btn btn-outline-secondary px-2 px-md-3" :title="$t('instance_manager.settings_btn')">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                    <button v-if="store.serverStatus === 'stopped' || (!store.serverStatus && !store.isRunning)" @click="serverAction('start')" class="btn btn-success px-3 px-md-4 fw-bold">
                        <i class="fa-solid fa-play me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.start') }}</span>
                    </button>
                    <template v-else-if="store.serverStatus === 'starting'">
                        <button disabled class="btn btn-warning px-3 px-md-4 fw-bold text-dark">
                            <i class="fa-solid fa-spinner fa-spin me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.state_starting') }}</span>
                        </button>
                        <button @click="forceStop" class="btn btn-outline-danger px-2 px-md-3" :title="$t('dashboard.force_stop')">
                            <i class="fa-solid fa-skull-crossbones"></i>
                        </button>
                    </template>
                    <template v-else-if="store.serverStatus === 'stopping'">
                        <button disabled class="btn btn-warning px-3 px-md-4 fw-bold text-dark">
                            <i class="fa-solid fa-spinner fa-spin me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.state_stopping') }}</span>
                        </button>
                        <button @click="forceStop" class="btn btn-outline-danger px-2 px-md-3" :title="$t('dashboard.force_stop')">
                            <i class="fa-solid fa-skull-crossbones"></i>
                        </button>
                    </template>
                    <template v-else>
                        <button @click="serverAction('stop')" class="btn btn-danger px-3 px-md-4 fw-bold">
                            <i class="fa-solid fa-stop me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.stop') }}</span>
                        </button>
                        <button @click="forceStop" class="btn btn-outline-danger px-2 px-md-3" :title="$t('dashboard.force_stop')">
                            <i class="fa-solid fa-skull-crossbones"></i>
                        </button>
                    </template>
                </div>
            </div>

            <div v-if="store.consoleInfoPosition === 'top'"
                 ref="statsSectionRef"
                 class="console-stats-section mb-2 mb-md-3 flex-shrink-0 w-100"
                 :class="{ 'mobile-is-collapsed': mobileCollapsed }">

                <!-- 1. Mobile-only Mini Collapsed Bar -->
                <div ref="miniBarRef"
                     class="mobile-mini-bar cursor-pointer d-md-none"
                     :class="{ 'bar-active': mobileCollapsed, 'bar-inactive': !mobileCollapsed }"
                     @click="expandMobileStats">
                    <div class="d-flex align-items-center gap-2 text-truncate min-w-0 w-100">
                        <span class="badge rounded-pill font-monospace" :class="dashboardStatusClass" style="font-size: 0.68rem; padding: 0.25rem 0.55rem;">{{ dashboardStatusText }}</span>
                        <div class="vr mx-0.5 opacity-25"></div>
                        <span class="text-body font-monospace text-truncate"><i class="fa-solid fa-users text-success me-1"></i>{{ store.stats?.mc?.online || 0 }}/{{ store.stats?.mc?.maxPlayers || 0 }}</span>
                        <div class="vr mx-0.5 opacity-25"></div>
                        <span class="text-body font-monospace"><i class="fa-solid fa-microchip text-primary me-1"></i>{{ store.stats.cpu || 0 }}%</span>
                        <div class="vr mx-0.5 opacity-25"></div>
                        <span class="text-body font-monospace"><i class="fa-solid fa-memory text-info me-1"></i>{{ store.stats.mem?.percentage || 0 }}%</span>
                    </div>
                </div>

                <!-- 2. Main Stats Content (Desktop full grid, Mobile expanded view) -->
                <div ref="expandedContentRef"
                     class="stats-expanded-content"
                     :class="{ 'mobile-content-active': !mobileCollapsed, 'mobile-content-inactive': mobileCollapsed }"
                     @touchstart="handleStatsTouchStart"
                     @touchend="handleStatsTouchEnd">
                    <!-- System Stats Overview -->
                    <div ref="dashboardGridRef"
                         @scroll="onGridScroll"
                         class="dashboard-grid mb-0 mb-md-3 flex-shrink-0 w-100" 
                         style="min-width: 0;">
                        <div class="stagger-item w-100" style="min-width: 0;">
                            <div class="stat-card h-100 w-100 d-flex flex-column" style="min-width: 0;">
                                <div class="stat-card-header flex-shrink-0">
                                    <div class="d-flex justify-content-between align-items-center" style="min-height: 24px;">
                                        <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1 text-truncate pe-2" style="font-size: 0.6875rem;" :title="activeInstanceName || $t('dashboard.server_info')">
                                            <i class="fa-solid fa-server me-2"></i>{{ activeInstanceName || $t('dashboard.server_info') }}
                                        </h6>
                                        <span class="badge rounded-pill font-monospace flex-shrink-0" :class="dashboardStatusClass">{{ dashboardStatusText }}</span>
                                    </div>
                                </div>
                                <div class="stat-card-body d-flex flex-column justify-content-between flex-grow-1" style="min-width: 0;">
                                    <!-- 1. Player Status & MOTD Hero Section -->
                                    <div class="mb-2 mb-md-2.5">
                                        <div class="d-flex align-items-center justify-content-between mb-1.5">
                                            <div class="d-flex align-items-center gap-1.5 gap-md-2 min-w-0">
                                                <div class="resource-icon-badge text-success flex-shrink-0" style="background: rgba(25, 135, 84, 0.12);">
                                                    <i class="fa-solid fa-users"></i>
                                                </div>
                                                <div class="min-w-0">
                                                    <div class="fw-bold text-body text-truncate" style="font-size: 0.85rem; line-height: 1.2;">{{ $t('dashboard.online_players') }}</div>
                                                    <div class="text-muted text-truncate font-monospace" style="font-size: 0.7rem; line-height: 1.2;">
                                                        <span v-if="store.stats?.mc?.online > 0" class="text-success fw-medium">{{ store.stats.mc.onlinePlayerList?.slice(0, 3).join(', ') }}{{ (store.stats.mc.onlinePlayerList?.length > 3 ? '...' : '') }}</span>
                                                        <span v-else-if="store.serverStatus === 'running' || store.isRunning" class="text-muted opacity-75">{{ $t('dashboard.no_players') }}</span>
                                                        <span v-else class="text-muted opacity-75">{{ store.lang === 'zh' ? '离线' : 'Offline' }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="text-end ps-1 flex-shrink-0">
                                                <div class="font-monospace fw-bold resource-percent-val" :class="(store.stats?.mc?.online > 0) ? 'text-success' : 'text-body'">
                                                    {{ store.stats?.mc ? store.stats.mc.online : '-' }}<span class="small fw-normal text-muted" style="font-size: 0.75rem; margin-left: 2px;">/ {{ store.stats?.mc ? store.stats.mc.maxPlayers : '-' }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="progress my-1.5" style="height: 5px; border-radius: 999px; background: rgba(128, 128, 128, 0.15);margin: 5px 0;">
                                            <div class="progress-bar" :class="(store.serverStatus === 'running' || store.isRunning) ? 'bg-success' : 'bg-secondary'" :style="{width: (store.stats?.mc?.maxPlayers > 0 ? ((store.stats.mc.online / store.stats.mc.maxPlayers) * 100) : 0) + '%'}"></div>
                                        </div>

                                        <div class="d-flex align-items-center justify-content-between text-muted font-monospace px-2.5 py-1 rounded-2 mt-1.5" style="font-size: 0.72rem; min-height: 26px; background: rgba(128, 128, 128, 0.08);padding: 0 10px">
                                            <div class="d-flex align-items-center text-truncate min-w-0 me-2">
                                                <i class="fa-solid fa-quote-left me-1.5 opacity-50 flex-shrink-0" style="font-size: 0.65rem;"></i>
                                                <span class="text-truncate" :title="displayMotd">{{ displayMotd }}</span>
                                            </div>
                                            <span class="flex-shrink-0 opacity-75 d-none d-md-inline" style="font-size: 0.6875rem;">{{ store.stats?.mc?.maxPlayers > 0 ? Math.round((store.stats.mc.online / store.stats.mc.maxPlayers) * 100) : 0 }}%</span>
                                        </div>
                                    </div>

                                    <!-- 2. Server Metadata 2x2 Grid -->
                                    <div class="row g-2 g-md-2.5 flex-grow-1">
                                        <!-- Game Version -->
                                        <div class="col-6 d-flex flex-column">
                                            <div class="resource-meta-tile p-2 p-md-2.5 rounded-3 border bg-body-tertiary d-flex align-items-center gap-2 gap-md-2.5 h-100 flex-grow-1">
                                                <div class="resource-icon-badge text-success flex-shrink-0" style="background: rgba(25, 135, 84, 0.12);">
                                                    <i class="fa-solid fa-cube"></i>
                                                </div>
                                                <div class="min-w-0 flex-grow-1">
                                                    <div class="text-muted text-truncate" style="font-size: 0.6875rem; line-height: 1.2;">{{ $t('dashboard.target') }}</div>
                                                    <div class="fw-bold font-monospace text-body text-truncate" style="font-size: 0.82rem; line-height: 1.3;" :title="store.stats.version?.mc || 'Unknown'">
                                                        {{ store.stats.version?.mc || 'Unknown' }}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Loader / Core -->
                                        <div class="col-6 d-flex flex-column">
                                            <div class="resource-meta-tile p-2 p-md-2.5 rounded-3 border bg-body-tertiary d-flex align-items-center gap-2 gap-md-2.5 h-100 flex-grow-1">
                                                <div class="resource-icon-badge flex-shrink-0" style="color: #a855f7; background: rgba(168, 85, 247, 0.12);">
                                                    <i class="fa-solid fa-layer-group"></i>
                                                </div>
                                                <div class="min-w-0 flex-grow-1">
                                                    <div class="text-muted text-truncate" style="font-size: 0.6875rem; line-height: 1.2;">{{ $t('dashboard.loader') }}</div>
                                                    <div class="fw-bold font-monospace text-body text-truncate" style="font-size: 0.82rem; line-height: 1.3;" :title="formattedLoader">
                                                        {{ formattedLoader }}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Java Environment -->
                                        <div class="col-6 d-flex flex-column">
                                            <div class="resource-meta-tile p-2 p-md-2.5 rounded-3 border bg-body-tertiary d-flex align-items-center gap-2 gap-md-2.5 h-100 flex-grow-1">
                                                <div class="resource-icon-badge text-warning flex-shrink-0" style="background: rgba(255, 170, 0, 0.12);">
                                                    <i class="fa-solid fa-mug-hot"></i>
                                                </div>
                                                <div class="min-w-0 flex-grow-1">
                                                    <div class="text-muted text-truncate" style="font-size: 0.6875rem; line-height: 1.2;">{{ $t('dashboard.java_version') }}</div>
                                                    <div class="fw-bold font-monospace text-body text-truncate" style="font-size: 0.82rem; line-height: 1.3;" :title="store.stats.javaVersion || 'Checking...'">
                                                        {{ store.stats.javaVersion || 'Checking...' }}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Server Port -->
                                        <div class="col-6 d-flex flex-column">
                                            <div class="resource-meta-tile p-2 p-md-2.5 rounded-3 border bg-body-tertiary d-flex align-items-center gap-2 gap-md-2.5 h-100 flex-grow-1">
                                                <div class="resource-icon-badge text-info flex-shrink-0" style="background: rgba(13, 202, 240, 0.12);">
                                                    <i class="fa-solid fa-network-wired"></i>
                                                </div>
                                                <div class="min-w-0 flex-grow-1">
                                                    <div class="text-muted text-truncate" style="font-size: 0.6875rem; line-height: 1.2;">{{ $t('dashboard.port') }}</div>
                                                    <div class="fw-bold font-monospace text-body text-truncate" style="font-size: 0.82rem; line-height: 1.3;" :title="store.stats?.mc?.port ? (':' + store.stats.mc.port) : ':25565'">
                                                        :{{ (store.stats?.mc?.port && store.stats.mc.port !== '-') ? store.stats.mc.port : '25565' }}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Mobile Inner Carousel Dots -->
                                    <div class="d-flex d-md-none justify-content-center align-items-center pt-2 pb-0.5 flex-shrink-0" style="gap: 6px;" @click.stop>
                                        <span class="rounded-pill" 
                                              @click.stop="setMobileCard(0)"
                                              style="cursor: pointer;"
                                              :style="{ width: activeMobileCard === 0 ? '16px' : '6px', height: '4px', background: activeMobileCard === 0 ? 'var(--c-primary)' : 'rgba(128, 128, 128, 0.35)', transition: 'all 0.25s ease' }"></span>
                                        <span class="rounded-pill" 
                                              @click.stop="setMobileCard(1)"
                                              style="cursor: pointer;"
                                              :style="{ width: activeMobileCard === 1 ? '16px' : '6px', height: '4px', background: activeMobileCard === 1 ? 'var(--c-primary)' : 'rgba(128, 128, 128, 0.35)', transition: 'all 0.25s ease' }"></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="stagger-item w-100" style="animation-delay: 0.1s; min-width: 0;">
                             <div class="stat-card h-100 w-100 d-flex flex-column" style="min-width: 0;">
                                <div class="stat-card-header flex-shrink-0">
                                    <div class="d-flex justify-content-between align-items-center" style="min-height: 24px;">
                                        <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1" style="font-size: 0.6875rem;">
                                            <i class="fa-solid fa-microchip me-2"></i>{{ $t('dashboard.system_resource') }}
                                        </h6>
                                        <span class="badge rounded-pill bg-body-tertiary text-muted border font-monospace d-inline-block" style="font-size: 0.65rem; padding: 0.2rem 0.5rem;">
                                            HOST
                                        </span>
                                    </div>
                                </div>
                                <div class="stat-card-body d-flex flex-column justify-content-between flex-grow-1" style="min-width: 0;">
                                    <div class="row g-2 g-md-3 flex-grow-1">
                                        <!-- 1. CPU -->
                                        <div class="col-6 d-flex flex-column">
                                            <div class="resource-widget p-2 p-md-3 rounded-3 border h-100 flex-grow-1 d-flex flex-column justify-content-between">
                                                <div class="d-flex align-items-center justify-content-between mb-1">
                                                    <div class="d-flex align-items-center gap-1.5 gap-md-2 min-w-0">
                                                        <div class="resource-icon-badge text-primary" style="background: rgba(var(--c-primary-rgb), 0.12);">
                                                            <i class="fa-solid fa-microchip"></i>
                                                        </div>
                                                        <div class="min-w-0">
                                                            <div class="fw-bold text-body text-truncate" style="font-size: 0.85rem; line-height: 1.2;">CPU</div>
                                                            <div class="text-muted text-truncate d-none d-md-block" style="font-size: 0.7rem; line-height: 1.2;">{{ $t('dashboard.cpu_usage') }}</div>
                                                        </div>
                                                    </div>
                                                    <div class="text-end ps-1 flex-shrink-0">
                                                        <div class="font-monospace fw-bold resource-percent-val" :class="Number(store.stats.cpu) > 80 ? 'text-danger' : 'text-body'">
                                                            {{ store.stats.cpu || 0 }}<span class="small fw-normal opacity-75" style="font-size: 0.75rem; margin-left: 1px;">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="progress my-1" style="height: 5px; border-radius: 999px; background: rgba(128, 128, 128, 0.15);">
                                                    <div class="progress-bar" :class="Number(store.stats.cpu) > 80 ? 'bg-danger' : 'bg-primary'" :style="{width: (store.stats.cpu || 0) + '%'}"></div>
                                                </div>
                                                <div class="d-flex justify-content-between align-items-center text-muted font-monospace" style="font-size: 0.7rem;">
                                                    <span class="text-truncate">{{ $t('dashboard.status') }}</span>
                                                    <span :class="Number(store.stats.cpu) > 80 ? 'text-danger fw-bold' : 'text-body-secondary'">{{ Number(store.stats.cpu) > 80 ? $t('dashboard.status_high') : $t('dashboard.status_normal') }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- 2. RAM -->
                                        <div class="col-6 d-flex flex-column">
                                            <div class="resource-widget p-2 p-md-3 rounded-3 border h-100 flex-grow-1 d-flex flex-column justify-content-between">
                                                <div class="d-flex align-items-center justify-content-between mb-1">
                                                    <div class="d-flex align-items-center gap-1.5 gap-md-2 min-w-0">
                                                        <div class="resource-icon-badge text-warning" style="background: rgba(255, 170, 0, 0.12);">
                                                            <i class="fa-solid fa-memory"></i>
                                                        </div>
                                                        <div class="min-w-0">
                                                            <div class="fw-bold text-body text-truncate" style="font-size: 0.85rem; line-height: 1.2;">RAM</div>
                                                            <div class="text-muted text-truncate d-none d-md-block" style="font-size: 0.7rem; line-height: 1.2;">{{ $t('dashboard.ram_usage') }}</div>
                                                        </div>
                                                    </div>
                                                    <div class="text-end ps-1 flex-shrink-0">
                                                        <div class="font-monospace fw-bold resource-percent-val" :class="Number(store.stats.mem?.percentage) > 85 ? 'text-danger' : 'text-body'">
                                                            {{ store.stats.mem?.percentage || 0 }}<span class="small fw-normal opacity-75" style="font-size: 0.75rem; margin-left: 1px;">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="progress my-1" style="height: 5px; border-radius: 999px; background: rgba(128, 128, 128, 0.15);">
                                                    <div class="progress-bar" :class="Number(store.stats.mem?.percentage) > 85 ? 'bg-danger' : 'bg-warning'" :style="{width: (store.stats.mem?.percentage || 0) + '%'}"></div>
                                                </div>
                                                <div class="d-flex justify-content-between align-items-center text-muted font-monospace" style="font-size: 0.7rem;">
                                                    <span class="text-truncate">{{ store.stats.mem?.used || 0 }}<span class="d-none d-md-inline"> </span>G<span class="d-none d-md-inline">B</span></span>
                                                    <span class="opacity-75">/ {{ store.stats.mem?.total || 0 }}<span class="d-none d-md-inline"> </span>G<span class="d-none d-md-inline">B</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- 3. SWAP -->
                                        <div class="col-6 d-flex flex-column">
                                            <div class="resource-widget p-2 p-md-3 rounded-3 border h-100 flex-grow-1 d-flex flex-column justify-content-between">
                                                <div class="d-flex align-items-center justify-content-between mb-1">
                                                    <div class="d-flex align-items-center gap-1.5 gap-md-2 min-w-0">
                                                        <div class="resource-icon-badge text-info" style="background: rgba(13, 202, 240, 0.12);">
                                                            <i class="fa-solid fa-arrows-rotate"></i>
                                                        </div>
                                                        <div class="min-w-0">
                                                            <div class="fw-bold text-body text-truncate" style="font-size: 0.85rem; line-height: 1.2;">SWAP</div>
                                                            <div class="text-muted text-truncate d-none d-md-block" style="font-size: 0.7rem; line-height: 1.2;">{{ $t('dashboard.swap_usage') }}</div>
                                                        </div>
                                                    </div>
                                                    <div class="text-end ps-1 flex-shrink-0">
                                                        <div class="font-monospace fw-bold resource-percent-val" :class="{'text-danger': Number(store.stats.swap?.percentage) > 80, 'text-muted fw-normal': Number(store.stats.swap?.total || 0) === 0}">
                                                            <template v-if="Number(store.stats.swap?.total || 0) > 0">{{ store.stats.swap?.percentage || 0 }}<span class="small fw-normal opacity-75" style="font-size: 0.75rem; margin-left: 1px;">%</span></template>
                                                            <template v-else>-</template>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="progress my-1" style="height: 5px; border-radius: 999px; background: rgba(128, 128, 128, 0.15);">
                                                    <div class="progress-bar bg-info" :class="{'bg-danger': Number(store.stats.swap?.percentage) > 80}" :style="{width: (Number(store.stats.swap?.total || 0) > 0 ? (store.stats.swap?.percentage || 0) : 0) + '%'}"></div>
                                                </div>
                                                <div class="d-flex justify-content-between align-items-center text-muted font-monospace" style="font-size: 0.7rem;">
                                                    <template v-if="Number(store.stats.swap?.total || 0) > 0">
                                                        <span class="text-truncate">{{ store.stats.swap?.used || 0 }}<span class="d-none d-md-inline"> </span>G<span class="d-none d-md-inline">B</span></span>
                                                        <span class="opacity-75">/ {{ store.stats.swap?.total || 0 }}<span class="d-none d-md-inline"> </span>G<span class="d-none d-md-inline">B</span></span>
                                                    </template>
                                                    <template v-else>
                                                        <span class="text-truncate opacity-75">{{ $t('dashboard.swap_unconfigured') }}</span>
                                                        <span class="opacity-50">OFF</span>
                                                    </template>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- 4. DISK -->
                                        <div class="col-6 d-flex flex-column">
                                            <div class="resource-widget p-2 p-md-3 rounded-3 border h-100 flex-grow-1 d-flex flex-column justify-content-between">
                                                <div class="d-flex align-items-center justify-content-between mb-1">
                                                    <div class="d-flex align-items-center gap-1.5 gap-md-2 min-w-0">
                                                        <div class="resource-icon-badge text-success" style="background: rgba(25, 135, 84, 0.12);">
                                                            <i class="fa-solid fa-hard-drive"></i>
                                                        </div>
                                                        <div class="min-w-0">
                                                            <div class="fw-bold text-body text-truncate" style="font-size: 0.85rem; line-height: 1.2;">DISK</div>
                                                            <div class="text-muted text-truncate d-none d-md-block" style="font-size: 0.7rem; line-height: 1.2;">{{ $t('dashboard.disk_usage') }}</div>
                                                        </div>
                                                    </div>
                                                    <div class="text-end ps-1 flex-shrink-0">
                                                        <div class="font-monospace fw-bold resource-percent-val" :class="Number(store.stats.disk?.percentage) > 90 ? 'text-danger' : 'text-body'">
                                                            {{ store.stats.disk?.percentage || 0 }}<span class="small fw-normal opacity-75" style="font-size: 0.75rem; margin-left: 1px;">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="progress my-1" style="height: 5px; border-radius: 999px; background: rgba(128, 128, 128, 0.15);">
                                                    <div class="progress-bar" :class="Number(store.stats.disk?.percentage) > 90 ? 'bg-danger' : 'bg-success'" :style="{width: (store.stats.disk?.percentage || 0) + '%'}"></div>
                                                </div>
                                                <div class="d-flex justify-content-between align-items-center text-muted font-monospace" style="font-size: 0.7rem;">
                                                    <span class="text-truncate">{{ store.stats.disk?.used || 0 }}<span class="d-none d-md-inline"> </span>G<span class="d-none d-md-inline">B</span></span>
                                                    <span class="opacity-75">/ {{ store.stats.disk?.total || 0 }}<span class="d-none d-md-inline"> </span>G<span class="d-none d-md-inline">B</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Mobile Inner Carousel Dots -->
                                    <div class="d-flex d-md-none justify-content-center align-items-center pt-2 pb-0.5 flex-shrink-0" style="gap: 6px;" @click.stop>
                                        <span class="rounded-pill" 
                                              @click.stop="setMobileCard(0)"
                                              style="cursor: pointer;"
                                              :style="{ width: activeMobileCard === 0 ? '16px' : '6px', height: '4px', background: activeMobileCard === 0 ? 'var(--c-primary)' : 'rgba(128, 128, 128, 0.35)', transition: 'all 0.25s ease' }"></span>
                                        <span class="rounded-pill" 
                                              @click.stop="setMobileCard(1)"
                                              style="cursor: pointer;"
                                              :style="{ width: activeMobileCard === 1 ? '16px' : '6px', height: '4px', background: activeMobileCard === 1 ? 'var(--c-primary)' : 'rgba(128, 128, 128, 0.35)', transition: 'all 0.25s ease' }"></span>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>

                    <!-- Mobile Bottom Handle (Visible only on mobile: d-md-none, outside cards) -->
                    <div class="mobile-stats-bottom-bar d-flex d-md-none align-items-center justify-content-center py-2 flex-shrink-0 cursor-pointer user-select-none"
                         @click.stop="collapseMobileStats"
                         @touchstart="handleHandleTouchStart"
                         @touchend="handleHandleTouchEnd"
                         :title="$t('dashboard.collapse_info') || '向上滑动或点击收起'">
                        <!-- Swipe Up Handle Pill -->
                        <div class="mobile-swipe-pill">
                            <span class="swipe-pill-bar"></span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="console-output flex-grow-1 mb-2 mb-md-3 position-relative" id="consoleBox">
                <div v-for="(log,i) in store.logs" :key="i" v-html="formatLog(log)"></div>
            </div>
            
            <div class="flex-shrink-0 position-relative" ref="cmdBarRef">
                <div class="input-group cmd-input-group">
                    <input ref="cmdInputRef" type="text" class="form-control" v-model="command" @keyup.enter="sendCommand" :placeholder="$t('dashboard.send_cmd_placeholder')">
                    <button class="btn" :class="showCmdPanel ? 'btn-primary text-white' : 'btn-outline-secondary'" @click="toggleCmdPanel" :title="$t('dashboard.cmd_helper')">
                        <i class="fa-solid fa-terminal"></i>
                    </button>
                    <button class="btn btn-primary fw-bold" @click="sendCommand">{{ $t('dashboard.send') }}</button>
                </div>

                <!-- PC Floating Popover Palette (Desktop >= 768px) -->
                <Transition name="cmd-palette">
                    <div v-if="showCmdPanel && !isMobile" class="cmd-pc-palette">
                        <!-- Header with Category Badges, Search Bar, and Close Button -->
                        <div class="cmd-pc-header d-flex align-items-center gap-2 px-3 py-2 border-bottom">
                            <div class="d-flex align-items-center gap-1.5 flex-nowrap">
                                <span class="badge rounded-pill cursor-pointer px-2.5 py-1.5 transition-fast"
                                      :class="cmdCategory === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-body-secondary text-secondary'"
                                      @click="cmdCategory = 'all'">
                                    {{ $t('dashboard.cmd_all') }}
                                </span>
                                <span v-for="cat in cmdCategories" :key="cat.key"
                                      class="badge rounded-pill cursor-pointer px-2.5 py-1.5 transition-fast"
                                      :class="cmdCategory === cat.key ? 'bg-' + cat.color + ' text-white shadow-sm' : 'bg-body-secondary text-' + cat.color"
                                      @click="cmdCategory = cat.key">
                                    <i :class="cat.icon" class="me-1"></i>{{ $t('dashboard.cmd_cat_' + cat.key) }}
                                </span>
                            </div>

                            <div class="input-group input-group-sm ms-auto" style="max-width: 220px;">
                                <span class="input-group-text bg-body-tertiary border-end-0 text-muted"><i class="fa-solid fa-search" style="font-size:0.75rem"></i></span>
                                <input type="text" class="form-control border-start-0 border-end-0 ps-0" :placeholder="$t('dashboard.cmd_search')" v-model="cmdSearch" style="font-size:0.8rem">
                                <button v-if="cmdSearch" class="btn btn-sm btn-outline-secondary border-start-0" type="button" @click="cmdSearch = ''">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            <button class="btn btn-sm btn-ghost text-muted p-1 ms-1" @click="showCmdPanel = false" title="关闭 (ESC)">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <!-- Command List -->
                        <div class="cmd-pc-list px-2 py-1.5">
                            <div v-for="cmd in filteredCommands" :key="cmd.name"
                                 class="cmd-pc-item d-flex align-items-center justify-content-between gap-3 py-2 px-2.5 rounded-2 cursor-pointer"
                                 @click="useCommand(cmd)">
                                <div class="d-flex align-items-center gap-2 min-w-0 flex-grow-1">
                                    <code class="text-primary fw-bold font-monospace flex-shrink-0" style="font-size: 0.8125rem;">/{{ cmd.name }}</code>
                                    <span class="text-body fw-medium text-truncate small flex-shrink-0" style="font-size: 0.775rem;">{{ getCmdTitle(cmd) }}</span>
                                    <span v-if="cmd._matchBadge" class="badge bg-warning-subtle text-warning border border-warning-subtle py-0 px-1 font-monospace flex-shrink-0" style="font-size: 0.65rem;">
                                        {{ cmd._matchBadge }}
                                    </span>
                                    <span class="text-muted text-truncate small opacity-75 d-none d-lg-inline" style="font-size: 0.725rem;">{{ $t('dashboard.cmd_' + cmd.desc) }}</span>
                                </div>
                                <div class="d-flex align-items-center gap-1.5 flex-shrink-0">
                                    <span v-if="hasSchema(cmd.name)" class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace" style="font-size: 0.65rem;">
                                        <i class="fa-solid fa-sliders me-1"></i>配置
                                    </span>
                                    <span v-else class="badge bg-body-secondary text-muted font-monospace" style="font-size: 0.65rem;">
                                        <i class="fa-solid fa-arrow-turn-down me-1"></i>填入
                                    </span>
                                    <button v-if="cmd.quick" class="btn btn-sm btn-ghost text-warning p-0.5 ms-1"
                                            :title="$t('dashboard.cmd_quick')"
                                            @click.stop="sendQuickCommand(cmd.template)">
                                        <i class="fa-solid fa-bolt" style="font-size:0.8rem"></i>
                                    </button>
                                </div>
                            </div>

                            <div v-if="filteredCommands.length === 0" class="text-center text-muted py-4 small">
                                <i class="fa-solid fa-inbox d-block mb-1 fs-5 opacity-50"></i>
                                {{ $t('dashboard.cmd_no_result') }}
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>

            <!-- Mobile Bottom Sheet (Teleported to body, Mobile <= 768px) -->
            <Teleport to="body">
                <!-- Backdrop -->
                <Transition name="cmd-fade">
                    <div v-if="isMobile && showCmdPanel" class="cmd-mobile-backdrop" @click="showCmdPanel = false"></div>
                </Transition>

                <!-- Bottom Sheet -->
                <Transition name="cmd-sheet">
                    <div v-if="isMobile && showCmdPanel" class="cmd-mobile-sheet">
                        <!-- Drag Handle Area -->
                        <div class="cmd-sheet-handle-area" 
                             @touchstart="handleSheetTouchStart" 
                             @touchend="handleSheetTouchEnd" 
                             @click="showCmdPanel = false">
                            <div class="cmd-sheet-handle"></div>
                        </div>

                        <!-- Sheet Header -->
                        <div class="cmd-sheet-header px-3 pb-2 pt-1 d-flex align-items-center justify-content-between"
                             @touchstart="handleSheetTouchStart" 
                             @touchend="handleSheetTouchEnd">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="cmd-sheet-icon">
                                        <i class="fa-solid fa-terminal text-primary"></i>
                                    </div>
                                    <div>
                                        <h6 class="m-0 fw-bold d-flex align-items-center gap-2">
                                            {{ $t('dashboard.cmd_helper') }}
                                            <span class="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle font-monospace" style="font-size: 0.65rem;">
                                                {{ filteredCommands.length }}
                                            </span>
                                        </h6>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-sm btn-ghost text-muted rounded-circle p-1.5" @click="showCmdPanel = false">
                                    <i class="fa-solid fa-xmark fs-6"></i>
                                </button>
                            </div>

                            <!-- Search Input in Sheet -->
                            <div class="px-3 pb-2">
                                <div class="input-group input-group-sm cmd-mobile-search">
                                    <span class="input-group-text bg-body-tertiary border-end-0 text-muted"><i class="fa-solid fa-search"></i></span>
                                    <input type="text" class="form-control border-start-0 border-end-0 ps-0"
                                           :placeholder="$t('dashboard.cmd_search')"
                                           v-model="cmdSearch">
                                    <button v-if="cmdSearch" class="btn btn-sm btn-outline-secondary border-start-0" type="button" @click="cmdSearch = ''">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Category Chips (Single-line horizontal swipe, NO WRAPPING!) -->
                            <div class="cmd-mobile-cats px-3 pb-2.5 d-flex flex-nowrap overflow-x-auto no-scrollbar gap-1.5">
                                <button type="button" class="btn btn-sm rounded-pill flex-shrink-0 text-nowrap font-monospace d-inline-flex align-items-center"
                                        :class="cmdCategory === 'all' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'"
                                        style="font-size: 0.72rem; padding: 0.2rem 0.65rem; min-height: 26px;"
                                        @click="cmdCategory = 'all'">
                                    {{ $t('dashboard.cmd_all') }}
                                </button>
                                <button v-for="cat in cmdCategories" :key="cat.key"
                                        type="button" class="btn btn-sm rounded-pill flex-shrink-0 text-nowrap font-monospace d-inline-flex align-items-center"
                                        :class="cmdCategory === cat.key ? 'btn-' + cat.color + ' text-white shadow-sm' : 'btn-outline-secondary'"
                                        style="font-size: 0.72rem; padding: 0.2rem 0.65rem; min-height: 26px;"
                                        @click="cmdCategory = cat.key">
                                    <i :class="cat.icon" class="me-1"></i>{{ $t('dashboard.cmd_cat_' + cat.key) }}
                                </button>
                            </div>

                            <!-- Mobile Command Cards List -->
                            <div class="cmd-mobile-list px-3 pb-4">
                                <div v-for="cmd in filteredCommands" :key="cmd.name"
                                     class="cmd-mobile-card p-2.5 mb-2 rounded-3 border bg-body-tertiary cursor-pointer"
                                     @click="useCommand(cmd)">
                                    <div class="d-flex align-items-center justify-content-between mb-1">
                                        <div class="d-flex align-items-center gap-1.5 flex-wrap min-w-0 flex-grow-1 me-2">
                                            <code class="text-primary fw-bold font-monospace" style="font-size: 0.85rem;">/{{ cmd.name }}</code>
                                            <span class="fw-bold small text-body" style="font-size: 0.8rem;">{{ getCmdTitle(cmd) }}</span>
                                            <span class="badge rounded-pill bg-body-secondary text-muted font-monospace" style="font-size: 0.65rem;">
                                                {{ $t('dashboard.cmd_cat_' + cmd.category) }}
                                            </span>
                                            <span v-if="cmd._matchBadge" class="badge bg-warning-subtle text-warning border border-warning-subtle py-0 px-1.5 font-monospace" style="font-size: 0.65rem;">
                                                {{ cmd._matchBadge }}
                                            </span>
                                        </div>
                                        <div class="d-flex align-items-center gap-1.5 flex-shrink-0">
                                            <button v-if="hasSchema(cmd.name)"
                                                    class="btn btn-sm btn-primary-subtle text-primary rounded-pill font-monospace text-nowrap d-inline-flex align-items-center justify-content-center"
                                                    style="font-size: 0.68rem; height: 24px; padding: 0 8px; line-height: 1;">
                                                <i class="fa-solid fa-sliders me-1"></i>配置
                                            </button>
                                            <button v-else
                                                    class="btn btn-sm btn-outline-secondary rounded-pill font-monospace text-nowrap d-inline-flex align-items-center justify-content-center"
                                                    style="font-size: 0.68rem; height: 24px; padding: 0 8px; line-height: 1;">
                                                <i class="fa-solid fa-arrow-turn-down me-1"></i>填入
                                            </button>
                                            <button v-if="cmd.quick"
                                                    class="btn btn-sm btn-outline-warning rounded-circle p-0 d-inline-flex align-items-center justify-content-center flex-shrink-0"
                                                    style="width: 24px; height: 24px; min-width: 24px; min-height: 24px; font-size: 0.7rem;"
                                                    :title="$t('dashboard.cmd_quick')"
                                                    @click.stop="sendQuickCommand(cmd.template)">
                                                <i class="fa-solid fa-bolt"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="small text-muted" style="font-size: 0.75rem; line-height: 1.35;">
                                        {{ $t('dashboard.cmd_' + cmd.desc) }}
                                    </div>

                                    <div v-if="cmd.syntax" class="mt-1 text-secondary opacity-75 font-monospace text-truncate" style="font-size: 0.68rem;">
                                        {{ cmd.syntax }}
                                    </div>
                                </div>

                                <div v-if="filteredCommands.length === 0" class="text-center text-muted py-5">
                                    <i class="fa-solid fa-magnifying-glass fs-3 mb-2 opacity-50"></i>
                                    <div>{{ $t('dashboard.cmd_no_result') }}</div>
                                </div>
                            </div>
                        </div>
                    </Transition>
            </Teleport>
        </div>

        <!-- Startup Settings Modal -->
        <div class="modal fade" id="startupModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fa-solid fa-gear me-2 text-primary"></i>{{ $t('instance_manager.settings_btn') }}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('properties.loader_type') }}</label>
                            <div class="d-flex align-items-center gap-2">
                                <span class="fw-bold small">{{ (form.loaderType || 'fabric') === 'neoforge' ? 'NeoForge' : (form.loaderType || 'fabric').charAt(0).toUpperCase() + (form.loaderType || 'fabric').slice(1) }}</span>
                                <span v-if="form.loaderType && form.loaderType !== 'fabric'" class="badge bg-info-subtle text-info small">{{ $t('instance_manager.run_sh_mode') }}</span>
                                <span v-else class="badge bg-success-subtle text-success small">{{ $t('instance_manager.jar_mode') }}</span>
                            </div>
                        </div>
                        <div v-if="!form.loaderType || form.loaderType === 'fabric'" class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.jar_name') }}</label>
                            <div class="d-flex gap-2 align-items-center">
                                <div style="flex:1;min-width:0">
                                    <CustomSelect v-model="form.jarName" :options="jars.length ? jars : (form.jarName ? [form.jarName] : [])" :placeholder="$t('panel_settings.jar_name')" />
                                </div>
                                <button class="btn btn-outline-secondary flex-shrink-0" @click="fetchJars"><i class="fa-solid fa-rotate"></i></button>
                            </div>
                        </div>
                        <div class="mb-0">
                            <label class="form-label small fw-bold text-muted">
                                {{ $t('instance_manager.java_args_label') }}
                            </label>
                            <div v-if="form.loaderType && form.loaderType !== 'fabric'" class="form-text small mb-1">
                                <i class="fa-solid fa-circle-info me-1"></i>{{ $t('instance_manager.user_jvm_args_tip') }}
                            </div>
                            <textarea class="form-control font-monospace small" rows="5" v-model="form.javaArgs" :placeholder="$t('instance_manager.java_args_placeholder')"></textarea>
                            <div v-if="store.stats && store.stats.mem && store.stats.mem.total > 0" class="form-text small mt-1 text-primary">
                                <i class="fa-solid fa-lightbulb me-1"></i>
                                {{ $t('instance_manager.java_args_recommend_tip', { total: store.stats.mem.total, recommend: Math.max(1, Math.floor(store.stats.mem.total * 0.75)) }) }}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary px-4" data-bs-dismiss="modal">{{ $t('common.cancel') }}</button>
                        <button class="btn btn-primary px-4" @click="saveStartupSettings" :disabled="saving">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                            {{ $t('common.confirm') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Command Helper Param Modal -->
        <div class="modal fade" id="cmdParamModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fa-solid fa-terminal me-2 text-primary"></i>
                            {{ store.lang === 'zh' ? (selectedSchema ? selectedSchema.titlecn : '') : (selectedSchema ? selectedSchema.titleen : '') }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body px-4 py-3" v-if="selectedSchema">
                        <div v-for="param in selectedSchema.params" :key="param.key" class="mb-3" v-show="!param.vif || param.vif(paramValues)">
                            <label class="form-label small fw-bold text-muted mb-1">
                                {{ store.lang === 'zh' ? param.labelcn : param.labelen }}
                                <span v-if="param.optional" class="text-muted fw-normal">({{ store.lang === 'zh' ? '可选' : 'Optional' }})</span>
                            </label>

                            <!-- select 类似玩家选择 -->
                            <div v-if="param.type === 'player_select'">
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control" v-model="paramValues[param.key]" placeholder="e.g. Steve / @a / @s">
                                    <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"></button>
                                    <ul class="dropdown-menu dropdown-menu-end" style="max-height: 200px; overflow-y: auto;">
                                        <li><a class="dropdown-item" href="#" @click.prevent="paramValues[param.key] = '@s'">@s ({{ store.lang === 'zh' ? '自己' : 'Myself' }})</a></li>
                                        <li><a class="dropdown-item" href="#" @click.prevent="paramValues[param.key] = '@a'">@a ({{ store.lang === 'zh' ? '所有人' : 'All Players' }})</a></li>
                                        <li><a class="dropdown-item" href="#" @click.prevent="paramValues[param.key] = '@p'">@p ({{ store.lang === 'zh' ? '最近的玩家' : 'Nearest Player' }})</a></li>
                                        <li><a class="dropdown-item" href="#" @click.prevent="paramValues[param.key] = '@r'">@r ({{ store.lang === 'zh' ? '随机玩家' : 'Random Player' }})</a></li>
                                        <li v-if="store.onlinePlayers.length" class="dropdown-divider"></li>
                                        <li v-for="player in store.onlinePlayers" :key="player">
                                            <a class="dropdown-item" href="#" @click.prevent="paramValues[param.key] = player">{{ player }}</a>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <!-- select 下拉选项 -->
                            <div v-else-if="param.type === 'select'">
                                <select class="form-select form-select-sm" v-model="paramValues[param.key]">
                                    <option v-for="opt in param.options" :key="opt.value" :value="opt.value">
                                        {{ store.lang === 'zh' ? opt.labelcn : opt.labelen }}
                                    </option>
                                </select>
                            </div>

                            <!-- select_input 可下拉可输入 -->
                            <div v-else-if="param.type === 'select_input'">
                                <div class="input-group input-group-sm">
                                    <input type="text" class="form-control" v-model="paramValues[param.key]" :placeholder="param.placeholder">
                                    <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"></button>
                                    <ul class="dropdown-menu dropdown-menu-end" style="max-height: 200px; overflow-y: auto;">
                                        <li v-for="opt in param.options" :key="opt.value">
                                            <a class="dropdown-item" href="#" @click.prevent="paramValues[param.key] = opt.value">
                                                {{ store.lang === 'zh' ? opt.labelcn : opt.labelen }}
                                            </a>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <!-- number 数值输入 -->
                            <div v-else-if="param.type === 'number'">
                                <input type="number" class="form-control form-control-sm" v-model.number="paramValues[param.key]" :placeholder="param.placeholder">
                            </div>

                            <!-- text 文本输入 -->
                            <div v-else>
                                <input type="text" class="form-control form-control-sm" v-model="paramValues[param.key]" :placeholder="param.placeholder">
                            </div>
                        </div>

                        <!-- 实时指令预览 -->
                        <div class="mt-3 p-3 rounded bg-body-tertiary border">
                            <div class="small fw-bold text-muted mb-1">{{ store.lang === 'zh' ? '实时指令预览' : 'Real-time Command Preview' }}</div>
                            <code class="text-primary font-monospace fs-6" style="word-break: break-all; display: block;">/{{ assembledCommand }}</code>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary px-3" data-bs-dismiss="modal">{{ $t('common.cancel') }}</button>
                        <button class="btn btn-outline-primary px-3" @click="insertCommand">{{ store.lang === 'zh' ? '填入控制台' : 'Insert into Input' }}</button>
                        <button class="btn btn-primary px-3" @click="executeConfiguredCommand">{{ store.lang === 'zh' ? '发送指令' : 'Send Command' }}</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const command = ref('');
        const activeMobileCard = ref(0);
        const mobileCollapsed = ref(localStorage.getItem('mc_mobile_dashboard_collapsed') === 'true');
        const dashboardGridRef = ref(null);
        const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
        const statsSectionRef = ref(null);
        const miniBarRef = ref(null);
        const expandedContentRef = ref(null);
        let collapseTransitionTimer = null;

        const updateMobile = () => {
            if (typeof window !== 'undefined') {
                isMobile.value = window.innerWidth <= 768;
            }
        };

        const setMobileCard = (index) => {
            activeMobileCard.value = index;
            if (dashboardGridRef.value) {
                const children = dashboardGridRef.value.children;
                if (children && children[index]) {
                    const childLeft = children[index].offsetLeft;
                    dashboardGridRef.value.scrollTo({ left: childLeft, behavior: 'smooth' });
                }
            }
        };

        const syncCardHeights = () => {
            if (typeof window === 'undefined' || !dashboardGridRef.value) return;
            const grid = dashboardGridRef.value;
            const cardWrappers = grid.querySelectorAll('.stagger-item');
            if (cardWrappers.length < 2) return;

            if (window.innerWidth > 768) {
                cardWrappers.forEach(w => {
                    w.style.height = '';
                    const card = w.querySelector('.stat-card');
                    if (card) {
                        card.style.height = '';
                        card.style.minHeight = '';
                    }
                });
                return;
            }

            const cards = [cardWrappers[0].querySelector('.stat-card'), cardWrappers[1].querySelector('.stat-card')];
            if (!cards[0] || !cards[1]) return;

            cards[0].style.height = '';
            cards[0].style.minHeight = '';
            cards[1].style.height = '';
            cards[1].style.minHeight = '';
            cardWrappers[0].style.height = '';
            cardWrappers[1].style.height = '';

            const h0 = cards[0].scrollHeight || cards[0].offsetHeight;
            const h1 = cards[1].scrollHeight || cards[1].offsetHeight;
            const targetHeight = Math.max(h0, h1);

            if (targetHeight > 0) {
                const targetPx = targetHeight + 'px';
                cards[0].style.minHeight = targetPx;
                cards[0].style.height = targetPx;
                cards[1].style.minHeight = targetPx;
                cards[1].style.height = targetPx;
                cardWrappers[0].style.height = targetPx;
                cardWrappers[1].style.height = targetPx;
            }
        };

        let syncHeightRaf = null;
        const requestSyncCardHeights = () => {
            if (syncHeightRaf) cancelAnimationFrame(syncHeightRaf);
            syncHeightRaf = requestAnimationFrame(() => {
                syncCardHeights();
                syncHeightRaf = null;
            });
        };

        const onGridScroll = (e) => {
            if (!e || !e.target) return;
            const target = e.target;
            const scrollLeft = target.scrollLeft;
            const totalScrollable = target.scrollWidth - target.clientWidth;
            if (totalScrollable > 0) {
                const newIndex = (scrollLeft / totalScrollable) > 0.4 ? 1 : 0;
                if (activeMobileCard.value !== newIndex) {
                    activeMobileCard.value = newIndex;
                }
            }
        };

        const toggleMobileCollapse = () => {
            const section = statsSectionRef.value;
            const miniBar = miniBarRef.value;
            const expanded = expandedContentRef.value;

            if (typeof window !== 'undefined' && window.innerWidth > 768) {
                return;
            }

            if (!section || !miniBar || !expanded) {
                mobileCollapsed.value = !mobileCollapsed.value;
                localStorage.setItem('mc_mobile_dashboard_collapsed', mobileCollapsed.value ? 'true' : 'false');
                return;
            }

            if (collapseTransitionTimer) {
                clearTimeout(collapseTransitionTimer);
                collapseTransitionTimer = null;
            }

            if (!mobileCollapsed.value) {
                // 当前展开 -> 执行平滑高度缩小为小卡片
                const startH = section.offsetHeight;
                const targetH = miniBar.offsetHeight || 42;

                section.style.height = startH + 'px';
                section.style.overflow = 'hidden';
                section.style.transition = 'height 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
                void section.offsetHeight;

                mobileCollapsed.value = true;
                localStorage.setItem('mc_mobile_dashboard_collapsed', 'true');

                requestAnimationFrame(() => {
                    section.style.height = targetH + 'px';
                });

                collapseTransitionTimer = setTimeout(() => {
                    if (section && mobileCollapsed.value) {
                        section.style.height = '';
                        section.style.overflow = '';
                        section.style.transition = '';
                    }
                    collapseTransitionTimer = null;
                }, 340);
            } else {
                // 当前收起 -> 执行平滑高度增大展开为大卡片
                const startH = section.offsetHeight;

                expanded.style.visibility = 'visible';
                expanded.style.position = 'absolute';
                expanded.style.width = '100%';
                
                syncCardHeights();
                const targetH = expanded.scrollHeight || 268;

                section.style.height = startH + 'px';
                section.style.overflow = 'hidden';
                section.style.transition = 'height 0.34s cubic-bezier(0.16, 1, 0.3, 1)';
                void section.offsetHeight;

                mobileCollapsed.value = false;
                localStorage.setItem('mc_mobile_dashboard_collapsed', 'false');

                requestAnimationFrame(() => {
                    section.style.height = targetH + 'px';
                });

                collapseTransitionTimer = setTimeout(() => {
                    if (section && !mobileCollapsed.value) {
                        section.style.height = '';
                        section.style.overflow = '';
                        section.style.transition = '';
                        if (expanded) {
                            expanded.style.position = '';
                            expanded.style.visibility = '';
                            expanded.style.width = '';
                        }
                        requestSyncCardHeights();
                    }
                    collapseTransitionTimer = null;
                }, 360);
            }
        };

        const collapseMobileStats = () => {
            if (!mobileCollapsed.value) {
                toggleMobileCollapse();
            }
        };

        const expandMobileStats = () => {
            if (mobileCollapsed.value) {
                toggleMobileCollapse();
            }
        };

        let statsTouchStartY = 0;
        let statsTouchStartX = 0;
        let statsTouchFromBottom = false;

        const handleStatsTouchStart = (e) => {
            if (mobileCollapsed.value || !e.touches || e.touches.length === 0) return;
            const touch = e.touches[0];
            statsTouchStartX = touch.clientX;
            statsTouchStartY = touch.clientY;

            // 判定触摸起始点是否位于卡片下半区域（底部 45% 或 Handle）
            const rect = expandedContentRef.value?.getBoundingClientRect();
            if (rect) {
                const relativeY = touch.clientY - rect.top;
                statsTouchFromBottom = relativeY >= (rect.height * 0.55);
            } else {
                statsTouchFromBottom = true;
            }
        };

        const handleStatsTouchEnd = (e) => {
            if (mobileCollapsed.value || !e.changedTouches || e.changedTouches.length === 0) return;
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - statsTouchStartX;
            const deltaY = touch.clientY - statsTouchStartY;

            // 当起始点在下半区域、向上滑动超过 25px、且垂直位移明显大于水平位移时触发收起
            if (statsTouchFromBottom && deltaY < -25 && Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
                collapseMobileStats();
            }
            statsTouchFromBottom = false;
        };

        const handleHandleTouchStart = (e) => {
            if (mobileCollapsed.value || !e.touches || e.touches.length === 0) return;
            const touch = e.touches[0];
            statsTouchStartX = touch.clientX;
            statsTouchStartY = touch.clientY;
            statsTouchFromBottom = true;
        };

        const handleHandleTouchEnd = (e) => {
            if (mobileCollapsed.value || !e.changedTouches || e.changedTouches.length === 0) return;
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - statsTouchStartX;
            const deltaY = touch.clientY - statsTouchStartY;

            // 底部手柄区域向上滑动超过 18px 即可平滑触发收起
            if (deltaY < -18 && Math.abs(deltaY) > Math.abs(deltaX)) {
                collapseMobileStats();
            }
            statsTouchFromBottom = false;
        };

        let sheetTouchStartX = 0;
        let sheetTouchStartY = 0;

        const handleSheetTouchStart = (e) => {
            if (!e.touches || e.touches.length === 0) return;
            sheetTouchStartX = e.touches[0].clientX;
            sheetTouchStartY = e.touches[0].clientY;
        };

        const handleSheetTouchEnd = (e) => {
            if (!e.changedTouches || e.changedTouches.length === 0) return;
            const deltaX = e.changedTouches[0].clientX - sheetTouchStartX;
            const deltaY = e.changedTouches[0].clientY - sheetTouchStartY;
            // 移动端指令助手手柄/头部向下滑动超过 25px 且竖直位移明显大于水平位移，平滑收起
            if (deltaY > 25 && deltaY > Math.abs(deltaX) * 1.1) {
                showCmdPanel.value = false;
            }
        };

        const cmdBarRef = ref(null);
        const cmdInputRef = ref(null);
        const startupModal = ref(null);
        const saving = ref(false);
        const jars = ref([]);
        const form = ref({ jarName: '', javaArgs: '', loaderType: 'fabric' });
        const showCmdPanel = ref(false);
        const cmdCategory = ref('all');
        const cmdSearch = ref('');

        // 指令助手参数配置弹窗相关
        const selectedSchema = ref(null);
        const paramValues = ref({});
        const cmdParamModalInstance = ref(null);

        const hasSchema = (name) => !!COMMAND_SCHEMAS[name];

        const toggleCmdPanel = () => {
            showCmdPanel.value = !showCmdPanel.value;
        };

        const handleGlobalKeydown = (e) => {
            if (e.key === 'Escape' && showCmdPanel.value) {
                showCmdPanel.value = false;
            }
        };

        const handleGlobalClick = (e) => {
            if (!showCmdPanel.value || isMobile.value) return;
            if (cmdBarRef.value && !cmdBarRef.value.contains(e.target)) {
                showCmdPanel.value = false;
            }
        };

        const cmdCategories = [
            { key: 'player', icon: 'fa-solid fa-user', color: 'primary' },
            { key: 'server', icon: 'fa-solid fa-server', color: 'success' },
            { key: 'world', icon: 'fa-solid fa-globe', color: 'info' },
            { key: 'admin', icon: 'fa-solid fa-shield-halved', color: 'danger' },
            { key: 'advanced', icon: 'fa-solid fa-code', color: 'secondary' },
        ];

        const isSubsequence = (sub, str) => {
            let i = 0, j = 0;
            while (i < sub.length && j < str.length) {
                if (sub[i] === str[j]) i++;
                j++;
            }
            return i === sub.length;
        };

        const getCmdTitle = (cmd) => {
            const schema = COMMAND_SCHEMAS[cmd.name];
            if (schema) {
                return store.lang === 'zh'
                    ? (schema.titlecn || t('dashboard.cmd_' + cmd.desc))
                    : (schema.titleen || t('dashboard.cmd_' + cmd.desc));
            }
            return t('dashboard.cmd_' + cmd.desc);
        };

        const filteredCommands = computed(() => {
            const raw = cmdSearch.value.toLowerCase().trim().replace(/^\/+/, '');
            if (!raw) {
                let cmds = MC_COMMANDS;
                if (cmdCategory.value !== 'all') {
                    cmds = cmds.filter(c => c.category === cmdCategory.value);
                }
                return cmds.map(c => ({ ...c, _matchBadge: null }));
            }

            const tokens = raw.split(/\s+/).filter(Boolean);
            const results = [];

            for (const cmd of MC_COMMANDS) {
                const schema = COMMAND_SCHEMAS[cmd.name];
                const aliases = COMMAND_ALIASES[cmd.name] || [];
                const descZh = (messages.zh?.dashboard?.['cmd_' + cmd.desc] || '').toLowerCase();
                const descEn = (messages.en?.dashboard?.['cmd_' + cmd.desc] || '').toLowerCase();
                const titlecn = (schema?.titlecn || '').toLowerCase();
                const titleen = (schema?.titleen || '').toLowerCase();
                const catZh = (messages.zh?.dashboard?.['cmd_cat_' + cmd.category] || '').toLowerCase();
                const catEn = (messages.en?.dashboard?.['cmd_cat_' + cmd.category] || '').toLowerCase();
                const syntax = (cmd.syntax || '').toLowerCase();

                // Extract option labels & values from schema
                const optionStrings = [];
                if (schema && schema.params) {
                    for (const p of schema.params) {
                        if (p.labelcn) optionStrings.push(p.labelcn.toLowerCase());
                        if (p.labelen) optionStrings.push(p.labelen.toLowerCase());
                        if (p.options) {
                            for (const opt of p.options) {
                                if (opt.value) optionStrings.push(opt.value.toLowerCase());
                                if (opt.labelcn) optionStrings.push(opt.labelcn.toLowerCase());
                                if (opt.labelen) optionStrings.push(opt.labelen.toLowerCase());
                            }
                        }
                    }
                }

                let totalScore = 0;
                let allTokensMatched = true;
                let matchedReason = '';

                for (const token of tokens) {
                    let tokenScore = 0;
                    let tokenReason = '';

                    // 1. Exact command name match
                    if (cmd.name === token) {
                        tokenScore += 10000;
                        tokenReason = `/${cmd.name}`;
                    } else if (cmd.name.startsWith(token)) {
                        tokenScore += 5000;
                        tokenReason = `/${cmd.name}`;
                    } else if (cmd.name.includes(token)) {
                        tokenScore += 2500;
                        tokenReason = `/${cmd.name}`;
                    }

                    // 2. Exact alias match
                    const exactAlias = aliases.find(a => a.toLowerCase() === token);
                    if (exactAlias) {
                        tokenScore += 4000;
                        if (!tokenReason) tokenReason = `别名: ${exactAlias}`;
                    } else {
                        // Alias prefix / contains
                        const containAlias = aliases.find(a => {
                            const al = a.toLowerCase();
                            return al.includes(token) || (token.length >= 2 && token.includes(al));
                        });
                        if (containAlias) {
                            tokenScore += 2000;
                            if (!tokenReason) tokenReason = `别名: ${containAlias}`;
                        }
                    }

                    // 3. Schema title match
                    if (titlecn) {
                        if (titlecn === token) {
                            tokenScore += 3500;
                            if (!tokenReason) tokenReason = schema.titlecn;
                        } else if (titlecn.includes(token) || (token.length >= 2 && token.includes(titlecn))) {
                            tokenScore += 2200;
                            if (!tokenReason) tokenReason = schema.titlecn;
                        } else if (token.length >= 2 && isSubsequence(token, titlecn)) {
                            tokenScore += 1600;
                            if (!tokenReason) tokenReason = schema.titlecn;
                        }
                    }
                    if (titleen && (titleen.includes(token) || token.includes(titleen))) {
                        tokenScore += 1500;
                    }

                    // 4. Description match
                    if (descZh.includes(token)) {
                        tokenScore += 1800;
                        if (!tokenReason) tokenReason = `描述匹配`;
                    } else if (token.length >= 2 && isSubsequence(token, descZh)) {
                        tokenScore += 1200;
                        if (!tokenReason) tokenReason = `描述匹配`;
                    }
                    if (descEn.includes(token)) {
                        tokenScore += 1000;
                    }

                    // 5. Schema options match (e.g. "白天", "死亡不掉落", "创造")
                    const matchedOpt = optionStrings.find(opt => opt.includes(token) || (token.length >= 2 && opt.length >= 2 && (isSubsequence(token, opt) || token.includes(opt))));
                    if (matchedOpt) {
                        tokenScore += 1500;
                        if (!tokenReason) tokenReason = `预设: ${matchedOpt.split(' ')[0]}`;
                    }

                    // 6. Syntax match
                    if (syntax.includes(token)) {
                        tokenScore += 300;
                    }

                    // 7. Category match
                    if (catZh.includes(token) || catEn.includes(token)) {
                        tokenScore += 200;
                    }

                    if (tokenScore === 0) {
                        allTokensMatched = false;
                        break;
                    }

                    totalScore += tokenScore;
                    if (!matchedReason) matchedReason = tokenReason;
                }

                if (allTokensMatched && totalScore > 0) {
                    // Category priority bonus if user explicitly selected a category tab
                    if (cmdCategory.value !== 'all' && cmd.category === cmdCategory.value) {
                        totalScore += 1000;
                    }
                    results.push({
                        cmd,
                        score: totalScore,
                        matchedReason
                    });
                }
            }

            results.sort((a, b) => b.score - a.score);
            return results.map(r => ({
                ...r.cmd,
                _matchBadge: r.matchedReason
            }));
        });

        const useCommand = (cmd) => {
            const schema = COMMAND_SCHEMAS[cmd.name];
            if (schema) {
                selectedSchema.value = schema;
                const vals = {};
                for (const param of schema.params) {
                    vals[param.key] = param.default !== undefined ? param.default : '';
                }
                const s = cmdSearch.value.toLowerCase().trim().replace(/^\/+/, '');
                if (s) {
                    for (const param of schema.params) {
                        if (param.options) {
                            const matchedOpt = param.options.find(opt => {
                                const val = (opt.value || '').toLowerCase();
                                const labelcn = (opt.labelcn || '').toLowerCase();
                                const labelen = (opt.labelen || '').toLowerCase();
                                return val === s || labelcn.includes(s) || labelen.includes(s) ||
                                    (s.length >= 2 && (val.includes(s) || labelcn.includes(s) || isSubsequence(s, labelcn)));
                            });
                            if (matchedOpt) {
                                vals[param.key] = matchedOpt.value;
                            }
                        }
                    }
                }
                paramValues.value = vals;
                cmdParamModalInstance.value.show();
                showCmdPanel.value = false;
            } else {
                command.value = cmd.template || cmd.name + ' ';
                showCmdPanel.value = false;
                nextTick(() => {
                    if (cmdInputRef.value) {
                        cmdInputRef.value.focus();
                    }
                });
            }
        };

        const assembledCommand = computed(() => {
            if (!selectedSchema.value) return '';
            try {
                return selectedSchema.value.assemble(paramValues.value);
            } catch (e) {
                return '';
            }
        });

        const insertCommand = () => {
            command.value = assembledCommand.value;
            cmdParamModalInstance.value.hide();
            nextTick(() => {
                if (cmdInputRef.value) {
                    cmdInputRef.value.focus();
                }
            });
        };

        const executeConfiguredCommand = async () => {
            if (!store.isRunning) {
                showToast('common.server_offline', 'warning');
                return;
            }
            if (assembledCommand.value) {
                await api.post('/api/server/command', { command: assembledCommand.value });
                showToast(t('dashboard.toast_sent'));
                cmdParamModalInstance.value.hide();
            }
        };

        const sendQuickCommand = async (template) => {
            if (!template) return;
            if (!store.isRunning) {
                showToast('common.server_offline', 'warning');
                return;
            }
            try {
                await api.post('/api/server/command', { command: template });
                showToast(t('dashboard.toast_sent'));
                showCmdPanel.value = false;
            } catch (e) {
                showToast(e.message || 'common.error', 'danger');
            }
        };

        const scrollToBottom = () => {
            nextTick(() => {
                const el = document.getElementById('consoleBox');
                if (el) el.scrollTop = el.scrollHeight;
            });
        };

        const onSetupComplete = () => {
            store.isSetup = true;
            location.reload();
        };

        const fetchJars = async () => {
            try {
                const res = await api.get('/api/panel/jars');
                jars.value = res.data;
            } catch (e) { }
        };

        const openStartupSettings = () => {
            const inst = store.instanceList.find(i => i.id === store.currentInstanceId);
            if (inst) {
                form.value = {
                    jarName: inst.jarName || '',
                    javaArgs: Array.isArray(inst.javaArgs) ? inst.javaArgs.join('\n') : (inst.javaArgs || ''),
                    loaderType: inst.loaderType || 'fabric'
                };
            }
            fetchJars();
            startupModal.value.show();
        };

        const saveStartupSettings = async () => {
            saving.value = true;
            try {
                const payload = {
                    id: store.currentInstanceId,
                    ...form.value
                };
                payload.javaArgs = (payload.javaArgs || '').split('\n').map(a => a.trim()).filter(a => a);
                await api.post('/api/instances/update', payload);
                showToast('instance_manager.update_success');
                startupModal.value.hide();
                const res = await api.get('/api/instances/list');
                store.instanceList = res.data.instances || res.data;
            } catch (e) {
                showToast(e.response?.data?.error || 'common.error', 'danger');
            } finally {
                saving.value = false;
            }
        };

        watch(() => store.logs.length, scrollToBottom);
        watch(() => store.stats, () => {
            if (!mobileCollapsed.value) {
                requestSyncCardHeights();
            }
        }, { deep: true });

        onMounted(() => {
            updateMobile();
            window.addEventListener('resize', updateMobile);
            window.addEventListener('resize', requestSyncCardHeights);
            window.addEventListener('orientationchange', requestSyncCardHeights);
            window.addEventListener('keydown', handleGlobalKeydown);
            document.addEventListener('click', handleGlobalClick);
            scrollToBottom();
            setTimeout(scrollToBottom, 100);
            nextTick(() => {
                requestSyncCardHeights();
                setTimeout(requestSyncCardHeights, 150);
            });
            startupModal.value = new bootstrap.Modal(document.getElementById('startupModal'));
            cmdParamModalInstance.value = new bootstrap.Modal(document.getElementById('cmdParamModal'));
        });

        onUnmounted(() => {
            window.removeEventListener('resize', updateMobile);
            window.removeEventListener('resize', requestSyncCardHeights);
            window.removeEventListener('orientationchange', requestSyncCardHeights);
            window.removeEventListener('keydown', handleGlobalKeydown);
            document.removeEventListener('click', handleGlobalClick);
            if (syncHeightRaf) cancelAnimationFrame(syncHeightRaf);
        });

        const dashboardStatusClass = computed(() => {
            const s = store.serverStatus || (store.isRunning ? 'running' : 'stopped');
            switch (s) {
                case 'running': return 'bg-success-subtle text-success';
                case 'starting': return 'bg-warning-subtle text-warning-emphasis';
                case 'stopping': return 'bg-warning-subtle text-warning-emphasis';
                case 'stopped':
                default: return 'bg-danger-subtle text-danger';
            }
        });

        const dashboardStatusText = computed(() => {
            const s = store.serverStatus || (store.isRunning ? 'running' : 'stopped');
            switch (s) {
                case 'running': return t('dashboard.state_running');
                case 'starting': return t('dashboard.state_starting');
                case 'stopping': return t('dashboard.state_stopping');
                case 'stopped':
                default: return t('dashboard.state_stopped');
            }
        });

        const formattedLoader = computed(() => {
            const type = store.stats?.loaderType || 'fabric';
            const typeName = type === 'neoforge' ? 'NeoForge' : (type.charAt(0).toUpperCase() + type.slice(1));
            const ver = store.stats?.version?.loader;
            if (ver && ver !== 'Unknown') {
                return `${typeName} ${ver}`;
            }
            return typeName;
        });

        const activeInstanceName = computed(() => {
            const inst = store.instanceList?.find(i => i.id === store.currentInstanceId);
            return inst ? inst.name : '';
        });

        const displayMotd = computed(() => {
            const raw = store.stats?.mc?.motd;
            if (raw && raw !== '-' && raw !== 'Loading...') {
                const cleaned = raw.replace(/§[0-9a-fk-or]/gi, '').trim();
                if (cleaned) return cleaned;
            }
            return activeInstanceName.value || 'Minecraft Server';
        });

        const serverAction = async (act) => {
            try {
                if (act === 'start') {
                    store.serverStatus = 'starting';
                    store.isRunning = true;
                } else if (act === 'stop') {
                    store.serverStatus = 'stopping';
                }
                const res = await api.post(`/api/server/${act}`);
                if (res.data && res.data.success === false) {
                    if (act === 'start') {
                        store.serverStatus = 'stopped';
                        store.isRunning = false;
                    }
                    if (res.data.errorType === 'port_in_use') {
                        openModal({
                            title: t('properties.port_conflict_title'),
                            message: t('properties.port_conflict_msg', { port: res.data.port }),
                            callback: async () => {
                                try {
                                    const reassignRes = await api.post('/api/server/reassign_port');
                                    if (reassignRes.data.success) {
                                        showToast(t('properties.port_reassign_success', { port: reassignRes.data.port }), 'success');
                                        store.serverStatus = 'starting';
                                        store.isRunning = true;
                                        await api.post('/api/server/start');
                                    }
                                } catch (err) {
                                    store.serverStatus = 'stopped';
                                    store.isRunning = false;
                                    showToast(err.response?.data?.error || 'common.error', 'danger');
                                }
                            }
                        });
                    } else {
                        showToast(res.data.message || 'common.error', 'danger');
                    }
                } else {
                    showToast('dashboard.toast_sent');
                }
            } catch (e) {
                if (act === 'start') {
                    store.serverStatus = 'stopped';
                    store.isRunning = false;
                }
                showToast('common.error', 'danger');
            }
        };

        const forceStop = () => {
            openModal({
                title: t('dashboard.force_stop_confirm_title'),
                message: t('dashboard.force_stop_confirm_msg'),
                showAgainKey: 'skip_force_stop_confirm',
                callback: async () => {
                    try {
                        store.serverStatus = 'stopping';
                        await api.post('/api/server/force_stop');
                        showToast('dashboard.force_stop_sent');
                    } catch (e) {
                        showToast('common.error', 'danger');
                    }
                }
            });
        };

        const sendCommand = async () => {
            if (command.value) {
                await api.post('/api/server/command', { command: command.value });
                command.value = '';
            }
        };

        return {
            store, command, serverAction, forceStop, sendCommand, formatLog,
            onSetupComplete, openStartupSettings, saveStartupSettings, saving, form, jars, fetchJars,
            showCmdPanel, cmdCategory, cmdSearch, cmdCategories, filteredCommands,
            useCommand, sendQuickCommand, hasSchema, toggleCmdPanel, getCmdTitle,
            cmdBarRef, cmdInputRef,
            dashboardStatusClass, dashboardStatusText,
            formattedLoader, activeInstanceName, displayMotd,

            // Mobile stats state & handlers
            activeMobileCard, mobileCollapsed, dashboardGridRef, setMobileCard, onGridScroll, toggleMobileCollapse, isMobile,
            statsSectionRef, miniBarRef, expandedContentRef,
            collapseMobileStats, expandMobileStats, handleStatsTouchStart, handleStatsTouchEnd, handleHandleTouchStart, handleHandleTouchEnd,
            handleSheetTouchStart, handleSheetTouchEnd,

            // 指令助手参数配置相关返回
            selectedSchema, paramValues, assembledCommand, insertCommand, executeConfiguredCommand
        };
    }
};
