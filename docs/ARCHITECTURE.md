# Master — Architecture

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) | Agent-friendly, great tooling, one language everywhere |
| Build | Vite | Instant dev server, trivial static deploy |
| Rendering | PixiJS | Fast 2D WebGL sprite rendering, ideal for pixel art |
| Tests | Vitest | Fast, Vite-native |
| Assets | `tools/pixelsmith` (Node) | Pixel sprites defined as data, compiled to PNG spritesheets |

Single-player in the browser (also packageable via Tauri/Electron later).
Hotseat needs no networking — just player-switch flow on one machine.

## The Prime Directive: sim / render separation

```
src/sim     — deterministic simulation core. NO imports from render/ui/pixi.
              Pure data in, pure data out. Seeded RNG only (no Math.random,
              no Date.now). Everything serializable to JSON.
src/data    — static content definitions (schools, wizards, races, units,
              buildings, spells, planes). Plain typed objects, no logic.
src/render  — PixiJS presentation layer. Reads sim state, never mutates it.
src/ui      — screens, menus, input handling. Translates input into sim commands.
tools/      — build-time tooling (pixelsmith asset pipeline).
```

Why this is non-negotiable:

1. **Auto-battler combat with a viewer** — combat runs headless in the sim and
   emits an event log; the viewer replays the log. Same battle, same result,
   every time.
2. **Save/load & hotseat** — the entire game state is one serializable object.
3. **Testing & agent development** — agents can build and test sim features
   headlessly without touching rendering.
4. **AI development** — the AI plays the same command API as the player.

## Determinism rules (enforced in review)

- All randomness flows through the seeded RNG in `src/sim/core/rng.ts`.
- No `Math.random`, `Date.now`, or iteration over non-deterministic ordering
  (e.g. `Set`/`Map` insertion order must be controlled) inside `src/sim`.
- Sim state is a plain-object tree; mutations happen only in command/turn
  processing.

## Content is data

All game content (races, wizards, spells, units, buildings) lives in
`src/data` as typed constant objects validated against the interfaces in
`src/sim/types.ts`. Balance passes are data edits, not code edits.

## Directory map

```
docs/            design + architecture docs
src/sim/core/    rng, ids, game state, turn processing, commands
src/sim/map/     plane/map generation, tiles, movement
src/sim/combat/  auto-resolved tactical combat + battle event log
src/data/        content: schools, planes, wizards, races, units, buildings, spells
src/render/      pixi app, sprite loading, map/battle views
src/ui/          screens and input
tools/pixelsmith pixel asset pipeline (data -> PNG spritesheets)
assets/          generated spritesheets + manifests (committed)
```

## Conventions

- Ids are lowercase kebab-case strings (`'high-men'`, `'charnel-deep'`).
- Content lookups go through typed registries, not raw imports scattered around.
- Every sim feature lands with Vitest coverage; content lands with a
  validation test (e.g. "exactly 21 wizards, no life+death mix").
