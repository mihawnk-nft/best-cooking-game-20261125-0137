# Sizzle & Serve

[![make.fun](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/c/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/mihawnk-nft/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/c/best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/mihawnk-nft/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/c/best-cooking-game-20261125-0137)

A tiny kitchen, a lunch rush, four dishes. **Sizzle & Serve** is an original,
complete cooking game that plays offline in a desktop browser from static
files — no network requests, no libraries, pure canvas and Web Audio.

## How to play

Run a 150-second shift in a small kitchen:

- **Grab ingredients** from the crates: buns, raw patties, tomatoes, lettuce, cheese.
- **Chop** tomatoes and lettuce on the chopping board (3 chops each).
- **Grill** raw patties — 6 seconds to cooked, 8 more to burnt. Burnt patties go in the bin.
- **Build the dish** on the plating counter, then **serve** it at the window
  before the ticket's patience runs out.

Serve fast for tips, chain serves for a combo multiplier, and don't let three
tickets walk out — three lost orders ends the shift early.

### The menu

| Dish | Needs | Price |
| --- | --- | --- |
| Classic Burger | bun + grilled patty + chopped lettuce + chopped tomato | $12 |
| Cheese Burger | bun + grilled patty + cheese + chopped tomato | $14 |
| Garden Salad | chopped lettuce + chopped tomato + cheese | $10 |
| Double Stack | bun + 2 grilled patties + cheese | $18 |

### Controls

- **WASD / arrow keys** — move the chef
- **E / Space** — use the nearest station
- **Click a station** — walk there and use it; click anywhere else to walk there
- **P / Esc** — pause, **M** — mute, **R** — restart after a shift

## Play it

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

Open `game/index.html` from any static server. Screenshots are staged from the
real rules with `?shot=start|play|end&seed=1` (see `shots.json`).

## Layout

- `game/` — the playable game: `index.html` + ES modules under `game/src/`
  (`config.js`, `world.js`, `render.js`, `input.js`, `audio.js`, `shots.js`, `main.js`, `random.js`)
- `screenshots/` — three real renders of the game's own code
- `main.ts` — hands the game in: copies `game/` + `screenshots/` to `/output`
  and writes `dossier.json` with the vendored make.fun library
- `vendor/makefun-game.ts` — the kit's library, unchanged
- `serve.ts` — tiny static server for local play-testing

Built for the [best cooking game bounty on make.fun](https://make.fun/c/best-cooking-game-20261125-0137). MIT licensed.
