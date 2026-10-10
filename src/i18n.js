/*
 * Propp Lozenge — textos de la interfaz en español e inglés.
 *
 * En el HTML:
 *   data-i18n="clave"                 → textContent
 *   data-i18n-attr="attr:clave;..."   → atributos (aria-label, title, data-tip...)
 * En JS: ProppI18n.t('clave', { param: valor }).
 */
(function (root) {
  'use strict';

  const STRINGS = {
    es: {
      'meta.description': 'Puzzle de rombos que crea la ilusión de un cubo 3D.',
      'stats.moves': 'Movimientos',
      'stats.time': 'Tiempo',
      'board.label': 'Tablero de rombos',
      'win.title': '¡Resuelto!',
      'win.detail': '{moves} movimientos · {time}',
      'win.again': 'Jugar otra vez',
      'undo': 'Deshacer',
      'spin': 'Girar el tablero 60°',
      'redo': 'Rehacer',
      'new': 'Nuevo estado aleatorio',
      'reset': 'Restablecer (resuelto)',
      'size': 'Tamaño',
      'size.original': 'original',
      'theme.toLight': 'Modo claro',
      'theme.toDark': 'Modo oscuro',
      'lang.label': 'Idioma',
      'help.title': 'Cómo se juega',
      'help.goal': 'Objetivo: recuperar el cubo con cada cara de un solo color. No importa qué color quede en cada cara: el verde puede acabar arriba, a la izquierda o a la derecha.',
      'help.select': 'Mueve el puntero: la herramienta de 3 piezas se ajusta al punto de convergencia más cercano.',
      'help.colors': 'Verde: tres rombos forman un cubito y se pueden girar. Rojo: giro bloqueado.',
      'help.click': 'Clic: gira el grupo 60° en sentido horario. Para girar más, vuelve a hacer clic.',
      'help.shape': 'Cada giro cambia el patrón: un cubito que sobresale pasa a ser un rincón y viceversa.',
      'help.touch': 'Táctil: toca para seleccionar y vuelve a tocar para girar.',
      'help.board': 'Botón de giro del tablero (o tecla R): gira el tablero completo 60°, como girar el marco del puzzle físico. No cuenta como movimiento y se gana en cualquier orientación.',
      'help.keys': 'Teclado: flechas para mover la selección, E o Enter para girar, R para girar el tablero, {undo} / {redo} para deshacer y rehacer.',
      'buy': 'Compra el puzzle físico',
      'credits': 'Puzzle inventado por James (Jim) Propp y diseñado por Oskar van Deventer. Esta es una versión digital no oficial, sin relación con los autores del puzzle físico.',
      'vibe': 'Vibe coded. Este proyecto se hizo con IA generativa: el código lo escribió un asistente de IA.',
      'status.random': 'Estado aleatorio generado (paridad verificada).',
      'status.noUndo': 'No hay movimientos que deshacer.',
      'status.noRedo': 'No hay movimientos que rehacer.',
    },
    en: {
      'meta.description': 'A lozenge puzzle that creates the illusion of a 3D cube.',
      'stats.moves': 'Moves',
      'stats.time': 'Time',
      'board.label': 'Lozenge board',
      'win.title': 'Solved!',
      'win.detail': '{moves} moves · {time}',
      'win.again': 'Play again',
      'undo': 'Undo',
      'spin': 'Rotate the board 60°',
      'redo': 'Redo',
      'new': 'New random state',
      'reset': 'Reset (solved)',
      'size': 'Size',
      'size.original': 'original',
      'theme.toLight': 'Light mode',
      'theme.toDark': 'Dark mode',
      'lang.label': 'Language',
      'help.title': 'How to play',
      'help.goal': 'Goal: rebuild the cube with each face a single colour. It does not matter which colour ends up on which face: green can finish on top, on the left or on the right.',
      'help.select': 'Move the pointer: the three-tile tool snaps to the nearest point where tiles meet.',
      'help.colors': 'Green: three tiles form a cube corner and can be rotated. Red: rotation blocked.',
      'help.click': 'Click: rotates the group 60° clockwise. To rotate further, click again.',
      'help.shape': 'Each rotation changes the pattern: a cube that sticks out becomes a hollow corner and vice versa.',
      'help.touch': 'Touch: tap to select, then tap again to rotate.',
      'help.board': 'Board rotation button (or the R key): rotates the whole board 60°, like turning the frame of the physical puzzle. It does not count as a move, and you can win in any orientation.',
      'help.keys': 'Keyboard: arrow keys move the selection, E or Enter rotates, R rotates the board, {undo} / {redo} undo and redo.',
      'buy': 'Buy the physical puzzle',
      'credits': 'Puzzle invented by James (Jim) Propp and designed by Oskar van Deventer. This is an unofficial digital version, not affiliated with the creators of the physical puzzle.',
      'vibe': 'Vibe coded. This project was made with generative AI: an AI assistant wrote the code.',
      'status.random': 'Random state generated (parity checked).',
      'status.noUndo': 'Nothing to undo.',
      'status.noRedo': 'Nothing to redo.',
    },
  };

  const LANGS = Object.keys(STRINGS);
  let lang = 'es';

  function t(key, params) {
    let s = STRINGS[lang][key];
    if (s === undefined) s = STRINGS.es[key] !== undefined ? STRINGS.es[key] : key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
    return s;
  }

  /** Traduce los elementos marcados del documento. */
  function apply(doc, params) {
    doc.documentElement.lang = lang;
    doc.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n, params);
    });
    doc.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':');
        el.setAttribute(attr.trim(), t(key.trim(), params));
      });
    });
  }

  function setLang(l) {
    lang = LANGS.includes(l) ? l : 'es';
    return lang;
  }

  /** Idioma inicial: el guardado, o el del navegador (español o inglés). */
  function detect(saved, navLangs) {
    if (LANGS.includes(saved)) return saved;
    for (const l of navLangs || []) {
      const base = String(l).slice(0, 2).toLowerCase();
      if (LANGS.includes(base)) return base;
    }
    return 'en';
  }

  root.ProppI18n = { STRINGS, LANGS, t, apply, setLang, detect, get lang() { return lang; } };
})(typeof self !== 'undefined' ? self : this);
