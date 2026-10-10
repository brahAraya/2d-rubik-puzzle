# Propp Lozenge

*[English](README.md)*

🛒 **Compra el puzzle físico:** [Propp Lozenge en Etsy](https://www.etsy.com/es/listing/4565297719/pastilla-de-propp)

> **⚠️ Vibe coded.** Este juego se programó con ayuda de un asistente de IA.
> Funciona y tiene tests, pero no lo escribió una persona línea a línea, así
> que puede tener asperezas.

Motor de juego en HTML/CSS/JavaScript vanilla que reproduce el puzzle
**Propp Lozenge** (inventado por James Propp y diseñado por Oskar van Deventer):
27 fichas en forma de rombo dentro de un marco hexagonal que crean la ilusión de
un cubo 3D. Con una herramienta magnética se levanta un grupo hexagonal de tres
fichas, se gira 60° y se vuelve a colocar. El objetivo es restaurar el cubo
original.

## Cómo ejecutarlo

Abre `index.html` en el navegador. No hace falta compilar ni servidor: los
scripts son clásicos (no módulos ES), así que también funcionan desde `file://`.

```bash
npm test          # 30 tests del motor (node:test, sin dependencias)
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

### La herramienta de 3 piezas

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

### El giro de 60°

El **único movimiento** es girar el grupo 60° en sentido horario. Para girar
más, se vuelve a girar: seis giros completan la vuelta.

Un giro de 60° convierte el hexágono en su otra teselación: un cubito que
sobresale pasa a ser un rincón y viceversa. Así cambia la forma de la pila y
aparecen cubitos girables nuevos. La animación rota las tres fichas e
interpola su sombreado mientras pasan de una cara a otra.

Cada casilla tiene una identidad estable aunque cambie la forma (la cara
superior de la columna (i, j), la cara +x de la fila (j, k) y la cara +y de la
fila (i, k)). Internamente, 60° = 180° + 240°: media vuelta deja cada ficha en
la nueva posición de su misma casilla, y los 240° restantes son un 3-ciclo. Los
tests verifican geométricamente que cada ficha acaba en la posición girada
exactamente 60° y con la orientación correcta.

El motor admite también −60°, 120°, 180° y 240° (`allowedOps`), pero la
partida sólo permite +60°. Deshacer aplica internamente el giro de −60°.

### Objetivo

Recuperar el cubo macizo original (3×3×3, 27 fichas) con todas las caras
superiores amarillas, las izquierdas verdes y las derechas rojas. También se
puede jugar con tamaños de 2 a 5.

### Estado aleatorio y paridad

Como en el puzzle físico, el estado inicial equivale a sacar todas las fichas
y colocarlas al azar: una forma aleatoria (un paseo aleatorio de giros) con una
colocación aleatoria de las fichas.

Los giros de 120° son 3-ciclos (permutaciones **pares**) y la media vuelta no
permuta fichas, así que toda secuencia de giros produce una permutación par.
Los 3-ciclos de una zona conexa generan exactamente el grupo alternado sobre
ella, y los cubitos de todas las formas posibles enlazan las 27 casillas (los
tests lo comprueban de forma exhaustiva para N ≤ 3). Por tanto un estado es
alcanzable si y sólo si la forma es una partición plana válida, las fichas son
una permutación y esa permutación es par.

Si la colocación aleatoria sale impar, `fixParity()`
intercambia dos fichas del **mismo color** y el tablero se ve igual. Por eso
**cualquier colocación aleatoria de las fichas tiene solución**, como dice la
descripción del puzzle físico (hay un test que lo comprueba con 200
colocaciones). El motor tiene además un modo «numerado», en el que cada ficha
debe volver a su casilla exacta y la mitad de las colocaciones serían
imposibles; el juego no lo usa. `setState()` y la
carga desde `localStorage` rechazan los estados imposibles, así que en el juego
nunca aparece un estado sin solución.

### Deshacer / rehacer

El motor guarda una pila de movimientos `{key, op}`, donde `key` es el vértice
central y `op` es `cw60`. Deshacer aplica el giro contrario (−60°) en el
mismo vértice y lo pasa a la pila de rehacer. Un giro nuevo vacía la pila de
rehacer. Los giros se animan en cola, así que pulsar Ctrl+Z varias veces
seguidas se reproduce en orden. La partida (con su historial) se guarda en
`localStorage`.

## Controles

| Acción | Ratón | Táctil | Teclado |
| --- | --- | --- | --- |
| Seleccionar cubito | mover el puntero | tocar | flechas |
| Girar 60° (horario) | clic | volver a tocar | `E` / `Enter` |
| Deshacer / rehacer | iconos ⟲ ⟳ | iconos ⟲ ⟳ | `Ctrl+Z` / `Ctrl+Y` (`⌘Z` / `⌘⇧Z` en Mac) |

En la cabecera se elige el idioma (español o inglés) y el modo claro u oscuro.
Las dos opciones se recuerdan; en la primera visita se usan el idioma del
navegador y el tema del sistema. Los textos están en `src/i18n.js` y el motor
devuelve un `code` estable en cada movimiento bloqueado para poder traducir el
motivo.

## Estructura

```
index.html          interfaz
styles.css          estilos (tema claro/oscuro)
src/i18n.js         textos en español e inglés
src/core.js         motor: teselación, validación, giros, paridad, historial (sin DOM)
src/presets.js      formas del tablero (cubo macizo; las demás, para tests)
src/renderer.js     vista SVG, herramienta de selección y animaciones
src/main.js         controlador: eventos, HUD, persistencia
tests/core.test.js  tests del motor
scripts/explore.js  búsqueda de la disposición con más piezas móviles
```

## Créditos

- **Puzzle inventado por:** James (Jim) Propp
- **Puzzle diseñado por:** Oskar van Deventer
- **Puzzle físico:** [a la venta en Etsy](https://www.etsy.com/es/listing/4565297719/pastilla-de-propp)

Este proyecto es una versión digital no oficial, hecha por aficionados para
aprender y disfrutar. No tiene relación con el inventor ni con el diseñador del
puzzle físico, ni cuenta con su respaldo.
