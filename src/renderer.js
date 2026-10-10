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
  // arriba blanco, frente (izquierda) verde, derecha rojo.
  const PIECE_RGB = [
    [246, 244, 236], // superior
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

  class BoardView {
    constructor(svg, opts = {}) {
      this.svg = svg;
      this.duration = opts.duration != null ? opts.duration : 280;
      this.queue = [];
      this.animating = false;
      this.onIdle = opts.onIdle || (() => {});
      this.selection = null; // { vertex, hex } en coordenadas de rejilla
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
      el('path', { d: pathFrom(outline), class: 'board-shadow' }, svg);

      this.slotLayer = el('g', { class: 'slots' }, svg);
      this.labelLayer = el('g', { class: 'labels' }, svg);
      this.animLayer = el('g', { class: 'anim' }, svg);
      this.toolLayer = el('g', { class: 'tool', 'aria-hidden': 'true' }, svg);
      el('path', { d: pathFrom(outline), class: 'board-outline' }, svg);

      // La identidad de cada casilla es estable; su geometría cambia con los volteos.
      this.slotEls = puzzle.target.slots.map((s) => el('path', { class: 'slot orient-' + s.orient }, this.slotLayer));

      // Numeración de las piezas que pueden moverse (modo numerado).
      this.pieceNumber = new Array(puzzle.slotCount).fill(0);
      let num = 0;
      puzzle.target.slots.forEach((s) => {
        if (puzzle.everMovable[s.id]) this.pieceNumber[s.id] = ++num;
      });
      this.labelEls = puzzle.target.slots.map(() => el('text', { class: 'label' }, this.labelLayer));

      // Herramienta de 3 piezas.
      this.toolHex = el('path', { class: 'tool-hex' }, this.toolLayer);
      this.toolArms = el('path', { class: 'tool-arms' }, this.toolLayer);
      this.toolArrow = el('path', { class: 'tool-arrow', 'marker-end': 'url(#arrowhead)' }, this.toolLayer);
      this.toolDot = el('circle', { r: 6, class: 'tool-dot' }, this.toolLayer);

      this.display = this._current();
      this.paint();
      this.drawSelection();
    }

    _current() {
      return { tiling: this.puzzle.tiling, perm: this.puzzle.perm.slice() };
    }

    /* ---------------- Pintado ---------------- */

    fillFor(piece, light) {
      return shade(PIECE_RGB[this.puzzle.pieceColor(piece)], light);
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
      }
      tiling.slots.forEach((s) => {
        const piece = perm[s.id];
        const path = this.slotEls[s.id];
        path.setAttribute('fill', this.fillFor(piece, LIGHT[s.orient]));
        path.classList.remove('hole');
        const label = this.labelEls[s.id];
        label.textContent = numbered && p.everMovable[piece] ? this.pieceNumber[piece] : '';
        label.setAttribute('fill', p.pieceColor(piece) === 0 ? '#333' : '#fff');
      });
    }

    /* ---------------- Selección ---------------- */

    setSelection(sel) {
      this.selection = sel;
      this.drawSelection();
    }

    drawSelection() {
      const sel = this.selection;
      const show = !!sel;
      this.toolLayer.style.display = show ? '' : 'none';
      if (!show) return;
      const p = this.puzzle;
      const tiling = p.tiling;
      const c = sel.vertex.point;
      const valid = sel.hex >= 0;
      this.toolLayer.classList.toggle('blocked', !valid);
      this.toolLayer.classList.toggle('shake', !!sel.shake);

      const slots = sel.vertex.slots.map((id) => tiling.slots[id]);
      // Contorno: los vértices de los rombos que no son el centro, ordenados por ángulo.
      const pts = new Map();
      slots.forEach((s) => s.corners.forEach((q, i) => {
        if (s.keys[i] !== sel.vertex.key) pts.set(s.keys[i], q);
      }));
      const ring = [...pts.values()].sort(
        (a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0])
      );
      this.toolHex.setAttribute('d', valid ? pathFrom(ring) : slots.map((s) => pathFrom(s.corners)).join(''));

      // Brazos de la herramienta: del centro al centro de cada rombo.
      this.toolArms.setAttribute('d', slots.map((s) =>
        'M' + c[0] * SCALE + ' ' + c[1] * SCALE + 'L' + s.centroid[0] * SCALE + ' ' + s.centroid[1] * SCALE
      ).join(''));
      this.toolDot.setAttribute('cx', c[0] * SCALE);
      this.toolDot.setAttribute('cy', c[1] * SCALE);

      if (valid) {
        // Flecha circular que indica el giro del clic (60° o 120° horario).
        const rad = 0.42 * SCALE;
        const sweep = this.puzzle.allowFlip ? Math.PI / 3 : (2 * Math.PI) / 3;
        const a0 = -Math.PI / 2 - 0.25 - sweep / 2;
        const a1 = a0 + sweep + 0.5;
        const x0 = c[0] * SCALE + rad * Math.cos(a0);
        const y0 = c[1] * SCALE + rad * Math.sin(a0);
        const x1 = c[0] * SCALE + rad * Math.cos(a1);
        const y1 = c[1] * SCALE + rad * Math.sin(a1);
        this.toolArrow.setAttribute('d', `M${x0} ${y0}A${rad} ${rad} 0 0 1 ${x1} ${y1}`);
      } else {
        this.toolArrow.setAttribute('d', '');
      }
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
        const orients = [s.orient];
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
      return [q.x / SCALE, q.y / SCALE];
    }
  }

  root.ProppView = { BoardView, SCALE, PIECE_RGB, LIGHT };
})(typeof self !== 'undefined' ? self : this);
