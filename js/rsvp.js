/* ============================================================
   rsvp.js — RSVP form validation & submission
   ============================================================ */

import { startDots, stopDots } from './dots.js';

// Paste a Valima-specific Apps Script Web App URL here (do not reuse the Barat sheet)
const APPS_SCRIPT_URL = '';
// Must match the SECRET value in your Apps Script
const SUBMIT_SECRET   = 'valima2026';
const SUBMIT_TIMEOUT_MS = 8000;

function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(ms);
    }
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
}

// Inject shake keyframe once
const _style = document.createElement('style');
_style.textContent = `
@keyframes shake {
    0%,100% { transform: translateX(0); }
    20%,60%  { transform: translateX(-6px); }
    40%,80%  { transform: translateX(6px); }
}`;
document.head.appendChild(_style);

function shake(el) {
    el.style.animation = 'none';
    el.offsetHeight; // force reflow
    el.style.animation = 'shake 0.4s ease';
    el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

function showThanks(form, rsvpTy, attending) {
    document.getElementById('thanks-icon').textContent = '♡';

    if (!attending) {
        document.getElementById('thanks-line1').textContent = "We're so sorry to hear you won't be able to make it.";
        document.getElementById('thanks-line2').textContent = "You'll be in our thoughts and prayers on the night.";
    }

    const section = form.closest('.rsvp-section');
    const heading = section?.querySelector('.section-heading');

    const fadeOut = el => { el.style.transition = 'opacity 0.5s'; el.style.opacity = '0'; };
    fadeOut(form);
    if (heading) fadeOut(heading);

    setTimeout(() => {
        form.classList.add('hidden');
        if (heading) heading.classList.add('hidden');
        rsvpTy.classList.remove('hidden');
    }, 500);
}

export function initRSVP() {
    const form          = document.getElementById('rsvp-form');
    const rsvpTy        = document.getElementById('rsvp-thanks');
    const partySizeField = document.getElementById('party-size-field');

    // Show party size only when attending yes
    form.querySelectorAll('[name="attend"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const attending = form.querySelector('[name="attend"]:checked')?.value === 'yes';
            partySizeField.classList.toggle('visible', attending);
            form.querySelector('[name="partySize"]').required = attending;
        });
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const name       = form.querySelector('[name="name"]').value.trim();
        const email      = form.querySelector('[name="email"]').value.trim();
        const attend     = form.querySelector('[name="attend"]:checked');
        const partySize  = form.querySelector('[name="partySize"]').value;
        const attending  = attend?.value === 'yes';

        if (!name)   { shake(form.querySelector('[name="name"]').closest('.field')); return; }
        if (!email)  { shake(form.querySelector('[name="email"]').closest('.field')); return; }
        if (!attend) { shake(form.querySelector('.radio-group')); return; }
        if (attending && !partySize) { shake(partySizeField); return; }

        const btn = form.querySelector('.btn-confirm');
        btn.classList.add('sent');
        btn.disabled = true;
        startDots(btn.querySelector('.btn-text'), 'Sending');

        const payload = {
            secret:     SUBMIT_SECRET,
            name,
            email,
            attend:     attend.value,
            partySize:  attending ? partySize : '',
            message:    form.querySelector('[name="message"]').value.trim(),
        };

        if (APPS_SCRIPT_URL) {
            try {
                await fetch(APPS_SCRIPT_URL, {
                    method:  'POST',
                    // Apps Script requires text/plain to avoid CORS preflight
                    headers: { 'Content-Type': 'text/plain' },
                    body:    JSON.stringify(payload),
                    signal:  timeoutSignal(SUBMIT_TIMEOUT_MS),
                });
            } catch (_) {
                // Network errors are non-fatal — show thanks anyway so the user
                // isn't left hanging; you can add retry logic here if needed
            }
        }

        stopDots();
        btn.querySelector('.btn-text').textContent = 'Sent';
        setTimeout(() => showThanks(form, rsvpTy, attend.value === 'yes'), 700);
    });
}
