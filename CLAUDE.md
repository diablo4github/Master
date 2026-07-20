# Master — 4X strategy game (Master of Magic × Master of Orion 1, pixel art)

Read `docs/DESIGN.md` (the vision, source of truth on design) and
`docs/ARCHITECTURE.md` (tech decisions) before making changes.

## Roles & workflow

- **Jacob** is Lead Designer — final say on design/taste. Escalate design
  questions; don't invent major mechanics unilaterally.
- **Claude (lead session)** is Lead Developer — delegate implementation to
  subagents aggressively; work directly only on matters of extreme taste
  (domain model, public APIs, core architecture).

## Hard rules

- `src/sim` is a deterministic, headless simulation. No imports from
  render/ui/pixi, no `Math.random`, no `Date.now`. All randomness via
  `src/sim/core/rng.ts`. Everything JSON-serializable.
- `src/data` is content-as-data: typed constants only, no logic.
- Renderer reads sim state; it never mutates it. UI issues commands.
- Ids are lowercase kebab-case.
- New sim logic and content ship with Vitest tests (`npm test`).

## Commands

- `npm run dev` — Vite dev server
- `npm test` — Vitest (run once, CI mode: `npm test -- --run`)
- `npm run build` — typecheck + production build
- `npm run assets` — regenerate spritesheets via tools/pixelsmith

## Key invariants (tested — keep the tests passing)

- Exactly 5 schools; Life+Death never combined on one wizard.
- Exactly 21 premade wizards (5 single, 9 double, 7 triple school).
- Exactly 8 planes (3 worlds + 5 school dimensions).
- Exactly 30 races: 18 normal-world, 6 dark-world, 6 light-world.
