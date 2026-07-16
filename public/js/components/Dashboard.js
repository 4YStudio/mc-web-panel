import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, formatLog, t, openModal } from '../utils.js';
import { ref, computed, nextTick, watch, onMounted } from '/js/vue.esm-browser.js';
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
    }
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
                    <button v-if="!store.isRunning" @click="serverAction('start')" class="btn btn-success px-3 px-md-4 fw-bold">
                        <i class="fa-solid fa-play me-md-2"></i><span class="d-none d-md-inline">{{ $t('dashboard.start') }}</span>
                    </button>
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

            <!-- System Stats Overview -->
            <div v-if="store.consoleInfoPosition === 'top'" class="row g-3 mb-3 flex-shrink-0">
                <div class="col-md-6 stagger-item">
                    <div class="stat-card h-100">
                        <div class="stat-card-header">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1" style="font-size: 0.6875rem;"><i class="fa-solid fa-server me-2"></i>{{ $t('dashboard.server_info') }}</h6>
                                 <span class="badge rounded-pill font-monospace" :class="store.isRunning?'bg-success-subtle text-success':'bg-danger-subtle text-danger'">{{ store.isRunning ? $t('dashboard.state_running') : $t('dashboard.state_stopped') }}</span>
                            </div>
                        </div>
                        <div class="stat-card-body">
                              <div v-if="store.stats && store.stats.mc" class="d-flex align-items-end mb-2">
                                  <div class="fw-bold me-2" style="font-size: 2rem; line-height: 1;">{{ store.stats.mc.online }}</div>
                                  <div class="text-muted mb-1 small">/ {{ store.stats.mc.maxPlayers }} {{ $t('dashboard.online_players') }}</div>
                              </div>
                             
                              <div v-if="store.stats && store.stats.mc" class="progress mb-3" style="height: 4px;">
                                 <div class="progress-bar bg-success" :style="{width: (store.stats.mc.maxPlayers > 0 ? (store.stats.mc.online/store.stats.mc.maxPlayers*100) : 0) + '%'}"></div>
                              </div>
                              <div v-if="store.stats && store.stats.mc" class="text-truncate small text-muted font-monospace mb-2"><i class="fa-solid fa-quote-left me-2 opacity-50"></i>{{ store.stats.mc.motd }}</div>
                             
                             <div class="d-flex justify-content-between small text-muted border-top pt-2 mt-2 flex-wrap gap-2" style="font-size: 0.6875rem; border-color: var(--c-border-subtle) !important;">
                                <span>{{ $t('dashboard.target') }}: {{ store.stats.version?.mc || 'Unknown' }}</span>
                                <span>{{ $t('dashboard.loader') }}: {{ store.stats.version?.loader || 'Unknown' }}</span>
                                <span>{{ $t('properties.loader_type') }}: {{ (store.stats.loaderType || 'fabric') === 'neoforge' ? 'NeoForge' : (store.stats.loaderType || 'fabric').charAt(0).toUpperCase() + (store.stats.loaderType || 'fabric').slice(1) }}</span>
                                <span>{{ $t('dashboard.java_version') }}: <span class="fw-bold">{{ store.stats.javaVersion || 'Checking...' }}</span></span>
                             </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 stagger-item" style="animation-delay: 0.1s;">
                     <div class="stat-card h-100">
                        <div class="stat-card-header">
                            <h6 class="text-uppercase text-muted small fw-bold m-0 letter-spacing-1" style="font-size: 0.6875rem;"><i class="fa-solid fa-microchip me-2"></i>{{ $t('dashboard.system_resource') }}</h6>
                        </div>
                        <div class="stat-card-body">
                             <div class="mb-3">
                                 <div class="d-flex justify-content-between small mb-1 fw-bold">
                                     <span>{{ $t('dashboard.cpu_usage') }}</span>
                                     <span :class="{'text-danger': store.stats.cpu > 80}">{{ store.stats.cpu }}%</span>
                                 </div>
                                 <div class="progress" style="height: 4px;">
                                    <div class="progress-bar" :style="{width: store.stats.cpu + '%'}"></div>
                                 </div>
                             </div>
                             <div>
                                 <div class="d-flex justify-content-between small mb-1 fw-bold">
                                     <span>{{ $t('dashboard.mem_usage') }} ({{ store.stats.mem.percentage }}%)</span>
                                     <span class="text-muted font-monospace" style="font-size: 0.6875rem;">{{ store.stats.mem.used }}G / {{ store.stats.mem.total }}G</span>
                                 </div>
                                 <div class="progress" style="height: 4px;">
                                    <div class="progress-bar bg-warning" :style="{width: store.stats.mem.percentage + '%'}"></div>
                                 </div>
                             </div>
                        </div>
                     </div>
                </div>
            </div>

            <div class="console-output flex-grow-1 mb-3 position-relative" id="consoleBox">
                <div v-for="(log,i) in store.logs" :key="i" v-html="formatLog(log)"></div>
            </div>
            
            <div class="flex-shrink-0">
                <div class="input-group cmd-input-group">
                    <input type="text" class="form-control" v-model="command" @keyup.enter="sendCommand" :placeholder="$t('dashboard.send_cmd_placeholder')">
                    <button class="btn btn-outline-secondary" @click="showCmdPanel = !showCmdPanel" :title="$t('dashboard.cmd_helper')">
                        <i class="fa-solid fa-terminal"></i>
                    </button>
                    <button class="btn btn-primary fw-bold" @click="sendCommand">{{ $t('dashboard.send') }}</button>
                </div>

                <div v-if="showCmdPanel" class="cmd-panel mt-2">
                    <div class="d-flex gap-2 mb-2 align-items-center flex-wrap">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="cursor:pointer" :class="{'bg-primary text-white': cmdCategory === 'all'}" @click="cmdCategory='all'">{{ $t('dashboard.cmd_all') }}</span>
                        <span v-for="cat in cmdCategories" :key="cat.key" class="badge border" style="cursor:pointer" :class="cmdCategory===cat.key ? 'bg-'+cat.color+' text-white' : 'bg-body-tertiary text-'+cat.color" @click="cmdCategory=cat.key">
                            <i :class="cat.icon" class="me-1"></i>{{ $t('dashboard.cmd_cat_' + cat.key) }}
                        </span>
                        <div class="input-group input-group-sm ms-auto" style="max-width:200px">
                            <span class="input-group-text bg-body-tertiary border-end-0"><i class="fa-solid fa-search text-muted" style="font-size:0.7rem"></i></span>
                            <input type="text" class="form-control border-start-0" :placeholder="$t('dashboard.cmd_search')" v-model="cmdSearch" style="font-size:0.8rem">
                        </div>
                    </div>
                    <div class="cmd-list">
                        <div v-for="cmd in filteredCommands" :key="cmd.name" class="cmd-item d-flex align-items-start gap-2 py-1 px-2 rounded" @click="useCommand(cmd)">
                            <code class="text-primary flex-shrink-0" style="min-width:120px;font-size:0.75rem">{{ cmd.name }}</code>
                            <span class="small text-muted flex-grow-1" style="font-size:0.7rem">{{ $t('dashboard.cmd_' + cmd.desc) }}</span>
                            <i v-if="cmd.quick" class="fa-solid fa-bolt text-warning flex-shrink-0" style="font-size:0.65rem" :title="$t('dashboard.cmd_quick')"></i>
                        </div>
                        <div v-if="filteredCommands.length === 0" class="text-center text-muted py-2 small">
                            {{ $t('dashboard.cmd_no_result') }}
                        </div>
                    </div>
                    <div class="mt-2 border-top pt-2" v-if="quickCommands.length > 0">
                        <div class="small fw-bold text-muted mb-1"><i class="fa-solid fa-bolt me-1 text-warning"></i>{{ $t('dashboard.cmd_quick_title') }}</div>
                        <div class="d-flex flex-wrap gap-1">
                            <button v-for="cmd in quickCommands" :key="cmd.name" class="btn btn-sm btn-outline-primary" style="font-size:0.7rem;padding:0.15rem 0.5rem" @click="sendQuickCommand(cmd.template)">
                                {{ cmd.name }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
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

        const cmdCategories = [
            { key: 'player', icon: 'fa-solid fa-user', color: 'primary' },
            { key: 'server', icon: 'fa-solid fa-server', color: 'success' },
            { key: 'world', icon: 'fa-solid fa-globe', color: 'info' },
            { key: 'admin', icon: 'fa-solid fa-shield-halved', color: 'danger' },
            { key: 'advanced', icon: 'fa-solid fa-code', color: 'secondary' },
        ];

        const filteredCommands = computed(() => {
            let cmds = MC_COMMANDS;
            if (cmdCategory.value !== 'all') {
                cmds = cmds.filter(c => c.category === cmdCategory.value);
            }
            const s = cmdSearch.value.toLowerCase().trim();
            if (s) {
                cmds = cmds.filter(c => c.name.includes(s) || c.syntax.toLowerCase().includes(s));
            }
            return cmds;
        });

        const quickCommands = computed(() => {
            return MC_COMMANDS.filter(c => c.quick && c.category === cmdCategory.value);
        });

        const useCommand = (cmd) => {
            const schema = COMMAND_SCHEMAS[cmd.name];
            if (schema) {
                selectedSchema.value = schema;
                const vals = {};
                for (const param of schema.params) {
                    vals[param.key] = param.default !== undefined ? param.default : '';
                }
                paramValues.value = vals;
                cmdParamModalInstance.value.show();
                showCmdPanel.value = false;
            } else {
                command.value = cmd.template || cmd.name + ' ';
                showCmdPanel.value = false;
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
            if (!store.isRunning) {
                showToast('common.server_offline', 'warning');
                return;
            }
            await api.post('/api/server/command', { command: template });
            showToast(t('dashboard.toast_sent'));
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

        onMounted(() => {
            scrollToBottom();
            setTimeout(scrollToBottom, 100);
            startupModal.value = new bootstrap.Modal(document.getElementById('startupModal'));
            cmdParamModalInstance.value = new bootstrap.Modal(document.getElementById('cmdParamModal'));
        });

        const serverAction = async (act) => {
            try {
                await api.post(`/api/server/${act}`);
                showToast('dashboard.toast_sent');
            } catch (e) {
                showToast('common.error', 'danger');
            }
        };

        const forceStop = () => {
            openModal({
                title: t('dashboard.force_stop_confirm_title'),
                message: t('dashboard.force_stop_confirm_msg'),
                callback: async () => {
                    try {
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
            showCmdPanel, cmdCategory, cmdSearch, cmdCategories, filteredCommands, quickCommands,
            useCommand, sendQuickCommand,

            // 指令助手参数配置相关返回
            selectedSchema, paramValues, assembledCommand, insertCommand, executeConfiguredCommand
        };
    }
};
