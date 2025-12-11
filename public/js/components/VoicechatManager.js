import { ref, reactive, onMounted, computed, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>{{ $t('voice.title') }}</h3>
            <div class="btn-group">
                <button class="btn btn-outline-secondary" @click="toggleEditMode">
                    <i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i>
                    <span class="d-none d-md-inline ms-1">{{ editMode==='gui' ? $t('common.mode_text') : $t('common.mode_gui') }}</span>
                </button>
                <button class="btn btn-success" @click="saveConfig">
                    <i class="fa-solid fa-save me-0 me-md-2"></i><span class="d-none d-md-inline">{{ $t('common.save') }}</span>
                </button>
            </div>
        </div>

        <Transition name="fade" mode="out-in">
            <!-- 图形化编辑器 -->
            <div v-if="editMode === 'gui'" class="row g-4 pb-4" key="gui">
                <div class="col-md-6" v-for="(group, idx) in vcGroups" :key="idx">
                    <div class="card h-100 border-secondary">
                        <div class="card-header bg-body-tertiary fw-bold">{{ group.title }}</div>
                        <div class="card-body">
                            <div v-for="item in group.items" :key="item.key" class="mb-3 row align-items-center">
                                <label class="col-sm-5 col-form-label small">{{ item.label }}</label>
                                <div class="col-sm-7">
                                    
                                    <div v-if="item.type === 'boolean'" class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" v-model="formModel[item.key]">
                                    </div>
                                    
                                    <select v-else-if="item.type === 'select'" class="form-select form-select-sm" v-model="formModel[item.key]">
                                        <option v-for="opt in item.options" :value="opt">{{ opt }}</option>
                                    </select>

                                    <input v-else :type="item.type" class="form-control form-control-sm" v-model="formModel[item.key]">
                                    
                                    <div v-if="item.desc" class="form-text text-secondary small" style="font-size: 0.75rem;">{{ item.desc }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-12">
                     <div class="alert alert-info">
                        <i class="fa-solid fa-circle-info me-2"></i> {{ $t('voice.restart_required') }}
                     </div>
                </div>
            </div>

            <!-- 文本编辑器 -->
            <div v-else class="h-100" key="text">
                <div class="card h-100 shadow-sm">
                    <div class="card-header bg-body-tertiary small text-muted">mc_server/config/voicechat/voicechat-server.properties</div>
                    <textarea class="form-control border-0 rounded-0 h-100"  
                        style="font-family: monospace; resize: none; min-height: 65vh;" 
                        v-model="fileContent" 
                        spellcheck="false"
                    ></textarea>
                </div>
            </div>
        </Transition>
    </div>
    `,
    setup() {
        const editMode = ref('gui');
        const fileContent = ref('');
        const formModel = reactive({});
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const vcGroups = computed(() => [
            {
                title: $t('voice.general'),
                items: [
                    { key: 'port', label: $t('voice.port'), type: 'number', desc: 'Default 24454 (UDP)' },
                    { key: 'voice_host', label: $t('voice.host'), type: 'text', desc: $t('voice.host_desc') },
                    { key: 'voice_chat_password', label: $t('voice.password'), type: 'text', desc: 'Not recommended' },
                    { key: 'max_packet_weight', label: $t('voice.max_packet_weight'), type: 'number', desc: 'Limit packet size' }
                ]
            },
            {
                title: $t('voice.quality_distance'),
                items: [
                    { key: 'voice_distance', label: $t('voice.max_distance'), type: 'number', desc: 'Default 48' },
                    { key: 'crouch_distance', label: $t('voice.crouch_distance'), type: 'number', desc: 'Default 48' },
                    { key: 'whisper_distance', label: $t('voice.whisper_distance'), type: 'number' },
                    { key: 'audio_bitrate', label: $t('voice.bitrate'), type: 'select', options: ['16000', '32000', '48000', '64000', '96000'] }
                ]
            }
        ]);

        const createRegex = (key) => new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm');

        const loadFile = async () => {
            try {
                const res = await api.get('/api/voicechat/config');
                fileContent.value = res.data.content;
                parseToGui();
            } catch (e) {
                fileContent.value = '# Error reading config';
                showToast($t('common.error') + ': ' + (e.response?.data?.error || e.message), 'danger');
            }
        };

        const parseToGui = () => {
            const text = fileContent.value;
            vcGroups.value.forEach(group => {
                group.items.forEach(item => {
                    const match = text.match(createRegex(item.key));
                    if (match) {
                        let valStr = match[1].trim();
                        if (item.type === 'boolean') formModel[item.key] = (valStr === 'true');
                        else if (item.type === 'number') formModel[item.key] = Number(valStr);
                        else formModel[item.key] = valStr;
                    } else {
                        formModel[item.key] = item.type === 'boolean' ? false : '';
                    }
                });
            });
        };

        const syncToText = () => {
            let text = fileContent.value;
            vcGroups.value.forEach(group => {
                group.items.forEach(item => {
                    if (formModel[item.key] !== undefined) {
                        const regex = createRegex(item.key);
                        if (regex.test(text)) {
                            text = text.replace(regex, `${item.key}=${formModel[item.key]}`);
                        } else {
                            if (text && !text.endsWith('\n')) text += '\n';
                            text += `${item.key}=${formModel[item.key]}`;
                        }
                    }
                });
            });
            fileContent.value = text;
        };

        const saveConfig = async () => {
            if (editMode.value === 'gui') syncToText();
            try {
                await api.post('/api/voicechat/save', { content: fileContent.value });
                showToast($t('voice.saved'));
            } catch (e) { showToast($t('common.error'), 'danger'); }
        };

        const toggleEditMode = () => {
            if (editMode.value === 'text') {
                parseToGui();
                editMode.value = 'gui';
            } else {
                syncToText();
                editMode.value = 'text';
            }
        };

        onMounted(loadFile);

        return { editMode, fileContent, formModel, vcGroups, saveConfig, toggleEditMode };
    }
};
