/* ============================================================
   curtains3d.js — Cinematic velvet curtain intro
   WebGL (Three.js) cloth-fold shaders, CSS 3D fallback
   ============================================================ */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const OPEN_MS = 3400;
const SETTLE_MS = 450;
const FADE_MS = 400;
// Shader starts the off-stage exit at uOpen 0.8. Unlock scroll then so
// settle/fade of the overlay cannot trap the page for another 1–2s.
const SCROLL_UNLOCK_AT = 0.8;

let prepared = null;
let mode = null; // 'webgl' | 'css'
let disposed = false;
let opening = false;

let overlay, canvas;
let THREE;
let renderer, scene, camera, leftMesh, rightMesh, clock;
let rafId = 0;
let onResizeBound = null;

const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function previewOpen() {
    const raw = new URLSearchParams(location.search).get('curtain');
    if (raw === null) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/* ── Easing: inertia, then a heavy, fluid draw ───────── */
function easeTheater(t) {
    t = Math.min(1, Math.max(0, t));
    // Brief weight, then a fluid S-curve — no long dead start
    if (t < 0.04) return 2.2 * t * t;
    const u = (t - 0.04) / 0.96;
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    return 0.0035 + 0.9965 * e;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ═══════════════════════════════════════════════════════
   SHADERS
   ═══════════════════════════════════════════════════════ */

const VERT = /* glsl */ `
uniform float uOpen;
uniform float uTime;
uniform float uSettle;
uniform float uFlip;
uniform float uSeed;
uniform vec2  uSize;

varying vec3  vWorldPos;
varying vec3  vNormal;
varying vec2  vUv;
varying float vFold;
varying float vOpen;
varying float vShade;

float sat(float x) { return clamp(x, 0.0, 1.0); }

float boxWave(float x) {
    float s = sin(x);
    return sign(s) * pow(abs(s) + 1e-4, 0.32);
}

// Pleats live in fabric UV so they pack as the drape gathers
float fabricFold(vec2 uv, float open) {
    float x = uv.x + 0.010 * sin(uv.x * 9.0 + uSeed) + 0.006 * sin(uv.y * 3.1 + uSeed);
    float y = uv.y;

    float p1 = boxWave(x * 15.0 * 3.14159265 + uSeed);
    float p2 = boxWave(x * 30.0 * 3.14159265 + 1.15 + uSeed) * 0.18;
    float pinch = pow(0.50 + 0.50 * cos(x * 14.0 * 3.14159265 * 0.25), 1.55);
    float wrinkle = sin(x * 58.0 + y * 12.0 + uSeed) * 0.04
                  + sin(x * 90.0 - y * 17.0) * 0.022
                  + sin(y * 8.0 + x * 4.5) * 0.03;

    float amp = mix(0.092, 0.138, open) * mix(1.0, 0.86, uSettle);
    float hem  = mix(0.38, 1.0, smoothstep(0.0, 0.13, y));
    float head = mix(0.42, 1.0, 1.0 - smoothstep(0.91, 1.0, y));
    float vary = 0.84 + 0.16 * sin(y * 5.2 + x * 3.6 + uSeed);

    return (p1 * (0.62 + 0.5 * pinch) + p2 + wrinkle) * amp * hem * head * vary;
}

vec3 curtainPos(vec2 uv) {
    // uv.x: 0 = outer / offstage, 1 = inner / centre
    // uv.y: 0 = weighted hem, 1 = rod
    float delayY = pow(1.0 - uv.y, 1.35) * 0.10 * (0.25 + 0.75 * uv.x);
    float lo = sat((uOpen - delayY) / 0.90);

    // Travel curtain: slide + mild pile-up, then exit the stage late
    float remain = mix(1.0, 0.13, lo);
    float bunch  = pow(uv.x, 1.0 + lo * 0.28);
    float t      = bunch * remain;
    float exit   = smoothstep(0.80, 1.0, uOpen) * 1.18;
    float meet   = 0.03 * (1.0 - uOpen);

    float fold = fabricFold(uv, lo);

    float billow = sin(uv.x * 3.14159265) * mix(0.055, 0.028, lo);
    billow *= sin(uv.y * 2.35 + 0.4);

    float motion = sin(uOpen * 3.14159265);
    float sway =
          sin(uTime * 1.12 + uv.y * 2.2 + uv.x * 1.8 + uSeed)
        * cos(uTime * 0.58 + uv.x * 3.1);
    sway *= mix(0.006, 0.017, 0.3 + 0.7 * motion) * mix(1.0, 0.5, uSettle);
    sway *= (1.0 - uv.y) * 0.9 + 0.1;

    // Inertia ripple that travels down the leading edge
    float ripple = sin(uv.y * 6.2 - uOpen * 9.5 + uSeed)
                 * motion * 0.012 * uv.x;

    float x = (t - 0.5) * uSize.x
            + meet * uSize.x
            - exit * uSize.x
            + fold * 0.28
            + sway
            + ripple;

    float sag = 0.02 * (1.0 - lo * 0.45) * sin(t * 3.14159265) * (1.0 - uv.y);
    float y = (uv.y - 0.5) * uSize.y - sag;

    float turn = uv.x * uv.x * mix(0.06, 0.02, lo);
    float z = fold + billow + abs(sway) * 0.5 + turn;

    return vec3(x, y, z);
}

void main() {
    vec3 pos = curtainPos(uv);

    float eps = 0.0028;
    vec3 px = curtainPos(uv + vec2(eps, 0.0));
    vec3 py = curtainPos(uv + vec2(0.0, eps));

    vec4 wp  = modelMatrix * vec4(pos, 1.0);
    vec3 pW  = wp.xyz;
    vec3 pxW = (modelMatrix * vec4(px, 1.0)).xyz;
    vec3 pyW = (modelMatrix * vec4(py, 1.0)).xyz;
    vec3 nW  = normalize(cross(pyW - pW, pxW - pW));
    if (uFlip > 0.5) nW = -nW;

    vUv       = uv;
    vFold     = pos.z;
    vOpen     = uOpen;
    vShade    = sat(1.0 - abs(pos.z) * 5.2);
    vNormal   = nW;
    vWorldPos = pW;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform float uOpen;
uniform vec3  uCamPos;

varying vec3  vWorldPos;
varying vec3  vNormal;
varying vec2  vUv;
varying float vFold;
varying float vOpen;
varying float vShade;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 L1 = normalize(vec3( 0.12, 0.82, 0.68));
    vec3 L2 = normalize(vec3(-0.35, 0.22, 0.55));
    vec3 L3 = normalize(vec3( 0.35, 0.18, 0.60));

    float ndv = max(dot(N, V), 0.0);
    float wrap1 = dot(N, L1) * 0.55 + 0.45;
    float wrap2 = dot(N, L2) * 0.5 + 0.5;
    float ndl1 = max(dot(N, L1), 0.0);

    // OLED jet black — valleys crush to 0; gold is braid-only
    vec3 deep = vec3(0.0, 0.0, 0.0);
    vec3 pile = vec3(0.012, 0.012, 0.014);
    vec3 lift = vec3(0.038, 0.039, 0.044);

    vec3 col = mix(deep, pile, wrap1);
    col += pile * wrap2 * 0.10;
    col = mix(col, lift, pow(wrap1, 3.0) * 0.28);

    float rim   = pow(1.0 - ndv, 2.8);
    float sheen = pow(1.0 - ndv, 4.2) * ndl1;
    col += rim   * vec3(0.028, 0.028, 0.032);
    col += sheen * vec3(0.055, 0.055, 0.062);

    float valley = clamp(-vFold * 8.5, 0.0, 1.0);
    col *= 1.0 - valley * 0.85;
    col *= 0.62 + vShade * 0.28;
    col += vec3(0.028, 0.028, 0.032) * clamp(vFold * 4.2, 0.0, 1.0) * 0.18;

    float n1 = hash(vUv * vec2(180.0, 320.0));
    float n2 = hash(vUv * vec2(72.0, 140.0) + 2.4);
    col += (n1 - 0.5) * 0.018 + (n2 - 0.5) * 0.010;
    col *= 0.98 + n2 * 0.03;

    vec3 gold = vec3(0.80, 0.62, 0.22);
    float dInner = 1.0 - vUv.x;
    float goldInner = smoothstep(0.022, 0.008, dInner) * smoothstep(0.0, 0.004, dInner)
                    * smoothstep(0.03, 0.14, vOpen);
    float goldHem   = smoothstep(0.038, 0.012, vUv.y) * smoothstep(0.0, 0.007, vUv.y);
    float goldTop   = smoothstep(0.014, 0.004, 1.0 - vUv.y);
    float g = max(goldInner * 0.96, max(goldHem * 0.78, goldTop * 0.42));
    vec3 R = reflect(-L1, N);
    float gspec = pow(max(dot(R, V), 0.0), 32.0);
    col = mix(col, gold * (0.48 + wrap1 * 0.55) + vec3(1.0, 0.88, 0.52) * gspec * 0.7, g);

    col += vec3(0.04, 0.04, 0.045) * max(dot(N, L3), 0.0) * 0.10;

    gl_FragColor = vec4(col, 1.0);
}
`;

/* ═══════════════════════════════════════════════════════
   WEBGL
   ═══════════════════════════════════════════════════════ */

function isMobile() {
    return window.matchMedia('(max-width: 720px)').matches
        || window.innerWidth < 720
        || ('ontouchstart' in window && window.innerWidth < 900);
}

function makeMaterial(flip, seed) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uOpen:   { value: 0 },
            uTime:   { value: 0 },
            uSettle: { value: 0 },
            uFlip:   { value: flip },
            uSeed:   { value: seed },
            uSize:   { value: new THREE.Vector2(1, 1) },
            uCamPos: { value: new THREE.Vector3() },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.DoubleSide,
        toneMapped: false,
    });
}

