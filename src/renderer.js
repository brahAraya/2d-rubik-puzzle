/*
 * Propp Lozenge — vista SVG.
 *
 * Dibuja las casillas fijas, la herramienta de selección de 3 piezas y las
 * animaciones de giro. El sombreado depende de la ORIENTACIÓN de la casilla
 * (no del color de la pieza): así la ilusión 3D se mantiene aunque el tablero
 * esté desordenado, y durante un giro el sombreado de cada pieza se interpola
 * mientras pasa de una cara a otra.
 */
(function (root) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SCALE = 60; // píxeles SVG por unidad de rejilla

  // Colores estándar de un cubo de Rubik visto desde la esquina U-F-R:
  // arriba amarillo, frente (izquierda) verde, derecha rojo.
  const PIECE_RGB = [
    [255, 208, 0], // superior
    [0, 158, 96], // izquierda
    [214, 40, 57], // derecha
  ];
  // Luz por orientación de la casilla (luz cenital ligeramente desde la izquierda).
  const LIGHT = [1.0, 0.82, 0.68];

  function el(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function pathFrom(points) {
    return 'M' + points.map((p) => (p[0] * SCALE).toFixed(2) + ' ' + (p[1] * SCALE).toFixed(2)).join('L') + 'Z';
  }

  function shade(rgb, light) {
    return 'rgb(' + rgb.map((c) => Math.round(c * light)).join(',') + ')';
  }

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /*
   * Forma de la herramienta de selección como «perfil radial»: la distancia
   * del centro al borde en TOOL_RAYS direcciones fijas. Así cualquier forma
   * (hexágono de 3 rombos, estrella de 4 o 6 rombos, vértice del borde) tiene
   * la misma representación y se puede interpolar punto a punto. Las
   * direcciones incluyen todos los múltiplos de 30°, que es donde están las
   * esquinas de cualquier rombo de la rejilla, así que el contorno es exacto.
   */
  const TOOL_RAYS = 48; // cada 7,5°
  const ARM_SLOTS = 12; // los brazos apuntan siempre a múltiplos de 30°
  const TOOL_TWEEN_MS = 160;

  // Distancia a la que un rayo desde la esquina `c` de un rombo sale de él (0 si no lo cruza).
  function rayExit(c, dir, corners) {
    let best = 0;
    for (let k = 0; k < 4; k++) {
      const a = corners[k];
      const b = corners[(k + 1) % 4];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const den = dir[0] * ey - dir[1] * ex;
      if (Math.abs(den) < 1e-12) continue;
      const ax = a[0] - c[0];
      const ay = a[1] - c[1];
      const t = (ax * ey - ay * ex) / den;
      const u = (ax * dir[1] - ay * dir[0]) / den;
      if (u >= -1e-9 && u <= 1 + 1e-9 && t > best) best = t;
    }
    return best;
  }

  /** Estado visual de la herramienta para un vértice de una teselación. */
  function toolShape(tiling, vertex) {
    const c = vertex.point;
    const slots = vertex.slots.map((id) => tiling.slots[id]);
    const radii = new Array(TOOL_RAYS);
    for (let k = 0; k < TOOL_RAYS; k++) {
      const a = (k * 2 * Math.PI) / TOOL_RAYS;
      const dir = [Math.cos(a), Math.sin(a)];
      let r = 0;
      for (const s of slots) r = Math.max(r, rayExit(c, dir, s.corners));
      radii[k] = r;
    }
    const arms = new Array(ARM_SLOTS).fill(0);
    for (const s of slots) {
      const dx = s.centroid[0] - c[0];
      const dy = s.centroid[1] - c[1];
      const i = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 6)) % ARM_SLOTS) + ARM_SLOTS) % ARM_SLOTS;
      arms[i] = Math.hypot(dx, dy);
    }
    return { cx: c[0], cy: c[1], radii, arms, bad: vertex.hex >= 0 ? 0 : 1 };
  }

  function mixShape(a, b, f) {
    const lerp = (x, y) => x + (y - x) * f;
    return {
      cx: lerp(a.cx, b.cx),
      cy: lerp(a.cy, b.cy),
      radii: a.radii.map((r, k) => lerp(r, b.radii[k])),
      arms: a.arms.map((r, k) => lerp(r, b.arms[k])),
      bad: lerp(a.bad, b.bad),
    };
  }

  class BoardView {
    constructor(svg, opts = {}) {
      this.svg = svg;
      this.duration = opts.duration != null ? opts.duration : 280;
      this.queue = [];
      this.animating = false;
      this.onIdle = opts.onIdle || (() => {});
      this.onViewChange = opts.onViewChange || null;
      this.toolTween = opts.toolTween != null ? opts.toolTween : TOOL_TWEEN_MS;
      this.pieceDim = 1;
      this.viewTurns = 0; // giro del tablero completo, en pasos de 60° horarios
      this.selKey = null; // vértice seleccionado (clave de rejilla)
      this.toolState = null; // forma dibujada ahora mismo (puede estar a medio camino)
    }

    /* ---------------- Montaje ---------------- */

    mount(puzzle) {
      this.puzzle = puzzle;
      this.queue = [];
      this.animating = false;
      this.drawnTiling = null;
      const n = puzzle.tiling.n;
      const r = n * SCALE + 18;
      const svg = this.svg;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', [-r, -r, 2 * r, 2 * r].join(' '));

      const defs = el('defs', {}, svg);
      const marker = el('marker', {
        id: 'arrowhead', viewBox: '0 0 10 10', refX: '5', refY: '5',
        markerWidth: '4', markerHeight: '4', orient: 'auto-start-reverse',
      }, defs);
      el('path', { d: 'M0 0L10 5L0 10Z', class: 'tool-arrowhead' }, marker);

      // Contorno exterior del hexágono (silueta del cubo).
      const outline = [0, 1, 2, 3, 4, 5].map((k) => {
        const a = -Math.PI / 2 + (k * Math.PI) / 3;
        return [n * Math.cos(a), n * Math.sin(a)];
      });
      // `world` contiene todo lo que gira al girar el tablero completo, incluido
      // el fondo y el contorno del hexágono. La sombra se aplica con CSS a todo
      // el SVG, así que no cambia de dirección al girar.
      this.world = el('g', { class: 'world' }, svg);
      el('path', { d: pathFrom(outline), class: 'board-shadow' }, this.world);
      this.slotLayer = el('g', { class: 'slots' }, this.world);
      this.labelLayer = el('g', { class: 'labels' }, this.world);
      // El borde exterior va debajo de las piezas en movimiento y de la
      // herramienta de selección, para que sus contornos se vean completos.
      el('path', { d: pathFrom(outline), class: 'board-outline' }, this.world);
      this.overLayer = el('g', { class: 'world-over' }, svg);
      this.animLayer = el('g', { class: 'anim' }, this.overLayer);
      this.toolLayer = el('g', { class: 'tool', 'aria-hidden': 'true' }, this.overLayer);
      this._applyViewTransform(this.viewTurns * 60);

      // La identidad de cada casilla es estable; su geometría cambia con los volteos.
      this.slotEls = puzzle.target.slots.map((s) => el('path', { class: 'slot orient-' + s.orient }, this.slotLayer));

      // Numeración de las piezas que pueden moverse (modo numerado).
      this.pieceNumber = new Array(puzzle.slotCount).fill(0);
      let num = 0;
      puzzle.target.slots.forEach((s) => {
        if (puzzle.everMovable[s.id]) this.pieceNumber[s.id] = ++num;
      });
      this.labelEls = puzzle.target.slots.map(() => el('text', { class: 'label' }, this.labelLayer));

      // Herramienta de 3 piezas. `toolSpin` recibe la rotación del giro; el
      // grupo exterior conserva su transformación CSS para la sacudida.
      this.toolSpin = el('g', {}, this.toolLayer);
      this.toolHex = el('path', { class: 'tool-hex' }, this.toolSpin);
      this.toolArms = el('path', { class: 'tool-arms' }, this.toolSpin);
      this.toolDot = el('circle', { r: 6, class: 'tool-dot' }, this.toolSpin);
      // La flecha indica el sentido del giro: no gira con la pieza.
      this.toolArrow = el('path', { class: 'tool-arrow', 'marker-end': 'url(#arrowhead)' }, this.toolLayer);

      this.selKey = null;
      this.toolState = null;
      this.display = this._current();
      this.refreshTheme();
      this._drawTool(null);
    }

    _current() {
      return { tiling: this.puzzle.tiling, perm: this.puzzle.perm.slice() };
    }

    /* ---------------- Pintado ---------------- */

    /**
     * Orientación con la que se VE una casilla con el tablero girado: cada
     * 60° de giro convierte una cara superior en izquierda, etc. El
     * sombreado usa esta orientación para que la ilusión 3D se mantenga.
     */
    _vis(orient) {
      let o = orient;
      for (let k = 0; k < this.viewTurns; k++) o = ProppCore.NEXT60[o];
      return o;
    }

    _applyViewTransform(deg) {
      const tf = deg % 360 === 0 ? null : `rotate(${deg} 0 0)`;
      for (const g of [this.world, this.overLayer]) {
        if (tf) g.setAttribute('transform', tf);
        else g.removeAttribute('transform');
      }
    }

    /** Fija el giro del tablero sin animar (al cargar una partida). */
    setViewTurns(turns) {
      this.viewTurns = ((turns % 6) + 6) % 6;
      if (!this.world) return;
      this._applyViewTransform(this.viewTurns * 60);
      if (!this.animating) this.paint();
    }

    /**
     * Gira el tablero completo `steps` × 60° (positivo = horario), animado y
     * en cola con los demás movimientos.
     */
    rotateView(steps = 1) {
      if (!steps) return;
      this.queue.push({ type: 'view', steps });
      if (!this.animating) this._next();
    }

    /** Vuelve a la orientación original por el camino más corto (animado). */
    resetView() {
      // La orientación final es la que queda tras los giros ya en cola.
      const pending = this.queue.reduce((acc, j) => acc + (j.type === 'view' ? j.steps : 0), 0);
      const v = (((this.viewTurns + pending) % 6) + 6) % 6;
      this.rotateView(v <= 3 ? -v : 6 - v);
    }

    _animateView(steps) {
      const from = this.viewTurns;
      const n = Math.abs(steps);
      const dir = Math.sign(steps);
      const next = (o) => (dir > 0 ? ProppCore.NEXT60[o] : ProppCore.NEXT60[ProppCore.NEXT60[o]]);
      const tiling = this.display.tiling;
      const perm = this.display.perm;
      // Orientación visible de cada rombo en cada paso de 60° del giro.
      const seq = tiling.slots.map((s) => {
        const list = [this._vis(s.orient)];
        for (let k = 0; k < n; k++) list.push(next(list[k]));
        return list;
      });
      const duration = this.duration * (0.8 + 0.5 * n);
      const start = performance.now();
      const frame = (now) => {
        const t = duration > 0 ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
        const p = ease(t) * n; // pasos recorridos (0..n)
        this._applyViewTransform((from + dir * p) * 60);
        const i = Math.min(Math.floor(p), n - 1);
        const f = p - i;
        // Interpolamos la luz de cada rombo entre las orientaciones por las que pasa.
        tiling.slots.forEach((s, k) => {
          const light = LIGHT[seq[k][i]] * (1 - f) + LIGHT[seq[k][i + 1]] * f;
          this.slotEls[s.id].setAttribute('fill', this.fillFor(perm[s.id], light));
        });
        if (t < 1) {
          this._raf = requestAnimationFrame(frame);
        } else {
          this.viewTurns = (((from + steps) % 6) + 6) % 6;
          this._applyViewTransform(this.viewTurns * 60);
          this.paint();
          if (this.onViewChange) this.onViewChange(this.viewTurns);
          this._next();
        }
      };
      this._raf = requestAnimationFrame(frame);
    }

    fillFor(piece, light) {
      return shade(PIECE_RGB[this.puzzle.pieceColor(piece)], light * this.pieceDim);
    }

    /**
     * Lee del CSS cuánto se oscurecen las fichas (--piece-dim: 1 en modo claro,
     * menos en oscuro para que contrasten con los bordes blancos) y repinta.
     */
    refreshTheme() {
      const v = parseFloat(getComputedStyle(this.svg).getPropertyValue('--piece-dim'));
      this.pieceDim = v > 0 && v <= 1 ? v : 1;
      // Durante una animación el siguiente fotograma ya usa el valor nuevo.
      if (this.puzzle && !this.animating) this.paint();
    }

    /** Pinta una instantánea { tiling, perm } (por defecto, la mostrada). */
    paint(snap = this.display) {
      const p = this.puzzle;
      const numbered = p.mode === 'numerado';
      this.svg.classList.toggle('numbered', numbered);
      const { tiling, perm } = snap;
      if (this.drawnTiling !== tiling) {
        const movable = new Set();
        tiling.hexagons.forEach((h) => h.ring.forEach((id) => movable.add(id)));
        tiling.slots.forEach((s) => {
          const path = this.slotEls[s.id];
          path.setAttribute('d', pathFrom(s.corners));
          // Con volteo toda casilla acaba siendo móvil: no marcamos ninguna como fija.
          path.classList.toggle('fixed', !p.allowFlip && !movable.has(s.id));
          this.labelEls[s.id].setAttribute('x', (s.centroid[0] * SCALE).toFixed(2));
          this.labelEls[s.id].setAttribute('y', (s.centroid[1] * SCALE).toFixed(2));
        });
        this.drawnTiling = tiling;
        this._snapTool();
      }
      tiling.slots.forEach((s) => {
        const piece = perm[s.id];
        const path = this.slotEls[s.id];
        path.setAttribute('fill', this.fillFor(piece, LIGHT[this._vis(s.orient)]));
        path.classList.remove('hole');
        const label = this.labelEls[s.id];
        label.textContent = numbered && p.everMovable[piece] ? this.pieceNumber[piece] : '';
        label.setAttribute('fill', p.pieceColor(piece) === 0 ? '#333' : '#fff');
      });
    }

    /* ---------------- Selección ---------------- */

    /**
     * Selecciona el vértice `key` (o ninguno con null). La herramienta se
     * desliza desde su posición actual hasta la nueva, transformando su
     * forma y su color por el camino.
     */
    setSelection(key) {
      if (key === this.selKey) return;
      this.selKey = key;
      const target = this._targetShape();
      if (!target || !this.toolState || this.toolTween <= 0) {
        cancelAnimationFrame(this._toolRaf);
        this._drawTool(target);
        return;
      }
      const from = this.toolState;
      const start = performance.now();
      cancelAnimationFrame(this._toolRaf);
      const step = (now) => {
        const t = Math.min(1, Math.max(0, (now - start) / this.toolTween));
        this._drawTool(mixShape(from, target, easeOut(t)));
        if (t < 1) this._toolRaf = requestAnimationFrame(step);
      };
      this._toolRaf = requestAnimationFrame(step);
    }

    /** Sacudida de «giro bloqueado». */
    shake() {
      this.toolLayer.classList.remove('shake');
      void this.toolLayer.getBBox(); // reinicia la animación CSS
      this.toolLayer.classList.add('shake');
      clearTimeout(this._shakeTimer);
      this._shakeTimer = setTimeout(() => this.toolLayer.classList.remove('shake'), 350);
    }

    // Forma objetivo según la teselación que se ve en pantalla.
    _targetShape() {
      const tiling = this.drawnTiling;
      if (this.selKey === null || !tiling) return null;
      if (!tiling._vertexByKey) tiling._vertexByKey = new Map(tiling.vertices.map((v) => [v.key, v]));
      const v = tiling._vertexByKey.get(this.selKey);
      return v ? toolShape(tiling, v) : null;
    }

    // Recoloca la herramienta sin transición (la teselación mostrada cambió).
    _snapTool() {
      if (!this.toolSpin) return;
      cancelAnimationFrame(this._toolRaf);
      this._drawTool(this._targetShape());
    }

    _drawTool(st) {
      this.toolState = st;
      this.toolLayer.style.display = st ? '' : 'none';
      if (!st) return;
      const cx = st.cx * SCALE;
      const cy = st.cy * SCALE;
      const pts = st.radii.map((r, k) => {
        const a = (k * 2 * Math.PI) / TOOL_RAYS;
        return (cx + r * SCALE * Math.cos(a)).toFixed(2) + ' ' + (cy + r * SCALE * Math.sin(a)).toFixed(2);
      });
      this.toolHex.setAttribute('d', 'M' + pts.join('L') + 'Z');
      let arms = '';
      st.arms.forEach((r, k) => {
        if (r < 0.02) return;
        const a = (k * Math.PI) / 6;
        arms += `M${cx} ${cy}L${(cx + r * SCALE * Math.cos(a)).toFixed(2)} ${(cy + r * SCALE * Math.sin(a)).toFixed(2)}`;
      });
      this.toolArms.setAttribute('d', arms);
      this.toolDot.setAttribute('cx', cx);
      this.toolDot.setAttribute('cy', cy);
      // Flecha del giro de 60°: se desvanece a medida que la forma pasa a «bloqueada».
      const rad = 0.42 * SCALE;
      const sweep = Math.PI / 3;
      const a0 = -Math.PI / 2 - 0.25 - sweep / 2;
      const a1 = a0 + sweep + 0.5;
      this.toolArrow.setAttribute('d', `M${cx + rad * Math.cos(a0)} ${cy + rad * Math.sin(a0)}A${rad} ${rad} 0 0 1 ${cx + rad * Math.cos(a1)} ${cy + rad * Math.sin(a1)}`);
      this.toolArrow.style.opacity = String(Math.max(0, 1 - 2 * st.bad));
      // Color: mezcla continua entre verde (válido) y rojo (bloqueado).
      this.toolLayer.style.setProperty('--mix', (st.bad * 100).toFixed(1) + '%');
      this.toolLayer.classList.toggle('blocked', st.bad > 0.5);
    }

    /* ---------------- Animación ---------------- */

    /**
     * Encola la animación de un movimiento ya validado y aplicado en el motor.
     * `tr` es la transición devuelta por el motor: forma y permutación antes y
     * después, centro, casillas del hexágono y ángulo de giro.
     */
    enqueue(tr) {
      this.queue.push(tr);
      if (!this.animating) this._next();
    }

    /** Sincroniza la vista con el motor sin animar (nuevo juego, carga...). */
    sync() {
      this.queue = [];
      this.animating = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this.animLayer.textContent = '';
      // Si se interrumpió un giro del tablero, volvemos a su orientación estable.
      this._applyViewTransform(this.viewTurns * 60);
      this.display = this._current();
      this.paint();
    }

    get busy() {
      return this.animating || this.queue.length > 0;
    }

    _next() {
      const job = this.queue.shift();
      if (!job) {
        this.animating = false;
        this.display = this._current();
        this.paint();
        this.onIdle();
        return;
      }
      this.animating = true;
      if (job.type === 'view') return this._animateView(job.steps);
      const p = this.puzzle;
      const c = job.center;
      const steps60 = Math.round(Math.abs(job.angle) / (Math.PI / 3));
      // Girar −60° equivale a avanzar dos pasos de +60° en el ciclo de orientaciones.
      const step = (o) => (job.angle > 0 ? ProppCore.NEXT60[o] : ProppCore.NEXT60[ProppCore.NEXT60[o]]);
      const duration = this.duration * (0.55 + 0.225 * steps60);

      this.paint(job.before);
      this.animLayer.textContent = '';
      const moving = job.ring.map((id) => {
        const s = job.before.tiling.slots[id];
        this.slotEls[id].classList.add('hole');
        this.labelEls[id].textContent = '';
        const piece = job.before.perm[id];
        const path = el('path', { d: pathFrom(s.corners), class: 'slot moving' }, this.animLayer);
        const label = el('text', { class: 'label' }, this.animLayer);
        if (p.mode === 'numerado' && p.everMovable[piece]) label.textContent = this.pieceNumber[piece];
        label.setAttribute('fill', p.pieceColor(piece) === 0 ? '#333' : '#fff');
        // Orientación que va adoptando el rombo cada 60° de giro.
        const orients = [this._vis(s.orient)];
        for (let k = 0; k < steps60; k++) orients.push(step(orients[k]));
        return { s, piece, path, label, orients };
      });

      const start = performance.now();
      const frame = (now) => {
        // El sello de requestAnimationFrame puede ser anterior a `start`.
        const t = duration > 0 ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
        const a = job.angle * ease(t);
        const deg = (a * 180) / Math.PI;
        const tf = `rotate(${deg} ${c[0] * SCALE} ${c[1] * SCALE})`;
        // Interpolamos la luz entre las orientaciones por las que pasa el rombo.
        const steps = Math.abs(a) / (Math.PI / 3);
        const i = Math.min(Math.floor(steps), steps60 - 1);
        const f = steps - i;
        // Si la herramienta está sobre el cubito que gira, gira con él.
        if (this.selKey === job.key) this.toolSpin.setAttribute('transform', tf);
        else this.toolSpin.removeAttribute('transform');
        moving.forEach((m) => {
          m.path.setAttribute('transform', tf);
          const light = LIGHT[m.orients[i]] * (1 - f) + LIGHT[m.orients[i + 1]] * f;
          m.path.setAttribute('fill', this.fillFor(m.piece, light));
          const q = ProppCore.rotatePoint(m.s.centroid, c, a);
          m.label.setAttribute('x', q[0] * SCALE);
          m.label.setAttribute('y', q[1] * SCALE);
        });
        if (t < 1) {
          this._raf = requestAnimationFrame(frame);
        } else {
          this.animLayer.textContent = '';
          this.toolSpin.removeAttribute('transform');
          this.display = job.after;
          this.paint();
          this._next();
        }
      };
      this._raf = requestAnimationFrame(frame);
    }

    /* ---------------- Coordenadas ---------------- */

    /** Convierte un evento de puntero a coordenadas de rejilla. */
    toLattice(evt) {
      const pt = this.svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const m = this.svg.getScreenCTM();
      if (!m) return null;
      const q = pt.matrixTransform(m.inverse());
      // Deshacemos el giro del tablero para trabajar en coordenadas de rejilla.
      const back = ProppCore.rotatePoint([q.x / SCALE, q.y / SCALE], [0, 0], (-this.viewTurns * Math.PI) / 3);
      return back;
    }
  }

  root.ProppView = { BoardView, SCALE, PIECE_RGB, LIGHT };
})(typeof self !== 'undefined' ? self : this);
