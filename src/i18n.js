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
      'redo': 'Rehacer',
      'new': 'Nuevo estado aleatorio',
      'reset': 'Restablecer',
      'spin.label': 'Girar tablero',
      'size': 'Tamaño',
      'size.original': 'original',
      'theme.toLight': 'Modo claro',
      'theme.toDark': 'Modo oscuro',
      'lang.label': 'Idioma',
      'help.goal.title': 'Objetivo:',
      'help.goal.text': 'deja cada cara del cubo de un solo color. No importa qué color quede en cada cara.',
      'help.steps': 'Cómo jugar',
      'help.s1.title': 'Apunta',
      'help.s1.text': 'El selector se ajusta al punto más cercano. Azul: se puede girar. Gris: no.',
      'help.s2.title': 'Gira',
      'help.s2.text': 'Cada clic gira las 3 piezas 60° en sentido horario.',
      'help.s3.title': 'Observa',
      'help.s3.text': 'Al girar, un cubito que sobresale pasa a ser un rincón y viceversa.',
      'help.keys.title': 'Atajos',
      'key.click': 'Clic',
      'key.undo': '{undo}',
      'key.redo': '{redo}',
      'help.k.rotate': 'Girar 60°',
      'help.k.move': 'Mover el selector',
      'help.k.board': 'Girar el tablero (no cuenta como movimiento)',
      'help.touch': 'En pantallas táctiles: toca para seleccionar y vuelve a tocar para girar.',
      'buy': 'Compra el puzzle físico',
      'credits': 'Puzzle inventado por James (Jim) Propp y diseñado por Oskar van Deventer. Esta es una versión digital no oficial, sin relación con los autores del puzzle físico.',
      'vibe': 'Este proyecto se hizo con IA generativa: el código lo escribió un asistente de IA.',
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
      'redo': 'Redo',
      'new': 'New random state',
      'reset': 'Reset',
      'spin.label': 'Rotate board',
      'size': 'Size',
      'size.original': 'original',
      'theme.toLight': 'Light mode',
      'theme.toDark': 'Dark mode',
      'lang.label': 'Language',
      'help.goal.title': 'Goal:',
      'help.goal.text': 'make each face of the cube a single colour. Any arrangement counts.',
      'help.steps': 'How it works',
      'help.s1.title': 'Aim',
      'help.s1.text': 'The selector snaps to the nearest point. Blue: it can rotate. Grey: it cannot.',
      'help.s2.title': 'Rotate',
      'help.s2.text': 'Each click turns the 3 tiles 60° clockwise.',
      'help.s3.title': 'Watch',
      'help.s3.text': 'When you rotate, a cube that sticks out becomes a hollow corner and vice versa.',
      'help.keys.title': 'Shortcuts',
      'key.click': 'Click',
      'key.undo': '{undo}',
      'key.redo': '{redo}',
      'help.k.rotate': 'Rotate 60°',
      'help.k.move': 'Move the selector',
      'help.k.board': 'Rotate the board (not counted as a move)',
      'help.touch': 'On touch screens: tap to select, then tap again to rotate.',
      'buy': 'Buy the physical puzzle',
      'credits': 'Puzzle invented by James (Jim) Propp and designed by Oskar van Deventer. This is an unofficial digital version, not affiliated with the creators of the physical puzzle.',
      'vibe': 'This project was made with generative AI: an AI assistant wrote the code.',
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
