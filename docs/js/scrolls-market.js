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
        }

        if (filtered.length === 0) {
            scrollsGrid.innerHTML = '';
            marketStatus.style.display = 'block';
            return;
        }

        marketStatus.style.display = 'none';
        scrollsGrid.innerHTML = filtered.map(item => {
            const categoryName = CATEGORIES[item.category] || '其它分类';
            const icon = item.icon || 'fa-scroll';
            const color = item.color || '#8b5cf6';
            const name = getName(item);
            const desc = getDesc(item);

            return `
                <div class="plugin-card" data-id="${item.id}" style="border-top: 3px solid ${color};">
                    <div class="plugin-header">
                        <div class="plugin-icon" style="background: ${color}1a; color: ${color};">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div class="plugin-title-wrap">
                            <h3 class="plugin-name">${name}</h3>
                            <div class="plugin-meta">
                                <span class="plugin-author"><i class="fa-regular fa-user"></i> ${item.author || '4YStudio'}</span>
                                <span class="plugin-version">v${item.version || '1.0.0'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <p class="plugin-desc">${desc}</p>
                    
                    <div class="plugin-tags">
                        <span class="tag tag-category"><i class="fa-solid fa-tag"></i> ${categoryName}</span>
                        <span class="tag tag-size"><i class="fa-regular fa-hard-drive"></i> ${formatBytes(item.fileSize)}</span>
                    </div>

                    <div class="plugin-footer">
                        <button class="btn btn-primary btn-sm btn-details" data-id="${item.id}" style="background: #8b5cf6; border-color: #8b5cf6;">
                            <i class="fa-solid fa-circle-info"></i> 详情 / 安装
                        </button>
                        <a href="${item.downloadUrl}" class="btn btn-outline btn-sm btn-download" download>
                            <i class="fa-solid fa-download"></i> ZIP
                        </a>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.btn-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                openDetailsModal(id);
            });
        });
    }

    function openDetailsModal(id) {
        const item = SCROLLS_DATA.find(p => p.id === id);
        if (!item) return;

        const name = getName(item);
        const desc = getDesc(item);
        const categoryName = CATEGORIES[item.category] || '其它分类';
        const fullDownloadUrl = new URL(item.downloadUrl, window.location.href).href;

        let schemaHtml = '';
        if (item.configSchema && Object.keys(item.configSchema).length > 0) {
            const schemaEntries = Array.isArray(item.configSchema) 
                ? item.configSchema 
                : Object.entries(item.configSchema).map(([k, v]) => ({ key: k, ...v }));
            schemaHtml = `
                <div class="modal-section">
                    <h4><i class="fa-solid fa-sliders"></i> 支持的可视化配置参数</h4>
                    <div class="permissions-list">
                        ${schemaEntries.map(s => `
                            <div class="permission-item">
                                <span class="perm-key">${s.title || s.label || s.key} (<code>${s.key}</code>)</span>
                                <span class="perm-desc">${s.description || '类型: ' + (s.type || 'string')} [默认: ${s.default}]</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        modalBody.innerHTML = `
            <div class="modal-header-custom" style="display: flex; gap: 16px; align-items: center; margin-bottom: 20px;">
                <div class="plugin-icon" style="background: ${item.color || '#8b5cf6'}1a; color: ${item.color || '#8b5cf6'}; width: 56px; height: 56px; font-size: 24px; display: flex; align-items: center; justify-content: center; border-radius: 14px;">
                    <i class="fa-solid ${item.icon || 'fa-scroll'}"></i>
                </div>
                <div>
                    <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">${name}</h2>
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">
                        <span>ID: <code>${item.id}</code></span> · 
                        <span>版本: v${item.version}</span> · 
                        <span>作者: ${item.author || '4YStudio'}</span>
                    </div>
                </div>
            </div>

            <div class="modal-section">
                <h4><i class="fa-solid fa-align-left"></i> 功能说明</h4>
                <p style="color: var(--text-secondary); line-height: 1.6;">${desc}</p>
            </div>

            <div class="modal-section">
                <h4><i class="fa-solid fa-circle-check"></i> 零侵入免崩服特性</h4>
                <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.5;">
                    本卷轴运行于 MC Web Panel 独立的 Node.js 沙盒环境中。支持 Vanilla 纯净服、Fabric、Forge、NeoForge、Paper 全核心版本通吃，绝对不影响游戏内核与存档稳定性。
                </p>
            </div>

            ${schemaHtml}

            <div class="modal-section" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="btn btn-primary" id="btnCopyInstallUrl" style="background: #8b5cf6; border-color: #8b5cf6;">
                    <i class="fa-solid fa-link"></i> 复制下载链接
                </button>
                <a href="${item.downloadUrl}" class="btn btn-outline" download>
                    <i class="fa-solid fa-download"></i> 下载 ZIP 包 (${formatBytes(item.fileSize)})
                </a>
            </div>
        `;

        detailsModal.showModal();

        const btnCopy = document.getElementById('btnCopyInstallUrl');
        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                navigator.clipboard.writeText(fullDownloadUrl).then(() => {
                    showToast('已复制卷轴直链，可在面板中直接输入 URL 安装！', 'success');
                }).catch(() => {
                    showToast('复制失败，请手动复制', 'error');
                });
            });
        }
    }

    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = '<i class="fa-solid fa-circle-info"></i> ' + msg;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    async function init() {
        try {
            const res = await fetch('./scrolls_shop/scrolls.json?t=' + Date.now());
            SCROLLS_DATA = await res.json();
            renderScrolls();
        } catch (e) {
            console.error('Failed to load scrolls.json:', e);
            showToast('未能加载 scrolls_shop/scrolls.json 索引文件', 'error');
        }

        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderScrolls();
        });

        categoryFilters.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                categoryFilters.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                state.activeCategory = e.target.dataset.category;
                renderScrolls();
            }
        });

        sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            renderScrolls();
        });

        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                searchInput.value = '';
                state.searchQuery = '';
                state.activeCategory = 'all';
                categoryFilters.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.category === 'all');
                });
                renderScrolls();
            });
        }

        modalCloseBtn.addEventListener('click', () => {
            detailsModal.close();
        });
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) detailsModal.close();
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
