/*
 * Propp Lozenge — controlador de la interfaz.
 */
(function () {
  'use strict';

  const { ProppPuzzle } = ProppCore;
  const { solidCube } = ProppPresets;
  const { t } = ProppI18n;
  const LANG_KEY = 'propp-lang';
  const THEME_KEY = 'propp-theme';
  const STORAGE_KEY = 'propp-lozenge-v4';
  // Único movimiento: girar el grupo de 3 rombos 60° en sentido horario.
  const MOVE = 'cw60';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const ui = {
    board: $('board'), moves: $('moves'), time: $('time'),
    status: $('status'), win: $('win'), winDetail: $('win-detail'), size: $('size'),
    lang: $('lang'), theme: $('theme'), undo: $('undo'), redo: $('redo'),
  };

  // Atajos de teclado que se muestran en las ayudas emergentes (⌘ en Mac).
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const KEYS = isMac ? { undo: '⌘Z', redo: '⌘⇧Z' } : { undo: 'Ctrl+Z', redo: 'Ctrl+Y' };

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      /* almacenamiento no disponible: se ignora */
    }
  }

  /* ---------------- Idioma ---------------- */

  function setLanguage(lang) {
    ProppI18n.setLang(lang);
    ui.lang.value = ProppI18n.lang;
    ProppI18n.apply(document, KEYS);
    ui.undo.setAttribute('aria-label', t('undo'));
    ui.undo.dataset.tip = t('undo') + ' · ' + KEYS.undo;
    ui.redo.setAttribute('aria-label', t('redo'));
    ui.redo.dataset.tip = t('redo') + ' · ' + KEYS.redo;
    updateThemeButton();
    if (puzzle) {
      updateHud();
      if (won) showWinDetail();
    }
    ui.status.textContent = '';
  }

  ui.lang.addEventListener('change', () => {
    storageSet(LANG_KEY, ui.lang.value);
    setLanguage(ui.lang.value);
  });

  /* ---------------- Tema claro / oscuro ---------------- */

  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  // Tema efectivo: el elegido por el usuario o, si no eligió, el del sistema.
  function currentTheme() {
    const forced = document.documentElement.dataset.theme;
    if (forced === 'light' || forced === 'dark') return forced;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function updateThemeButton() {
    const label = currentTheme() === 'dark' ? t('theme.toLight') : t('theme.toDark');
    ui.theme.setAttribute('aria-label', label);
    ui.theme.dataset.tip = label;
  }

  ui.theme.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    storageSet(THEME_KEY, next);
    updateThemeButton();
    view.refreshTheme();
  });
  if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener('change', () => {
      updateThemeButton();
      view.refreshTheme();
    });
  }

  const view = new ProppView.BoardView(ui.board, {
    duration: reduceMotion ? 0 : 280,
    toolTween: reduceMotion ? 0 : 160,
    onIdle: () => checkWin(),
  });

  let puzzle = null;
  let timer = { start: 0, elapsed: 0, running: false };
  let won = false;
  let selectedKey = null; // vértice de la herramienta de selección
  let statusTimeout = 0;

  /* ---------------- Partida ---------------- */

  function newPuzzle(n, state) {
    puzzle = state
      ? ProppPuzzle.deserialize(state)
      : new ProppPuzzle({ heights: solidCube(n), mode: 'color', allowedOps: [MOVE] });
    puzzle.on(() => {
      updateHud();
      save();
    });
    view.mount(puzzle);
    selectedKey = null;
    view.setSelection(null);
    ui.size.value = String(puzzle.target.n);
    updateHud();
  }

  function rebuild() {
    newPuzzle(+ui.size.value);
    startRandom();
  }

  function startRandom() {
    puzzle.randomize();
    view.sync();
    resetTimer();
    say(t('status.random'));
  }

  function resetTimer() {
    timer = { start: 0, elapsed: 0, running: false };
    won = false;
    ui.win.hidden = true;
    updateHud();
  }

  /* ---------------- Movimientos ---------------- */

  function selectedHex() {
    return selectedKey === null ? -1 : puzzle.hexAt(selectedKey);
  }

  function act() {
    const res = puzzle.move(selectedHex(), MOVE);
    if (!res.ok) {
      blocked();
      return false;
    }
    if (!timer.running && !won) {
      timer.running = true;
      timer.start = performance.now() - timer.elapsed;
    }
    view.enqueue(res.transition);
    return true;
  }

  function undo() {
    const tr = puzzle.undo();
    if (!tr) return say(t('status.noUndo'));
    view.enqueue(tr);
  }

  function redo() {
    const tr = puzzle.redo();
    if (!tr) return say(t('status.noRedo'));
    view.enqueue(tr);
  }

  // Giro bloqueado: basta con la sacudida del selector rojo, sin texto.
  function blocked() {
    view.shake();
  }

  function checkWin() {
    if (won || puzzle.moveCount === 0 || !puzzle.isSolved()) return;
    won = true;
    timer.elapsed = performance.now() - timer.start;
    timer.running = false;
    showWinDetail();
    ui.win.hidden = false;
    updateHud();
  }

  function showWinDetail() {
    ui.winDetail.textContent = t('win.detail', { moves: puzzle.moveCount, time: fmtTime(timer.elapsed) });
  }

  /* ---------------- Selección ---------------- */

  function selectVertex(v) {
    selectedKey = v ? v.key : null;
    view.setSelection(selectedKey);
  }

  function selectAt(x, y) {
    const v = puzzle.nearestVertex(x, y);
    // Fuera del tablero no se muestra la herramienta.
    if (!v || Math.hypot(v.point[0] - x, v.point[1] - y) > 0.9) return selectVertex(null);
    selectVertex(v);
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
      if (touchPending) act();
      touchPending = false;
      return;
    }
    const q = view.toLattice(e);
    if (q) selectAt(q[0], q[1]);
    act();
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
      act();
    }
  });

  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('new').addEventListener('click', startRandom);
  $('win-new').addEventListener('click', startRandom);
  $('solve-reset').addEventListener('click', () => {
    puzzle.reset();
    view.sync();
    resetTimer();
  });
  ui.size.addEventListener('change', rebuild);

  /* ---------------- HUD ---------------- */

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function updateHud() {
    ui.moves.textContent = puzzle.moveCount;
    $('undo').disabled = !puzzle.canUndo();
    $('redo').disabled = !puzzle.canRedo();
  }

  function say(msg) {
    ui.status.textContent = msg;
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => (ui.status.textContent = ''), 3500);
  }

  setInterval(() => {
    if (timer.running) timer.elapsed = performance.now() - timer.start;
    ui.time.textContent = fmtTime(timer.elapsed);
  }, 250);

  /* ---------------- Persistencia ---------------- */

  function save() {
    storageSet(STORAGE_KEY, JSON.stringify({ state: puzzle.serialize(), elapsed: timer.elapsed }));
  }

  function load() {
    try {
      const raw = storageGet(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      // deserialize valida la forma, la paridad y el historial guardados.
      newPuzzle(0, data.state);
      timer.elapsed = data.elapsed || 0;
      won = puzzle.isSolved() && puzzle.moveCount > 0;
      return true;
    } catch (_) {
      return false;
    }
  }

  setLanguage(ProppI18n.detect(storageGet(LANG_KEY), navigator.languages || [navigator.language]));
  if (!load()) {
    newPuzzle(3);
    startRandom();
  }
})();
