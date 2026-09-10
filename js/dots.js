/* ============================================================
   dots.js — Animated ellipsis helper
   ============================================================ */

let _interval = null;

/**
 * Starts animating "..." on an element's text content.
 * @param {HTMLElement} el   - Element whose textContent will be updated
 * @param {string}      base - Base text without dots (e.g. "Sending")
 * @param {number}      ms   - Interval in milliseconds between frames (default 400)
 */
export function startDots(el, base, ms = 400) {
    stopDots();
    let count = 0;
    el.textContent = base;
    _interval = setInterval(() => {
        count = (count % 3) + 1;
        el.textContent = base + '.'.repeat(count);
    }, ms);
}

/** Stops any running dot animation. */
export function stopDots() {
    if (_interval !== null) {
        clearInterval(_interval);
        _interval = null;
    }
}
