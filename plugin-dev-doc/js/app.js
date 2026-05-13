const state = {
    lang: localStorage.getItem('lang') || 'zh',
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
    const data = docContentData[state.lang];
    
    // Render TOC
    UI.tocNav.innerHTML = data.sections.map(s => `
        <a href="#section-${s.id}" class="nav-link ${state.activeSection === s.id ? 'active' : ''}" data-id="${s.id}">
            <i class="fa-solid fa-fw ${s.icon}"></i>
            <span>${s.title}</span>
        </a>
    `).join('');

    // Render Content
    UI.docContent.innerHTML = data.sections.map(s => `
        <section id="section-${s.id}" class="doc-section">
            <div class="d-flex align-items-center mb-4">
                <div class="section-icon-box bg-primary bg-opacity-10 text-primary rounded-4 d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 54px; height: 54px;">
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
            <hr class="my-5 opacity-10">
        </section>
    `).join('');

    // Re-highlight code
    Prism.highlightAll();
}

function setupEventListeners() {
    UI.btnZh.addEventListener('click', () => {
        if (state.lang === 'zh') return;
        state.lang = 'zh';
        localStorage.setItem('lang', 'zh');
        updateLangButtons();
        render();
    });

    UI.btnEn.addEventListener('click', () => {
        if (state.lang === 'en') return;
        state.lang = 'en';
        localStorage.setItem('lang', 'en');
        updateLangButtons();
        render();
    });

    UI.sidebarToggle.addEventListener('click', () => {
        UI.sidebar.classList.toggle('show');
    });

    // TOC click
    UI.tocNav.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (link) {
            UI.sidebar.classList.remove('show');
            // Active class is handled by observer
        }
    });
}

function setupScrollObserver() {
    const observerOptions = {
        root: null,
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id.replace('section-', '');
                state.activeSection = id;
                updateActiveToc();
            }
        });
    }, observerOptions);

    // Initial and after render
    function observeSections() {
        document.querySelectorAll('.doc-section').forEach(section => {
            observer.observe(section);
        });
    }

    observeSections();
    
    // Patch render to re-observe
    const originalRender = render;
    window.render = function() {
        originalRender();
        observeSections();
    };
}

function updateActiveToc() {
    UI.tocNav.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.id === state.activeSection);
    });
}

document.addEventListener('DOMContentLoaded', init);
