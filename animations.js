// ============================================================
//  WAWE — ANIMATIONS
//  Tutte le onde sono animate via requestAnimationFrame
//  con Math.sin(), NON via CSS d:path() keyframes
//  (Firefox e Safari non supportano l'animazione di d:path)
//  Ogni frame usa solo setAttribute su SVG path → zero layout
// ============================================================

(function () {
  'use strict';

  // ── WAVE PATH BUILDER ──────────────────────────────────────
  // Genera un path SVG con onda sinusoidale orizzontale
  // x0,x1 = range X, yCenter = centro verticale
  // amplitude = altezza onda, frequency = cicli nel range
  // phase = sfasamento in radianti
  function buildWavePath(x0, x1, yCenter, amplitude, frequency, phase, steps) {
    steps = steps || 48;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = yCenter + amplitude * Math.sin(Math.PI * 2 * frequency * t + phase);
      pts.push(i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}`
                       : `L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ');
  }

  // ── LOGO WAVES ────────────────────────────────────────────
  // Tre onde nel cerchio del logo (42×42 viewBox)
  const logoW1 = document.querySelector('.logo-wave-bg');
  const logoW2 = document.querySelector('.logo-wave-bg2');
  const logoW3 = document.querySelector('.logo-wave-bg3');

  // ── DROPZONE WAVES ────────────────────────────────────────
  // Tre onde grandi nella dropzone (84×72 viewBox)
  const dzW1 = document.querySelector('.dz-wave-path');
  const dzW2 = document.querySelector('.dz-wave-path2');
  const dzW3 = document.querySelector('.dz-wave-path3');

  // ── BACKGROUND WAVE LINES ─────────────────────────────────
  // Tre onde statiche in fondo alla pagina (1440×200 viewBox)
  // Le rendiamo leggermente animate per un effetto mare
  const bgPaths = document.querySelectorAll('.bg-waves path');

  // ── ANIMATION LOOP ────────────────────────────────────────
  let startTime = null;
  // visibilità della pagina — pausa animazioni quando non visibile
  let paused = false;
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (!paused) {
      startTime = null; // resetta il tempo per evitare salti
      requestAnimationFrame(tick);
    }
  });

  function tick(timestamp) {
    if (paused) return;
    if (startTime === null) startTime = timestamp;
    const t = (timestamp - startTime) / 1000; // secondi

    // ── LOGO (42×42) ──
    if (logoW1) {
      logoW1.setAttribute('d', buildWavePath(4, 38, 21, 5.5, 2, t * 2.6, 32));
    }
    if (logoW2) {
      logoW2.setAttribute('d', buildWavePath(4, 38, 24, 5.5, 2, t * 2.6 - 0.85, 32));
    }
    if (logoW3) {
      logoW3.setAttribute('d', buildWavePath(4, 38, 18, 5.5, 2, t * 2.6 + 0.85, 32));
    }

    // ── DROPZONE (84×72) ──
    if (dzW1) {
      dzW1.setAttribute('d', buildWavePath(5, 79, 36, 14, 2, t * 2.1, 48));
    }
    if (dzW2) {
      dzW2.setAttribute('d', buildWavePath(5, 79, 44, 14, 2, t * 2.1 - 0.7, 48));
    }
    if (dzW3) {
      dzW3.setAttribute('d', buildWavePath(5, 79, 28, 14, 2, t * 2.1 + 0.7, 48));
    }

    // ── BACKGROUND WAVES (1440×200) — più lente, quasi statiche ──
    if (bgPaths.length >= 3) {
      bgPaths[0].setAttribute('d', buildWavePath(0, 1440, 100, 55, 4, t * 0.3, 64));
      bgPaths[1].setAttribute('d', buildWavePath(0, 1440, 120, 55, 4, t * 0.3 - 0.5, 64));
      bgPaths[2].setAttribute('d', buildWavePath(0, 1440, 140, 55, 4, t * 0.3 - 1.0, 64));
    }

    requestAnimationFrame(tick);
  }

  // Avvia solo dopo il primo paint
  requestAnimationFrame(tick);

})();
