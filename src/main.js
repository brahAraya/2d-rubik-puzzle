/*
 * Propp Lozenge — controlador de la interfaz.
 */
(function () {
  'use strict';

  const { ProppPuzzle } = ProppCore;
  const { PRESETS } = ProppPresets;
  const STORAGE_KEY = 'propp-lozenge-v3';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const ui = {
    board: $('board'), moves: $('moves'), time: $('time'), progress: $('progress'), parity: $('parity'),
    status: $('status'), info: $('info'), win: $('win'), winDetail: $('win-detail'),
    size: $('size'), preset: $('preset'), mode: $('mode'),
  };

  for (const key in PRESETS) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = PRESETS[key].label;
    ui.preset.appendChild(o);
  }

  const view = new ProppView.BoardView(ui.board, {
    duration: reduceMotion ? 0 : 280,
    onIdle: () => {
      refreshSelection();
      checkWin();
    },
  });

  let puzzle = null;
  let presetKey = 'macizo';
  let timer = { start: 0, elapsed: 0, running: false };
  let won = false;
  let selectedKey = null; // vértice de la herramienta de selección
  let statusTimeout = 0;

  /* ---------------- Partida ---------------- */

  function newPuzzle(n, preset, mode, state) {
    presetKey = preset;
    // Único movimiento: el giro mínimo de 60° (horario o antihorario).
    puzzle = state
      ? ProppPuzzle.deserialize(state)
      : new ProppPuzzle({ heights: PRESETS[preset].build(n), mode });
    puzzle.on(() => {
      updateHud();
      save();
    });
    view.mount(puzzle);
    selectedKey = null;
    view.setSelection(null);
    ui.size.value = String(puzzle.target.n);
    ui.preset.value = presetKey;
    ui.mode.value = puzzle.mode;
    ui.info.textContent =
      'Cada giro de 60° cambia el patrón: un cubito que sobresale pasa a ser un rincón y viceversa. ' +
      'Hay que recuperar la forma original con sus colores. ' + puzzle.slotCount + ' fichas.';
    updateHud();
  }

  function rebuild() {
    newPuzzle(+ui.size.value, ui.preset.value, ui.mode.value);
    startRandom();
  }

  function startRandom() {
    puzzle.randomize();
    view.sync();
    resetTimer();
    say('Estado aleatorio generado (paridad verificada).');
  }

  function resetTimer() {
    timer = { start: 0, elapsed: 0, running: false };
    won = false;
    ui.win.hidden = true;
    updateHud();
  }

  /* ---------------- Movimientos ---------------- */

  // Giro mínimo de la herramienta magnética.
  function stepOp(dir) {
    return dir > 0 ? 'cw60' : 'ccw60';
  }

  function selectedHex() {
    return selectedKey === null ? -1 : puzzle.hexAt(selectedKey);
  }

  /** op: 'cw60' (60° horario) o 'ccw60' (60° antihorario). */
  function act(op) {
    const res = puzzle.move(selectedHex(), op);
    if (!res.ok) {
      blocked(res.reason);
      return false;
    }
    if (!timer.running && !won) {
      timer.running = true;
      timer.start = performance.now() - timer.elapsed;
    }
    view.enqueue(res.transition);
    refreshSelection();
    return true;
  }

  function undo() {
    const tr = puzzle.undo();
    if (!tr) return say('No hay movimientos que deshacer.');
    view.enqueue(tr);
    refreshSelection();
  }

  function redo() {
    const tr = puzzle.redo();
    if (!tr) return say('No hay movimientos que rehacer.');
    view.enqueue(tr);
    refreshSelection();
  }

  function blocked(reason) {
    say('Movimiento bloqueado: ' + reason, true);
    if (view.selection) {
      view.setSelection(Object.assign({}, view.selection, { shake: true }));
      setTimeout(() => view.selection && view.setSelection(Object.assign({}, view.selection, { shake: false })), 350);
    }
  }

  function checkWin() {
    if (won || puzzle.moveCount === 0 || !puzzle.isSolved()) return;
    won = true;
    timer.elapsed = performance.now() - timer.start;
    timer.running = false;
    ui.winDetail.textContent = puzzle.moveCount + ' movimientos · ' + fmtTime(timer.elapsed);
    ui.win.hidden = false;
    updateHud();
  }

  /* ---------------- Selección ---------------- */

  function selectVertex(v, quiet) {
    selectedKey = v ? v.key : null;
    view.setSelection(v ? { vertex: v, hex: v.hex } : null);
    if (!v || quiet) return;
    if (v.hex < 0) {
      const n = v.slots.length;
      say(n === 3
        ? 'Aquí convergen 3 rombos, pero no con sus ángulos de 120°: no forman un cubito.'
        : 'Aquí convergen ' + n + ' rombos: no forman un cubito de 3 piezas.', true, true);
    } else {
      const h = puzzle.hexagons[v.hex];
      say('Cubito ' + h.kind + ' seleccionado · clic: 60° horario · Mayús+clic o clic derecho: 60° antihorario', false, true);
    }
  }

  function selectAt(x, y) {
    const v = puzzle.nearestVertex(x, y);
    // Fuera del tablero no se muestra la herramienta.
    if (!v || Math.hypot(v.point[0] - x, v.point[1] - y) > 0.9) return selectVertex(null);
    selectVertex(v);
  }

  // Tras un volteo cambian los vértices: recolocamos la herramienta en el mismo punto.
  function refreshSelection() {
    if (selectedKey === null) return;
    selectVertex(puzzle.tiling.vertices.find((v) => v.key === selectedKey) || null, true);
  }

  function selectHex(hexId) {
    const h = puzzle.hexagons[hexId];
    if (h) selectVertex(puzzle.tiling.vertices.find((v) => v.key === h.key));
  }

  // Selección por teclado: salta al cubito más cercano en la dirección pedida.
  function moveSelection(dx, dy) {
    const hs = puzzle.hexagons;
    if (!hs.length) return;
    if (selectedHex() < 0) return selectHex(puzzle.nearestHexagon(0, 0));
    const c = hs[selectedHex()].center;
    let best = -1;
    let bestScore = Infinity;
    for (const h of hs) {
      const vx = h.center[0] - c[0];
      const vy = h.center[1] - c[1];
      const along = vx * dx + vy * dy;
      if (along < 1e-6) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + 2 * across;
      if (score < bestScore) {
        bestScore = score;
        best = h.id;
      }
    }
    if (best >= 0) selectHex(best);
  }

  /* ---------------- Eventos ---------------- */

  let touchPending = false;
  let lastPointer = 'mouse';

  ui.board.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const q = view.toLattice(e);
    if (q) selectAt(q[0], q[1]);
  });
  ui.board.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    selectVertex(null);
  });
  ui.board.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType;
    if (e.pointerType !== 'touch') return;
    const q = view.toLattice(e);
    if (!q) return;
    const prev = selectedHex();
    selectAt(q[0], q[1]);
    // Segundo toque sobre el mismo cubito: girar.
    touchPending = prev >= 0 && prev === selectedHex();
  });
  ui.board.addEventListener('click', (e) => {
    if (lastPointer === 'touch') {
      if (touchPending) act(stepOp(1));
      touchPending = false;
      return;
    }
    const q = view.toLattice(e);
    if (q) selectAt(q[0], q[1]);
    act(stepOp(e.shiftKey ? -1 : 1));
  });
  ui.board.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const q = view.toLattice(e);
    if (q) selectAt(q[0], q[1]);
    act(stepOp(-1));
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('select')) return;
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
    if (mod && k === 'y') {
      e.preventDefault();
      return redo();
    }
    if (mod) return;
    const dirs = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] };
    if (dirs[k]) {
      e.preventDefault();
      return moveSelection(dirs[k][0], dirs[k][1]);
    }
    if (k === 'e' || (k === 'enter' && e.target === document.body)) {
      e.preventDefault();
      act(stepOp(1));
    } else if (k === 'q') {
      act(stepOp(-1));
    }
  });

  $('rot-cw').addEventListener('click', () => act(stepOp(1)));
  $('rot-ccw').addEventListener('click', () => act(stepOp(-1)));
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('new').addEventListener('click', startRandom);
  $('win-new').addEventListener('click', startRandom);
  $('scramble').addEventListener('click', () => {
    puzzle.scramble(30);
    view.sync();
    resetTimer();
    say('Mezclado con 30 giros aleatorios de 60°.');
  });
  $('solve-reset').addEventListener('click', () => {
    puzzle.reset();
    view.sync();
    resetTimer();
  });
  ui.size.addEventListener('change', rebuild);
  ui.preset.addEventListener('change', rebuild);
  ui.mode.addEventListener('change', () => {
    puzzle.setMode(ui.mode.value);
    view.paint();
    won = false;
    ui.win.hidden = true;
    checkWin();
  });

  /* ---------------- HUD ---------------- */

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function updateHud() {
    ui.moves.textContent = puzzle.moveCount;
    ui.progress.textContent = Math.round(puzzle.progress() * 100) + '%';
    const a = puzzle.analyze();
    ui.parity.textContent = a.solvable ? 'par ✓' : 'imposible ✗';
    ui.parity.classList.toggle('bad', !a.solvable);
    $('undo').disabled = !puzzle.canUndo();
    $('redo').disabled = !puzzle.canRedo();
  }

  function say(msg, warn = false, quiet = false) {
    ui.status.textContent = msg;
    ui.status.classList.toggle('warn', warn);
    ui.status.classList.toggle('quiet', quiet);
    clearTimeout(statusTimeout);
    if (!quiet) statusTimeout = setTimeout(() => (ui.status.textContent = ''), 3500);
  }

  setInterval(() => {
    if (timer.running) timer.elapsed = performance.now() - timer.start;
    ui.time.textContent = fmtTime(timer.elapsed);
  }, 250);

  /* ---------------- Persistencia ---------------- */

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: presetKey, state: puzzle.serialize(), elapsed: timer.elapsed }));
    } catch (_) {
      /* almacenamiento no disponible: se ignora */
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!PRESETS[data.preset]) return false;
      // deserialize valida la partición plana y la paridad del estado guardado.
      newPuzzle(0, data.preset, null, data.state);
      timer.elapsed = data.elapsed || 0;
      won = puzzle.isSolved() && puzzle.moveCount > 0;
      return true;
    } catch (_) {
      return false;
    }
  }

  if (!load()) {
    newPuzzle(3, 'macizo', 'color');
    startRandom();
  }
})();
