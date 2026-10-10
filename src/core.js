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
      slots.push({ id: slots.length, orient, corners, keys, centroid: [cx, cy] });
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
    const kind = v.incid.every((x) => x.corner === 2) ? 'convexo' : 'cóncavo';
    return { id, key: v.key, center, ring, kind };
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
      return { ok: false, reason: 'Se necesitan exactamente tres rombos' };
    }
    if (new Set(slotIds).size !== 3) return { ok: false, reason: 'Los rombos deben ser distintos' };
    const s = slotIds.map((id) => tiling.slots[id]);
    if (s.some((x) => !x)) return { ok: false, reason: 'Rombo inexistente' };
    const orients = new Set(s.map((x) => x.orient));
    if (orients.size !== 3) {
      return { ok: false, reason: 'Un cubito necesita una cara de cada orientación' };
    }
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) {
        if (!shareEdge(s[a], s[b])) return { ok: false, reason: 'Los rombos no son adyacentes' };
      }
    }
    for (const x of s) {
      const idx = x.keys.indexOf(key);
      if (idx < 0 || idx % 2 !== 0) {
        return { ok: false, reason: 'Los rombos no convergen con su ángulo obtuso en el vértice' };
      }
    }
    const v = tiling.vertices.find((vv) => vv.key === key);
    if (!v || v.slots.length !== 3) {
      return { ok: false, reason: 'Hay más de tres rombos en el punto de convergencia' };
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

  class ProppPuzzle {
    /**
     * @param {object} opts
     * @param {number[][]} opts.heights  partición plana que define el tablero
     * @param {'color'|'numerado'} [opts.mode]  'color': basta con que cada
     *        orientación tenga su color; 'numerado': cada pieza vuelve a su casilla.
     */
    constructor(opts) {
      this.tiling = buildTiling(opts.heights);
      this.mode = opts.mode === 'numerado' ? 'numerado' : 'color';
      this.slotCount = this.tiling.slots.length;
      this.perm = Array.from({ length: this.slotCount }, (_, i) => i);
      this.history = [];
      this.future = [];
      this.listeners = new Set();
      this._buildComponents();
    }

    /* ---- Estructura ---- */

    get hexagons() {
      return this.tiling.hexagons;
    }

    // Componentes conexas de casillas enlazadas por hexágonos que se solapan.
    // Una pieza nunca puede salir de su componente.
    _buildComponents() {
      const parent = Array.from({ length: this.slotCount }, (_, i) => i);
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      this.hexagons.forEach((h) => {
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
      this.componentOf = new Array(this.slotCount);
      this.components.forEach((c, ci) => c.forEach((s) => (this.componentOf[s] = ci)));
      this.movable = new Array(this.slotCount).fill(false);
      this.hexagons.forEach((h) => h.ring.forEach((s) => (this.movable[s] = true)));
    }

    pieceColor(piece) {
      return this.tiling.slots[piece].orient;
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

    /** Valida que un movimiento sea legal antes de ejecutarlo o animarlo. */
    validateMove(hexId, turns) {
      if (turns !== 1 && turns !== 2) {
        return { ok: false, reason: 'Sólo se permiten giros de 120° o 240°' };
      }
      const h = this.hexagons[hexId];
      if (!h) return { ok: false, reason: 'No hay un cubito válido en ese punto' };
      return validateTriple(this.tiling, h.ring, h.key);
    }

    /* ---- Movimientos ---- */

    // Gira las piezas del hexágono `turns` × 120° en sentido horario.
    _apply(hexId, turns) {
      const ring = this.hexagons[hexId].ring;
      const old = ring.map((s) => this.perm[s]);
      for (let k = 0; k < 3; k++) this.perm[ring[(k + turns) % 3]] = old[k];
    }

    /**
     * Ejecuta un giro. turns = 1 (120° horario) o 2 (240° horario = 120° antihorario).
     * @returns {{ok:boolean, reason?:string}}
     */
    rotate(hexId, turns = 1) {
      const check = this.validateMove(hexId, turns);
      if (!check.ok) return check;
      this._apply(hexId, turns);
      this.history.push({ hex: hexId, turns });
      this.future.length = 0;
      this._emit({ type: 'move', hex: hexId, turns });
      return { ok: true };
    }

    canUndo() {
      return this.history.length > 0;
    }

    canRedo() {
      return this.future.length > 0;
    }

    /** Deshace el último giro. Devuelve el giro inverso aplicado (para animarlo). */
    undo() {
      const m = this.history.pop();
      if (!m) return null;
      const inv = { hex: m.hex, turns: 3 - m.turns };
      this._apply(inv.hex, inv.turns);
      this.future.push(m);
      this._emit({ type: 'undo', hex: inv.hex, turns: inv.turns });
      return inv;
    }

    redo() {
      const m = this.future.pop();
      if (!m) return null;
      this._apply(m.hex, m.turns);
      this.history.push(m);
      this._emit({ type: 'redo', hex: m.hex, turns: m.turns });
      return m;
    }

    get moveCount() {
      return this.history.length;
    }

    /* ---- Estado ---- */

    isSolved() {
      for (let s = 0; s < this.slotCount; s++) {
        if (this.mode === 'numerado' ? this.perm[s] !== s : this.colorAt(s) !== this.tiling.slots[s].orient) {
          return false;
        }
      }
      return true;
    }

    /** Fracción de casillas correctas (para la barra de progreso). */
    progress() {
      let ok = 0;
      let total = 0;
      for (let s = 0; s < this.slotCount; s++) {
        if (!this.movable[s]) continue;
        total++;
        const good = this.mode === 'numerado' ? this.perm[s] === s : this.colorAt(s) === this.tiling.slots[s].orient;
        if (good) ok++;
      }
      return total ? ok / total : 1;
    }

    /**
     * Analiza si una permutación es alcanzable desde el estado resuelto.
     *
     * Cada giro es un 3-ciclo, es decir, una permutación PAR. Los 3-ciclos de
     * una componente conexa generan exactamente el grupo alternado sobre ella,
     * así que un estado es alcanzable si y sólo si:
     *   1. es una permutación de las piezas,
     *   2. ninguna pieza ha salido de su componente,
     *   3. la permutación restringida a cada componente es par.
     * (Para una componente de un solo hexágono A₃ = C₃, que coincide con lo
     * que generan sus giros, así que el criterio sigue siendo exacto.)
     */
    analyze(perm = this.perm) {
      const problems = [];
      if (!Array.isArray(perm) || perm.length !== this.slotCount) {
        return { solvable: false, problems: ['Tamaño de estado incorrecto'] };
      }
      const seen = new Set(perm);
      if (seen.size !== this.slotCount || perm.some((p) => !Number.isInteger(p) || p < 0 || p >= this.slotCount)) {
        return { solvable: false, problems: ['El estado no es una permutación de las piezas'] };
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
     * numerado) se intercambian las dos primeras piezas de la componente.
     */
    fixParity(perm) {
      const { oddComponents = [] } = this.analyze(perm);
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

    /**
     * Estado inicial aleatorio uniforme entre los estados ALCANZABLES:
     * baraja cada componente y corrige la paridad.
     */
    randomize(rng = Math.random) {
      let perm;
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
        this.fixParity(perm);
      } while (this.hexagons.length > 0 && this._looksSolved(perm));
      this.setState(perm);
    }

    /** Mezcla aplicando `count` giros aleatorios (alternativa a randomize). */
    scramble(count, rng = Math.random) {
      const perm = this.perm.slice();
      this.perm = perm;
      let last = -1;
      for (let i = 0; i < count && this.hexagons.length; i++) {
        let h;
        do h = randInt(rng, this.hexagons.length);
        while (h === last && this.hexagons.length > 1);
        last = h;
        this._apply(h, 1 + randInt(rng, 2));
      }
      this.setState(this.perm);
    }

    _looksSolved(perm) {
      const saved = this.perm;
      this.perm = perm;
      const r = this.isSolved();
      this.perm = saved;
      return r;
    }

    /** Reemplaza el estado tras validarlo. Borra el historial. */
    setState(perm) {
      const a = this.analyze(perm);
      if (!a.solvable) throw new Error('Estado imposible: ' + a.problems.join('; '));
      this.perm = perm.slice();
      this.history = [];
      this.future = [];
      this._emit({ type: 'reset' });
    }

    reset() {
      this.setState(Array.from({ length: this.slotCount }, (_, i) => i));
    }

    setMode(mode) {
      this.mode = mode === 'numerado' ? 'numerado' : 'color';
      this._emit({ type: 'mode' });
    }

    serialize() {
      return {
        heights: this.tiling.heights,
        mode: this.mode,
        perm: this.perm.slice(),
        history: this.history.slice(),
        future: this.future.slice(),
      };
    }

    static deserialize(data) {
      const p = new ProppPuzzle({ heights: data.heights, mode: data.mode });
      p.setState(data.perm);
      const okMoves = (list) =>
        Array.isArray(list) && list.every((m) => m && p.hexagons[m.hex] && (m.turns === 1 || m.turns === 2));
      if (okMoves(data.history) && okMoves(data.future)) {
        p.history = data.history.slice();
        p.future = data.future.slice();
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
    project,
    latticeKey,
    makeRng,
    validateHeights,
    buildTiling,
    validateTriple,
    shareEdge,
    parityOn,
    rotatePoint,
    ProppPuzzle,
  };
});
