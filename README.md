# Propp Lozenge

> **Vibe coded.** This project was made with generative AI: an AI assistant
> wrote the code.

*[Español](README.es.md)*

A browser version of **Propp Lozenge**, a flat puzzle that looks like a 3D cube.
It is written in vanilla HTML, CSS and JavaScript, with no dependencies.

🛒 **Get the physical puzzle:** [Propp Lozenge on Etsy](https://www.etsy.com/listing/4565297719/pastilla-de-propp)

## The puzzle

Propp Lozenge is a magnetic tile puzzle invented by **James (Jim) Propp** and
designed by **Oskar van Deventer**.

It has 27 diamond-shaped tiles (lozenges) arranged inside a hexagonal frame.
Their colours and orientations create the illusion of a three-dimensional cube,
even though the puzzle is completely flat.

Each tile has a small magnet embedded in it. With the magnetic tool you lift a
hexagonal group of three tiles, rotate it 60° and put it back in the frame.
These rotations gradually transform the pattern and let you scramble the
puzzle. Rotating a group turns a cube that sticks out into a hollow corner and
the other way round, so the picture shifts between many familiar lozenge
patterns that look like cubes with missing sections.

The goal is simple: restore the original cube pattern.

Unlike many permutation puzzles, a completely random arrangement of Propp
Lozenge can always be solved. However badly you scramble it, there is always a
way back.

## How to play

**▶ Play online: [braharaya.github.io/2d-rubik-puzzle](https://braharaya.github.io/2d-rubik-puzzle/)**

You can also play offline: download the repository and open `index.html` in a
browser. No build step or server is needed.

- **Goal:** rebuild the solid cube with yellow top faces, green left faces and
  red right faces.
- **Select:** move the pointer over the board. The three-tile tool snaps to the
  nearest point where three tiles meet. Green means the three tiles form a
  valid group and can be rotated. Red means rotation is blocked at that point.
- **Rotate:** click to rotate the group 60° clockwise. That is the only move.
  To rotate further, click again; six clicks bring the group back to where it
  started.
- **Touch:** tap to select a group, then tap it again to rotate it.
- **Keyboard:** arrow keys move the selection, `E` or `Enter` rotates.
- **Undo / redo:** use the icon buttons (hover over them to see the shortcut),
  or `Ctrl+Z` / `Ctrl+Y` (`⌘Z` / `⌘⇧Z` on a Mac).
- **Language and theme:** the header has a language picker (Spanish or
  English) and a light/dark mode button. Both choices are remembered. On the
  first visit the game follows the browser language and the system theme.

Each new game starts from a random arrangement, like taking every tile out of
the frame and putting them back at random. The game is saved in the browser,
including the move history. You can also play 2×2×2, 4×4×4 and 5×5×5 versions;
3×3×3 is the original.

## How it works

- **Board:** every lozenge tiling of the hexagon is the projection of a stack
  of small cubes in an N×N×N box (a plane partition). The engine stores the
  current stack as a height map and derives the 3N² tiles from it.
- **Rotatable groups:** a group is a grid point where exactly three tiles meet,
  each with its 120° corner there. Before every move the engine checks that
  there are three distinct tiles, one per orientation, that they share edges
  pairwise, and that no fourth tile touches that point.
- **The 60° move:** rotating a group by 60° swaps it to the other tiling of
  the same hexagon, so the stack gains or loses a cube. Each tile lands exactly
  on its position rotated by 60°; the tests check this geometrically.
- **Solvability:** every sequence of moves produces an even permutation of the
  tiles. The groups from all possible stacks link all 27 positions, so an even
  permutation is always reachable. When a random arrangement comes out odd, two
  tiles of the same colour are swapped. That fixes the parity without changing
  how the board looks, which is why any random arrangement is solvable.
- **Undo / redo:** each move is stored as its centre point. Undo applies a
  −60° rotation at the same point.

To run the engine tests (Node.js 18 or later, no dependencies):

```bash
npm test
```

## Project layout

```
index.html          page
styles.css          styles (light and dark themes)
src/i18n.js         Spanish and English texts
src/core.js         engine: tiling, validation, moves, parity, history (no DOM)
src/presets.js      board shapes (the solid cube; other shapes are for tests)
src/renderer.js     SVG view, selection tool and animations
src/main.js         UI controller: input, HUD, saving
tests/core.test.js  engine tests
scripts/explore.js  search for the tilings with the most rotatable groups
```

## Credits

- **Puzzle invented by:** James (Jim) Propp
- **Puzzle designed by:** Oskar van Deventer
- **Physical puzzle:** [available on Etsy](https://www.etsy.com/listing/4565297719/pastilla-de-propp)

This project is an unofficial, fan-made digital version created for learning
and enjoyment. It is not affiliated with or endorsed by the inventor or the
designer of the physical puzzle.
