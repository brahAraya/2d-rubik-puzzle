/*
 * Formas del tablero (particiones planas).
 *
 * El juego usa sólo el cubo macizo N×N×N (el puzzle original es 3×3×3: 27
 * rombos). Las demás formas se usan en los tests y en scripts/explore.js para
 * ejercitar el motor con teselaciones distintas.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProppPresets = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function diagonalCut(n, c) {
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => Math.max(0, Math.min(n, c - i - j)))
    );
  }

  // Corte que maximiza las piezas móviles (ver tabla en scripts/explore.js).
  function steppedCube(n) {
    return diagonalCut(n, n - 1 + Math.ceil(n / 2));
  }

  function solidCube(n) {
    return diagonalCut(n, 3 * n);
  }

  // Partición plana aleatoria: alturas no crecientes en filas y columnas.
  function randomStack(n, rng = Math.random) {
    const h = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const max = Math.min(i ? h[i - 1][j] : n, j ? h[i][j - 1] : n);
        h[i][j] = Math.floor(rng() * (max + 1));
      }
    }
    return h;
  }

  return { diagonalCut, steppedCube, solidCube, randomStack };
});
