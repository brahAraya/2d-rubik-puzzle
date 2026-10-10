# Propp Lozenge

Motor de juego en HTML/CSS/JavaScript vanilla que reproduce la mecánica del puzzle
**Propp Lozenge**: un tablero de rombos en rejilla isométrica que crea la ilusión
de un cubo 3D formado por cubitos, en el que se giran grupos de tres rombos.

## Cómo ejecutarlo

Abre `index.html` en el navegador. No hace falta compilar ni servidor: los
scripts son clásicos (no módulos ES), así que también funcionan desde `file://`.

```bash
npm test          # 17 tests del motor (node:test, sin dependencias)
npm run explore   # búsqueda de la mejor disposición inicial (opcional: N)
```

## Por qué vanilla

No hay nada que justifique una dependencia externa:

- **SVG** dibuja los rombos como polígonos nítidos a cualquier escala, con
  detección de puntero y estilos CSS. Para unas decenas de piezas no hace falta
  Canvas ni WebGL.
- Las animaciones son `requestAnimationFrame` con una transformación `rotate`.
- Los tests usan `node:test`, incluido en Node ≥ 18.

## Modelo

### Tablero

El tablero es un hexágono de lado N sobre la rejilla triangular. Toda
teselación de ese hexágono con rombos es la proyección isométrica de una pila
de cubitos dentro de una caja N×N×N (biyección entre teselaciones por rombos y
particiones planas, estudiada por James Propp). Por eso cada disposición se
define con una **matriz de alturas** `h[i][j]` y el motor deduce de ella los 3N²
rombos (`src/core.js → buildTiling`).

Cada rombo es una **casilla** con una de tres orientaciones: cara superior,
izquierda o derecha. Las **piezas** se mueven por las casillas. El sombreado
depende de la orientación de la casilla, no de la pieza, así que la ilusión 3D
se mantiene aunque el tablero esté desordenado.

### Cubitos: la herramienta de 3 piezas

Un cubito girable es un vértice de la rejilla en el que convergen exactamente
tres rombos, cada uno con su ángulo de 120° en ese punto. Juntos forman un
hexágono regular: la esquina visible de un cubito (convexo) o un rincón
(cóncavo).

- Al mover el puntero, la herramienta se ajusta al **punto de convergencia más
  cercano**. Si allí hay un cubito válido se resalta en verde. Si no (por ejemplo
  convergen 4 o 6 rombos), se muestra en rojo y el giro queda bloqueado.
- Antes de cada giro, `validateMove` → `validateTriple` comprueba que haya tres
  rombos distintos, uno de cada orientación, adyacentes dos a dos (comparten
  arista) y con el ángulo obtuso en el vértice común, y que no haya un cuarto
  rombo en ese punto.
- Un giro de 120° o 240° transforma el hexágono en sí mismo: la teselación no
  cambia y las tres piezas se permutan cíclicamente. La animación rota el grupo
  e interpola el sombreado de cada pieza mientras pasa de una cara a otra.

### Disposición inicial

El cubo macizo sólo tiene **un** cubito girable (la esquina central), así que
no sirve como puzzle. `scripts/explore.js` recorre las 980 particiones planas
de 3×3×3. Las mejores son las pilas en escalera cortadas por un plano diagonal:
**24 de 27 rombos móviles, 13 cubitos girables y una sola zona conexa**. La
disposición por defecto («Cubo escalonado») usa ese corte para cualquier N; la
pirámide, la pila aleatoria y el cubo macizo también están disponibles.

### Objetivo

- **Colores**: todas las caras superiores blancas, las izquierdas verdes y las
  derechas rojas. Es lo que se ve de un cubo de Rubik estándar desde la esquina
  U-F-R.
- **Numerado** (difícil): cada pieza debe volver a su casilla exacta.

La partida empieza en un estado aleatorio uniforme entre los estados alcanzables.

### Paridad y estados imposibles

Cada giro es un 3-ciclo, es decir, una permutación **par**. Los 3-ciclos de una
zona conexa generan exactamente el grupo alternado de esa zona. Por tanto un
estado es alcanzable si y sólo si:

1. es una permutación de las piezas,
2. ninguna pieza ha salido de su zona conexa,
3. la permutación dentro de cada zona es par.

`analyze()` aplica este criterio. Un test lo verifica por fuerza bruta: en un
tablero con zonas de 3 y 7 rombos, la exploración BFS alcanza exactamente
|A₃|·|A₇| = 7560 estados. `randomize()` baraja cada zona y, si sale impar,
`fixParity()` intercambia dos piezas del **mismo color** (en modo color el
tablero se ve igual). `setState()` y la carga desde `localStorage` rechazan los
estados imposibles. La cabecera muestra el estado de paridad en todo momento.

### Deshacer / rehacer

El motor guarda una pila de giros `{hex, turns}`. Deshacer aplica el giro
inverso (`3 − turns`) y lo pasa a la pila de rehacer. Un giro nuevo vacía la
pila de rehacer. Los giros se animan en cola, así que pulsar Ctrl+Z varias
veces seguidas se reproduce en orden. La partida (con su historial) se guarda en
`localStorage`.

## Controles

| Acción | Ratón | Táctil | Teclado |
| --- | --- | --- | --- |
| Seleccionar cubito | mover el puntero | tocar | flechas |
| Girar 120° horario | clic | volver a tocar | `E` / `Enter` |
| Girar 240° | Mayús+clic / clic derecho | botón ↺ | `Q` |
| Deshacer / rehacer | botones | botones | `Ctrl+Z` / `Ctrl+Y` |

## Estructura

```
index.html          interfaz
styles.css          estilos (tema claro/oscuro)
src/core.js         motor: teselación, validación, giros, paridad, historial (sin DOM)
src/presets.js      disposiciones iniciales (particiones planas)
src/renderer.js     vista SVG, herramienta de selección y animaciones
src/main.js         controlador: eventos, HUD, persistencia
tests/core.test.js  tests del motor
scripts/explore.js  búsqueda de la disposición con más piezas móviles
```
