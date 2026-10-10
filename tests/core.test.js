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
  const p = new ProppPuzzle({ heights: P.solidCube(3), allowFlip: false });
  assert.equal(p.hexagons.length, 1);
  assert.equal(p.hexagons[0].kind, 'convexo');
});

test('el tablero por defecto (N=3) maximiza las piezas móviles', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3), allowFlip: false });
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
  const p = new ProppPuzzle({ heights: P.steppedCube(3), allowFlip: false });
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
  const p = new ProppPuzzle({ heights: P.steppedCube(3), allowFlip: false });
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
  const p = new ProppPuzzle({ heights: P.steppedCube(3), allowFlip: false });
  assert.equal(p.rotate(0, 3).ok, false);
  assert.equal(p.rotate(0, 0).ok, false);
  assert.equal(p.rotate(999, 1).ok, false);
  assert.equal(p.rotate(-1, 1).ok, false);
  assert.ok(p.isSolved());
  assert.equal(p.moveCount, 0);
});

test('undo/redo restauran exactamente los estados', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3), allowFlip: false });
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
  const p = new ProppPuzzle({ heights: [[1, 1], [1, 0]], allowFlip: false });
  const sizes = p.components.map((c) => c.length).filter((x) => x > 1).sort();
  assert.deepEqual(sizes, [3, 7]);
  const start = p.perm.slice();
  const seen = new Set([start.join()]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.pop();
    for (const h of p.hexagons) {
      p.perm = cur.slice();
      p._apply(h.id, 'cw');
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
  const p = new ProppPuzzle({ heights: P.steppedCube(3), mode: 'numerado', allowFlip: false });
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
  const p = new ProppPuzzle({ heights: P.steppedCube(3), mode: 'color', allowFlip: false });
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
      const p = new ProppPuzzle({ heights: P.steppedCube(n), mode, allowFlip: false });
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
  const p = new ProppPuzzle({ heights: P.randomStack(4, makeRng(3)), allowFlip: false });
  p.scramble(200, makeRng(5));
  assert.ok(p.analyze().solvable);
});

test('serialize / deserialize', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3), mode: 'numerado', allowFlip: false });
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
  const p = new ProppPuzzle({ heights: P.steppedCube(3), allowFlip: false });
  for (const h of p.hexagons) {
    assert.equal(p.nearestHexagon(h.center[0] + 0.1, h.center[1] - 0.05), h.id);
  }
  assert.equal(p.nearestHexagon(100, 100, 1), -1);
});

/* ---------------- Volteo de 180° ---------------- */

function keyRot180(key, center) {
  const [u, v] = key.split(',').map(Number);
  const [cu, cv] = center.split(',').map(Number);
  return 2 * cu - u + ',' + (2 * cv - v);
}

test('NEXT60 describe cómo cambia la orientación al girar', () => {
  for (const h of allPartitions(3)) {
    const t = buildTiling(h);
    for (const hex of t.hexagons) {
      hex.ring.forEach((s, k) => {
        const o = t.slots[s].orient;
        const landed = t.slots[hex.ring[(k + 1) % 3]].orient;
        assert.equal(landed, C.NEXT60[C.NEXT60[o]]);
      });
    }
  }
});

test('el volteo gira 180° las tres casillas y conserva su identidad', () => {
  for (const h of allPartitions(3)) {
    const p = new ProppPuzzle({ heights: h, allowFlip: true });
    for (const hex of p.hexagons) {
      const q = new ProppPuzzle({ heights: h, allowFlip: true });
      const res = q.flip(hex.id);
      assert.ok(res.ok, res.reason);
      const before = p.tiling.slots;
      const after = q.tiling.slots;
      for (let s = 0; s < p.slotCount; s++) {
        if (hex.ring.includes(s)) {
          const rotated = before[s].keys.map((k) => keyRot180(k, hex.key)).sort().join('|');
          assert.equal(after[s].keys.slice().sort().join('|'), rotated);
          assert.equal(after[s].orient, before[s].orient);
        } else {
          assert.deepEqual(after[s].keys, before[s].keys);
        }
      }
      // El centro sigue siendo un cubito (convexo <-> cóncavo) y volver a voltear lo deshace.
      const back = q.hexAt(hex.key);
      assert.ok(back >= 0);
      assert.notEqual(q.hexagons[back].kind, hex.kind);
      q.flip(back);
      assert.ok(C.sameHeights(q.heights, h));
      assert.deepEqual(q.perm, p.perm);
    }
  }
});