function fitCurtains() {
    if (!camera || !leftMesh) return;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = Math.abs(camera.position.z);
    const fh = 2 * Math.tan(fov / 2) * dist;
    const fw = fh * camera.aspect;

    // Generous bleed so perspective + tilt never flash the page
    const height = fh * 1.34;
    const halfW  = fw * 0.58;

    leftMesh.material.uniforms.uSize.value.set(halfW, height);
    rightMesh.material.uniforms.uSize.value.set(halfW, height);
    leftMesh.position.set(-halfW * 0.5, 0.02, 0);
    rightMesh.position.set( halfW * 0.5, 0.02, 0);
}

function handleResize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    fitCurtains();
    if (camera && leftMesh) {
        leftMesh.material.uniforms.uCamPos.value.copy(camera.position);
        rightMesh.material.uniforms.uCamPos.value.copy(camera.position);
    }
    renderer.render(scene, camera);
}

function renderFrame(time, open, settle) {
    const t = time * 0.001;
    for (const mesh of [leftMesh, rightMesh]) {
        const u = mesh.material.uniforms;
        u.uTime.value = t;
        u.uOpen.value = open;
        u.uSettle.value = settle;
        u.uCamPos.value.copy(camera.position);
    }
    const veil = Math.max(0, 1 - open * 5.5);
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${veil.toFixed(3)})`;
    renderer.render(scene, camera);
}

function loadThree() {
    return Promise.race([
        import(THREE_URL),
        delay(8000).then(() => { throw new Error('Three.js load timed out'); }),
    ]);
}

async function initWebGL() {
    THREE = await loadThree();

    canvas = document.createElement('canvas');
    canvas.id = 'curtain-canvas';
    canvas.className = 'curtain-canvas';
    overlay.appendChild(canvas);

    const mobile = isMobile();
    renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !mobile,
        powerPreference: 'high-performance',
        premultipliedAlpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.08, 24);
    camera.position.set(0, -0.22, 2.05);
    camera.lookAt(0, 0.12, 0);

    const segsX = mobile ? 36 : 68;
    const segsY = mobile ? 48 : 88;
    const geo = new THREE.PlaneGeometry(1, 1, segsX, segsY);

    const leftMat  = makeMaterial(0, 0.35);
    const rightMat = makeMaterial(1, 1.82);

    leftMesh  = new THREE.Mesh(geo, leftMat);
    rightMesh = new THREE.Mesh(geo.clone(), rightMat);
    rightMesh.scale.x = -1;

    // Slight pitch: looking up at tall house curtains
    leftMesh.rotation.x  = 0.12;
    rightMesh.rotation.x = 0.12;

    scene.add(leftMesh, rightMesh);

    clock = new THREE.Clock();
    onResizeBound = handleResize;
    window.addEventListener('resize', onResizeBound);
    handleResize();

    const preview = previewOpen();
    const startOpen = preview === null ? 0 : preview;
    renderFrame(0, startOpen, preview === 1 ? 1 : 0);

    // One closed frame under the splash — no idle loop (saves GPU).
    // Preview mode keeps a cheap sway so ?curtain= poses stay alive.
    if (preview !== null) {
        const idle = () => {
            if (disposed || opening) return;
            renderFrame(clock.getElapsedTime() * 1000, startOpen, preview === 1 ? 1 : 0);
            rafId = requestAnimationFrame(idle);
        };
        rafId = requestAnimationFrame(idle);
    }

    mode = 'webgl';
}

function disposeWebGL() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (onResizeBound) {
        window.removeEventListener('resize', onResizeBound);
        onResizeBound = null;
    }
    if (leftMesh) {
        leftMesh.geometry.dispose();
        leftMesh.material.dispose();
    }
    if (rightMesh) {
        rightMesh.geometry.dispose();
        rightMesh.material.dispose();
    }
    renderer?.dispose();
    renderer = scene = camera = leftMesh = rightMesh = null;
}

async function openWebGL() {
    if (rafId) cancelAnimationFrame(rafId);
    clock.getElapsedTime();
    const t0 = performance.now();

    await new Promise(resolve => {
        const step = now => {
            if (disposed) { resolve(); return; }
            const elapsed = now - t0;
            const open = easeTheater(Math.min(1, elapsed / OPEN_MS));
            const settle = elapsed > OPEN_MS
                ? Math.min(1, (elapsed - OPEN_MS) / SETTLE_MS)
                : 0;
            renderFrame(now, open, settle);

            if (elapsed < OPEN_MS + SETTLE_MS) {
                rafId = requestAnimationFrame(step);
            } else {
                resolve();
            }
        };
        rafId = requestAnimationFrame(step);
    });
}

/* ═══════════════════════════════════════════════════════
   CSS 3D FALLBACK
   ═══════════════════════════════════════════════════════ */

const CSS_PANELS = 16;

function initCssFallback() {
    overlay.classList.add('css-mode');
    overlay.innerHTML = '';

    for (const side of ['left', 'right']) {
        const curtain = document.createElement('div');
        curtain.className = `css-curtain ${side}`;
        for (let i = 0; i < CSS_PANELS; i++) {
            const panel = document.createElement('div');
            panel.className = 'css-panel';
            const inward = side === 'left' ? i : (CSS_PANELS - 1 - i);
            panel.style.setProperty('--i', String(inward));
            panel.style.setProperty('--fold', `${(inward % 2 === 0 ? 17 : -15)}deg`);
            curtain.appendChild(panel);
        }
        overlay.appendChild(curtain);
    }
    mode = 'css';
}

function openCss() {
    overlay.classList.add('is-open');
    return delay(OPEN_MS + 200);
}

/* ═══════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════ */

function unlockScroll() {
    document.body.classList.remove('curtain-intro');
}

function forceReveal() {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    document.body.classList.add('curtains-open');
    unlockScroll();
    if (overlay) {
        overlay.classList.add('is-gone');
        overlay.style.pointerEvents = 'none';
    }
    disposeWebGL();
    setTimeout(() => overlay?.remove(), 400);
}

async function doPrepare() {
    overlay = document.getElementById('curtain-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'curtain-overlay';
        overlay.className = 'curtain-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.appendChild(overlay);
    }

    if (reducedMotion()) {
        mode = 'none';
        return;
    }

    try {
        await initWebGL();
        overlay.classList.add('is-ready');
    } catch (err) {
        console.warn('WebGL curtains unavailable, using CSS fallback.', err);
        disposeWebGL();
        initCssFallback();
        overlay.classList.add('is-ready');
    }
}

/** Warm WebGL (or CSS fallback) under the splash. Safe to call twice. */
export function prepareCurtains() {
    if (!prepared) prepared = doPrepare();
    return prepared;
}

/** Draw the house. Resolves after the overlay is gone. Idempotent. */
export async function openCurtains() {
    if (opening || disposed) return;
    if (previewOpen() !== null) {
        document.body.classList.add('curtains-open');
        unlockScroll();
        if (overlay) overlay.style.pointerEvents = 'none';
        if (previewOpen() >= 0.99) forceReveal();
        return;
    }
    opening = true;
    document.body.classList.add('curtains-open');

    const safety = setTimeout(forceReveal, 9000);
    let unlockTimer = 0;

    try {
        await prepareCurtains();

        if (reducedMotion() || mode === 'none') {
            forceReveal();
            return;
        }

        overlay.classList.add('is-opening');
        unlockTimer = setTimeout(
            unlockScroll,
            Math.round(OPEN_MS * SCROLL_UNLOCK_AT),
        );

        if (mode === 'webgl') {
            await openWebGL();
        } else {
            await openCss();
        }

        if (disposed) return;
        overlay.classList.add('is-gone');
        await delay(FADE_MS);
        forceReveal();
    } catch (err) {
        console.warn('Curtain open failed.', err);
        forceReveal();
    } finally {
        clearTimeout(unlockTimer);
        clearTimeout(safety);
        unlockScroll();
    }
}
