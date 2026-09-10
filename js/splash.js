/* ============================================================
   splash.js — Splash screen & AK zoom-to-fill transition
   ============================================================ */

const ZOOM_MS = 1550;

export function initSplash(onDismiss) {
    const splash = document.getElementById('splash');
    const main   = document.getElementById('main');

    let dismissed = false;

    function revealPage() {
        splash?.classList.add('dismissed');
        document.body.classList.remove('splash-intro');
        document.body.classList.add('hero-revealed');
        onDismiss();
    }

    function dismiss() {
        if (dismissed) return;
        dismissed = true;

        main?.classList.remove('hidden');

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduced) {
            revealPage();
            return;
        }

        splash?.classList.add('zooming');

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            revealPage();
        };

        const mono = splash?.querySelector('.splash-monogram');
        mono?.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'transform') finish();
        });

        setTimeout(finish, ZOOM_MS + 180);
    }

    document.addEventListener('click', (e) => {
        const el = document.getElementById('splash');
        if (!el || el.classList.contains('dismissed') || el.classList.contains('zooming')) return;
        if (el.contains(e.target)) dismiss();
    });
    document.addEventListener('touchstart', (e) => {
        const el = document.getElementById('splash');
        if (!el || el.classList.contains('dismissed') || el.classList.contains('zooming')) return;
        if (el.contains(e.target)) dismiss();
    }, { passive: true });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = document.getElementById('splash');
        if (!el || el.classList.contains('dismissed') || el.classList.contains('zooming')) return;
        e.preventDefault();
        dismiss();
    });

    splash?.addEventListener('click', dismiss);
    splash?.addEventListener('touchstart', dismiss, { passive: true });

    if (new URLSearchParams(location.search).has('zoom')) {
        dismiss();
    }
}