test('con volteo, los cubitos de todas las formas enlazan todas las casillas', () => {
  for (const n of [1, 2, 3]) {
    const parent = Array.from({ length: 3 * n * n }, (_, i) => i);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const h of allPartitions(n)) {
      for (const hex of buildTiling(h).hexagons) {
        parent[find(hex.ring[1])] = find(hex.ring[0]);
        parent[find(hex.ring[2])] = find(hex.ring[0]);
      }
    }
    assert.equal(new Set(parent.map(find)).size, 1, 'N=' + n);
  }
});

test('con volteo, N=1 alcanza exactamente 2 formas × |A3| estados', () => {
  const p = new ProppPuzzle({ heights: [[1]], allowFlip: true });
  const key = () => JSON.stringify([p.heights, p.perm]);
  const seen = new Set([key()]);
  const queue = [[p.heights, p.perm.slice()]];
  while (queue.length) {
    const [h, perm] = queue.pop();
    for (const op of ['cw', 'ccw', 'flip']) {
      p.setState(perm, h);
      p.move(0, op);
      if (!seen.has(key())) {
        seen.add(key());
        queue.push([p.heights, p.perm.slice()]);
      }
    }
  }
  assert.equal(seen.size, 6);
});

test('cubo macizo con volteo: el estado aleatorio desordena todo el tablero', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3), allowFlip: true });
  const rng = makeRng(11);
  const touched = new Set();
  for (let i = 0; i < 20; i++) {
    p.randomize(rng);
    assert.ok(p.analyze().solvable);
    assert.equal(p.isSolved(), false);
    p.perm.forEach((x, s) => x !== s && touched.add(s));
  }
  assert.equal(touched.size, 27);
});

test('cubo macizo con volteo: se puede resolver deshaciendo una mezcla', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3), allowFlip: true, mode: 'numerado' });
  const rng = makeRng(2);
  for (let i = 0; i < 300; i++) {
    const h = Math.floor(rng() * p.hexagons.length);
    assert.ok(p.move(h, ['cw', 'ccw', 'flip'][Math.floor(rng() * 3)]).ok);
  }
  assert.equal(p.isSolved(), false);
  const saved = ProppPuzzle.deserialize(JSON.parse(JSON.stringify(p.serialize())));
  assert.equal(saved.moveCount, 300);
  while (saved.canUndo()) assert.ok(saved.undo());
  assert.ok(saved.isSolved());
});

test('sin volteo, voltear está bloqueado y la forma no puede cambiar', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3), allowFlip: false });
  assert.equal(p.flip(0).ok, false);
  const other = P.steppedCube(3);
  assert.equal(p.analyze(p.perm, other).solvable, false);
  assert.throws(() => p.setState(p.perm, other));
});

/* ---------------- Giros de 60° ---------------- */

test('el giro de 60° lleva cada pieza a la casilla girada 60°', () => {
  for (const h of allPartitions(3)) {
    const p = new ProppPuzzle({ heights: h, allowFlip: true });
    for (const hex of p.hexagons) {
      for (const [op, sign] of [['cw60', 1], ['ccw60', -1]]) {
        const q = new ProppPuzzle({ heights: h, allowFlip: true });
        const res = q.move(hex.id, op);
        assert.ok(res.ok, res.reason);
        for (const s of hex.ring) {
          const piece = p.perm[s];
          const t = q.perm.indexOf(piece);
          const target = C.rotatePoint(p.tiling.slots[s].centroid, hex.center, (sign * Math.PI) / 3);
          const c = q.tiling.slots[t].centroid;
          assert.ok(Math.hypot(target[0] - c[0], target[1] - c[1]) < 1e-9, op + ' en ' + hex.key);
          const o = p.tiling.slots[s].orient;
          assert.equal(q.tiling.slots[t].orient, sign > 0 ? C.NEXT60[o] : C.NEXT60[C.NEXT60[o]]);
        }
      }
    }
  }
});

test('seis giros de 60° vuelven al inicio; 60° y −60° se anulan', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3), allowFlip: true, mode: 'numerado' });
  for (let i = 0; i < 6; i++) {
    assert.ok(p.move(p.hexAt('0,0'), 'cw60').ok);
    if (i < 5) assert.equal(p.isSolved(), false);
  }
  assert.ok(p.isSolved());
  p.move(p.hexAt('0,0'), 'cw60');
  p.move(p.hexAt('0,0'), 'ccw60');
  assert.ok(p.isSolved());
  p.undo();
  p.undo();
  p.redo();
  assert.equal(p.isSolved(), false);
});

test('sin cambio de forma se bloquean 60°, 180° y 300°', () => {
  const p = new ProppPuzzle({ heights: P.steppedCube(3), allowFlip: false });
  for (const op of ['cw60', 'flip', 'ccw60']) assert.equal(p.move(0, op).ok, false);
  assert.equal(p.move(0, 'cw').ok, true);
});

