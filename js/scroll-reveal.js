/* ============================================================
   scroll-reveal.js — IntersectionObserver fade-in on scroll
   Called after gated content is unlocked by scratch.js
   ============================================================ */

export function initScrollReveal() {
    const targets = document.querySelectorAll('[data-reveal]');

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    targets.forEach(el => observer.observe(el));
}
