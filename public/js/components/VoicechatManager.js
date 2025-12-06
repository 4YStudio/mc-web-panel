import { ref, reactive, onMounted } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { showToast } from '../utils.js';

// --- Voicechat Config Schema ---
const VC_GROUPS = [
    {
        title: '基础设置 (General)',
        items: [
            { key: 'port', label: '端口 (Port)', type: 'number', desc: '默认 24454 (UDP)' },
            { key: 'voice_host', label: '语音主机 (Voice Host)', type: 'text', desc: '公网IP或域名，必须设置否则玩家无法连接' },
            { key: 'voice_chat_password', label: '连接密码', type: 'text', desc: '不推荐设置' },
            { key: 'max_packet_weight', label: '最大数据包大小', type: 'number', desc: '限制语音数据包大小' }
        ]
    },
    {
        title: '语音质量 & 距离',
        items: [
            { key: 'voice_distance', label: '最大语音距离', type: 'number', desc: '默认 48' },
            { key: 'crouch_distance', label: '潜行语音距离', type: 'number', desc: '默认 48' },
            { key: 'whisper_distance', label: '耳语距离', type: 'number' },
            { key: 'audio_bitrate', label: '音频码率', type: 'select', options: ['16000', '32000', '48000', '64000', '96000'] }
        ]
    }
];

export default {
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>简单语音配置 (Simple Voice Chat)</h3>
            <div class="btn-group">
                <button class="btn btn-outline-secondary" @click="toggleEditMode">
                    <i class="fa-solid" :class="editMode==='gui'?'fa-code':'fa-sliders'"></i>
                    {{ editMode==='gui' ? '切换文本模式' : '切换图形模式' }}
                </button>
                <button class="btn btn-success" @click="saveConfig">
                    <i class="fa-solid fa-save me-2"></i>保存配置
                </button>
            </div>
        </div>

        <!-- 图形化编辑器 -->
        <div v-if="editMode === 'gui'" class="row g-4 pb-4">
            <div class="col-md-6" v-for="(group, idx) in VC_GROUPS" :key="idx">
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
                    <i class="fa-solid fa-circle-info me-2"></i> 修改配置后需要重启服务器才能生效。
                 </div>
            </div>
        </div>

        <!-- 文本编辑器 -->
        <div v-else class="h-100">
            <div class="card h-100 shadow-sm">
                <div class="card-header bg-body-tertiary small text-muted">mc_server/config/voicechat/voicechat-server.properties</div>
                <textarea class="form-control border-0 rounded-0 h-100"  
                    style="font-family: monospace; resize: none; min-height: 65vh;" 
                    v-model="fileContent" 
                    spellcheck="false"
                ></textarea>
            </div>
        </div>
    </div>
    `,
    setup() {
        const editMode = ref('gui');
        const fileContent = ref('');
        const formModel = reactive({});

        const createRegex = (key) => new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm');

        const loadFile = async () => {
            try {
                const res = await api.get('/api/voicechat/config');
                fileContent.value = res.data.content;
                parseToGui();
            } catch (e) {
                fileContent.value = '# 无法读取配置文件';
                showToast('读取失败: ' + (e.response?.data?.error || e.message), 'danger');
            }
        };

        const parseToGui = () => {
            const text = fileContent.value;
            VC_GROUPS.forEach(group => {
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
            VC_GROUPS.forEach(group => {
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
                showToast('配置已保存 (需重启服务器)');
            } catch (e) { showToast('保存失败', 'danger'); }
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

        return { editMode, fileContent, formModel, VC_GROUPS, saveConfig, toggleEditMode };
    }
};
