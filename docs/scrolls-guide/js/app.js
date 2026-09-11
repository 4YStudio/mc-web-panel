const state = {
    lang: localStorage.getItem('scroll_doc_lang') || 'zh',
    activeSection: 'intro'
};

const UI = {
    docContent: document.getElementById('doc-content'),
    tocNav: document.getElementById('toc-nav'),
    btnZh: document.getElementById('btn-zh'),
    btnEn: document.getElementById('btn-en'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle')
};

function init() {
    updateLangButtons();
    render();
    setupEventListeners();
    setupScrollObserver();
}

function updateLangButtons() {
    UI.btnZh.classList.toggle('active', state.lang === 'zh');
    UI.btnEn.classList.toggle('active', state.lang === 'en');
}

function render() {
    const data = docContentData[state.lang] || docContentData['zh'];
    
    // Render TOC
    UI.tocNav.innerHTML = data.sections.map(s => `
        <a href="#section-${s.id}" class="nav-link ${state.activeSection === s.id ? 'active' : ''}" data-id="${s.id}">
            <i class="fa-solid fa-fw ${s.icon}"></i>
            <span class="text-truncate">${s.title}</span>
        </a>
    `).join('');

    // Render Content
    UI.docContent.innerHTML = data.sections.map(s => `
        <section id="section-${s.id}" class="doc-section mb-5">
            <div class="d-flex align-items-center mb-4">
                <div class="bg-purple-box text-purple rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm flex-shrink-0" style="width: 52px; height: 52px;">
                    <i class="fa-solid ${s.icon}" style="font-size: 1.5rem;"></i>
                </div>
                <div>
                    <h3 class="fw-bold m-0 tracking-tight">${s.title}</h3>
                    <p class="text-muted small m-0 mt-1 opacity-75">${s.description || ''}</p>
                </div>
            </div>
            <div class="section-body">
                ${s.content}
            </div>
            <hr class="my-5 opacity-10" style="border-color: var(--c-border);">
        </section>
    `).join('');

    // Highlight code
    if (window.Prism) Prism.highlightAll();
}

function setupEventListeners() {
    UI.btnZh.addEventListener('click', () => {
        if (state.lang === 'zh') return;
        state.lang = 'zh';
        localStorage.setItem('scroll_doc_lang', 'zh');
        updateLangButtons();
        render();
    });

    UI.btnEn.addEventListener('click', () => {
        if (state.lang === 'en') return;
        state.lang = 'en';
        localStorage.setItem('scroll_doc_lang', 'en');
        updateLangButtons();
        render();
    });

    if (UI.sidebarToggle) {
        UI.sidebarToggle.addEventListener('click', () => {
            UI.sidebar.classList.toggle('show');
        });
    }

    UI.tocNav.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (link) {
            UI.sidebar.classList.remove('show');
        }
    });
}

function setupScrollObserver() {
    const observerOptions = {
        root: null,
        rootMargin: '-10% 0px -75% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id.replace('section-', '');
                state.activeSection = id;
                document.querySelectorAll('#toc-nav .nav-link').forEach(link => {
                    link.classList.toggle('active', link.dataset.id === id);
                });
            }
        });
    }, observerOptions);

    document.querySelectorAll('.doc-section').forEach(section => {
        observer.observe(section);
    });
}

document.addEventListener('DOMContentLoaded', init);
