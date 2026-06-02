import { store } from '../store.js';
import { api } from '../api.js';
import { showToast, formatLog, t, openModal } from '../utils.js';
import { ref, computed, nextTick, watch, onMounted } from '/js/vue.esm-browser.js';
import SetupWizard from './SetupWizard.js';

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
            command.value = cmd.template || cmd.name + ' ';
            showCmdPanel.value = false;
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
            useCommand, sendQuickCommand
        };
    }
};
