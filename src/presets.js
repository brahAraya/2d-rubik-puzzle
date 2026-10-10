/*
 * Disposiciones del tablero (particiones planas). La disposición es a la vez
 * la forma del estado resuelto: el objetivo es volver a ella con sus colores.
 *
 * «Cubo» es el puzzle original: 27 rombos que forman un cubo 3×3×3 macizo.
 * Las demás son variantes. Las pilas en escalera cortadas por un plano
 * diagonal i + j + k ≈ c tienen el máximo número de cubitos girables
 * (13 para N = 3; búsqueda exhaustiva en scripts/explore.js).
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

  function pyramid(n) {
    return diagonalCut(n, n);
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

  const PRESETS = {
    macizo: { label: 'Cubo (puzzle original)', build: solidCube },
    escalonado: { label: 'Cubo escalonado', build: steppedCube },
    piramide: { label: 'Pirámide', build: pyramid },
    aleatorio: { label: 'Pila aleatoria', build: randomStack },
  };

  return { PRESETS, diagonalCut, steppedCube, pyramid, solidCube, randomStack };
});
