/* ============================================================
   script.js — Entry point
   Imports feature modules and wires up initialisation order.
   ============================================================ */

import { initSplash } from './js/splash.js';
import { initScrollReveal } from './js/scroll-reveal.js';
import { startCountdown } from './js/countdown.js';
import { initRSVP } from './js/rsvp.js';

function boot() {
    if (window.__inviteBooted) return;
    window.__inviteBooted = true;

    initRSVP();

    initSplash(() => {
        startCountdown();
        initScrollReveal();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
