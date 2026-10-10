# Propp Lozenge

> Este proyecto se hizo con IA generativa: el código lo escribió un asistente
> de IA.

*[English](README.md)*

Una versión para navegador de **Propp Lozenge**, un puzzle plano que parece un
cubo en 3D. Está escrito en HTML, CSS y JavaScript vanilla, sin dependencias.

🛒 **Compra el puzzle físico:** [Propp Lozenge en Etsy](https://www.etsy.com/listing/4565297719/pastilla-de-propp)

## El puzzle

Propp Lozenge es un puzzle de fichas magnéticas inventado por **James (Jim)
Propp** y diseñado por **Oskar van Deventer**.

Tiene 27 fichas en forma de rombo dispuestas dentro de un marco hexagonal. Sus
colores y orientaciones crean la ilusión de un cubo tridimensional, aunque el
puzzle es completamente plano.

Cada ficha lleva un pequeño imán incrustado. Con la herramienta magnética se
levanta un grupo hexagonal de tres fichas, se gira 60° y se vuelve a colocar en
el marco. Estos giros transforman poco a poco el patrón y permiten desordenar
el puzzle. Al girar un grupo, un cubo que sobresale se convierte en un rincón
hueco y viceversa, así que la imagen va pasando por muchos patrones de rombos
conocidos que parecen cubos a los que les faltan partes.

El objetivo es sencillo: restaurar el patrón original del cubo.

A diferencia de muchos puzzles de permutación, una disposición completamente
aleatoria de Propp Lozenge siempre tiene solución. Por mucho que lo desordenes,
siempre hay una manera de volver atrás.

## Cómo se juega

**▶ Juega online: [braharaya.github.io/2d-rubik-puzzle](https://braharaya.github.io/2d-rubik-puzzle/)**

También puedes jugar sin conexión: descarga el repositorio y abre `index.html`
en un navegador. No hace falta compilar ni usar un servidor.

- **Objetivo:** reconstruir el cubo macizo con cada una de sus tres caras de
  un solo color. Cualquier reparto vale: el verde puede acabar arriba, a la
  izquierda o a la derecha, siempre que cada cara sea uniforme. Los seis
  repartos posibles se pueden alcanzar.
- **Seleccionar:** mueve el puntero sobre el tablero. La herramienta de tres
  fichas se ajusta al punto más cercano donde se juntan tres fichas. Verde
  significa que las tres fichas forman un grupo válido y se pueden girar. Rojo
  significa que el giro está bloqueado en ese punto.
- **Girar:** haz clic para girar el grupo 60° en el sentido de las agujas del
  reloj. Es el único movimiento. Para girar más, vuelve a hacer clic; con seis
  clics el grupo vuelve a su posición inicial.
- **Girar el tablero:** el botón «Girar tablero» (o la tecla `R`) gira el
  tablero completo 60°, como girar el marco del puzzle físico. No cuenta como
  movimiento y se puede ganar en cualquier orientación. Girado 60°, el cubo
  macizo se ve como un rincón hueco.
- **Restablecer:** devuelve todas las fichas a su sitio y después gira el
  tablero hasta su orientación original, con una animación que va por el
  camino más corto.
- **Táctil:** toca un grupo para seleccionarlo y vuelve a tocarlo para girarlo.
- **Teclado:** las flechas mueven la selección, `E` o `Enter` gira y `R` gira
  el tablero.
- **Deshacer / rehacer:** usa los botones con icono (al pasar el ratón se ve el
  atajo), o `Ctrl+Z` / `Ctrl+Y` (`⌘Z` / `⌘⇧Z` en Mac).
- **Idioma y tema:** arriba del panel lateral hay un selector de idioma
  (español o inglés) y un botón de modo claro/oscuro. Las dos opciones se recuerdan. En la
  primera visita el juego usa el idioma del navegador y el tema del sistema.

En escritorio la página siempre cabe en la ventana sin hacer scroll: el
tablero se escala al espacio disponible. En el móvil, o con mucho zoom, la
página pasa a una sola columna que se desplaza con normalidad.

Cada partida nueva empieza desde una disposición aleatoria, como si sacaras
todas las fichas del marco y las volvieras a colocar al azar. La partida se
guarda en el navegador, incluido el historial de movimientos. También se puede
jugar en versiones de 2×2×2, 4×4×4 y 5×5×5; la de 3×3×3 es la original.

## Cómo funciona

- **Tablero:** cada teselación del hexágono con rombos es la proyección de una
  pila de cubitos dentro de una caja N×N×N (una partición plana). El motor
  guarda la pila actual como un mapa de alturas y deduce de él las 3N² fichas.
- **Grupos girables:** un grupo es un punto de la rejilla donde se juntan
  exactamente tres fichas, cada una con su esquina de 120° en ese punto. Antes
  de cada movimiento el motor comprueba que haya tres fichas distintas, una de
  cada orientación, que compartan arista dos a dos y que ninguna cuarta ficha
  toque ese punto.
- **El giro de 60°:** girar un grupo 60° lo cambia a la otra teselación del
  mismo hexágono, así que la pila gana o pierde un cubo. Cada ficha cae
  exactamente en su posición girada 60°; los tests lo comprueban
  geométricamente.
- **Solubilidad:** toda secuencia de movimientos produce una permutación par
  de las fichas. Los grupos de todas las pilas posibles enlazan las 27
  posiciones, así que siempre se puede alcanzar una permutación par. Cuando una
  disposición aleatoria sale impar, se intercambian dos fichas del mismo color.
  Eso corrige la paridad sin cambiar el aspecto del tablero, y por eso
  cualquier disposición aleatoria tiene solución.
- **Victoria:** el juego comprueba que el tablero tenga la forma del cubo
  macizo, visto con el tablero en cualquier orientación, y que las nueve
  fichas de cada cara compartan color, sea cual sea.
- **Giro del tablero:** sólo cambia la vista, no el estado del puzzle. Girar
  el hexágono 120° permuta los tres ejes de la pila, y girarlo 180° cambia la
  pila por su complemento dentro de la caja (el cubo macizo pasa a ser el
  rincón vacío). Los tests comprueban que estas formas coinciden con la
  geometría de los rombos girada.
- **Deshacer / rehacer:** cada movimiento se guarda como su punto central.
  Deshacer aplica un giro de −60° en ese mismo punto.

Para ejecutar los tests del motor (Node.js 18 o posterior, sin dependencias):

```bash
npm test
```

## Estructura del proyecto

```
index.html          página
styles.css          estilos (temas claro y oscuro)
src/i18n.js         textos en español e inglés
src/core.js         motor: teselación, validación, movimientos, paridad, historial (sin DOM)
src/presets.js      formas del tablero (el cubo macizo; las demás formas son para los tests)
src/renderer.js     vista SVG, herramienta de selección y animaciones
src/main.js         controlador de la interfaz: entrada, marcador, guardado
tests/core.test.js  tests del motor
scripts/explore.js  búsqueda de las teselaciones con más grupos girables
```

## Créditos

- **Puzzle inventado por:** James (Jim) Propp
- **Puzzle diseñado por:** Oskar van Deventer
- **Puzzle físico:** [a la venta en Etsy](https://www.etsy.com/listing/4565297719/pastilla-de-propp)

Este proyecto es una versión digital no oficial, hecha por aficionados para
aprender y disfrutar. No tiene relación con el inventor ni con el diseñador del
puzzle físico, ni cuenta con su respaldo.
