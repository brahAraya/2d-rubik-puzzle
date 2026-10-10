const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const P = require('../src/presets.js');

const { ProppPuzzle, buildTiling, makeRng } = C;

function allPartitions(n) {
  const out = [];
  (function rec(h, idx) {
    if (idx === n * n) return void out.push(h.map((r) => r.slice()));
    const i = Math.floor(idx / n);
    const j = idx % n;
    const max = Math.min(i ? h[i - 1][j] : n, j ? h[i][j - 1] : n);
    for (let v = 0; v <= max; v++) {
      h[i][j] = v;
      rec(h, idx + 1);
    }
    h[i][j] = 0;
  })(Array.from({ length: n }, () => new Array(n).fill(0)), 0);
  return out;
}

test('cada partición plana produce una teselación válida del hexágono', () => {
  for (const n of [1, 2, 3]) {
    for (const h of allPartitions(n)) {
      const t = buildTiling(h);
      assert.equal(t.slots.length, 3 * n * n);
      for (let o = 0; o < 3; o++) assert.equal(t.slots.filter((s) => s.orient === o).length, n * n);
      // Suma de ángulos por vértice: nunca supera 360° (no hay solapes) y en
      // los vértices interiores es exactamente 360° (no hay huecos).
      for (const v of t.vertices) {
        let sum = 0;
        for (const id of v.slots) sum += t.slots[id].keys.indexOf(v.key) % 2 === 0 ? 120 : 60;
        assert.ok(sum <= 360, 'solape en ' + v.key);
        const [a, b] = v.key.split(',').map(Number);
        const interior = Math.max(Math.abs(a), Math.abs(b), Math.abs(a - b)) < n;
        if (interior) assert.equal(sum, 360, 'hueco en ' + v.key);
      }
    }
  }
});

test('las claves de rejilla coinciden con la proyección', () => {
  const t = buildTiling(P.steppedCube(3));
  const seen = new Map();
  for (const s of t.slots) {
    s.keys.forEach((k, i) => {
      if (seen.has(k)) {
        const p = seen.get(k);
        assert.ok(Math.hypot(p[0] - s.corners[i][0], p[1] - s.corners[i][1]) < 1e-9);
      } else seen.set(k, s.corners[i]);
    });
  }
});

test('todos los cubitos detectados pasan la validación de adyacencia', () => {
  for (const h of allPartitions(3)) {
    const t = buildTiling(h);
    for (const hex of t.hexagons) {
      assert.deepEqual(C.validateTriple(t, hex.ring, hex.key), { ok: true });
      assert.equal(new Set(hex.ring.map((s) => t.slots[s].orient)).size, 3);
    }
  }
});

test('el cubo macizo sólo tiene un cubito girable', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3) });
  assert.equal(p.hexagons.length, 1);
  assert.equal(p.hexagons[0].kind, 'convexo');
});

test('el tablero por defecto (N=3) maximiza las piezas móviles', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3) });
  assert.equal(p.hexagons.length, 13);
  assert.equal(p.movable.filter(Boolean).length, 24);
  assert.equal(p.components.filter((c) => c.length > 1).length, 1);
});

test('validateTriple bloquea grupos que no forman un cubito', () => {
  const t = buildTiling(P.solidCube(3));
  // Tres caras superiores: misma orientación.
  assert.equal(C.validateTriple(t, [0, 1, 2], '0,0').ok, false);
  // Dos rombos repetidos.
  assert.equal(C.validateTriple(t, [0, 0, 1], '0,0').ok, false);
  // Una cara de cada orientación pero lejos entre sí.
  const top = t.slots.find((s) => s.orient === 0).id;
  const left = t.slots.filter((s) => s.orient === 1).pop().id;
  const right = t.slots.find((s) => s.orient === 2).id;
  assert.equal(C.validateTriple(t, [top, left, right], t.slots[top].keys[0]).ok, false);
  // Dos rombos.
  assert.equal(C.validateTriple(t, [0, 1], '0,0').ok, false);
});

test('rotar 3 veces 120° (o 120° + 240°) es la identidad', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3) });
  for (const h of p.hexagons) {
    p.rotate(h.id, 1);
    assert.equal(p.isSolved(), false, 'un giro debe cambiar el tablero');
    p.rotate(h.id, 1);
    p.rotate(h.id, 1);
    assert.ok(p.isSolved());
    p.rotate(h.id, 1);
    p.rotate(h.id, 2);
    assert.ok(p.isSolved());
  }
});

test('el giro es geométrico: cada pieza va a la casilla girada +120°', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3) });
  const h = p.hexagons[0];
  const before = h.ring.map((s) => p.perm[s]);
  p.rotate(h.id, 1);
  h.ring.forEach((s, k) => {
    const target = h.ring[(k + 1) % 3];
    const rotated = C.rotatePoint(p.tiling.slots[s].centroid, h.center, (2 * Math.PI) / 3);
    const c = p.tiling.slots[target].centroid;
    assert.ok(Math.hypot(rotated[0] - c[0], rotated[1] - c[1]) < 1e-9);
    assert.equal(p.perm[target], before[k]);
  });
});

