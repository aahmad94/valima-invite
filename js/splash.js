/* ============================================================
   splash.js — Splash screen & hero curtain animation
   ============================================================ */

import { openCurtains } from './curtains3d.js';

export function initSplash(onDismiss) {
    const splash = document.getElementById('splash');
    const main   = document.getElementById('main');

    let dismissed = false;

    function dismiss() {
        if (dismissed) return;
        dismissed = true;

        const el = document.getElementById('splash');
        const page = document.getElementById('main');
        el?.classList.add('dismissed');
        page?.classList.remove('hidden');

        const hold = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : 60;
        setTimeout(() => { openCurtains(); }, hold);

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

    if (new URLSearchParams(location.search).has('curtain')) {
        dismiss();
    }
}
