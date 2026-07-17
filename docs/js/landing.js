(function () {
    // 注册 Service Worker 实现网络优先策略，解决 GitHub Pages 缓存问题
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    var navbar = document.getElementById('navbar');
    var navToggle = document.getElementById('navToggle');
    var navLinks = document.getElementById('navLinks');

    window.addEventListener('scroll', function () {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    navToggle.addEventListener('click', function () {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    var observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document
        .querySelectorAll('.feature-card, .screenshot-card, .step-card, .plugin-card')
        .forEach(function (el, i) {
            el.style.transitionDelay = (i % 6) * 0.06 + 's';
            observer.observe(el);
        });
})();
