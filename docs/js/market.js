/**
 * MC Web Panel - 插件市场 JavaScript 交互逻辑
 */
(function () {
    // 注册 Service Worker 实现网络优先策略，解决 GitHub Pages 缓存问题
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    let PLUGINS_DATA = [];

    // 分类字典
    const CATEGORIES = {
        tools: '系统工具',
        backups: '备份管理',
        network: '网络穿透',
        security: '安全管理'
    };

    // 权限字典说明
    const PERMISSIONS_DESC = {
        'fs.read': '读取文件系统（访问服务器文件）',
        'fs.write': '写入文件系统（修改或写入配置文件）',
        'network': '网络访问（与外部API交互）',
        'process': '执行命令（运行或守护底层系统进程）',
        'socket': '实时通信（创建实时数据管道）',
        'http': '注册自定义 HTTP 路由与控制器接口',
        'http.public': '向公网暴露无鉴权的开放 HTTP 路由',
        'storage': '持久化键值对存储数据库读写',
        'settings': '在控制台注册插件专属配置页面',
        'task': '注册后台常驻或定时计划轮询任务',
        'events': '监听或发送插件间系统事件'
    };

    // 状态管理
    const state = {
        searchQuery: '',
        activeCategory: 'all',
        sortBy: 'default'
    };

    // DOM 元素引用
    const searchInput = document.getElementById('searchInput');
    const categoryFilters = document.getElementById('categoryFilters');
    const sortSelect = document.getElementById('sortSelect');
    const pluginsGrid = document.getElementById('pluginsGrid');
    const marketStatus = document.getElementById('marketStatus');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const detailsModal = document.getElementById('detailsModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalBody = document.getElementById('modalBody');
    const toastContainer = document.getElementById('toastContainer');

    // 格式化文件大小
    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // 渲染插件卡片
    function renderPlugins() {
        // 过滤
        let filtered = PLUGINS_DATA.filter(plugin => {
            const matchesSearch = plugin.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                plugin.description.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                plugin.author.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                plugin.id.toLowerCase().includes(state.searchQuery.toLowerCase());

            const matchesCategory = state.activeCategory === 'all' || plugin.category === state.activeCategory;

            return matchesSearch && matchesCategory;
        });

        // 排序
        if (state.sortBy === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        } else if (state.sortBy === 'category') {
            filtered.sort((a, b) => a.category.localeCompare(b.category));
        } else {
            // 默认排序: 按 ID
            filtered.sort((a, b) => a.id.localeCompare(b.id));
        }

        // 清空容器
        pluginsGrid.innerHTML = '';

        if (filtered.length === 0) {
            marketStatus.style.display = 'block';
            pluginsGrid.style.display = 'none';
        } else {
            marketStatus.style.display = 'none';
            pluginsGrid.style.display = 'grid';

            filtered.forEach(plugin => {
                const card = document.createElement('article');
                card.className = 'plugin-store-card';
                
                // 渲染权限标签
                const permsHtml = plugin.permissions && plugin.permissions.length > 0
                    ? `<div class="plugin-perms-tags">
                        ${plugin.permissions.map(p => `<span class="plugin-perm-tag" title="${PERMISSIONS_DESC[p] || p}">${p}</span>`).join('')}
                       </div>`
                    : '<div class="plugin-perms-tags"><span class="plugin-perm-tag perm-none">无特殊权限请求</span></div>';

                card.innerHTML = `
                    <div class="plugin-card-header">
                        <span class="plugin-category-badge badge-${plugin.category}">${CATEGORIES[plugin.category] || '扩展插件'}</span>
                        <div style="display: flex; gap: 6px;">
                            <span class="plugin-version-badge">v${plugin.version}</span>
                            <span class="plugin-version-badge">${formatBytes(plugin.fileSize)}</span>
                        </div>
                    </div>
                    <h3 class="plugin-card-title">
                        <i class="fa-solid ${plugin.icon || 'fa-puzzle-piece'} me-2 text-primary" style="font-size: 0.95rem;"></i>
                        ${plugin.name}
                    </h3>
                    <p class="plugin-card-desc">${plugin.description}</p>
                    
                    ${permsHtml}

                    <div class="plugin-card-footer">
                        <div class="plugin-author-info">
                            <div class="plugin-author-avatar">${plugin.author[0].toUpperCase()}</div>
                            <span class="plugin-author-name">${plugin.author}</span>
                        </div>
                        <div class="plugin-actions">
                            <a class="btn-icon-only btn-download" href="${plugin.downloadUrl}" download title="下载 ZIP 包">
                                <i class="fa-solid fa-download"></i>
                            </a>
                            <button class="btn btn-primary btn-sm btn-details" data-id="${plugin.id}">
                                详情
                            </button>
                        </div>
                    </div>
                `;

                card.querySelector('.btn-download').addEventListener('click', function (e) {
                    e.stopPropagation();
                    showToast('正在开始下载插件压缩包...');
                });

                card.querySelector('.btn-details').addEventListener('click', function (e) {
                    e.stopPropagation();
                    openPluginDetails(plugin.id);
                });

                // 点击卡片也可展开详情
                card.addEventListener('click', function () {
                    openPluginDetails(plugin.id);
                });

                pluginsGrid.appendChild(card);
            });
        }
    }

    // 复制到剪切板与 Toast
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('已复制安装说明到剪切板！');
            }).catch(err => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try {
            document.execCommand('copy');
            showToast('已复制安装说明到剪切板！');
        } catch (e) {
            showToast('复制失败，请手动选择复制。', 'error');
        }
        document.body.removeChild(area);
    }

    function showToast(msg, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'market-toast';
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'} market-toast-icon"></i>
            <span>${msg}</span>
        `;
        toastContainer.appendChild(toast);

        // 3秒后移除
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3000);
    }

    // 展开插件详情弹窗
    function openPluginDetails(pluginId) {
        const plugin = PLUGINS_DATA.find(p => p.id === pluginId);
        if (!plugin) return;

        // 权限详细解释
        const permsDetailHtml = plugin.permissions && plugin.permissions.length > 0
            ? plugin.permissions.map(p => `
                <li style="margin-bottom: 6px; font-size: 0.85rem; color: var(--c-text-secondary);">
                    <code style="background: var(--c-bg); padding: 2px 6px; border-radius: 4px; color: var(--c-primary); font-family: monospace; font-size: 0.78rem;">${p}</code>
                    <span style="margin-left: 8px;">— ${PERMISSIONS_DESC[p] || '特殊访问权限'}</span>
                </li>
              `).join('')
            : '<li style="font-size: 0.85rem; color: var(--c-text-secondary); list-style: none; margin-left: -20px;">无特殊访问权限（纯隔离运行）</li>';

        // 拼接 Modal 内容
        modalBody.innerHTML = `
            <div class="modal-header-section">
                <div class="modal-title-row">
                    <h2 class="modal-title">
                        <i class="fa-solid ${plugin.icon || 'fa-puzzle-piece'} me-2 text-primary"></i>
                        ${plugin.name}
                    </h2>
                    <div class="modal-badges">
                        <span class="plugin-category-badge badge-${plugin.category}">${CATEGORIES[plugin.category] || '扩展'}</span>
                        <span class="plugin-version-badge">v${plugin.version}</span>
                    </div>
                </div>
                <p class="modal-desc" style="margin-top: 10px;">${plugin.description}</p>
            </div>

            <div class="modal-section" style="margin-bottom: 24px;">
                <h4 class="modal-section-title">
                    <i class="fa-solid fa-shield-halved"></i>
                    系统接口权限请求 (Permissions)
                </h4>
                <ul style="padding-left: 20px; margin-top: 10px;">
                    ${permsDetailHtml}
                </ul>
            </div>

            <div class="modal-meta-grid">
                <div class="modal-meta-item">
                    <span class="modal-meta-label">插件 ID (Identifier)</span>
                    <span class="modal-meta-value" style="font-family: monospace; font-size: 0.8rem;">${plugin.id}</span>
                </div>
                <div class="modal-meta-item">
                    <span class="modal-meta-label">文件大小</span>
                    <span class="modal-meta-value">${formatBytes(plugin.fileSize)}</span>
                </div>
                <div class="modal-meta-item">
                    <span class="modal-meta-label">开发作者</span>
                    <span class="modal-meta-value">${plugin.author}</span>
                </div>
                <div class="modal-meta-item">
                    <span class="modal-meta-label">开源库及支持</span>
                    <span class="modal-meta-value">
                        <a href="https://github.com/4ystudio/mc-web-panel" target="_blank">
                            <i class="fa-brands fa-github"></i> GitHub 主仓
                        </a>
                    </span>
                </div>
            </div>

            <div class="modal-install-section" style="display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div style="flex: 1 1 300px;">
                    <h4 class="modal-section-title" style="margin-bottom: 8px;">
                        <i class="fa-solid fa-puzzle-piece"></i>
                        安装与部署指引
                    </h4>
                    <ol style="padding-left: 20px; font-size: 0.85rem; color: var(--c-text-secondary); line-height: 1.6; margin-bottom: 0;">
                        <li>点击右侧按钮直接下载该插件的 ZIP 包（<code>${plugin.id}.zip</code>）。</li>
                        <li>在面板运行根目录的 <code>plugins/</code> 目录下新建以 <code>${plugin.id}</code> 命名的子目录。</li>
                        <li>将下载得到的 ZIP 包解压，并将其中的文件（确保 <code>plugin.json</code> 处于该目录下）放进该文件夹中。</li>
                        <li>重启 MC Web Panel 后台服务以自动检测插件。</li>
                        <li>访问面板后台“插件管理”菜单，开启 <strong>${plugin.name}</strong> 插件。</li>
                    </ol>
                </div>
                <a class="btn btn-primary" href="${plugin.downloadUrl}" download style="white-space: nowrap; display: inline-flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-download"></i>下载 ZIP 包
                </a>
            </div>
        `;

        // 展现 modal (HTML5 dialog standard API)
        detailsModal.showModal();
    }

    // 事件绑定
    searchInput.addEventListener('input', function (e) {
        state.searchQuery = e.target.value.trim();
        renderPlugins();
    });

    categoryFilters.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            categoryFilters.querySelector('.filter-btn.active').classList.remove('active');
            this.classList.add('active');
            state.activeCategory = this.getAttribute('data-category');
            renderPlugins();
        });
    });

    sortSelect.addEventListener('change', function (e) {
        state.sortBy = e.target.value;
        renderPlugins();
    });

    resetFiltersBtn.addEventListener('click', function () {
        searchInput.value = '';
        state.searchQuery = '';
        state.activeCategory = 'all';
        categoryFilters.querySelector('.filter-btn.active').classList.remove('active');
        categoryFilters.querySelector('[data-category="all"]').classList.add('active');
        state.sortBy = 'default';
        sortSelect.value = 'default';
        renderPlugins();
    });

    modalCloseBtn.addEventListener('click', function () {
        detailsModal.close();
    });

    // 点击弹窗背景处关闭弹窗
    detailsModal.addEventListener('click', function (e) {
        if (e.target === detailsModal) {
            detailsModal.close();
        }
    });

    // 动态载入数据并初始化渲染
    async function init() {
        try {
            // 加时间戳防止缓存
            const response = await fetch(`./plugins_shop/plugins.json?t=${Date.now()}`);
            PLUGINS_DATA = await response.json();
        } catch (e) {
            console.error('Failed to load plugins.json from plugins_shop:', e);
            showToast('未能加载 plugins_shop/plugins.json 索引文件', 'error');
        }
        renderPlugins();
    }

    init();
})();
