/* ============================================================
   scratch.js — Three-card scratch-to-reveal & content gate
   ============================================================ */

import { initScrollReveal } from './scroll-reveal.js';

const CARD_DATA = [
    { pipId: 'pip-0' },
    { pipId: 'pip-1' },
    { pipId: 'pip-2' },
];

const cards    = CARD_DATA.map(() => ({ revealed: false, ctx: null }));
const canvases = Array.from(document.querySelectorAll('.scratch-canvas'));

const HANG_MS = 3500;
const AUTO_STAGGER_MS = 280;
const SCROLL_INTENT_PX = 12;

let hangTimer = null;
let hangArmed = false;
let hangScratchResetUsed = false;
let hangScrollHandler = null;

/* ── Drawing ──────────────────────────────────────────── */
function drawLayer(ctx, canvas) {
    const { width: w, height: h } = canvas;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0,    '#3a2e0a');
    grad.addColorStop(0.35, '#6b540e');
    grad.addColorStop(0.7,  '#4d3d0b');
    grad.addColorStop(1,    '#2a2208');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Diagonal sheen
    ctx.save();
    ctx.strokeStyle = 'rgba(212,175,55,0.15)';
    ctx.lineWidth = 1;
    for (let i = -h; i < w + h; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
    }
    ctx.restore();

    // Hint glyph
    ctx.save();
    ctx.fillStyle    = 'rgba(212,175,55,0.5)';
    ctx.font         = `${h * 0.1}px 'Playfair Display', serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', w / 2, h / 2);
    ctx.restore();
}

/* ── Canvas sizing (call after main is visible) ──────── */
export function initScratchCanvases() {
    canvases.forEach((canvas, idx) => {
        const wrap    = canvas.closest('.scratch-card-wrap');
        canvas.width  = wrap.offsetWidth  || 155;
        canvas.height = wrap.offsetHeight || 185;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        cards[idx].ctx = ctx;
        drawLayer(ctx, canvas);
    });

    window.addEventListener('resize', () => {
        canvases.forEach((canvas, idx) => {
            if (cards[idx].revealed) return;
            const wrap    = canvas.closest('.scratch-card-wrap');
            canvas.width  = wrap.offsetWidth  || 155;
            canvas.height = wrap.offsetHeight || 185;
            drawLayer(cards[idx].ctx, canvas);
        });
    });
}

/* ── Event listeners (safe to wire up at DOMContentLoaded) */
export function setupScratchListeners() {
    canvases.forEach((canvas, idx) => {
        let isScratching = false;
        let scratchedArea = 0;

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const src  = e.touches ? e.touches[0] : e;
            return {
                x: (src.clientX - rect.left) * (canvas.width  / rect.width),
                y: (src.clientY - rect.top)  * (canvas.height / rect.height),
            };
        }

        function doScratch(e) {
            if (!isScratching || cards[idx].revealed || !cards[idx].ctx) return;
            e.preventDefault();

            const { x, y } = getPos(e);
            const ctx = cards[idx].ctx;

            ctx.globalCompositeOperation = 'destination-out';
            const r = Math.max(canvas.width * 0.14, 18);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();

            // Area accumulation — no getImageData, no GPU stall
            scratchedArea += Math.PI * r * r;
            if (scratchedArea >= canvas.width * canvas.height * 1.1) {
                revealCard(idx);
            }
        }

        canvas.addEventListener('mousedown',  () => { isScratching = true; onScratchStart(); });
        canvas.addEventListener('mouseup',    () => { isScratching = false; });
        canvas.addEventListener('mouseleave', () => { isScratching = false; });
        canvas.addEventListener('mousemove',  doScratch);

        canvas.addEventListener('touchstart', e => { isScratching = true; onScratchStart(); doScratch(e); }, { passive: false });
        canvas.addEventListener('touchend',   () => { isScratching = false; });
        canvas.addEventListener('touchmove',  doScratch, { passive: false });
    });
}

/* ── Hang-time auto-unveil (3.5s from scroll toward the scratcher) */
function dateFullyRevealed() {
    return cards.every(c => c.revealed);
}

function clearHangTimer() {
    if (hangTimer == null) return;
    clearTimeout(hangTimer);
    hangTimer = null;
}

function armHangTimer() {
    if (dateFullyRevealed()) return;
    hangArmed = true;
    clearHangTimer();
    hangTimer = setTimeout(autoUnveilDate, HANG_MS);
}

function stopHangWatch() {
    hangArmed = false;
    clearHangTimer();
    if (hangScrollHandler) {
        window.removeEventListener('scroll', hangScrollHandler);
        hangScrollHandler = null;
    }
}

function onScratchStart() {
    if (dateFullyRevealed() || hangScratchResetUsed) return;
    hangScratchResetUsed = true;
    armHangTimer();
}

function autoUnveilDate() {
    hangTimer = null;
    if (dateFullyRevealed()) return;

    const stagger = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : AUTO_STAGGER_MS;

    let step = 0;
    cards.forEach((card, idx) => {
        if (card.revealed) return;
        const delay = step * stagger;
        step += 1;
        setTimeout(() => revealCard(idx), delay);
    });
}

export function scheduleAutoReveal() {
    if (hangScrollHandler || dateFullyRevealed()) return;

    hangScrollHandler = () => {
        if (dateFullyRevealed()) {
            stopHangWatch();
            return;
        }
        if (hangArmed) return;
        if (window.scrollY < SCROLL_INTENT_PX) return;
        armHangTimer();
    };

    window.addEventListener('scroll', hangScrollHandler, { passive: true });
    hangScrollHandler();
}

/* ── Reveal one card ──────────────────────────────────── */
function revealCard(idx) {
    if (cards[idx].revealed) return;
    cards[idx].revealed = true;

    canvases[idx].style.opacity = '0';
    setTimeout(() => { canvases[idx].style.pointerEvents = 'none'; }, 950);

    document.getElementById(CARD_DATA[idx].pipId).classList.add('done');

    if (dateFullyRevealed()) {
        stopHangWatch();
        setTimeout(unlockContent, 600);
    }
}

/* ── Unlock gated content ─────────────────────────────── */
function unlockContent() {
    const gate       = document.getElementById('scratch-gate');
    const gated      = document.getElementById('gated-content');
    const scrollHint = document.getElementById('scratch-scroll-hint');

    gate.style.opacity = '0';
    setTimeout(() => { gate.style.display = 'none'; }, 900);

    // Show scroll hint at bottom of scratch section
    if (scrollHint) {
        scrollHint.classList.remove('hidden');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            scrollHint.classList.add('visible');
        }));
    }

    gated.classList.add('unlocked');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        gated.classList.add('fade-in');
    }));

    initScrollReveal();
}