test('una colocación completamente aleatoria de las 27 fichas siempre tiene solución (modo color)', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3), allowFlip: true });
  const rng = makeRng(99);
  for (let i = 0; i < 200; i++) {
    // Cualquier permutación: si es impar, intercambiar dos fichas del mismo
    // color la vuelve par sin cambiar lo que se ve.
    const perm = Array.from({ length: 27 }, (_, k) => k);
    for (let k = 26; k > 0; k--) {
      const r = Math.floor(rng() * (k + 1));
      [perm[k], perm[r]] = [perm[r], perm[k]];
    }
    const colors = perm.map((x) => p.pieceColor(x));
    p.fixParity(perm, p.target.heights);
    assert.ok(p.analyze(perm, p.target.heights).solvable);
    assert.deepEqual(perm.map((x) => p.pieceColor(x)), colors);
  }
});

test('por defecto (como el puzzle físico) sólo se permite girar 60°', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3) });
  assert.deepEqual(p.allowedOps, ['cw60', 'ccw60']);
  for (const op of ['cw', 'ccw', 'flip']) {
    const r = p.move(0, op);
    assert.equal(r.ok, false);
    assert.match(r.reason, /60°/);
  }
  assert.ok(p.move(0, 'cw60').ok);
  // 120° = dos giros de 60°.
  const q = new ProppPuzzle({ heights: P.solidCube(3), allowFlip: true });
  q.move(0, 'cw');
  p.move(p.hexAt('0,0'), 'cw60');
  assert.deepEqual(p.perm, q.perm);
  assert.ok(C.sameHeights(p.heights, q.heights));
  // Mezclar y deserializar respetan los movimientos permitidos.
  p.scramble(100, makeRng(4));
  const r = ProppPuzzle.deserialize(JSON.parse(JSON.stringify(p.serialize())));
  assert.deepEqual(r.allowedOps, ['cw60', 'ccw60']);
});

test('con sólo +60° permitido, −60° se bloquea pero deshacer y rehacer funcionan', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3), mode: 'color', allowedOps: ['cw60'] });
  assert.equal(p.move(0, 'ccw60').ok, false);
  const rng = makeRng(8);
  for (let i = 0; i < 50; i++) assert.ok(p.move(Math.floor(rng() * p.hexagons.length), 'cw60').ok);
  const saved = ProppPuzzle.deserialize(JSON.parse(JSON.stringify(p.serialize())));
  assert.equal(saved.moveCount, 50);
  while (p.canUndo()) assert.ok(p.undo());
  assert.ok(p.isSolved());
  while (p.canRedo()) assert.ok(p.redo());
  assert.ok(C.sameHeights(p.heights, saved.heights));
  assert.deepEqual(p.perm, saved.perm);
  // La mezcla aleatoria sólo usa el giro permitido.
  p.reset();
  p.randomize(rng);
  assert.ok(p.analyze().solvable);
});

test('modo color: gana cualquier reparto de los 3 colores entre las 3 caras', () => {
  const p = new ProppPuzzle({ heights: P.solidCube(3), mode: 'color', allowedOps: ['cw60'] });
  const orientOf = (s) => p.target.slots[s].orient;
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const sigma of perms) {
    // Cada casilla de orientación o recibe una ficha de color sigma[o].
    const pool = [[], [], []];
    for (let piece = 0; piece < 27; piece++) pool[p.pieceColor(piece)].push(piece);
    const perm = Array.from({ length: 27 }, (_, s) => pool[sigma[orientOf(s)]].pop());
    p.fixParity(perm, p.target.heights);
    assert.ok(p.analyze(perm, p.target.heights).solvable, 'reparto ' + sigma + ' alcanzable');
    p.setState(perm, p.target.heights);
    assert.ok(p.isSolved(), 'reparto ' + sigma + ' cuenta como resuelto');
  }
  // Una cara con dos colores no está resuelta.
  p.reset();
  const perm = p.perm.slice();
  const top = perm.findIndex((x, s) => orientOf(s) === 0);
  const left = perm.findIndex((x, s) => orientOf(s) === 1);
  [perm[top], perm[left]] = [perm[left], perm[top]];
  p.fixParity(perm, p.target.heights);
  p.setState(perm, p.target.heights);
  assert.equal(p.isSolved(), false);
  // La forma también cuenta: caras uniformes pero sin la forma del cubo no gana.
  p.reset();
  p.move(p.hexAt('0,0'), 'cw60');
  assert.equal(p.isSolved(), false);
});
