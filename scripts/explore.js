#!/usr/bin/env node
// Búsqueda exhaustiva de la partición plana con más rombos móviles.
// Uso: node scripts/explore.js [N]   (N ≤ 3 exhaustivo; tabla de cortes diagonales para cualquier N)
const { ProppPuzzle } = require('../src/core.js');
const { diagonalCut } = require('../src/presets.js');

const N = Number(process.argv[2]) || 3;

function stats(h) {
  const p = new ProppPuzzle({ heights: h });
  return {
    alturas: JSON.stringify(h),
    cubitos: p.hexagons.length,
    moviles: p.movable.filter(Boolean).length + '/' + p.slotCount,
    zonas: p.components.filter((c) => c.length > 1).map((c) => c.length).join('+') || '-',
  };
}

console.log('Cortes diagonales h = clamp(c - i - j, 0, N):');
const rows = [];
for (let c = 0; c <= 3 * N; c++) rows.push({ c, ...stats(diagonalCut(N, c)) });
console.table(rows);

if (N <= 3) {
  const all = [];
  (function rec(h, idx) {
    if (idx === N * N) return void all.push(stats(h.map((r) => r.slice())));
    const i = Math.floor(idx / N);
    const j = idx % N;
    const max = Math.min(i ? h[i - 1][j] : N, j ? h[i][j - 1] : N);
    for (let v = 0; v <= max; v++) {
      h[i][j] = v;
      rec(h, idx + 1);
    }
    h[i][j] = 0;
  })(Array.from({ length: N }, () => new Array(N).fill(0)), 0);
  all.sort((a, b) => parseInt(b.moviles) - parseInt(a.moviles) || b.cubitos - a.cubitos);
  console.log('Mejores de ' + all.length + ' particiones planas:');
  console.table(all.slice(0, 5));
}
