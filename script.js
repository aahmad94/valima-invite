/* ============================================================
   script.js — Entry point
   Imports feature modules and wires up initialisation order.
   ============================================================ */

import { initSplash } from './js/splash.js';
import { prepareCurtains } from './js/curtains3d.js';
import {
    setupScratchListeners,
    initScratchCanvases,
    scheduleAutoReveal,
} from './js/scratch.js';
import { startCountdown } from './js/countdown.js';
import { initRSVP } from './js/rsvp.js';

function boot() {
    if (window.__inviteBooted) return;
    window.__inviteBooted = true;

    prepareCurtains();
    setupScratchListeners();
    initRSVP();

    initSplash(() => {
        setTimeout(initScratchCanvases, 80);
        scheduleAutoReveal();
        startCountdown();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
