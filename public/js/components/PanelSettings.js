import { ref, reactive, computed, onMounted, onUnmounted, watch, getCurrentInstance } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, waitForPanel, uploadFileWithChunk, isLargeFile } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column animate-in overflow-hidden">
        <!-- 页面顶部 Header -->
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
                <button class="btn btn-primary btn-sm px-3 px-md-4 py-2 fw-bold shadow-sm d-flex align-items-center gap-2" @click="saveConfig" :disabled="saving">
                    <span v-if="saving" class="spinner-border spinner-border-sm"></span>
                    <i v-else class="fa-solid fa-floppy-disk"></i>
                    <span class="d-none d-md-inline">{{ $t('common.save') }}</span>
                </button>
            </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted fw-medium">{{ $t('common.loading') }}</p>
        </div>

        <!-- 设置主体自适应容器 -->
        <div v-else class="d-flex flex-grow-1 overflow-hidden settings-container">
            <!-- 优雅固定侧边栏 (Fixed Harmonious Sidebar) -->
            <div class="settings-sidebar d-flex flex-column p-3 h-100">
                <div class="settings-nav-section-title">设置导航</div>
                <div class="settings-sidebar-nav d-flex flex-column gap-1 mt-1">
                    <button v-for="tab in settingsTabs" :key="tab.id" 
                        class="btn w-100 settings-tab-btn d-flex align-items-center gap-2.5"
                        :class="{ active: activeSettingsTab === tab.id }"
                        @click="activeSettingsTab = tab.id">
                        <div class="settings-tab-icon">
                            <i class="fa-solid" :class="tab.icon"></i>
                        </div>
                        <span class="text-truncate">{{ tab.label }}</span>
                    </button>
                </div>
            </div>

            <!-- 右侧自适应居中内容区 (Harmonized Centered Content Area) -->
            <div class="settings-content-area custom-scrollbar">
                <div class="settings-content-wrapper">
                
                    <!-- 1. 基本设置 Panel -->
                    <div v-show="activeSettingsTab === 'basic'" class="animate-in">
                        <div class="settings-panel-header d-flex align-items-center gap-3">
                            <div class="settings-header-icon">
                                <i class="fa-solid fa-sliders"></i>
                            </div>
                            <div>
                                <h4 class="settings-panel-title">{{ $t('panel_settings.basic') }}</h4>
                                <p class="settings-panel-subtitle">配置面板核心运行参数、监听端口、显示语言及主题偏好</p>
                            </div>
                        </div>

                        <!-- 卡片 1: 服务与网络 -->
                        <div class="settings-card">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-solid fa-network-wired text-primary"></i>网络与服务配置
                                </h6>
                                <p class="settings-card-desc">面板对外服务的网络接口、端口及控制台日志展示偏好</p>
                            </div>
                            <div class="settings-card-body">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.host') }}</label>
                                        <div class="input-group">
                                            <span class="input-group-text"><i class="fa-solid fa-server text-muted"></i></span>
                                            <input type="text" class="form-control" v-model="config.host" placeholder="0.0.0.0">
                                        </div>
                                        <div class="d-flex gap-2 mt-1">
                                            <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 small" style="font-size: 0.75rem;" @click="config.host = '0.0.0.0'">{{ $t('panel_settings.host_all') }}</button>
                                            <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 small" style="font-size: 0.75rem;" @click="config.host = '127.0.0.1'">{{ $t('panel_settings.host_local') }}</button>
                                        </div>
                                        <div class="form-text small opacity-75 mt-1">{{ $t('panel_settings.host_desc') }}</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.port') }}</label>
                                        <div class="input-group">
                                            <span class="input-group-text"><i class="fa-solid fa-plug text-muted"></i></span>
                                            <input type="number" class="form-control" v-model.number="config.port" min="1024" max="65535">
                                        </div>
                                        <div class="form-text small opacity-75 mt-1">{{ $t('panel_settings.port_desc') }}</div>
                                    </div>
                                    <div class="col-12" v-if="lanIps && lanIps.length">
                                        <div class="alert alert-light border py-2 px-3 mb-0 small text-muted d-flex align-items-center flex-wrap gap-2">
                                            <i class="fa-solid fa-circle-info text-info"></i>
                                            <span>{{ $t('panel_settings.lan_addresses') }}:</span>
                                            <span v-for="ip in lanIps" :key="ip" class="badge bg-secondary bg-opacity-25 text-body font-monospace">http://{{ ip }}:{{ config.port }}</span>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.console_info_position') }}</label>
                                        <CustomSelect v-model="config.consoleInfoPosition" :options="[{value: 'top', label: $t('panel_settings.pos_top')}, {value: 'sidebar', label: $t('panel_settings.pos_sidebar')}]" />
                                        <div class="form-text small opacity-75 mt-1">控制实例详情页中性能数据的呈现位置</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 卡片 2: 界面偏好与语言 -->
                        <div class="settings-card">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-solid fa-language text-info"></i>界面偏好与语言
                                </h6>
                                <p class="settings-card-desc">个性化设定面板界面的默认系统语言与明暗色彩主题</p>
                            </div>
                            <div class="settings-card-body">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.default_lang') }}</label>
                                        <CustomSelect v-model="config.defaultLang" :options="[{value: 'zh', label: '中文'}, {value: 'en', label: 'English'}]" />
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.theme') }}</label>
                                        <CustomSelect v-model="config.theme" :options="[{value: 'light', label: $t('panel_settings.theme_light')}, {value: 'dark', label: $t('panel_settings.theme_dark')}, {value: 'auto', label: $t('panel_settings.theme_auto')}]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 卡片 3: GitHub 代理加速 -->
                        <div class="settings-card" style="position: relative; z-index: 5;">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-brands fa-github text-secondary"></i>GitHub 代理加速通道
                                </h6>
                                <p class="settings-card-desc">{{ $t('panel_settings.github_proxy_desc') }}</p>
                            </div>
                            <div class="settings-card-body">
                                <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.github_proxy') }}</label>
                                <div class="input-group">
                                    <button class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-1" type="button" data-bs-toggle="dropdown" data-bs-boundary="viewport" aria-expanded="false">
                                        <i class="fa-solid fa-bolt-lightning text-warning"></i>
                                        <span>快速选择</span>
                                    </button>
                                    <ul class="dropdown-menu shadow border" style="max-height: 290px; overflow-y: auto; z-index: 1050; min-width: 260px;">
                                         <li><a class="dropdown-item small py-2 px-3 fw-medium" href="#" @click.prevent="config.githubProxy = ''"><i class="fa-solid fa-ban me-2 opacity-50"></i>{{ $t('common.disabled') }} (不使用代理)</a></li>
                                         <li><hr class="dropdown-divider opacity-50"></li>
                                         <li><a class="dropdown-item small py-2 px-3 fw-medium d-flex justify-content-between align-items-center" href="#" @click.prevent="config.githubProxy = 'https://hk.gh-proxy.org'"><span>hk.gh-proxy.org</span><span class="badge bg-success-subtle text-success ms-2">高速 (香港)</span></a></li>
                                         <li><a class="dropdown-item small py-2 px-3 fw-medium d-flex justify-content-between align-items-center" href="#" @click.prevent="config.githubProxy = 'https://ghfast.top'"><span>ghfast.top</span><span class="badge bg-primary-subtle text-primary ms-2">推荐</span></a></li>
                                         <li><a class="dropdown-item small py-2 px-3 fw-medium d-flex justify-content-between align-items-center" href="#" @click.prevent="config.githubProxy = 'https://ghproxy.net'"><span>ghproxy.net</span><span class="badge bg-info-subtle text-info ms-2">稳定</span></a></li>
                                         <li><a class="dropdown-item small py-2 px-3 fw-medium d-flex justify-content-between align-items-center" href="#" @click.prevent="config.githubProxy = 'https://gh.ddlc.top'"><span>gh.ddlc.top</span><span class="badge bg-secondary-subtle text-secondary ms-2">边缘</span></a></li>
                                         <li><a class="dropdown-item small py-2 px-3 fw-medium d-flex justify-content-between align-items-center" href="#" @click.prevent="config.githubProxy = 'https://hub.gitmirror.com'"><span>hub.gitmirror.com</span><span class="badge bg-secondary-subtle text-secondary ms-2">加速</span></a></li>
                                         <li><a class="dropdown-item small py-2 px-3 fw-medium d-flex justify-content-between align-items-center" href="#" @click.prevent="config.githubProxy = 'https://mirror.ghproxy.com'"><span>mirror.ghproxy.com</span><span class="badge bg-secondary-subtle text-secondary ms-2">经典</span></a></li>
                                     </ul>
                                    <input type="text" class="form-control" v-model="config.githubProxy" :placeholder="$t('panel_settings.github_proxy_desc')">
                                </div>
                                <div class="form-text small opacity-75 mt-1.5">支持填入自定义的反代地址，以 https:// 开头</div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. 安全设置 Panel -->
                    <div v-show="activeSettingsTab === 'security'" class="animate-in">
                        <div class="settings-panel-header d-flex align-items-center gap-3">
                            <div class="settings-header-icon" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);">
                                <i class="fa-solid fa-shield-halved"></i>
                            </div>
                            <div>
                                <h4 class="settings-panel-title">{{ $t('panel_settings.security') }}</h4>
                                <p class="settings-panel-subtitle">增强控制台防御，配置两步身份验证 (2FA/TOTP) 及会话生命周期</p>
                            </div>
                        </div>

                        <!-- 2FA 卡片 -->
                        <div class="settings-card">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-solid fa-mobile-screen-button text-success"></i>两步验证 (2FA / TOTP)
                                </h6>
                                <p class="settings-card-desc">为管理员登录启用动态验证码二次验证，杜绝暴力破解威胁</p>
                            </div>
                            <div class="settings-card-body">
                                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 p-3 rounded-3 border bg-surface" style="border-color: var(--c-border) !important;">
                                    <div class="d-flex align-items-center gap-3">
                                        <div class="rounded-circle d-flex align-items-center justify-content-center" :class="config.secret ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'" style="width: 44px; height: 44px; flex-shrink: 0;">
                                            <i class="fa-solid" :class="config.secret ? 'fa-shield-check' : 'fa-shield-xmark'" style="font-size: 1.3rem;"></i>
                                        </div>
                                        <div>
                                            <div class="fw-bold d-flex align-items-center gap-2">
                                                <span>双重认证状态</span>
                                                <span v-if="config.secret" class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20 px-2 py-0.5" style="font-size: 0.72rem;">已保护</span>
                                                <span v-else class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-20 px-2 py-0.5" style="font-size: 0.72rem;">未启用</span>
                                            </div>
                                            <div class="small text-muted mt-0.5">
                                                {{ config.secret ? '管理员已绑定 2FA 认证器 (密钥已隐藏受保护)' : '尚未绑定认证器应用 (推荐使用 Google Authenticator 或 微软认证器)' }}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-outline-success btn-sm px-3 py-1.5 fw-semibold d-flex align-items-center gap-1.5" @click="reset2FA">
                                            <i class="fa-solid fa-qrcode"></i>
                                            <span>{{ config.secret ? $t('panel_settings.reset_2fa') : $t('panel_settings.enable_2fa') }}</span>
                                        </button>
                                        <button v-if="config.secret" class="btn btn-outline-danger btn-sm px-3 py-1.5 fw-semibold d-flex align-items-center gap-1.5" @click="disable2FA">
                                            <i class="fa-solid fa-trash-can"></i>
                                            <span>{{ $t('panel_settings.disable_2fa') }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 会话超时卡片 -->
                        <div class="settings-card">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-solid fa-stopwatch text-warning"></i>会话安全与有效期
                                </h6>
                                <p class="settings-card-desc">配置登录凭证在客户端的有效期，超时后需重新输入凭证登录</p>
                            </div>
                            <div class="settings-card-body">
                                <div class="row g-3 align-items-center">
                                    <div class="col-md-7">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.session_timeout') }}</label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" v-model.number="config.sessionTimeout" min="1" max="365">
                                            <span class="input-group-text">天 (Days)</span>
                                        </div>
                                        <div class="form-text small opacity-75 mt-1">建议设置为 7 到 30 天，兼顾安全性与免密便利</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. 账号管理 Panel (重点美化) -->
                    <div v-show="activeSettingsTab === 'account'" class="animate-in">
                        <div class="settings-panel-header d-flex align-items-center gap-3">
                            <div class="settings-header-icon" style="color: #6366f1; background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.2);">
                                <i class="fa-solid fa-user-gear"></i>
                            </div>
                            <div>
                                <h4 class="settings-panel-title">{{ $t('panel_settings.account_mgmt') }}</h4>
                                <p class="settings-panel-subtitle">管理面板超级管理员账户档案、修改登录用户名及安全访问密码</p>
                            </div>
                        </div>

                        <!-- 卡片 1: 管理员身份概览 (Profile Card) -->
                        <div class="settings-card">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-solid fa-id-badge text-primary"></i>管理员身份概览
                                </h6>
                                <p class="settings-card-desc">当前面板最高特权管理员账户信息</p>
                            </div>
                            <div class="settings-card-body">
                                <div class="d-flex flex-column flex-sm-row align-items-sm-center gap-4 mb-4">
                                    <div class="settings-avatar-badge">
                                        <span>{{ (accountForm.username || 'A').charAt(0).toUpperCase() }}</span>
                                    </div>
                                    <div class="flex-grow-1">
                                        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                            <span class="fw-bold fs-6">{{ accountForm.username || 'Admin' }}</span>
                                            <span class="settings-role-tag">
                                                <i class="fa-solid fa-crown text-warning"></i>超级管理员
                                            </span>
                                            <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20 px-2 py-0.5" style="font-size: 0.7rem;">全部特权</span>
                                        </div>
                                        <div class="text-muted small">拥有系统环境、网络监听、游戏实例生命周期及用户授权的完全管理权限</div>
                                    </div>
                                </div>

                                <div class="pt-3 border-top">
                                    <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.admin_user') }}</label>
                                    <div class="input-group" style="max-width: 480px;">
                                        <span class="input-group-text"><i class="fa-solid fa-at text-muted"></i></span>
                                        <input type="text" class="form-control" v-model="accountForm.username" placeholder="请输入管理员用户名">
                                    </div>
                                    <div class="form-text small opacity-75 mt-1">此用户名作为面板登录的超级管理员唯一账号</div>
                                </div>
                            </div>
                        </div>

                        <!-- 卡片 2: 密码与凭据修改 (Password Card) -->
                        <div class="settings-card">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-solid fa-key text-warning"></i>修改登录密码
                                </h6>
                                <p class="settings-card-desc">若仅修改管理员用户名，可将新密码项留空；如需更改密码，需验证当前密码</p>
                            </div>
                            <div class="settings-card-body">
                                <div class="row g-3" style="max-width: 680px;">
                                    <!-- 当前密码 -->
                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-muted">
                                            {{ $t('panel_settings.current_pass') }} <span class="text-danger">*</span>
                                        </label>
                                        <div class="input-group">
                                            <span class="input-group-text"><i class="fa-solid fa-lock text-muted"></i></span>
                                            <input :type="showPass.current ? 'text' : 'password'" class="form-control" v-model="accountForm.currentPassword" placeholder="输入当前正在使用的管理员密码">
                                            <button class="btn btn-outline-secondary" type="button" @click="showPass.current = !showPass.current">
                                                <i class="fa-solid" :class="showPass.current ? 'fa-eye-slash' : 'fa-eye'"></i>
                                            </button>
                                        </div>
                                        <div class="form-text small opacity-75 mt-1">任何账号信息变更均需验证当前密码，以确保账户安全</div>
                                    </div>

                                    <!-- 新密码 -->
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.new_pass') }}</label>
                                        <div class="input-group">
                                            <span class="input-group-text"><i class="fa-solid fa-shield-halved text-muted"></i></span>
                                            <input :type="showPass.next ? 'text' : 'password'" class="form-control" v-model="accountForm.newPassword" placeholder="留空表示不修改密码">
                                            <button class="btn btn-outline-secondary" type="button" @click="showPass.next = !showPass.next">
                                                <i class="fa-solid" :class="showPass.next ? 'fa-eye-slash' : 'fa-eye'"></i>
                                            </button>
                                        </div>
                                        <div class="form-text small opacity-75 mt-1">若修改，长度不能少于 6 位字符</div>
                                    </div>

                                    <!-- 确认新密码 -->
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.confirm_new_pass') }}</label>
                                        <div class="input-group">
                                            <span class="input-group-text"><i class="fa-solid fa-check text-muted"></i></span>
                                            <input :type="showPass.confirm ? 'text' : 'password'" class="form-control" v-model="accountForm.confirmNewPassword" placeholder="再次输入新密码以确认">
                                            <button class="btn btn-outline-secondary" type="button" @click="showPass.confirm = !showPass.confirm">
                                                <i class="fa-solid" :class="showPass.confirm ? 'fa-eye-slash' : 'fa-eye'"></i>
                                            </button>
                                        </div>
                                        <div class="form-text small opacity-75 mt-1">需与上方新密码输入完全一致</div>
                                    </div>
                                </div>
                            </div>
                            <div class="settings-card-footer">
                                <button class="btn btn-primary px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm" @click="updateAccount" :disabled="updatingAccount">
                                    <span v-if="updatingAccount" class="spinner-border spinner-border-sm"></span>
                                    <i v-else class="fa-solid fa-user-check"></i>
                                    <span>保存账号与密码变更</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 4. 集成与回调 Panel -->
                    <div v-show="activeSettingsTab === 'integrations'" class="animate-in">
                        <div class="settings-panel-header d-flex align-items-center gap-3">
                            <div class="settings-header-icon" style="color: #06b6d4; background: rgba(6, 182, 212, 0.1); border-color: rgba(6, 182, 212, 0.2);">
                                <i class="fa-solid fa-link"></i>
                            </div>
                            <div>
                                <h4 class="settings-panel-title">集成与回调 (Integrations)</h4>
                                <p class="settings-panel-subtitle">配置外部 Webhook 事件通知端点及 OpenAI 兼容的智能 AI 辅助服务</p>
                            </div>
                        </div>

                        <!-- Webhook 卡片 -->
                        <div class="settings-card">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-solid fa-envelope-open-text text-warning"></i>事件回调通知 (Webhook)
                                </h6>
                                <p class="settings-card-desc">当服务器启动、停止、崩溃或有玩家进出游戏时，面板会向这些 URL 发送 POST 事件通知</p>
                            </div>
                            <div class="settings-card-body">
                                <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.webhook_urls') || 'Webhook 接收端点 (每行一个)' }}</label>
                                <textarea class="form-control font-monospace small" rows="5" v-model="webhookText" placeholder="https://example.com/api/webhook&#10;https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."></textarea>
                                <div class="form-text small opacity-75 mt-1.5">支持多个端点，换行分隔。面板将以标准 JSON 格式投递事件 Payload。</div>
                            </div>
                        </div>

                        <!-- AI 服务卡片 -->
                        <div class="settings-card">
                            <div class="settings-card-header">
                                <h6 class="settings-card-title">
                                    <i class="fa-solid fa-robot text-info"></i>{{ $t('panel_settings.ai_settings') }}
                                </h6>
                                <p class="settings-card-desc">接入大语言模型，用于智能日志排错、游戏崩溃诊断与服主配置建议</p>
                            </div>
                            <div class="settings-card-body">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_endpoint') }}</label>
                                        <input type="text" class="form-control" v-model="config.aiEndpoint" :placeholder="$t('panel_settings.ai_endpoint_desc')">
                                        <div class="form-text small opacity-75 mt-1">例如 https://api.openai.com/v1</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_model') }}</label>
                                        <input type="text" class="form-control" v-model="config.aiModel" :placeholder="$t('panel_settings.ai_model_placeholder')">
                                        <div class="form-text small opacity-75 mt-1">例如 gpt-4o-mini 或 deepseek-chat</div>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-muted">{{ $t('panel_settings.ai_key') }}</label>
                                        <input type="password" class="form-control" v-model="config.aiKey" :placeholder="$t('panel_settings.ai_key_desc')">
                                        <div class="form-text small opacity-75 mt-1">如果接口为本地模型或无需 Key 可留空</div>
                                    </div>
                                </div>
                            </div>
                            <div class="settings-card-footer">
                                <button class="btn btn-outline-info btn-sm px-3 py-1.5 fw-bold d-flex align-items-center gap-2" @click="testAI" :disabled="testingAI">
                                    <span v-if="testingAI" class="spinner-border spinner-border-sm"></span>
                                    <i v-else class="fa-solid fa-vial"></i>
                                    <span>{{ $t('panel_settings.ai_test') }}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 5. 外观自定义 Panel -->
                    <div v-show="activeSettingsTab === 'appearance'" class="animate-in">
                        <div class="settings-panel-header d-flex align-items-center gap-3">
                            <div class="settings-header-icon" style="color: #ec4899; background: rgba(236, 72, 153, 0.1); border-color: rgba(236, 72, 153, 0.2);">
                                <i class="fa-solid fa-palette"></i>
                            </div>
                            <div>
                                <h4 class="settings-panel-title">{{ $t('panel_settings.appearance') }}</h4>
                                <p class="settings-panel-subtitle">自定义面板品牌 Logo、登录与主界面背景图及各模块透明度</p>
                            </div>
                        </div>

                        <!-- 选项卡导航 -->
                        <div class="d-flex flex-nowrap border-bottom mb-4 gap-2 overflow-x-auto no-scrollbar pb-2" style="flex-shrink: 0; -webkit-overflow-scrolling: touch;">
                            <button v-for="tab in appearanceTabs" :key="tab.id" class="btn btn-sm px-3 py-2 fw-semibold rounded-3 border-0 d-flex align-items-center gap-2 flex-shrink-0 text-nowrap" 
                                :class="activeAppearanceTab === tab.id ? 'btn-primary shadow-sm' : 'text-muted bg-body-tertiary'" 
                                @click="activeAppearanceTab = tab.id">
                                <i class="fa-solid" :class="tab.icon"></i>
                                <span>{{ $t(tab.labelKey) }}</span>
                            </button>
                        </div>

                        <div class="settings-card">
                            <div class="settings-card-body">
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

                    <!-- 6. 子账号管理 Panel -->
                    <div v-show="activeSettingsTab === 'subaccounts'" class="animate-in">
                        <div class="settings-panel-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div class="d-flex align-items-center gap-3">
                                <div class="settings-header-icon" style="color: #10b981; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2);">
                                    <i class="fa-solid fa-users-gear"></i>
                                </div>
                                <div>
                                    <h4 class="settings-panel-title">子账号管理</h4>
                                    <p class="settings-panel-subtitle">为运维团队或助手分配受限权限的子管理账号</p>
                                </div>
                            </div>
                            <button class="btn btn-primary btn-sm fw-bold px-3 py-2 d-flex align-items-center gap-1.5 shadow-sm" @click="openCreateUserModal">
                                <i class="fa-solid fa-user-plus"></i>
                                <span>新建子账号</span>
                            </button>
                        </div>

                    <!-- Sub-accounts List -->
                    <div v-if="users.length === 0" class="text-center py-5 border rounded-4 mb-4" style="background-color: var(--c-surface); border-color: var(--c-border) !important;">
                        <i class="fa-solid fa-users text-muted mb-3" style="font-size: 2.5rem; opacity: 0.4;"></i>
                        <p class="text-muted fw-medium mb-0">暂无子账号，点击上方按钮创建一个吧</p>
                    </div>
                    <div v-else class="row g-3 mb-4">
                        <div v-for="user in users" :key="user.username" class="col-md-6">
                            <div class="card instance-card h-100 p-3 p-md-4 border rounded-4 bg-surface flex-column" style="border-radius: 16px;">
                                <div class="d-flex align-items-center gap-3 mb-4">
                                    <div class="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style="width: 44px; height: 44px;">
                                        <i class="fa-solid fa-user" style="font-size: 1.25rem;"></i>
                                    </div>
                                    <div>
                                        <h5 class="fw-bold mb-1 text-truncate" style="font-size: 0.9375rem;">{{ user.username }}</h5>
                                        <div class="d-flex align-items-center gap-2">
                                            <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-10 fw-medium px-2 py-0.5" style="font-size: 0.75rem;">子账号</span>
                                            <span v-if="user.has2FA" class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-10 fw-medium px-2 py-0.5 d-flex align-items-center gap-1" style="font-size: 0.75rem;">
                                                <i class="fa-solid fa-shield-checkmark" style="font-size: 0.65rem;"></i>2FA 已绑定
                                            </span>
                                            <span v-else class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-10 fw-medium px-2 py-0.5" style="font-size: 0.75rem;">2FA 未启用</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="small mb-4 text-muted flex-grow-1">
                                    <div class="fw-bold text-uppercase letter-spacing-1 mb-1" style="font-size: 0.625rem;">拥有权限</div>
                                    <div class="text-truncate">
                                        {{ user.permissions.length === 0 ? '无任何权限' : user.permissions.map(p => translatePermission(p)).join(', ') }}
                                    </div>
                                </div>

                                <!-- Hover Swap Container -->
                                <div class="card-hover-swap-container mt-auto position-relative" style="height: 38px;">
                                    <!-- Info View -->
                                    <div class="card-info-view w-100 h-100 d-none d-md-flex align-items-center">
                                        <span class="small text-muted"><i class="fa-solid fa-ellipsis me-1.5"></i>悬停以显示操作</span>
                                    </div>
                                    <!-- Action View -->
                                    <div class="card-action-view w-100 h-100">
                                        <div class="btn-group w-100 instance-card-btn-group">
                                            <button class="btn btn-outline-primary btn-sm fw-bold px-3 py-2" @click="openEditUserModal(user)">
                                                <i class="fa-solid fa-pen-to-square me-1.5"></i>编辑
                                            </button>
                                            <button class="btn btn-outline-danger btn-sm fw-bold px-3 py-2" @click="deleteUser(user.username)">
                                                <i class="fa-solid fa-trash-can me-1.5"></i>删除
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sub-account Create/Edit Modal -->
                    <Teleport to="body">
                        <div class="modal fade" id="userModal" tabindex="-1" aria-hidden="true">
                            <div class="modal-dialog modal-dialog-centered" style="max-width: 500px;">
                                <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style="background-color: var(--c-surface);">
                                    <div class="modal-header border-0 p-4 pb-3" style="background-color: rgba(var(--c-surface-rgb), 0.3); border-bottom: 1px solid var(--c-border) !important;">
                                        <h5 class="modal-title fw-bold">{{ isEditingUser ? '编辑子账号' : '新建子账号' }}</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                    </div>
                                    <div class="modal-body p-4 pt-3">
                                        <form @submit.prevent="saveUser">
                                            <div class="mb-3">
                                                <label class="form-label small fw-bold text-muted">用户名</label>
                                                <input type="text" class="form-control" v-model="userForm.username" :disabled="isEditingUser" required placeholder="请输入用户名">
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label small fw-bold text-muted">密码 {{ isEditingUser ? '(留空表示不修改)' : '' }}</label>
                                                <input type="password" class="form-control" v-model="userForm.password" :required="!isEditingUser" placeholder="请输入密码">
                                            </div>

                                            <div class="mb-3">
                                                <label class="form-label small fw-bold text-muted d-block">权限配置</label>
                                                <div class="row g-2 border rounded-3 p-3" style="background-color: rgba(var(--c-surface-rgb), 0.5); border-color: var(--c-border) !important;">
                                                    <div v-for="(label, value) in permissionOptions" :key="value" class="col-6">
                                                        <div class="form-check">
                                                            <input class="form-check-input" type="checkbox" :id="'perm_' + value" :value="value" v-model="userForm.permissions">
                                                            <label class="form-check-label small fw-medium" :for="'perm_' + value">{{ label }}</label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="mb-4">
                                                <div class="form-check form-switch mb-3">
                                                    <input class="form-check-input" type="checkbox" role="switch" id="enable2FASwitch" v-model="userForm.enable2FA" @change="handle2FAToggle">
                                                    <label class="form-check-label small fw-bold text-muted" for="enable2FASwitch">开启 2FA 双重认证</label>
                                                </div>
                                                
                                                <!-- 2FA QR Code Binding -->
                                                <div v-if="userForm.enable2FA && userForm.tempQR" class="p-3 border rounded-3 text-center animate-in" style="background-color: rgba(var(--c-surface-rgb), 0.5); border-color: var(--c-border) !important;">
                                                    <p class="small text-muted mb-2">使用 Google Authenticator 等应用扫描二维码绑定 2FA：</p>
                                                    <img :src="userForm.tempQR" class="img-fluid border rounded-3 bg-white p-2 mb-2" style="width: 150px; height: 150px;">
                                                    <div class="small fw-semibold text-secondary select-all">密钥: {{ userForm.tempSecret }}</div>
                                                </div>
                                            </div>

                                            <div class="d-flex gap-2 justify-content-end mt-4">
                                                <button type="button" class="btn btn-outline-secondary btn-sm px-4 py-2 fw-bold" data-bs-dismiss="modal">取消</button>
                                                <button type="submit" class="btn btn-primary btn-sm px-4 py-2 fw-bold" :disabled="savingUser">
                                                    <span v-if="savingUser" class="spinner-border spinner-border-sm me-1"></span>保存
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Teleport>

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

        const showPass = reactive({
            current: false,
            next: false,
            confirm: false
        });

        const config = reactive({
            host: '0.0.0.0',
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

        const lanIps = ref([]);
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

        const settingsTabs = computed(() => {
            const tabs = [
                { id: 'basic', label: $t('panel_settings.basic') || '基本设置', icon: 'fa-sliders' },
                { id: 'security', label: $t('panel_settings.security') || '安全与认证', icon: 'fa-shield-halved' },
                { id: 'account', label: $t('panel_settings.account_mgmt') || '账户管理', icon: 'fa-user-gear' },
                { id: 'integrations', label: $t('panel_settings.integrations') || '集成与回调', icon: 'fa-link' },
                { id: 'appearance', label: $t('panel_settings.appearance') || '个性化外观', icon: 'fa-palette' }
            ];
            if (!store.auth.isSubAccount) {
                tabs.push({ id: 'subaccounts', label: '子账号管理', icon: 'fa-users-gear' });
            }
            return tabs;
        });

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
                if (res.data.lanIps) {
                    lanIps.value = res.data.lanIps;
                }
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

        const activeSettingsTab = ref('basic');
        const users = ref([]);
        const isEditingUser = ref(false);
        const savingUser = ref(false);
        const userForm = reactive({
            username: '',
            password: '',
            permissions: [],
            enable2FA: false,
            tempSecret: '',
            tempQR: ''
        });

        const permissionOptions = {
            'instance.control': '实例控制 (启动/停止/执行命令)',
            'instance.properties': '修改配置 (server.properties/图标)',
            'instance.files': '文件管理 (读写/上传/下载文件)',
            'instance.mods': 'Mod/插件安装 (搜索/下载/启用/禁用)',
            'instance.players': '玩家管理 (白名单/Ban/查看背包)',
            'instance.backups': '备份管理 (创建/回档/删除备份)',
            'panel.settings': '面板设置 (修改系统设置/主管理员信息)',
            'panel.plugins': '插件系统 (管理面板功能扩展插件)'
        };

        const translatePermission = (perm) => {
            return permissionOptions[perm] ? permissionOptions[perm].split(' ')[0] : perm;
        };

        const loadUsers = async () => {
            if (store.auth.isSubAccount) return;
            try {
                const res = await api.get('/api/users');
                users.value = res.data.users || [];
            } catch (err) {
                console.error('Failed to load sub-accounts:', err);
            }
        };

        const handle2FAToggle = async () => {
            if (userForm.enable2FA && !userForm.tempSecret) {
                try {
                    const res = await api.get('/api/users/qr', {
                        params: { username: userForm.username || 'SubAccount' }
                    });
                    userForm.tempSecret = res.data.secret;
                    userForm.tempQR = res.data.qr;
                } catch (err) {
                    showToast('生成 2FA 二维码失败', 'danger');
                    userForm.enable2FA = false;
                }
            }
        };

        const openCreateUserModal = async () => {
            isEditingUser.value = false;
            userForm.username = '';
            userForm.password = '';
            userForm.permissions = [];
            userForm.enable2FA = false;
            userForm.tempSecret = '';
            userForm.tempQR = '';
            
            const modalEl = document.getElementById('userModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
            }
        };

        const openEditUserModal = async (user) => {
            isEditingUser.value = true;
            userForm.username = user.username;
            userForm.password = '';
            userForm.permissions = [...user.permissions];
            userForm.enable2FA = user.has2FA;
            userForm.tempSecret = '';
            userForm.tempQR = '';

            const modalEl = document.getElementById('userModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
            }
        };

        const saveUser = async () => {
            const username = userForm.username ? userForm.username.trim() : '';
            const password = userForm.password ? userForm.password : '';

            if (!username) {
                showToast('用户名不能为空', 'danger');
                return;
            }
            if (username.length < 2) {
                showToast('用户名长度不能少于 2 位', 'danger');
                return;
            }
            if (!isEditingUser.value) {
                if (!password) {
                    showToast('密码不能为空', 'danger');
                    return;
                }
                if (password.length < 6) {
                    showToast('密码长度不能少于 6 位', 'danger');
                    return;
                }
            } else {
                if (password && password.length < 6) {
                    showToast('密码长度不能少于 6 位', 'danger');
                    return;
                }
            }

            savingUser.value = true;
            try {
                const payload = {
                    username: username,
                    password: password || undefined,
                    permissions: userForm.permissions,
                    enable2FA: userForm.enable2FA,
                    tempSecret: userForm.tempSecret || undefined
                };

                if (isEditingUser.value) {
                    await api.put(`/api/users/${username}`, payload);
                    showToast('修改子账号成功', 'success');
                } else {
                    await api.post('/api/users', payload);
                    showToast('创建子账号成功', 'success');
                }

                const modalEl = document.getElementById('userModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                    modal.hide();
                }

                await loadUsers();
            } catch (err) {
                showToast(err.response?.data?.error || err.message || '保存失败', 'danger');
            } finally {
                savingUser.value = false;
            }
        };

        const deleteUser = async (username) => {
            if (!confirm(`确定删除子账号 "${username}" 吗？`)) return;
            try {
                await api.delete(`/api/users/${username}`);
                showToast('删除子账号成功', 'success');
                await loadUsers();
            } catch (err) {
                showToast(err.response?.data?.error || err.message || '删除失败', 'danger');
            }
        };

        onMounted(() => {
            loadConfigWithSave();
            loadJars();

            loadInstances();
            loadJavaList();
            loadAppearance();
            loadUsers();
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
            store, loading, saving, testingAI, config, lanIps, javaArgsText, webhookText, jars,
            saveConfig, testAI, reset2FA, disable2FA,
            updatingAccount, accountForm, updateAccount, showPass,
            appearance, activeAppearanceTab, appearanceTabs,
            logoInput, bgInput, triggerLogoUpload, triggerBgUpload,
            handleLogoUpload, handleBgUpload, removeLogo, removeBackground,
            activeSettingsTab, settingsTabs,
            users, isEditingUser, savingUser, userForm, permissionOptions, translatePermission,
            handle2FAToggle, openCreateUserModal, openEditUserModal, saveUser, deleteUser
        };
    }
};
