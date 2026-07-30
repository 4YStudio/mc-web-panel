import { ref, reactive, computed, onMounted, onUnmounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, waitForPanel, uploadFileWithChunk, isLargeFile } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column animate-in overflow-hidden">
        <div class="page-header d-flex justify-content-between align-items-center flex-shrink-0">
            <div class="d-flex align-items-center overflow-hidden">
                <button @click="store.view = store.prevView || 'instance-manager'" class="btn-back me-3">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <h3 class="m-0 fw-bold d-flex align-items-center text-truncate tracking-tight">
                    <i class="fa-solid fa-sliders me-2 me-md-3 text-primary d-none d-md-inline"></i>
                    <span>{{ $t('panel_settings.title') }}</span>
                </h3>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-success btn-sm px-3 px-md-4 py-2 fw-bold" @click="saveConfig" :disabled="saving">
                    <i class="fa-solid fa-save me-md-2"></i><span class="d-none d-md-inline">{{ $t('common.save') }}</span>
                </button>
            </div>
        </div>

        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted fw-medium">{{ $t('common.loading') }}</p>
        </div>

        <div v-else class="row g-0 flex-grow-1 overflow-hidden rounded-4 border bg-surface" style="background-color: var(--c-surface); border-radius: 16px;">
            <!-- Settings Sidebar -->
            <div class="col-md-3 border-end h-100 settings-sidebar p-3 d-flex flex-column gap-2 flex-shrink-0" style="min-width: 200px;">
                <button v-for="tab in settingsTabs" :key="tab.id" class="btn btn-sm text-start py-2.5 px-3 rounded-3 border-0 d-flex align-items-center gap-2.5 w-100 settings-tab-btn"
                    :class="{ active: activeSettingsTab === tab.id }"
                    @click="activeSettingsTab = tab.id"
                    style="font-size: 0.85rem; font-weight: 600; line-height: 1.5; text-decoration: none;">
                    <i class="fa-solid" :class="tab.icon" style="width: 18px; text-align: center;"></i>
                    <span>{{ tab.label }}</span>
                </button>
            </div>
            <!-- Settings Panels -->
            <div class="col-md-9 h-100 overflow-auto custom-scrollbar p-4 d-flex flex-column">
                
                <!-- Basic Settings Panel -->
                <div v-show="activeSettingsTab === 'basic'" class="animate-in">
                    <h5 class="fw-bold mb-4 d-flex align-items-center">
                        <i class="fa-solid fa-sliders text-primary me-2"></i>
                        {{ $t('panel_settings.basic') }}
                    </h5>
                    <div class="row g-4" style="max-width: 680px;">
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.port') }}</label>
                            <input type="number" class="form-control" v-model.number="config.port" min="1024" max="65535">
                            <div class="form-text small opacity-75" style="font-size: 0.7rem;">{{ $t('panel_settings.port_desc') }}</div>
                        </div>
                        
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.default_lang') }}</label>
                            <CustomSelect v-model="config.defaultLang" :options="[{value: 'zh', label: '中文'}, {value: 'en', label: 'English'}]" />
                        </div>
                        
                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.theme') }}</label>
                            <CustomSelect v-model="config.theme" :options="[{value: 'light', label: $t('panel_settings.theme_light')}, {value: 'dark', label: $t('panel_settings.theme_dark')}, {value: 'auto', label: $t('panel_settings.theme_auto')}]" />
                        </div>

                        <div class="col-md-6">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.console_info_position') }}</label>
                            <CustomSelect v-model="config.consoleInfoPosition" :options="[{value: 'top', label: $t('panel_settings.pos_top')}, {value: 'sidebar', label: $t('panel_settings.pos_sidebar')}]" />
                        </div>

                        <div class="col-12 mt-4 pt-3 border-top">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.github_proxy') }}</label>
                            <div class="input-group input-group-sm">
                                <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i class="fa-solid fa-list-ul"></i>
                                </button>
                                <ul class="dropdown-menu shadow-sm border-0">
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = ''"><i class="fa-solid fa-ban me-2 opacity-50"></i>{{ $t('common.disabled') }}</a></li>
                                    <li><hr class="dropdown-divider opacity-50"></li>
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = 'https://gh-proxy.org'">gh-proxy.org</a></li>
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = 'https://hk.gh-proxy.org'">hk.gh-proxy.org</a></li>
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = 'https://cdn.gh-proxy.org'">cdn.gh-proxy.org</a></li>
                                    <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = 'https://edgeone.gh-proxy.org'">edgeone.gh-proxy.org</a></li>
                                </ul>
                                <input type="text" class="form-control" v-model="config.githubProxy" :placeholder="$t('panel_settings.github_proxy_desc')">
                            </div>
                            <div class="form-text small opacity-75 mt-1" style="font-size: 0.7rem;">{{ $t('panel_settings.github_proxy_desc') }}</div>
                        </div>
                    </div>
                </div>

                <!-- Security Panel -->
                <div v-show="activeSettingsTab === 'security'" class="animate-in">
                    <h5 class="fw-bold mb-4 d-flex align-items-center">
                        <i class="fa-solid fa-shield-halved text-danger me-2"></i>
                        {{ $t('panel_settings.security') }}
                    </h5>
                    <div style="max-width: 600px;">
                        <div class="mb-4">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.secret') }}</label>
                            <div class="input-group input-group-sm mb-2">
                                <input type="text" class="form-control" :value="config.secret || '未启用 / Disabled'" readonly>
                                <button class="btn btn-outline-success" @click="reset2FA">
                                    <i class="fa-solid fa-key me-1"></i>{{ config.secret ? $t('panel_settings.reset_2fa') : $t('panel_settings.enable_2fa') }}
                                </button>
                                <button v-if="config.secret" class="btn btn-outline-danger" @click="disable2FA">
                                    <i class="fa-solid fa-trash me-1"></i>{{ $t('panel_settings.disable_2fa') }}
                                </button>
                            </div>
                            <div class="form-text small opacity-75" style="font-size: 0.7rem;">{{ $t('panel_settings.secret_masked') }}</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.session_timeout') }}</label>
                            <input type="number" class="form-control" v-model.number="config.sessionTimeout" min="1" max="365">
                        </div>
                    </div>
                </div>

                <!-- Account Management Panel -->
                <div v-show="activeSettingsTab === 'account'" class="animate-in">
                    <h5 class="fw-bold mb-4 d-flex align-items-center" style="color: var(--c-accent);">
                        <i class="fa-solid fa-user-gear me-2"></i>
                        {{ $t('panel_settings.account_mgmt') }}
                    </h5>
                    <div style="max-width: 500px;">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.admin_user') }}</label>
                            <input type="text" class="form-control" v-model="accountForm.username">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.current_pass') }}</label>
                            <input type="password" class="form-control" v-model="accountForm.currentPassword" placeholder="******">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.new_pass') }}</label>
                            <input type="password" class="form-control" v-model="accountForm.newPassword" placeholder="******">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.confirm_new_pass') }}</label>
                            <input type="password" class="form-control" v-model="accountForm.confirmNewPassword" placeholder="******">
                        </div>
                        <div class="d-grid mt-4">
                            <button class="btn btn-outline-primary fw-bold" @click="updateAccount" :disabled="updatingAccount">
                                <span v-if="updatingAccount" class="spinner-border spinner-border-sm me-2"></span>
                                <i v-else class="fa-solid fa-user-pen me-2"></i>{{ $t('common.save') }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Integrations Panel -->
                <div v-show="activeSettingsTab === 'integrations'" class="animate-in">
                    <h5 class="fw-bold mb-4 d-flex align-items-center text-info">
                        <i class="fa-solid fa-link me-2"></i>
                        集成与回调 (Webhook & AI Integrations)
                    </h5>
                    <div class="row g-4" style="max-width: 780px;">
                        <!-- Webhook section -->
                        <div class="col-md-6 border-end">
                            <h6 class="fw-bold mb-3 text-warning">
                                <i class="fa-solid fa-envelope-open me-2"></i>事件回调 (Webhook)
                            </h6>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.webhook_urls') || 'Webhook 接收端点 (每行一个)' }}</label>
                                <textarea class="form-control font-monospace small" rows="7" v-model="webhookText" :placeholder="'http://example.com/webhook'"></textarea>
                                <div class="form-text small opacity-75 mt-1" style="font-size: 0.7rem;">
                                    {{ $t('panel_settings.webhook_desc') || '当服务器启动、停止、崩溃或有玩家进出游戏时，面板会向这些 URL 发送 POST 事件通知。' }}
                                </div>
                            </div>
                        </div>
                        <!-- AI Section -->
                        <div class="col-md-6">
                            <h6 class="fw-bold mb-3 text-info">
                                <i class="fa-solid fa-robot me-2"></i>{{ $t('panel_settings.ai_settings') }}
                            </h6>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_endpoint') }}</label>
                                <input type="text" class="form-control" v-model="config.aiEndpoint" :placeholder="$t('panel_settings.ai_endpoint_desc')">
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_key') }}</label>
                                <input type="password" class="form-control" v-model="config.aiKey" :placeholder="$t('panel_settings.ai_key_desc')">
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_model') }}</label>
                                <input type="text" class="form-control" v-model="config.aiModel" :placeholder="$t('panel_settings.ai_model_placeholder')">
                            </div>
                            <div class="d-grid mt-3">
                                <button class="btn btn-outline-info btn-sm fw-bold" @click="testAI" :disabled="testingAI">
                                    <span v-if="testingAI" class="spinner-border spinner-border-sm me-2"></span>
                                    <i v-else class="fa-solid fa-vial me-2"></i>{{ $t('panel_settings.ai_test') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Appearance Panel -->
                <div v-show="activeSettingsTab === 'appearance'" class="animate-in">
                    <h5 class="fw-bold mb-4 d-flex align-items-center" style="color: var(--c-accent);">
                        <i class="fa-solid fa-palette me-2"></i>
                        {{ $t('panel_settings.appearance') }}
                    </h5>
                    
                    <div class="d-flex border-bottom mb-4 gap-1 overflow-auto" style="flex-shrink: 0;">
                        <button v-for="tab in appearanceTabs" :key="tab.id" class="btn btn-sm px-3 py-2 fw-bold rounded-top border-0" 
                            :class="activeAppearanceTab === tab.id ? 'btn-primary shadow-sm' : 'btn-link text-muted'" 
                            @click="activeAppearanceTab = tab.id" style="font-size: 0.8rem; border-radius: 8px 8px 0 0 !important;">
                            <i class="fa-solid me-1" :class="tab.icon"></i><span>{{ $t(tab.labelKey) }}</span>
                        </button>
                    </div>

                    <div class="p-1">
                        <div v-if="activeAppearanceTab === 'general'" class="row g-4">
                            <div class="col-md-7">
                                <div class="mb-3 mb-md-4">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.custom_logo') }}</label>
                                    <div class="d-flex align-items-center gap-3">
                                        <div class="appearance-preview rounded-3 border d-flex align-items-center justify-content-center" style="width: 48px; height: 48px; overflow: hidden; flex-shrink: 0; background: var(--c-surface-elevated);">
                                            <img v-if="appearance.logoPreview" :src="appearance.logoPreview" style="width: 100%; height: 100%; object-fit: contain;">
                                            <i v-else class="fa-solid fa-image text-muted" style="font-size: 1.2rem;"></i>
                                        </div>
                                        <div class="d-flex gap-2 flex-grow-1">
                                            <button class="btn btn-outline-primary btn-sm flex-grow-1" @click="triggerLogoUpload">
                                                <i class="fa-solid fa-upload me-1"></i>{{ $t('panel_settings.upload') }}
                                            </button>
                                            <button v-if="appearance.logoPreview" class="btn btn-outline-danger btn-sm" @click="removeLogo">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                        <input type="file" ref="logoInput" class="d-none" accept="image/*" @change="handleLogoUpload">
                                    </div>
                                    <div class="form-text small opacity-75 mt-1" style="font-size: 0.7rem;">{{ $t('panel_settings.logo_desc') }}</div>
                                </div>

                                <div class="mb-3 mb-md-4">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.background_image') }}</label>
                                    <div class="d-flex align-items-center gap-3">
                                        <div class="appearance-preview rounded-3 border d-flex align-items-center justify-content-center" style="width: 48px; height: 48px; overflow: hidden; flex-shrink: 0; background: var(--c-surface-elevated);">
                                            <img v-if="appearance.bgPreview" :src="appearance.bgPreview" style="width: 100%; height: 100%; object-fit: cover;">
                                            <i v-else class="fa-solid fa-panorama text-muted" style="font-size: 1.2rem;"></i>
                                        </div>
                                        <div class="d-flex gap-2 flex-grow-1">
                                            <button class="btn btn-outline-primary btn-sm flex-grow-1" @click="triggerBgUpload">
                                                <i class="fa-solid fa-upload me-1"></i>{{ $t('panel_settings.upload') }}
                                            </button>
                                            <button v-if="appearance.bgPreview" class="btn btn-outline-danger btn-sm" @click="removeBackground">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                        <input type="file" ref="bgInput" class="d-none" accept="image/*" @change="handleBgUpload">
                                    </div>
                                    <div class="form-text small opacity-75 mt-1" style="font-size: 0.7rem;">{{ $t('panel_settings.background_desc') }}</div>
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="appearance-preview-box w-100 rounded-4 overflow-hidden border" style="height: 180px; position: relative; background: var(--c-bg);">
                                    <div v-if="appearance.bgPreview" class="appearance-bg-layer" :style="{ backgroundImage: 'url(' + appearance.bgPreview + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                                    <div class="d-flex h-100">
                                        <div class="appearance-sidebar-preview" :style="{ opacity: appearance.sidebarOpacity }">
                                            <div class="px-2 py-2">
                                                <div class="d-flex align-items-center gap-2 mb-2 px-1">
                                                    <div style="width: 20px; height: 20px; border-radius: 6px; background: var(--c-accent); flex-shrink: 0;"></div>
                                                    <div style="width: 40px; height: 6px; border-radius: 3px; background: var(--c-text-secondary);"></div>
                                                </div>
                                                <div v-for="i in 5" :key="i" class="d-flex align-items-center gap-2 mb-1 px-1 py-1 rounded" :style="{ background: i === 1 ? 'var(--c-accent-muted)' : 'transparent' }">
                                                    <div style="width: 12px; height: 12px; border-radius: 3px; background: var(--c-text-tertiary); flex-shrink: 0;"></div>
                                                    <div style="width: 30px; height: 4px; border-radius: 2px; background: var(--c-text-tertiary);"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex-grow-1 p-2" :style="{ opacity: appearance.contentOpacity }">
                                            <div class="rounded-3 p-2 mb-2" :style="{ opacity: appearance.cardOpacity, background: 'var(--c-surface)' }">
                                                <div style="width: 50px; height: 5px; border-radius: 3px; background: var(--c-text-secondary); margin-bottom: 6px;"></div>
                                                <div style="width: 100%; height: 4px; border-radius: 2px; background: var(--c-border); margin-bottom: 4px;"></div>
                                                <div style="width: 80%; height: 4px; border-radius: 2px; background: var(--c-border);"></div>
                                            </div>
                                            <div class="rounded-3 p-2" :style="{ opacity: appearance.cardOpacity, background: 'var(--c-surface)' }">
                                                <div style="width: 40px; height: 5px; border-radius: 3px; background: var(--c-text-secondary); margin-bottom: 6px;"></div>
                                                <div style="width: 90%; height: 4px; border-radius: 2px; background: var(--c-border); margin-bottom: 4px;"></div>
                                                <div style="width: 60%; height: 4px; border-radius: 2px; background: var(--c-border);"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="activeAppearanceTab === 'login'" class="row g-4">
                            <div class="col-md-7">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.login_opacity') }} <span class="opacity-75">({{ Math.round(appearance.loginOpacity * 100) }}%)</span></label>
                                    <input type="range" class="form-range" v-model.number="appearance.loginOpacity" min="0.3" max="1" step="0.05">
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="appearance-preview-box w-100 rounded-4 overflow-hidden border" style="height: 180px; position: relative; background: var(--c-bg);">
                                    <div v-if="appearance.bgPreview" class="appearance-bg-layer" :style="{ backgroundImage: 'url(' + appearance.bgPreview + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                                    <div class="d-flex align-items-center justify-content-center h-100">
                                        <div class="rounded-4 p-3 text-center" :style="{ opacity: appearance.loginOpacity, background: 'var(--c-surface)', width: '60%' }">
                                            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--c-accent); margin: 0 auto 6px;"></div>
                                            <div style="width: 60%; height: 4px; border-radius: 2px; background: var(--c-text-secondary); margin: 0 auto 8px;"></div>
                                            <div style="width: 100%; height: 6px; border-radius: 3px; background: var(--c-border); margin-bottom: 6px;"></div>
                                            <div style="width: 80%; height: 6px; border-radius: 3px; background: var(--c-accent);"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="activeAppearanceTab === 'instance-list'" class="row g-4">
                            <div class="col-md-7">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.instance_opacity') }} <span class="opacity-75">({{ Math.round(appearance.instanceOpacity * 100) }}%)</span></label>
                                    <input type="range" class="form-range" v-model.number="appearance.instanceOpacity" min="0.3" max="1" step="0.05">
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="appearance-preview-box w-100 rounded-4 overflow-hidden border" style="height: 180px; position: relative; background: var(--c-bg);">
                                    <div v-if="appearance.bgPreview" class="appearance-bg-layer" :style="{ backgroundImage: 'url(' + appearance.bgPreview + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                                    <div class="p-2 h-100" :style="{ opacity: appearance.instanceOpacity }">
                                        <div style="height: 8px; background: var(--c-surface); border-radius: 4px; margin-bottom: 6px;"></div>
                                        <div class="d-flex gap-1">
                                            <div style="flex: 1; height: 50px; background: var(--c-surface); border-radius: 6px;"></div>
                                            <div style="flex: 1; height: 50px; background: var(--c-surface); border-radius: 6px;"></div>
                                            <div style="flex: 1; height: 50px; background: var(--c-surface); border-radius: 6px;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="activeAppearanceTab === 'instance-detail'" class="row g-4">
                            <div class="col-md-7">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.sidebar_opacity') }} <span class="opacity-75">({{ Math.round(appearance.sidebarOpacity * 100) }}%)</span></label>
                                    <input type="range" class="form-range" v-model.number="appearance.sidebarOpacity" min="0.3" max="1" step="0.05">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.content_opacity') }} <span class="opacity-75">({{ Math.round(appearance.contentOpacity * 100) }}%)</span></label>
                                    <input type="range" class="form-range" v-model.number="appearance.contentOpacity" min="0.3" max="1" step="0.05">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.card_opacity') }} <span class="opacity-75">({{ Math.round(appearance.cardOpacity * 100) }}%)</span></label>
                                    <input type="range" class="form-range" v-model.number="appearance.cardOpacity" min="0.3" max="1" step="0.05">
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="appearance-preview-box w-100 rounded-4 overflow-hidden border" style="height: 180px; position: relative; background: var(--c-bg);">
                                    <div v-if="appearance.bgPreview" class="appearance-bg-layer" :style="{ backgroundImage: 'url(' + appearance.bgPreview + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                                    <div class="d-flex h-100">
                                        <div class="appearance-sidebar-preview" :style="{ opacity: appearance.sidebarOpacity }">
                                            <div class="px-2 py-2">
                                                <div class="d-flex align-items-center gap-2 mb-2 px-1">
                                                    <div style="width: 20px; height: 20px; border-radius: 6px; background: var(--c-accent); flex-shrink: 0;"></div>
                                                    <div style="width: 40px; height: 6px; border-radius: 3px; background: var(--c-text-secondary);"></div>
                                                </div>
                                                <div v-for="i in 5" :key="i" class="d-flex align-items-center gap-2 mb-1 px-1 py-1 rounded" :style="{ background: i === 1 ? 'var(--c-accent-muted)' : 'transparent' }">
                                                    <div style="width: 12px; height: 12px; border-radius: 3px; background: var(--c-text-tertiary); flex-shrink: 0;"></div>
                                                    <div style="width: 30px; height: 4px; border-radius: 2px; background: var(--c-text-tertiary);"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex-grow-1 p-2" :style="{ opacity: appearance.contentOpacity }">
                                            <div class="rounded-3 p-2 mb-2" :style="{ opacity: appearance.cardOpacity, background: 'var(--c-surface)' }">
                                                <div style="width: 50px; height: 5px; border-radius: 3px; background: var(--c-text-secondary); margin-bottom: 6px;"></div>
                                                <div style="width: 100%; height: 4px; border-radius: 2px; background: var(--c-border); margin-bottom: 4px;"></div>
                                                <div style="width: 80%; height: 4px; border-radius: 2px; background: var(--c-border);"></div>
                                            </div>
                                            <div class="rounded-3 p-2" :style="{ opacity: appearance.cardOpacity, background: 'var(--c-surface)' }">
                                                <div style="width: 40px; height: 5px; border-radius: 3px; background: var(--c-text-secondary); margin-bottom: 6px;"></div>
                                                <div style="width: 90%; height: 4px; border-radius: 2px; background: var(--c-border); margin-bottom: 4px;"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="activeAppearanceTab === 'other'" class="row g-4">
                            <div class="col-md-7">
                                <p class="text-muted small mb-4">{{ $t('panel_settings.other_interfaces_desc') }}</p>
                                
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.sidebar_opacity') }} <span class="opacity-75">({{ Math.round(appearance.sidebarOpacity * 100) }}%)</span></label>
                                    <input type="range" class="range-sm form-range" v-model.number="appearance.sidebarOpacity" min="0.3" max="1" step="0.05">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.content_opacity') }} <span class="opacity-75">({{ Math.round(appearance.contentOpacity * 100) }}%)</span></label>
                                    <input type="range" class="range-sm form-range" v-model.number="appearance.contentOpacity" min="0.3" max="1" step="0.05">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.card_opacity') }} <span class="opacity-75">({{ Math.round(appearance.cardOpacity * 100) }}%)</span></label>
                                    <input type="range" class="range-sm form-range" v-model.number="appearance.cardOpacity" min="0.3" max="1" step="0.05">
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="appearance-preview-box w-100 rounded-4 overflow-hidden border d-flex align-items-center justify-content-center" style="height: 180px; position: relative; background: var(--c-bg);">
                                    <div v-if="appearance.bgPreview" class="appearance-bg-layer" :style="{ backgroundImage: 'url(' + appearance.bgPreview + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"></div>
                                    <div class="d-flex h-100 w-100">
                                        <div class="appearance-sidebar-preview" :style="{ opacity: appearance.sidebarOpacity, width: '40px' }"></div>
                                        <div class="flex-grow-1 p-3">
                                            <div class="rounded-3 p-3 mb-2" :style="{ opacity: appearance.cardOpacity, background: 'var(--c-surface)' }">
                                                <div class="text-center" :style="{ opacity: appearance.contentOpacity }">
                                                    <i class="fa-solid fa-puzzle-piece text-muted mb-2" style="font-size: 1.2rem;"></i>
                                                    <div style="width: 40px; height: 4px; border-radius: 2px; background: var(--c-border); margin: 0 auto;"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
    `,
    setup() {
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;

        const loading = ref(true);
        const saving = ref(false);
        const testingAI = ref(false);
        const updatingAccount = ref(false);
        const accountForm = reactive({
            username: '',
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: ''
        });

        const config = reactive({
            port: 3000,
            defaultLang: 'zh',
            theme: 'auto',
            consoleInfoPosition: 'top',
            jarName: '',
            javaArgs: [],
            webhooks: [],
            secret: '',
            sessionTimeout: 7,
            maxLogHistory: 1000,
            monitorInterval: 2000,
            aiEndpoint: '',
            aiKey: '',
            aiModel: '',
            githubProxy: ''
        });

        const javaArgsText = ref('');
        const webhookText = ref('');
        const jars = ref([]);
        const instances = ref([]);
        const javaList = ref([]);

        const logoInput = ref(null);
        const bgInput = ref(null);
        const appearance = reactive({
            logoPreview: '',
            bgPreview: '',
            sidebarOpacity: 1,
            contentOpacity: 1,
            cardOpacity: 1,
            loginOpacity: 1,
            instanceOpacity: 1
        });

        const activeAppearanceTab = ref('general');
        const appearanceTabs = [
            { id: 'general', icon: 'fa-palette', labelKey: 'panel_settings.tab_general' },
            { id: 'login', icon: 'fa-right-to-bracket', labelKey: 'panel_settings.tab_login' },
            { id: 'instance-list', icon: 'fa-server', labelKey: 'panel_settings.tab_instance_list' },
            { id: 'instance-detail', icon: 'fa-terminal', labelKey: 'panel_settings.tab_instance_detail' },
            { id: 'other', icon: 'fa-puzzle-piece', labelKey: 'panel_settings.tab_other' }
        ];

        const activeSettingsTab = ref('basic');
        const settingsTabs = computed(() => [
            { id: 'basic', label: $t('panel_settings.basic') || '基本设置', icon: 'fa-sliders' },
            { id: 'security', label: $t('panel_settings.security') || '安全与认证', icon: 'fa-shield-halved' },
            { id: 'account', label: $t('panel_settings.account_mgmt') || '账户管理', icon: 'fa-user-gear' },
            { id: 'integrations', label: '集成与回调 (Integrations)', icon: 'fa-link' },
            { id: 'appearance', label: $t('panel_settings.appearance') || '个性化外观', icon: 'fa-palette' }
        ]);

        const triggerLogoUpload = () => logoInput.value.click();
        const triggerBgUpload = () => bgInput.value.click();

        const handleLogoUpload = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('type', 'logo');
                await api.post('/api/appearance/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                appearance.logoPreview = '/api/appearance/logo?t=' + Date.now();
                showToast($t('panel_settings.upload_success'), 'success');
            } catch (err) {
                showToast($t('common.error') + ': ' + (err.response?.data?.error || err.message), 'danger');
            }
            e.target.value = '';
        };

        const handleBgUpload = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('type', 'background');
                await api.post('/api/appearance/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                appearance.bgPreview = '/api/appearance/background?t=' + Date.now();
                showToast($t('panel_settings.upload_success'), 'success');
            } catch (err) {
                showToast($t('common.error') + ': ' + (err.response?.data?.error || err.message), 'danger');
            }
            e.target.value = '';
        };

        const removeLogo = async () => {
            try {
                await api.delete('/api/appearance/upload', { data: { type: 'logo' } });
                appearance.logoPreview = '';
                showToast($t('common.success'), 'success');
            } catch (err) {
                showToast($t('common.error'), 'danger');
            }
        };

        const removeBackground = async () => {
            try {
                await api.delete('/api/appearance/upload', { data: { type: 'background' } });
                appearance.bgPreview = '';
                showToast($t('common.success'), 'success');
            } catch (err) {
                showToast($t('common.error'), 'danger');
            }
        };

        const loadAppearance = async () => {
            try {
                await api.get('/api/appearance/logo');
                appearance.logoPreview = '/api/appearance/logo?t=' + Date.now();
            } catch (_) { }
            try {
                await api.get('/api/appearance/background');
                appearance.bgPreview = '/api/appearance/background?t=' + Date.now();
            } catch (_) { }
        };

        const loadJars = async () => {
            try {
                const res = await api.get('/api/panel/jars');
                jars.value = res.data;
            } catch (e) {
                console.error('Failed to load jars:', e);
            }
        };



        const loadInstances = async () => {
            try {
                const res = await api.get('/api/instances/list');
                instances.value = res.data.instances || res.data;
            } catch (e) { }
        };

        const loadJavaList = async () => {
            try {
                const res = await api.get('/api/java/installed');
                javaList.value = res.data;
            } catch (e) { }
        };





        const loadConfig = async () => {
            try {
                loading.value = true;
                const res = await api.get('/api/panel/config');
                Object.assign(config, res.data);
                accountForm.username = res.data.username || 'admin';
                javaArgsText.value = (config.javaArgs || []).join('\n');
                webhookText.value = (config.webhooks || []).join('\n');

                if (res.data.appearance) {
                    appearance.sidebarOpacity = res.data.appearance.sidebarOpacity ?? 1;
                    appearance.contentOpacity = res.data.appearance.contentOpacity ?? 1;
                    appearance.cardOpacity = res.data.appearance.cardOpacity ?? 1;
                    appearance.loginOpacity = res.data.appearance.loginOpacity ?? 1;
                    appearance.instanceOpacity = res.data.appearance.instanceOpacity ?? 1;
                }

                const currentTheme = localStorage.getItem('theme');
                const currentLang = localStorage.getItem('lang');

                if (currentTheme && config.theme !== currentTheme && config.theme === 'auto') {
                    config.theme = currentTheme;
                }
                if (currentLang && config.defaultLang !== currentLang) {
                    config.defaultLang = currentLang;
                }
            } catch (e) {
                showToast($t('common.error') + ': ' + (e.response?.data?.error || e.message), 'danger');
            } finally {
                loading.value = false;
            }
        };

        const saveConfig = async () => {
            try {
                saving.value = true;
                config.javaArgs = javaArgsText.value.split('\n').map(s => s.trim()).filter(s => s);
                config.webhooks = webhookText.value.split('\n').map(s => s.trim()).filter(s => s);
                config.appearance = {
                    sidebarOpacity: appearance.sidebarOpacity,
                    contentOpacity: appearance.contentOpacity,
                    cardOpacity: appearance.cardOpacity,
                    loginOpacity: appearance.loginOpacity,
                    instanceOpacity: appearance.instanceOpacity
                };
                const res = await api.post('/api/panel/config', config);

                if (res.data.success) {
                    if (config.theme && config.theme !== 'auto') {
                        document.documentElement.setAttribute('data-bs-theme', config.theme);
                        localStorage.setItem('theme', config.theme);
                    }
                    if (config.defaultLang) {
                        const { store } = await import('../store.js');
                        store.lang = config.defaultLang;
                        localStorage.setItem('lang', config.defaultLang);
                    }

                    // Sync consoleInfoPosition to global store immediately
                    const { store } = await import('../store.js');
                    store.consoleInfoPosition = config.consoleInfoPosition;

                    Object.assign(savedAppearance, {
                        sidebarOpacity: appearance.sidebarOpacity,
                        contentOpacity: appearance.contentOpacity,
                        cardOpacity: appearance.cardOpacity,
                        loginOpacity: appearance.loginOpacity,
                        instanceOpacity: appearance.instanceOpacity
                    });

                    showToast($t('panel_settings.save_success'), 'success');

                    openModal({
                        title: $t('panel_settings.restart_required'),
                        message: $t('panel_settings.restart_confirm'),
                        callback: async () => {
                            try {
                                const currentPort = window.location.port || '80';
                                const newPort = config.port.toString();
                                const portChanged = currentPort !== newPort;
                                await api.post('/api/panel/restart');
                                showToast($t('panel_settings.restarting'), 'info');
                                
                                await waitForPanel(portChanged ? newPort : null);
                                if (portChanged) {
                                    const protocol = window.location.protocol;
                                    const hostname = window.location.hostname;
                                    window.location.href = `${protocol}//${hostname}:${newPort}`;
                                } else {
                                    window.location.reload();
                                }
                            } catch (e) {
                                showToast($t('common.error'), 'danger');
                            }
                        }
                    });
                }
            } catch (e) {
                showToast($t('panel_settings.validation_error') + ': ' + (e.response?.data?.error || e.message), 'danger');
            } finally {
                saving.value = false;
            }
        };

        const testAI = async () => {
            if (!config.aiEndpoint || !config.aiModel) {
                showToast($t('panel_settings.validation_error'), 'warning');
                return;
            }
            testingAI.value = true;
            try {
                await api.post('/api/panel/ai/test', {
                    aiEndpoint: config.aiEndpoint,
                    aiKey: config.aiKey,
                    aiModel: config.aiModel
                });
                showToast($t('panel_settings.ai_test_success'), 'success');
            } catch (e) {
                showToast($t('panel_settings.ai_test_fail') + ': ' + (e.response?.data?.error || e.message), 'danger');
            } finally {
                testingAI.value = false;
            }
        };

        const reset2FA = () => {
            openModal({
                title: $t('panel_settings.reset_2fa'),
                message: $t('panel_settings.reset_2fa_confirm'),
                callback: async () => {
                    try {
                        const res = await api.get('/api/panel/2fa/generate');
                        const { secret, qr } = res.data;
                        const verifyFlow = () => {
                            setTimeout(() => {
                                openModal({
                                    title: $t('panel_settings.reset_2fa_setup'),
                                    message: `
                                        <div class="text-center">
                                            <p>${$t('panel_settings.reset_2fa_instruction')}</p>
                                            <img src="${qr}" class="img-fluid mb-2" style="max-width: 250px;">
                                            <p class="text-muted small user-select-all">${secret}</p>
                                        </div>
                                    `,
                                    mode: 'input',
                                    placeholder: '6-digit Code',
                                    callback: async (code) => {
                                        if (!code) return;
                                        try {
                                            await api.post('/api/panel/2fa/verify', { secret, token: code });
                                            showToast($t('panel_settings.reset_2fa_success'), 'success');
                                            loadConfig();
                                        } catch (e) {
                                            showToast($t('common.error') + ': ' + (e.response?.data?.error || 'Invalid Code'), 'danger');
                                            verifyFlow();
                                        }
                                    }
                                });
                            }, 300);
                        };
                        verifyFlow();
                    } catch (e) {
                        showToast($t('common.error') + ': ' + (e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        const updateAccount = async () => {
            if (!accountForm.username) {
                showToast($t('login.placeholder_user'), 'warning');
                return;
            }
            if (!accountForm.currentPassword) {
                showToast($t('panel_settings.current_pass'), 'warning');
                return;
            }
            if (accountForm.newPassword && accountForm.newPassword.length < 6) {
                showToast($t('login.placeholder_pass') + ' (>= 6 chars)', 'warning');
                return;
            }
            if (accountForm.newPassword !== accountForm.confirmNewPassword) {
                showToast($t('login.mismatch_pass'), 'warning');
                return;
            }

            updatingAccount.value = true;
            try {
                const res = await api.post('/api/panel/account/update', {
                    username: accountForm.username,
                    currentPassword: accountForm.currentPassword,
                    newPassword: accountForm.newPassword
                });
                if (res.data.success) {
                    showToast($t('panel_settings.account_update_success'), 'success');
                    accountForm.currentPassword = '';
                    accountForm.newPassword = '';
                    accountForm.confirmNewPassword = '';
                }
            } catch (err) {
                showToast($t('panel_settings.account_update_fail') + ': ' + (err.response?.data?.error || err.message), 'danger');
            } finally {
                updatingAccount.value = false;
            }
        };

        const disable2FA = () => {
            openModal({
                title: $t('panel_settings.disable_2fa'),
                message: $t('panel_settings.disable_2fa_confirm'),
                callback: async () => {
                    try {
                        const res = await api.post('/api/panel/2fa/disable');
                        if (res.data.success) {
                            showToast($t('common.success'), 'success');
                            loadConfig();
                        }
                    } catch (e) {
                        showToast($t('common.error') + ': ' + (e.response?.data?.error || e.message), 'danger');
                    }
                }
            });
        };

        onMounted(() => {
            loadConfigWithSave();
            loadJars();

            loadInstances();
            loadJavaList();
            loadAppearance();
        });

        const savedAppearance = reactive({
            sidebarOpacity: 1,
            contentOpacity: 1,
            cardOpacity: 1,
            loginOpacity: 1,
            instanceOpacity: 1
        });

        const applyAppearanceLive = () => {
            const root = document.documentElement;
            root.style.setProperty('--app-sidebar-opacity', appearance.sidebarOpacity);
            root.style.setProperty('--app-content-opacity', appearance.contentOpacity);
            root.style.setProperty('--app-card-opacity', appearance.cardOpacity);
            root.style.setProperty('--app-login-opacity', appearance.loginOpacity);
            root.style.setProperty('--app-instance-opacity', appearance.instanceOpacity);
        };

        const restoreAppearance = () => {
            const root = document.documentElement;
            root.style.setProperty('--app-sidebar-opacity', savedAppearance.sidebarOpacity);
            root.style.setProperty('--app-content-opacity', savedAppearance.contentOpacity);
            root.style.setProperty('--app-card-opacity', savedAppearance.cardOpacity);
            root.style.setProperty('--app-login-opacity', savedAppearance.loginOpacity);
            root.style.setProperty('--app-instance-opacity', savedAppearance.instanceOpacity);
        };

        const stopWatch = watch(
            () => [appearance.sidebarOpacity, appearance.contentOpacity, appearance.cardOpacity, appearance.loginOpacity, appearance.instanceOpacity],
            () => { applyAppearanceLive(); }
        );

        const originalLoadConfig = loadConfig;
        const loadConfigWithSave = async () => {
            await originalLoadConfig();
            Object.assign(savedAppearance, {
                sidebarOpacity: appearance.sidebarOpacity,
                contentOpacity: appearance.contentOpacity,
                cardOpacity: appearance.cardOpacity,
                loginOpacity: appearance.loginOpacity,
                instanceOpacity: appearance.instanceOpacity
            });
        };

        onUnmounted(() => {
            stopWatch();
            restoreAppearance();
        });

        return {
            store, loading, saving, testingAI, config, javaArgsText, webhookText, jars,
            saveConfig, testAI, reset2FA, disable2FA,
            updatingAccount, accountForm, updateAccount,
            appearance, activeAppearanceTab, appearanceTabs,
            logoInput, bgInput, triggerLogoUpload, triggerBgUpload,
            handleLogoUpload, handleBgUpload, removeLogo, removeBackground,
            activeSettingsTab, settingsTabs
        };
    }
};
