/* ============================================================
   splash.js — Splash screen fade to the invitation card
   ============================================================ */

export function initSplash(onDismiss) {
    const splash = document.getElementById('splash');
    const main   = document.getElementById('main');

    let dismissed = false;

    function dismiss() {
        if (dismissed) return;
        dismissed = true;

        main?.classList.remove('hidden');
        document.body.classList.add('hero-revealed');
        document.body.classList.remove('splash-intro');

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
            splash?.classList.add('dismissed');
            onDismiss();
            return;
        }

        requestAnimationFrame(() => {
            splash?.classList.add('dismissed');
        });
        onDismiss();
    }

    document.addEventListener('click', (e) => {
        const el = document.getElementById('splash');
        if (!el || el.classList.contains('dismissed')) return;
        if (el.contains(e.target)) dismiss();
    });
    document.addEventListener('touchstart', (e) => {
        const el = document.getElementById('splash');
        if (!el || el.classList.contains('dismissed')) return;
        if (el.contains(e.target)) dismiss();
    }, { passive: true });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = document.getElementById('splash');
        if (!el || el.classList.contains('dismissed')) return;
        dismiss();
    });

    splash?.addEventListener('click', dismiss);
    splash?.addEventListener('touchstart', dismiss, { passive: true });

    if (new URLSearchParams(location.search).has('fade')) {
        dismiss();
    }
}
