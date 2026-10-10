/*
 * Propp Lozenge — núcleo del motor (sin DOM).
 *
 * Modelo
 * ------
 * El tablero es un hexágono de lado N sobre la rejilla triangular, teselado
 * por rombos (lozenges). Toda teselación de ese hexágono es la proyección
 * isométrica de una pila de cubitos dentro de una caja N×N×N (biyección de
 * Propp/MacMahon entre teselaciones por rombos y particiones planas). Por eso
 * la disposición inicial se describe con una matriz de alturas h[i][j]
 * (no creciente en filas y columnas) y el motor deduce de ella los 3N² rombos.
 *
 * Cada rombo es una CASILLA (slot) fija con una de tres orientaciones:
 *   0 = cara superior (normal +z), 1 = cara izquierda (+y), 2 = cara derecha (+x).
 * Sobre las casillas se mueven PIEZAS. La pieza p nace en la casilla p y su
 * color es la orientación de esa casilla, de modo que el estado resuelto
 * muestra cada orientación con un color uniforme (como las tres caras visibles
 * de un cubo de Rubik estándar).
 *
 * Un "cubito" seleccionable es un vértice de la rejilla en el que convergen
 * exactamente tres rombos, cada uno con su ángulo obtuso (120°) en ese vértice:
 * los tres forman un hexágono regular. Girar ese hexágono 120° o 240° alrededor
 * de su centro lo transforma en sí mismo, así que la teselación se conserva y
 * sólo se permutan cíclicamente las tres piezas.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProppCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SQRT3_2 = Math.sqrt(3) / 2;
  // Proyección isométrica (eje y de pantalla hacia abajo).
  const EX = [SQRT3_2, 0.5];
  const EY = [-SQRT3_2, 0.5];
  const EZ = [0, -1];

  const ORIENT = { TOP: 0, LEFT: 1, RIGHT: 2 };
  const ORIENT_NAMES = ['superior', 'izquierda', 'derecha'];

  function project(x, y, z) {
    return [x * EX[0] + y * EY[0] + z * EZ[0], x * EX[1] + y * EY[1] + z * EZ[1]];
  }

  // Dos puntos 3D con igual (x-z, y-z) caen en el mismo punto de la rejilla.
  function latticeKey(x, y, z) {
    return (x - z) + ',' + (y - z);
  }

  /* ------------------------------------------------------------------ */
  /* Generadores aleatorios                                             */
  /* ------------------------------------------------------------------ */

  // mulberry32: PRNG determinista para tests y semillas reproducibles.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, n) {
    return Math.floor(rng() * n);
  }

  /* ------------------------------------------------------------------ */
  /* Particiones planas                                                 */
  /* ------------------------------------------------------------------ */

  function validateHeights(heights) {
    const n = heights.length;
    if (n < 1) throw new Error('La matriz de alturas está vacía');
    for (let i = 0; i < n; i++) {
      if (!Array.isArray(heights[i]) || heights[i].length !== n) {
        throw new Error('La matriz de alturas debe ser cuadrada (N×N)');
      }
      for (let j = 0; j < n; j++) {
        const h = heights[i][j];
        if (!Number.isInteger(h) || h < 0 || h > n) {
          throw new Error('Altura fuera de rango en (' + i + ',' + j + ')');
        }
        if (i > 0 && heights[i - 1][j] < h) throw new Error('Las alturas deben ser no crecientes en i');
        if (j > 0 && heights[i][j - 1] < h) throw new Error('Las alturas deben ser no crecientes en j');
      }
    }
    return n;
  }

  /* ------------------------------------------------------------------ */
  /* Teselación                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Construye las casillas (rombos) y los hexágonos (cubitos) de la
   * teselación asociada a una partición plana.
   */
  function buildTiling(heights) {
    const n = validateHeights(heights);
    const slots = [];

    // Cara cuadrada unitaria: eje normal, coordenada del plano y origen en
    // los dos ejes que la generan. Las esquinas 0 y 2 son las obtusas.
    function addFace(orient, corners3d) {
      const corners = corners3d.map((c) => project(c[0], c[1], c[2]));
      const keys = corners3d.map((c) => latticeKey(c[0], c[1], c[2]));
      const cx = (corners[0][0] + corners[2][0]) / 2;
      const cy = (corners[0][1] + corners[2][1]) / 2;
      slots.push({ id: slots.length, orient, corners, corners3d, keys, centroid: [cx, cy] });
    }

    // Caras superiores: una por columna (i, j), a la altura h[i][j].
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const z = heights[i][j];
        addFace(ORIENT.TOP, [[i, j, z], [i + 1, j, z], [i + 1, j + 1, z], [i, j + 1, z]]);
      }
    }
    // Caras +x (derecha): para cada (j, k), la pila termina en x = #{i : h[i][j] > k}.
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        let x = 0;
        while (x < n && heights[x][j] > k) x++;
        addFace(ORIENT.RIGHT, [[x, j, k], [x, j + 1, k], [x, j + 1, k + 1], [x, j, k + 1]]);
      }
    }
    // Caras +y (izquierda): para cada (i, k), la pila termina en y = #{j : h[i][j] > k}.
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        let y = 0;
        while (y < n && heights[i][y] > k) y++;
        addFace(ORIENT.LEFT, [[i, y, k], [i, y, k + 1], [i + 1, y, k + 1], [i + 1, y, k]]);
      }
    }

    // Índice de vértices: qué rombos tocan cada punto y con qué ángulo.
    const vertexMap = new Map();
    slots.forEach((s) => {
      s.keys.forEach((key, idx) => {
        if (!vertexMap.has(key)) vertexMap.set(key, { key, point: s.corners[idx], incid: [] });
        vertexMap.get(key).incid.push({ slot: s.id, obtuse: idx % 2 === 0, corner: idx });
      });
    });

    const vertices = [];
    const hexagons = [];
    vertexMap.forEach((v) => {
      const vertex = { key: v.key, point: v.point, slots: v.incid.map((x) => x.slot), hex: -1 };
      const isHex = v.incid.length === 3 && v.incid.every((x) => x.obtuse);
      if (isHex) {
        vertex.hex = hexagons.length;
        hexagons.push(makeHexagon(hexagons.length, v, slots));
      }
      vertices.push(vertex);
    });

    return { n, heights: heights.map((r) => r.slice()), slots, vertices, hexagons };
  }

  function makeHexagon(id, v, slots) {
    const center = v.point;
    // Ordenamos las casillas por ángulo alrededor del centro (sentido horario
    // en pantalla, porque el eje y apunta hacia abajo).
    const ring = v.incid
      .map((x) => x.slot)
      .sort((a, b) => angleOf(slots[a].centroid, center) - angleOf(slots[b].centroid, center));
    // ring[k] -> ring[k+1] es un giro de +120° (horario). Lo verificamos
    // geométricamente en lugar de suponerlo.
    for (let k = 0; k < 3; k++) {
      const p = rotatePoint(slots[ring[k]].centroid, center, (2 * Math.PI) / 3);
      const q = slots[ring[(k + 1) % 3]].centroid;
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) {
        throw new Error('Hexágono degenerado en ' + v.key);
      }
    }
    // Convexo (esquina de cubito que sobresale): las caras se encuentran en su
    // esquina máxima (índice 2). Cóncavo (rincón): esquina mínima (índice 0).
    const convex = v.incid.every((x) => x.corner === 2);
    if (!convex && !v.incid.every((x) => x.corner === 0)) throw new Error('Hexágono mixto en ' + v.key);
    // Volteo de 180°: un cubito convexo se quita de la columna (X-1, Y-1);
    // en un rincón cóncavo se pone un cubito en la columna (X, Y).
    const p3 = slots[v.incid[0].slot].corners3d[v.incid[0].corner];
    const flip = convex ? { i: p3[0] - 1, j: p3[1] - 1, delta: -1 } : { i: p3[0], j: p3[1], delta: 1 };
    return { id, key: v.key, center, ring, kind: convex ? 'convexo' : 'cóncavo', flip };
  }

  function angleOf(p, c) {
    return Math.atan2(p[1] - c[1], p[0] - c[0]);
  }

  function rotatePoint(p, c, a) {
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs];
  }

  /* ------------------------------------------------------------------ */
  /* Validación de un grupo de tres rombos                              */
  /* ------------------------------------------------------------------ */

  function sharedKeys(a, b) {
    return a.keys.filter((k) => b.keys.includes(k));
  }

  // Dos rombos son adyacentes si comparten una arista completa (2 vértices
  // consecutivos de cada uno).
  function shareEdge(a, b) {
    const common = sharedKeys(a, b);
    if (common.length !== 2) return false;
    const ia = common.map((k) => a.keys.indexOf(k));
    const d = Math.abs(ia[0] - ia[1]);
    return d === 1 || d === 3;
  }

  /**
   * Comprueba que un trío de casillas forma un cubito girable alrededor del
   * vértice `key`: tres rombos distintos, una orientación de cada tipo,
   * adyacentes dos a dos y con su ángulo obtuso en el vértice común.
   */
  function validateTriple(tiling, slotIds, key) {
    if (!Array.isArray(slotIds) || slotIds.length !== 3) {
      return { ok: false, code: 'count', reason: 'Se necesitan exactamente tres rombos' };
    }
    if (new Set(slotIds).size !== 3) return { ok: false, code: 'distinct', reason: 'Los rombos deben ser distintos' };
    const s = slotIds.map((id) => tiling.slots[id]);
    if (s.some((x) => !x)) return { ok: false, code: 'missing', reason: 'Rombo inexistente' };
    const orients = new Set(s.map((x) => x.orient));
    if (orients.size !== 3) {
      return { ok: false, code: 'orient', reason: 'Un cubito necesita una cara de cada orientación' };
    }
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) {
        if (!shareEdge(s[a], s[b])) return { ok: false, code: 'adjacent', reason: 'Los rombos no son adyacentes' };
      }
    }
    for (const x of s) {
      const idx = x.keys.indexOf(key);
      if (idx < 0 || idx % 2 !== 0) {
        return { ok: false, code: 'angle', reason: 'Los rombos no convergen con su ángulo obtuso en el vértice' };
      }
    }
    const v = tiling.vertices.find((vv) => vv.key === key);
    if (!v || v.slots.length !== 3) {
      return { ok: false, code: 'crowded', reason: 'Hay más de tres rombos en el punto de convergencia' };
    }
    return { ok: true };
  }

  /* ------------------------------------------------------------------ */
  /* Utilidades de permutaciones                                        */
  /* ------------------------------------------------------------------ */

  // Paridad de la permutación restringida a `positions`:
  // 0 = par, 1 = impar. perm[pos] = pieza que ocupa la casilla pos.
  function parityOn(perm, positions) {
    const index = new Map(positions.map((p, i) => [p, i]));
    const local = positions.map((p) => index.get(perm[p]));
    const seen = new Array(local.length).fill(false);
    let parity = 0;
    for (let i = 0; i < local.length; i++) {
      if (seen[i]) continue;
      let len = 0;
      for (let j = i; !seen[j]; j = local[j]) {
        seen[j] = true;
        len++;
      }
      parity ^= (len - 1) & 1;
    }
    return parity;
  }

  /* ------------------------------------------------------------------ */
  /* Puzzle                                                             */
  /* ------------------------------------------------------------------ */

  // Girar un rombo 60° en sentido horario cambia su orientación:
  // superior → izquierda → derecha → superior (verificado en los tests).
  const NEXT60 = [ORIENT.LEFT, ORIENT.RIGHT, ORIENT.TOP];

  // Movimientos de la herramienta magnética (ángulos en sentido horario):
  //   cw60 = 60°, cw = 120°, flip = 180°, ccw = 240° (−120°), ccw60 = 300° (−60°).
  // 120° y 240° conservan la forma del tablero; 60°, 180° y 300° la cambian
  // (un cubito que sobresale pasa a ser un rincón y viceversa).
  const OPS = ['cw60', 'cw', 'flip', 'ccw', 'ccw60'];
  const SHAPE_OPS = ['cw60', 'flip', 'ccw60'];
  const INVERSE = { cw: 'ccw', ccw: 'cw', flip: 'flip', cw60: 'ccw60', ccw60: 'cw60' };
  // Ángulo con signo que recorre la animación (negativo = antihorario).
  const OP_ANGLE = {
    cw60: Math.PI / 3,
    cw: (2 * Math.PI) / 3,
    flip: Math.PI,
    ccw: (-2 * Math.PI) / 3,
    ccw60: -Math.PI / 3,
  };
  const OP_DEGREES = { cw60: 60, cw: 120, flip: 180, ccw: 240, ccw60: 300 };

  function sameHeights(a, b) {
    return a.length === b.length && a.every((row, i) => row.every((h, j) => h === b[i][j]));
  }

  function cloneHeights(h) {
    return h.map((r) => r.slice());
  }

  /**
   * Formas que se obtienen al girar el tablero completo en múltiplos de 60°.
   * En 3D, girar el hexágono 120° permuta cíclicamente los ejes (x, y, z) y
   * girarlo 180° cambia la pila por su complemento dentro de la caja (el cubo
   * macizo pasa a ser el rincón vacío). Combinando ambas salen los 6 giros.
   * Los tests verifican que coinciden con girar la geometría de los rombos.
   */
  function boardRotationShapes(heights) {
    const n = heights.length;
    const has = (h, i, j, k) => k < h[i][j];
    const build = (f) => {
      const out = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        let c = 0;
        for (let k = 0; k < n; k++) if (f(i, j, k)) c++;
        out[i][j] = c;
      }
      return out;
    };
    const cyc1 = build((i, j, k) => has(heights, k, i, j));
    const cyc2 = build((i, j, k) => has(heights, j, k, i));
    const shapes = [heights, cyc1, cyc2].flatMap((h) => [
      cloneHeights(h),
      build((i, j, k) => !has(h, n - 1 - i, n - 1 - j, n - 1 - k)),
    ]);
    return shapes;
  }

  /**
   * Estado = forma (partición plana) + permutación de piezas.
   *
   * Las casillas tienen una identidad estable aunque cambie la forma: la cara
   * superior de la columna (i, j), la cara +x de la fila (j, k) y la cara +y
   * de la fila (i, k). Un volteo de 180° quita o pone un cubito: las tres caras
   * del hexágono giran media vuelta y caen exactamente en las nuevas posiciones
   * de esas mismas tres casillas, con la misma orientación. Por eso el volteo
   * cambia la forma pero NO la permutación, y los giros de 120°/240° son los
   * únicos que permutan piezas.
   */
  class ProppPuzzle {
    /**
     * @param {object} opts
     * @param {number[][]} opts.heights  partición plana del estado resuelto
     * @param {'color'|'numerado'} [opts.mode]  'color': basta con que cada
     *        orientación tenga su color; 'numerado': cada pieza vuelve a su casilla.
     * @param {string[]} [opts.allowedOps]  movimientos permitidos. Por defecto
     *        sólo el giro mínimo de 60° (horario y antihorario), como la
     *        herramienta magnética del puzzle físico.
     * @param {boolean} [opts.allowFlip]  atajo: true = todos los giros,
     *        false = sólo 120°/240° (la forma no cambia). Permite el volteo de 180° (quitar o
     *        poner un cubito), que cambia la forma del tablero.
     */
    constructor(opts) {
      this.target = buildTiling(opts.heights);
      this.mode = opts.mode === 'numerado' ? 'numerado' : 'color';
      if (Array.isArray(opts.allowedOps)) this.allowedOps = OPS.filter((op) => opts.allowedOps.includes(op));
      else if (opts.allowFlip === true) this.allowedOps = OPS.slice();
      else if (opts.allowFlip === false) this.allowedOps = ['cw', 'ccw'];
      else this.allowedOps = ['cw60', 'ccw60'];
      if (!this.allowedOps.length) throw new Error('No hay movimientos permitidos');
      // ¿Puede cambiar la forma del tablero?
      this.allowFlip = this.allowedOps.some((op) => SHAPE_OPS.includes(op));
      this.slotCount = this.target.slots.length;
      this.perm = Array.from({ length: this.slotCount }, (_, i) => i);
      this.history = [];
      this.future = [];
      this.listeners = new Set();
      this._setTiling(this.target);
      this._buildComponents();
      // Formas que, vistas con el tablero girado, son la forma objetivo.
      this.targetShapes = boardRotationShapes(this.target.heights);
    }

    /* ---- Estructura ---- */

    get hexagons() {
      return this.tiling.hexagons;
    }

    get heights() {
      return this.tiling.heights;
    }

    _setTiling(tiling) {
      this.tiling = tiling;
      this.hexByKey = new Map(tiling.hexagons.map((h) => [h.key, h]));
      // Casillas que, con la forma actual, pertenecen a algún cubito girable.
      this.movable = new Array(this.slotCount).fill(false);
      tiling.hexagons.forEach((h) => h.ring.forEach((s) => (this.movable[s] = true)));
    }

    // Zonas: conjuntos de casillas entre los que pueden viajar las piezas.
    // Sin volteo, son las componentes conexas de los hexágonos (fijos). Con
    // volteo, cualquier forma es alcanzable y los hexágonos de todas las formas
    // enlazan todas las casillas (verificado en los tests), así que hay una
    // sola zona.
    _buildComponents() {
      if (this.allowFlip) {
        this.components = [Array.from({ length: this.slotCount }, (_, i) => i)];
      } else {
        const parent = Array.from({ length: this.slotCount }, (_, i) => i);
        const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
        this.target.hexagons.forEach((h) => {
          parent[find(h.ring[1])] = find(h.ring[0]);
          parent[find(h.ring[2])] = find(h.ring[0]);
        });
        const groups = new Map();
        for (let s = 0; s < this.slotCount; s++) {
          const r = find(s);
          if (!groups.has(r)) groups.set(r, []);
          groups.get(r).push(s);
        }
        this.components = [...groups.values()];
      }
      this.componentOf = new Array(this.slotCount);
      this.components.forEach((c, ci) => c.forEach((s) => (this.componentOf[s] = ci)));
      // Casillas que pueden moverse en algún momento de la partida.
      this.everMovable = new Array(this.slotCount).fill(false);
      this.components.forEach((c) => c.length > 1 && c.forEach((s) => (this.everMovable[s] = true)));
    }

    pieceColor(piece) {
      return this.target.slots[piece].orient;
    }

    colorAt(slot) {
      return this.pieceColor(this.perm[slot]);
    }

    /* ---- Selección ---- */

    /** Hexágono (cubito) más cercano a un punto en unidades de la rejilla. */
    nearestHexagon(x, y, maxDist = Infinity) {
      let best = -1;
      let bestD = maxDist;
      for (const h of this.hexagons) {
        const d = Math.hypot(h.center[0] - x, h.center[1] - y);
        if (d < bestD) {
          bestD = d;
          best = h.id;
        }
      }
      return best;
    }

    /** Vértice de la rejilla más cercano (válido o no). */
    nearestVertex(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const v of this.tiling.vertices) {
        const d = Math.hypot(v.point[0] - x, v.point[1] - y);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      return best;
    }

    /** Hexágono cuyo centro es el vértice `key`, o -1. */
    hexAt(key) {
      const h = this.hexByKey.get(key);
      return h ? h.id : -1;
    }

    /**
     * Valida un movimiento antes de ejecutarlo o animarlo. Si no es válido
     * devuelve un `code` estable (para traducir el mensaje) y un `reason` legible.
     * @param {number} hexId
     * @param {'cw60'|'cw'|'flip'|'ccw'|'ccw60'} op
     */
    validateMove(hexId, op, internal = false) {
      if (!OPS.includes(op)) return { ok: false, code: 'bad-op', reason: 'Sólo se permiten giros múltiplos de 60°' };
      // Deshacer aplica el giro inverso aunque el jugador no pueda usarlo
      // directamente (p. ej. −60° cuando sólo se permite +60°).
      if (!internal && !this.allowedOps.includes(op)) {
        const list = [...new Set(this.allowedOps.map((o) => Math.min(OP_DEGREES[o], 360 - OP_DEGREES[o])))];
        return { ok: false, code: 'not-allowed', reason: 'Sólo se permite girar ' + list.join('° o ') + '°' };
      }
      const h = this.hexagons[hexId];
      if (!h) return { ok: false, code: 'no-hex', reason: 'No hay un cubito válido en ese punto' };
      const check = validateTriple(this.tiling, h.ring, h.key);
      if (!check.ok) return check;
      if (SHAPE_OPS.includes(op)) {
        const next = this.tiling.heights[h.flip.i] && this.tiling.heights[h.flip.i][h.flip.j];
        if (next === undefined || next + h.flip.delta < 0 || next + h.flip.delta > this.tiling.n) {
          return { ok: false, code: 'out-of-box', reason: 'El volteo sacaría un cubito de la caja' };
        }
      }
      return { ok: true };
    }

    /* ---- Movimientos ---- */

    // Aplica un movimiento ya validado y devuelve la transición para animarla.
    _apply(hexId, op) {
      const h = this.hexagons[hexId];
      const before = { tiling: this.tiling, perm: this.perm.slice() };
      const cycle = (hex, turns) => {
        const old = hex.ring.map((s) => this.perm[s]);
        for (let k = 0; k < 3; k++) this.perm[hex.ring[(k + turns) % 3]] = old[k];
      };
      if (SHAPE_OPS.includes(op)) {
        const heights = cloneHeights(this.tiling.heights);
        heights[h.flip.i][h.flip.j] += h.flip.delta;
        this._setTiling(buildTiling(heights));
        // 60° = 180° + 240° y 300° = 180° + 120°: tras el volteo, el mismo
        // centro sigue siendo un cubito y completamos el giro sobre él.
        if (op !== 'flip') cycle(this.hexByKey.get(h.key), op === 'cw60' ? 2 : 1);
      } else {
        cycle(h, op === 'cw' ? 1 : 2);
      }
      return {
        op,
        key: h.key,
        center: h.center,
        ring: h.ring.slice(),
        angle: OP_ANGLE[op],
        before,
        after: { tiling: this.tiling, perm: this.perm.slice() },
      };
    }

    /**
     * Ejecuta un movimiento: 'cw60' (60° horario), 'cw' (120°), 'flip' (180°),
     * 'ccw' (240° = 120° antihorario) o 'ccw60' (300° = 60° antihorario).
     * @returns {{ok:boolean, reason?:string, transition?:object}}
     */
    move(hexId, op) {
      const check = this.validateMove(hexId, op);
      if (!check.ok) return check;
      const transition = this._apply(hexId, op);
      this.history.push({ key: transition.key, op });
      this.future.length = 0;
      this._emit({ type: 'move', transition });
      return { ok: true, transition };
    }

    /** Giro de 120° (turns = 1) o 240° (turns = 2) en sentido horario. */
    rotate(hexId, turns = 1) {
      return this.move(hexId, turns === 1 ? 'cw' : turns === 2 ? 'ccw' : 'invalid');
    }

    flip(hexId) {
      return this.move(hexId, 'flip');
    }

    canUndo() {
      return this.history.length > 0;
    }

    canRedo() {
      return this.future.length > 0;
    }

    /** Deshace el último movimiento. Devuelve la transición (para animarla) o null. */
    undo() {
      const m = this.history[this.history.length - 1];
      if (!m) return null;
      const hexId = this.hexAt(m.key);
      const op = INVERSE[m.op];
      if (!this.validateMove(hexId, op, true).ok) return null;
      this.history.pop();
      const transition = this._apply(hexId, op);
      this.future.push(m);
      this._emit({ type: 'undo', transition });
      return transition;
    }

    redo() {
      const m = this.future[this.future.length - 1];
      if (!m) return null;
      const hexId = this.hexAt(m.key);
      if (!this.validateMove(hexId, m.op, true).ok) return null;
      this.future.pop();
      const transition = this._apply(hexId, m.op);
      this.history.push(m);
      this._emit({ type: 'redo', transition });
      return transition;
    }

    get moveCount() {
      return this.history.length;
    }

    /* ---- Estado ---- */

    _slotOk(s, perm, tiling) {
      if (tiling !== this.target && tiling.slots[s].keys.join() !== this.target.slots[s].keys.join()) return false;
      return this.mode === 'numerado' ? perm[s] === s : this.pieceColor(perm[s]) === this.target.slots[s].orient;
    }

    /**
     * Resuelto:
     *  - modo color: la forma original vista con el tablero en cualquier
     *    orientación (girar el tablero 60° convierte el cubo macizo en el
     *    rincón vacío) y cada cara (orientación) de un solo color, sea cual
     *    sea. Vale cualquier reparto de los 3 colores entre las 3 caras; todos
     *    son alcanzables porque en modo color cualquier colocación tiene
     *    solución.
     *  - modo numerado: la forma original y cada pieza en su casilla exacta.
     */
    _isSolvedState(perm, heights) {
      if (this.mode === 'numerado') {
        if (!sameHeights(heights, this.target.heights)) return false;
        for (let s = 0; s < this.slotCount; s++) if (perm[s] !== s) return false;
        return true;
      }
      if (!this.targetShapes.some((h) => sameHeights(h, heights))) return false;
      const faceColor = [-1, -1, -1];
      for (let s = 0; s < this.slotCount; s++) {
        const o = this.target.slots[s].orient;
        const c = this.pieceColor(perm[s]);
        if (faceColor[o] === -1) faceColor[o] = c;
        else if (faceColor[o] !== c) return false;
      }
      return true;
    }

    isSolved() {
      return this._isSolvedState(this.perm, this.tiling.heights);
    }

    /** Fracción de casillas correctas (forma y pieza) para la barra de progreso. */
    progress() {
      let ok = 0;
      let total = 0;
      for (let s = 0; s < this.slotCount; s++) {
        if (!this.everMovable[s]) continue;
        total++;
        if (this._slotOk(s, this.perm, this.tiling)) ok++;
      }
      return total ? ok / total : 1;
    }

    /**
     * Analiza si un estado es alcanzable desde el estado resuelto.
     *
     * Cada giro es un 3-ciclo, es decir, una permutación PAR, y el volteo no
     * permuta piezas. Los 3-ciclos de una zona conexa generan exactamente el
     * grupo alternado sobre ella, así que un estado es alcanzable si y sólo si:
     *   1. la forma es una partición plana válida (y, sin volteo, la original),
     *   2. es una permutación de las piezas,
     *   3. ninguna pieza ha salido de su zona,
     *   4. la permutación restringida a cada zona es par.
     * (Con volteo, las particiones planas están conectadas por volteos, así que
     * toda forma es alcanzable con cualquier permutación par.)
     */
    analyze(perm = this.perm, heights = this.tiling.heights) {
      const problems = [];
      try {
        if (validateHeights(heights) !== this.target.n) problems.push('La forma no tiene el tamaño del tablero');
      } catch (e) {
        problems.push('Forma inválida: ' + e.message);
      }
      if (!problems.length && !this.allowFlip && !sameHeights(heights, this.target.heights)) {
        problems.push('Sin volteo la forma del tablero no puede cambiar');
      }
      if (!Array.isArray(perm) || perm.length !== this.slotCount) {
        return { solvable: false, problems: problems.concat('Tamaño de estado incorrecto'), oddComponents: [] };
      }
      const seen = new Set(perm);
      if (seen.size !== this.slotCount || perm.some((p) => !Number.isInteger(p) || p < 0 || p >= this.slotCount)) {
        return { solvable: false, problems: problems.concat('El estado no es una permutación de las piezas'), oddComponents: [] };
      }
      const oddComponents = [];
      this.components.forEach((comp, ci) => {
        if (comp.some((s) => this.componentOf[perm[s]] !== ci)) {
          problems.push('Una pieza ocupa una zona del tablero a la que no puede llegar');
          return;
        }
        if (parityOn(perm, comp) === 1) oddComponents.push(ci);
      });
      if (oddComponents.length) problems.push('Paridad impar en ' + oddComponents.length + ' zona(s)');
      return { solvable: problems.length === 0, problems, oddComponents };
    }

    /**
     * Corrige la paridad de un estado impar con una transposición.
     * En modo color se intercambian dos piezas del MISMO color, de modo que el
     * aspecto del tablero no cambia; si no existe tal pareja (o en modo
     * numerado) se intercambian las dos primeras piezas de la zona.
     */
    fixParity(perm, heights = this.tiling.heights) {
      const { oddComponents = [] } = this.analyze(perm, heights);
      oddComponents.forEach((ci) => {
        const comp = this.components[ci];
        let pair = null;
        if (this.mode === 'color') {
          const byColor = new Map();
          for (const s of comp) {
            const c = this.pieceColor(perm[s]);
            if (byColor.has(c)) {
              pair = [byColor.get(c), s];
              break;
            }
            byColor.set(c, s);
          }
        }
        if (!pair) pair = [comp[0], comp[1]];
        const t = perm[pair[0]];
        perm[pair[0]] = perm[pair[1]];
        perm[pair[1]] = t;
      });
      return perm;
    }

    /** Forma aleatoria alcanzable: paseo aleatorio de volteos desde la forma resuelta. */
    _randomShape(rng) {
      let tiling = this.target;
      const steps = 12 * Math.pow(tiling.n, 3);
      for (let k = 0; k < steps && tiling.hexagons.length; k++) {
        const h = tiling.hexagons[randInt(rng, tiling.hexagons.length)];
        const heights = cloneHeights(tiling.heights);
        heights[h.flip.i][h.flip.j] += h.flip.delta;
        tiling = buildTiling(heights);
      }
      return tiling.heights;
    }

    /**
     * Estado inicial aleatorio entre los estados ALCANZABLES: baraja cada zona,
     * corrige la paridad y, con volteo, elige además una forma aleatoria.
     */
    randomize(rng = Math.random) {
      let perm;
      let heights;
      let tries = 0;
      do {
        perm = Array.from({ length: this.slotCount }, (_, i) => i);
        for (const comp of this.components) {
          for (let k = comp.length - 1; k > 0; k--) {
            const r = randInt(rng, k + 1);
            const t = perm[comp[k]];
            perm[comp[k]] = perm[comp[r]];
            perm[comp[r]] = t;
          }
        }
        heights = this.allowFlip ? this._randomShape(rng) : this.target.heights;
        this.fixParity(perm, heights);
      } while (this._isSolvedState(perm, heights) && this.target.hexagons.length > 0 && ++tries < 50);
      this.setState(perm, heights);
    }

    /** Mezcla aplicando `count` movimientos aleatorios (alternativa a randomize). */
    scramble(count, rng = Math.random) {
      let lastKey = null;
      for (let i = 0; i < count && this.hexagons.length; i++) {
        let h;
        let guard = 0;
        do h = this.hexagons[randInt(rng, this.hexagons.length)];
        while (h.key === lastKey && this.hexagons.length > 1 && ++guard < 20);
        lastKey = h.key;
        this._apply(h.id, this.allowedOps[randInt(rng, this.allowedOps.length)]);
      }
      this.setState(this.perm, this.tiling.heights);
    }

    /** Reemplaza el estado (permutación y forma) tras validarlo. Borra el historial. */
    setState(perm, heights = this.tiling.heights) {
      const a = this.analyze(perm, heights);
      if (!a.solvable) throw new Error('Estado imposible: ' + a.problems.join('; '));
      if (!sameHeights(heights, this.tiling.heights)) {
        this._setTiling(sameHeights(heights, this.target.heights) ? this.target : buildTiling(heights));
      }
      this.perm = perm.slice();
      this.history = [];
      this.future = [];
      this._emit({ type: 'reset' });
    }

    reset() {
      this.setState(Array.from({ length: this.slotCount }, (_, i) => i), this.target.heights);
    }

    setMode(mode) {
      this.mode = mode === 'numerado' ? 'numerado' : 'color';
      this._emit({ type: 'mode' });
    }

    serialize() {
      return {
        heights: cloneHeights(this.target.heights),
        current: cloneHeights(this.tiling.heights),
        mode: this.mode,
        allowedOps: this.allowedOps.slice(),
        perm: this.perm.slice(),
        history: this.history.slice(),
        future: this.future.slice(),
      };
    }

    /** Reconstruye una partida validando la forma, la paridad y el historial. */
    static deserialize(data) {
      const opts = { heights: data.heights, mode: data.mode, allowedOps: data.allowedOps };
      const p = new ProppPuzzle(opts);
      p.setState(data.perm, data.current || data.heights);
      const okList = (list) => Array.isArray(list) && list.every((m) => m && typeof m.key === 'string' && OPS.includes(m.op));
      if (okList(data.history) && okList(data.future)) {
        // Comprobamos que todo el historial se puede deshacer y rehacer.
        const probe = new ProppPuzzle(opts);
        probe.setState(data.perm, data.current || data.heights);
        probe.history = data.history.slice();
        probe.future = data.future.slice();
        let ok = true;
        const n = probe.history.length;
        for (let i = 0; i < n && ok; i++) ok = probe.undo() !== null;
        for (let i = 0; i < n + data.future.length && ok; i++) ok = probe.redo() !== null;
        if (ok) {
          p.history = data.history.slice();
          p.future = data.future.slice();
        }
      }
      return p;
    }

    on(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    _emit(ev) {
      this.listeners.forEach((fn) => fn(ev, this));
    }
  }

  return {
    ORIENT,
    ORIENT_NAMES,
    NEXT60,
    OPS,
    OP_DEGREES,
    project,
    latticeKey,
    makeRng,
    validateHeights,
    buildTiling,
    validateTriple,
    shareEdge,
    parityOn,
    rotatePoint,
    sameHeights,
    boardRotationShapes,
    ProppPuzzle,
  };
});