test('se bloquean giros ilegales', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3) });
  assert.equal(p.rotate(0, 3).ok, false);
  assert.equal(p.rotate(0, 0).ok, false);
  assert.equal(p.rotate(999, 1).ok, false);
  assert.equal(p.rotate(-1, 1).ok, false);
  assert.ok(p.isSolved());
  assert.equal(p.moveCount, 0);
});

test('undo/redo restauran exactamente los estados', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3) });
  const rng = makeRng(7);
  const states = [p.perm.slice()];
  for (let i = 0; i < 40; i++) {
    p.rotate(Math.floor(rng() * p.hexagons.length), 1 + Math.floor(rng() * 2));
    states.push(p.perm.slice());
  }
  for (let i = 39; i >= 0; i--) {
    p.undo();
    assert.deepEqual(p.perm, states[i]);
  }
  assert.equal(p.undo(), null);
  for (let i = 1; i <= 40; i++) {
    p.redo();
    assert.deepEqual(p.perm, states[i]);
  }
  assert.equal(p.redo(), null);
  // Un movimiento nuevo descarta la rama de rehacer.
  p.undo();
  p.rotate(0, 1);
  assert.equal(p.canRedo(), false);
});

test('los giros alcanzan exactamente las permutaciones pares de cada zona', () => {
  // Tablero pequeño con zonas de 3 y 7 rombos: se puede explorar entero.
  const p = new ProppPuzzle({ heights: [[1, 1], [1, 0]] });
  const sizes = p.components.map((c) => c.length).filter((x) => x > 1).sort();
  assert.deepEqual(sizes, [3, 7]);
  const start = p.perm.slice();
  const seen = new Set([start.join()]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.pop();
    for (const h of p.hexagons) {
      p.perm = cur.slice();
      p._apply(h.id, 1);
      const k = p.perm.join();
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(p.perm.slice());
      }
    }
  }
  // |A3| · |A7| = 3 · 2520
  assert.equal(seen.size, 3 * 2520);
  for (const k of seen) assert.ok(p.analyze(k.split(',').map(Number)).solvable);
});

test('la validación de paridad detecta estados imposibles', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3), mode: 'numerado' });
  const comp = p.components.find((c) => c.length > 1);
  const odd = p.perm.slice();
  [odd[comp[0]], odd[comp[1]]] = [odd[comp[1]], odd[comp[0]]];
  const a = p.analyze(odd);
  assert.equal(a.solvable, false);
  assert.match(a.problems.join(), /Paridad/);
  assert.throws(() => p.setState(odd), /imposible/);

  // Una pieza fuera de su zona.
  const fixed = p.components.find((c) => c.length === 1)[0];
  const escaped = p.perm.slice();
  [escaped[fixed], escaped[comp[0]]] = [escaped[comp[0]], escaped[fixed]];
  assert.equal(p.analyze(escaped).solvable, false);

  assert.equal(p.analyze([0, 0, 1]).solvable, false);
});

test('fixParity en modo color no cambia el aspecto del tablero', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3), mode: 'color' });
  const comp = p.components.find((c) => c.length > 1);
  const odd = p.perm.slice();
  [odd[comp[0]], odd[comp[1]]] = [odd[comp[1]], odd[comp[0]]];
  const colors = odd.map((x) => p.pieceColor(x));
  p.fixParity(odd);
  assert.ok(p.analyze(odd).solvable);
  assert.deepEqual(odd.map((x) => p.pieceColor(x)), colors);
});

test('randomize genera estados alcanzables y desordenados', () => {
  for (const mode of ['color', 'numerado']) {
    for (const n of [2, 3, 4]) {
      const p = new ProppPuzzle({ heights: P.steppedCube(n), mode });
      const rng = makeRng(n * 31);
      for (let i = 0; i < 20; i++) {
        p.randomize(rng);
        assert.ok(p.analyze().solvable);
        assert.equal(p.isSolved(), false);
        assert.equal(p.moveCount, 0);
      }
    }
  }
});

test('scramble por giros siempre produce estados resolubles', () => {
  const p = new ProppPuzzle({ heights: P.randomStack(4, makeRng(3)) });
  p.scramble(200, makeRng(5));
  assert.ok(p.analyze().solvable);
});

test('serialize / deserialize', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3), mode: 'numerado' });
  p.randomize(makeRng(1));
  p.rotate(2, 1);
  p.rotate(4, 2);
  p.undo();
  const q = ProppPuzzle.deserialize(JSON.parse(JSON.stringify(p.serialize())));
  assert.deepEqual(q.perm, p.perm);
  assert.equal(q.mode, 'numerado');
  assert.equal(q.moveCount, 1);
  assert.ok(q.canRedo());

  const bad = p.serialize();
  const comp = p.components.find((c) => c.length > 1);
  [bad.perm[comp[0]], bad.perm[comp[1]]] = [bad.perm[comp[1]], bad.perm[comp[0]]];
  assert.throws(() => ProppPuzzle.deserialize(bad));
});

test('nearestHexagon encaja con el punto de convergencia más cercano', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3) });
  for (const h of p.hexagons) {
    assert.equal(p.nearestHexagon(h.center[0] + 0.1, h.center[1] - 0.05), h.id);
  }
  assert.equal(p.nearestHexagon(100, 100, 1), -1);
});
