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
      'reset': 'Restablecer (resuelto)',
      'size': 'Tamaño',
      'size.original': 'original',
      'theme.toLight': 'Modo claro',
      'theme.toDark': 'Modo oscuro',
      'lang.label': 'Idioma',
      'help.title': 'Cómo se juega',
      'help.goal': 'Objetivo: recuperar el cubo con las caras superiores amarillas, las izquierdas verdes y las derechas rojas.',
      'help.select': 'Mueve el puntero: la herramienta de 3 piezas se ajusta al punto de convergencia más cercano.',
      'help.colors': 'Verde: tres rombos forman un cubito y se pueden girar. Rojo: giro bloqueado.',
      'help.click': 'Clic: gira el grupo 60° en sentido horario. Para girar más, vuelve a hacer clic.',
      'help.shape': 'Cada giro cambia el patrón: un cubito que sobresale pasa a ser un rincón y viceversa.',
      'help.touch': 'Táctil: toca para seleccionar y vuelve a tocar para girar.',
      'help.keys': 'Teclado: flechas para mover la selección, E o Enter para girar, {undo} / {redo} para deshacer y rehacer.',
      'buy': 'Compra el puzzle físico',
      'credits': 'Puzzle inventado por James (Jim) Propp y diseñado por Oskar van Deventer. Esta es una versión digital no oficial, sin relación con los autores del puzzle físico.',
      'vibe': '🤖 Vibe coded: este proyecto se hizo con IA generativa. El código lo escribió un asistente de IA. Lo avisamos desde el principio para que quien prefiera no usar ni apoyar obras hechas con IA pueda decidir enseguida si sigue o no.',
      'status.random': 'Estado aleatorio generado (paridad verificada).',
      'status.noUndo': 'No hay movimientos que deshacer.',
      'status.noRedo': 'No hay movimientos que rehacer.',
      'status.blocked': 'Giro bloqueado: {reason}',
      'status.selected.convex': 'Cubito convexo seleccionado · clic para girar 60°',
      'status.selected.concave': 'Rincón seleccionado · clic para girar 60°',
      'status.three': 'Aquí convergen 3 rombos, pero no con sus ángulos de 120°: no forman un cubito.',
      'status.many': 'Aquí convergen {n} rombos: no forman un cubito de 3 piezas.',
      'reason.no-hex': 'no hay un cubito válido en ese punto',
      'reason.not-allowed': 'sólo se permite girar 60° en sentido horario',
      'reason.bad-op': 'sólo se permiten giros múltiplos de 60°',
      'reason.out-of-box': 'el giro sacaría un cubito de la caja',
      'reason.count': 'se necesitan exactamente tres rombos',
      'reason.distinct': 'los rombos deben ser distintos',
      'reason.missing': 'rombo inexistente',
      'reason.orient': 'un cubito necesita una cara de cada orientación',
      'reason.adjacent': 'los rombos no son adyacentes',
      'reason.angle': 'los rombos no convergen con su ángulo de 120° en el vértice',
      'reason.crowded': 'hay más de tres rombos en el punto de convergencia',
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
      'reset': 'Reset (solved)',
      'size': 'Size',
      'size.original': 'original',
      'theme.toLight': 'Light mode',
      'theme.toDark': 'Dark mode',
      'lang.label': 'Language',
      'help.title': 'How to play',
      'help.goal': 'Goal: rebuild the cube with yellow top faces, green left faces and red right faces.',
      'help.select': 'Move the pointer: the three-tile tool snaps to the nearest point where tiles meet.',
      'help.colors': 'Green: three tiles form a cube corner and can be rotated. Red: rotation blocked.',
      'help.click': 'Click: rotates the group 60° clockwise. To rotate further, click again.',
      'help.shape': 'Each rotation changes the pattern: a cube that sticks out becomes a hollow corner and vice versa.',
      'help.touch': 'Touch: tap to select, then tap again to rotate.',
      'help.keys': 'Keyboard: arrow keys move the selection, E or Enter rotates, {undo} / {redo} undo and redo.',
      'buy': 'Buy the physical puzzle',
      'credits': 'Puzzle invented by James (Jim) Propp and designed by Oskar van Deventer. This is an unofficial digital version, not affiliated with the creators of the physical puzzle.',
      'vibe': '🤖 Vibe coded: this project was made with generative AI. An AI assistant wrote the code. We say so up front so that anyone who prefers not to use or support AI-made work can decide right away whether to continue.',
      'status.random': 'Random state generated (parity checked).',
      'status.noUndo': 'Nothing to undo.',
      'status.noRedo': 'Nothing to redo.',
      'status.blocked': 'Rotation blocked: {reason}',
      'status.selected.convex': 'Cube corner selected · click to rotate 60°',
      'status.selected.concave': 'Hollow corner selected · click to rotate 60°',
      'status.three': 'Three tiles meet here, but not at their 120° corners: they do not form a cube corner.',
      'status.many': '{n} tiles meet here: they do not form a three-tile group.',
      'reason.no-hex': 'there is no valid group at that point',
      'reason.not-allowed': 'only 60° clockwise rotations are allowed',
      'reason.bad-op': 'only multiples of 60° are allowed',
      'reason.out-of-box': 'the rotation would push a cube out of the box',
      'reason.count': 'exactly three tiles are needed',
      'reason.distinct': 'the tiles must be different',
      'reason.missing': 'missing tile',
      'reason.orient': 'a cube corner needs one face of each orientation',
      'reason.adjacent': 'the tiles are not adjacent',
      'reason.angle': 'the tiles do not meet at their 120° corners',
      'reason.crowded': 'more than three tiles meet at that point',
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
