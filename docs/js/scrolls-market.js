/**
 * MC Web Panel - 卷轴市场 JavaScript 交互逻辑
 */
(function () {
    let SCROLLS_DATA = [];

    const CATEGORIES = {
        tools: '系统运维',
        interactive: '玩家互动',
        utility: '实用工具'
    };

    const state = {
        searchQuery: '',
        activeCategory: 'all',
        sortBy: 'default'
    };

    const searchInput = document.getElementById('searchInput');
    const categoryFilters = document.getElementById('categoryFilters');
    const sortSelect = document.getElementById('sortSelect');
    const scrollsGrid = document.getElementById('scrollsGrid');
    const marketStatus = document.getElementById('marketStatus');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const detailsModal = document.getElementById('detailsModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalBody = document.getElementById('modalBody');
    const toastContainer = document.getElementById('toastContainer');

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getName(scroll) {
        if (!scroll) return '';
        if (typeof scroll.name === 'object') return scroll.name.zh || scroll.name.en || scroll.id;
        return scroll.name || scroll.id;
    }

    function getDesc(scroll) {
        if (!scroll) return '';
        if (typeof scroll.description === 'object') return scroll.description.zh || scroll.description.en || '';
        return scroll.description || '';
    }

    function renderScrolls() {
        let filtered = SCROLLS_DATA.filter(item => {
            const name = getName(item).toLowerCase();
            const desc = getDesc(item).toLowerCase();
            const author = (item.author || '').toLowerCase();
            const id = (item.id || '').toLowerCase();
            const q = state.searchQuery.toLowerCase();
            const matchesSearch = name.includes(q) || desc.includes(q) || author.includes(q) || id.includes(q);
            const matchesCategory = state.activeCategory === 'all' || item.category === state.activeCategory;
            return matchesSearch && matchesCategory;
        });

        if (state.sortBy === 'name') {
            filtered.sort((a, b) => getName(a).localeCompare(getName(b), 'zh-CN'));
        } else if (state.sortBy === 'category') {
            filtered.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        } else {
            filtered.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        }

        scrollsGrid.innerHTML = '';

        if (filtered.length === 0) {
            marketStatus.style.display = 'block';
            scrollsGrid.style.display = 'none';
            return;
        }

        marketStatus.style.display = 'none';
        scrollsGrid.style.display = 'grid';

        filtered.forEach(scroll => {
            const card = document.createElement('article');
            card.className = 'plugin-store-card';

            const name = getName(scroll);
            const desc = getDesc(scroll);
            const categoryName = CATEGORIES[scroll.category] || '自动化脚本';
            const icon = scroll.icon || 'fa-scroll';
            const author = scroll.author || '4YStudio';
            const authorInitial = (author[0] || 'S').toUpperCase();

            card.innerHTML = `
                <div class="plugin-card-header">
                    <span class="plugin-category-badge badge-${scroll.category}">${categoryName}</span>
                    <div style="display: flex; gap: 6px;">
                        <span class="plugin-version-badge">v${scroll.version || '1.0.0'}</span>
                        <span class="plugin-version-badge">${formatBytes(scroll.fileSize)}</span>
                    </div>
                </div>
                <h3 class="plugin-card-title">
                    <i class="fa-solid ${icon} me-2 text-primary" style="font-size: 0.95rem;"></i>
                    ${name}
                </h3>
                <p class="plugin-card-desc">${desc}</p>
                
                <div class="plugin-perms-tags">
                    <span class="plugin-perm-tag" title="零侵入式原生控制台驱动"><i class="fa-solid fa-feather me-1"></i>免装Mod</span>
                    <span class="plugin-perm-tag" title="沙盒隔离，永不损坏世界存档"><i class="fa-solid fa-shield-halved me-1"></i>永不崩服</span>
                    <span class="plugin-perm-tag" title="支持在线热保存与热重载"><i class="fa-solid fa-bolt me-1"></i>热重载</span>
                    <span class="plugin-perm-tag" title="纯净/Fabric/Forge/Paper全核心全版本通用"><i class="fa-solid fa-infinity me-1"></i>全版本</span>
                </div>

                <div class="plugin-card-footer">
                    <div class="plugin-author-info">
                        <div class="plugin-author-avatar">${authorInitial}</div>
                        <span class="plugin-author-name">${author}</span>
                    </div>
                    <div class="plugin-actions">
                        <a class="btn-icon-only btn-download" href="${scroll.downloadUrl}" download title="下载卷轴 ZIP 包">
                            <i class="fa-solid fa-download"></i>
                        </a>
                        <button class="btn btn-primary btn-sm btn-details" data-id="${scroll.id}">
                            详情 / 安装
                        </button>
                    </div>
                </div>
            `;

            card.querySelector('.btn-download').addEventListener('click', function (e) {
                e.stopPropagation();
                showToast('正在开始下载卷轴压缩包...');
            });

            card.querySelector('.btn-details').addEventListener('click', function (e) {
                e.stopPropagation();
                openDetailsModal(scroll.id);
            });

            card.addEventListener('click', function () {
                openDetailsModal(scroll.id);
            });

            scrollsGrid.appendChild(card);
        });
    }

    function openDetailsModal(scrollId) {
        const scroll = SCROLLS_DATA.find(s => s.id === scrollId);
        if (!scroll) return;

        const name = getName(scroll);
        const desc = getDesc(scroll);
        const categoryName = CATEGORIES[scroll.category] || '自动化脚本';
        const icon = scroll.icon || 'fa-scroll';
        const author = scroll.author || '4YStudio';
        const fullDownloadUrl = new URL(scroll.downloadUrl, window.location.href).href;

        // 配置参数清单 HTML
        let schemaHtml = '';
        if (scroll.configSchema) {
            const schemaEntries = Array.isArray(scroll.configSchema)
                ? scroll.configSchema
                : Object.entries(scroll.configSchema).map(([k, v]) => ({ key: k, ...v }));

            if (schemaEntries.length > 0) {
                schemaHtml = `
                    <div class="modal-section" style="margin-bottom: 24px;">
                        <h4 class="modal-section-title">
                            <i class="fa-solid fa-sliders"></i>
                            支持的可视化配置参数 (Config Schema)
                        </h4>
                        <div style="background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--radius); padding: 12px 16px; margin-top: 10px;">
                            <ul style="padding-left: 20px; margin: 0;">
                                ${schemaEntries.map(item => `
                                    <li style="margin-bottom: 8px; font-size: 0.85rem; color: var(--c-text-secondary); line-height: 1.5;">
                                        <code style="background: var(--c-surface); padding: 2px 6px; border-radius: 4px; color: var(--c-primary); font-family: monospace; font-size: 0.78rem;">${item.label || item.title || item.key}</code>
                                        <span style="margin-left: 8px; color: var(--c-text);">${item.description || ''}</span>
                                        ${item.default !== undefined ? `<span style="margin-left: 6px; font-size: 0.75rem; color: var(--c-text-tertiary);">(默认: ${JSON.stringify(item.default)})</span>` : ''}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            }
        }

        modalBody.innerHTML = `
            <div class="modal-header-section">
                <div class="modal-title-row">
                    <h2 class="modal-title">
                        <i class="fa-solid ${icon} me-2 text-primary"></i>
                        ${name}
                    </h2>
                    <div class="modal-badges">
                        <span class="plugin-category-badge badge-${scroll.category}">${categoryName}</span>
                        <span class="plugin-version-badge">v${scroll.version || '1.0.0'}</span>
                    </div>
                </div>
                <p class="modal-desc" style="margin-top: 10px;">${desc}</p>
            </div>

            ${schemaHtml}

            <div class="modal-section" style="margin-bottom: 24px;">
                <h4 class="modal-section-title">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    卷轴核心机制说明
                </h4>
                <ul class="modal-features-list" style="margin-top: 10px;">
                    <li><strong>零侵入控制台驱动</strong>：纯原生通过 Minecraft 控制台标准输入/输出流实现自动化，无侵入、无前置 Mod。</li>
                    <li><strong>实例级数据自治</strong>：每个游戏实例独立安装、独立配置、独立启用，备份实例时数据完整保留。</li>
                    <li><strong>毫秒级动态热重载</strong>：在面板内保存配置或修改代码后无需重启服务端，立即无感热生效。</li>
                </ul>
            </div>

            <div class="modal-meta-grid">
                <div class="modal-meta-item">
                    <span class="modal-meta-label">卷轴标识 (ID)</span>
                    <span class="modal-meta-value" style="font-family: monospace; font-size: 0.8rem;">${scroll.id}</span>
                </div>
                <div class="modal-meta-item">
                    <span class="modal-meta-label">压缩包大小</span>
                    <span class="modal-meta-value">${formatBytes(scroll.fileSize)}</span>
                </div>
                <div class="modal-meta-item">
                    <span class="modal-meta-label">作者 / 团队</span>
                    <span class="modal-meta-value">${author}</span>
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
                        <i class="fa-solid fa-scroll"></i>
                        快速安装指南
                    </h4>
                    <ol style="padding-left: 20px; font-size: 0.85rem; color: var(--c-text-secondary); line-height: 1.6; margin-bottom: 0;">
                        <li>点击右侧按钮下载 <code>${scroll.id}.zip</code> 压缩包；</li>
                        <li>在 MC Web Panel 控制台对应实例中，打开左侧边栏的 <strong>「卷轴管理」</strong> 界面；</li>
                        <li>点击右上角的 <strong>「安装卷轴」</strong> 按钮并上传刚才下载的 ZIP 包，系统将全自动部署生效！</li>
                    </ol>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; align-items: flex-end;">
                    <a class="btn btn-primary" href="${scroll.downloadUrl}" download style="white-space: nowrap; display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-download"></i>下载 ZIP 卷轴包
                    </a>
                    <button class="btn btn-outline btn-sm btn-copy-link" style="white-space: nowrap;">
                        <i class="fa-solid fa-link me-1"></i>复制安装直链
                    </button>
                </div>
            </div>
        `;

        modalBody.querySelector('.btn-copy-link')?.addEventListener('click', () => {
            copyToClipboard(fullDownloadUrl);
        });

        detailsModal.showModal();
    }

    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('已复制卷轴直链到剪切板！');
            }).catch(() => fallbackCopy(text));
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
            showToast('已复制卷轴直链到剪切板！');
        } catch (e) {
            showToast('复制失败，请手动选择复制。', 'error');
        }
        document.body.removeChild(area);
    }

    function showToast(msg, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = (type === 'error' ? '<i class="fa-solid fa-circle-exclamation"></i> ' : '<i class="fa-solid fa-circle-check"></i> ') + msg;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }

    // 绑定交互控件事件
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderScrolls();
        });
    }

    if (categoryFilters) {
        categoryFilters.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                categoryFilters.querySelector('.filter-btn.active')?.classList.remove('active');
                this.classList.add('active');
                state.activeCategory = this.getAttribute('data-category') || 'all';
                renderScrolls();
            });
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            renderScrolls();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            state.searchQuery = '';
            state.activeCategory = 'all';
            categoryFilters?.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === 'all');
            });
            state.sortBy = 'default';
            if (sortSelect) sortSelect.value = 'default';
            renderScrolls();
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => detailsModal?.close());
    }

    if (detailsModal) {
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) detailsModal.close();
        });
    }

    // 初始化获取数据
    async function init() {
        try {
            // 支持多种相对路径，确保在 GitHub Pages 任意子路径下均可成功获取
            const fetchUrls = [
                './scrolls_shop/scrolls.json?t=' + Date.now(),
                'scrolls_shop/scrolls.json?t=' + Date.now(),
                '/scrolls_shop/scrolls.json?t=' + Date.now()
            ];

            let loadedData = null;
            for (const url of fetchUrls) {
                try {
                    const res = await fetch(url);
                    if (res.ok) {
                        const json = await res.json();
                        if (Array.isArray(json)) {
                            loadedData = json;
                            break;
                        }
                    }
                } catch (_) {}
            }

            if (loadedData) {
                SCROLLS_DATA = loadedData;
            } else {
                console.error('Failed to load scrolls_shop/scrolls.json from all candidate paths');
                showToast('未能加载 scrolls_shop/scrolls.json 索引文件', 'error');
            }
        } catch (e) {
            console.error('Failed to load scrolls.json:', e);
            showToast('未能加载 scrolls_shop/scrolls.json 索引文件', 'error');
        } finally {
            renderScrolls();
        }
    }

    // 保证必定执行初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
