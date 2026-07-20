# Master — Design Document

> **Status:** Living document. Lead Designer: Jacob. Lead Developer: Claude.
> Anything marked *(placeholder)* is a developer suggestion awaiting designer approval.

## Vision

A single-player 4X strategy game in the spirit of **Master of Magic** and the
**original Master of Orion**, with pixel graphics. The game should have a "big"
feel like MoO1: sweeping scope with most management **abstracted** — the player
makes a few meaningful decisions per turn, not a hundred chores. Hotseat
multiplayer is a potential future addition; no networked multiplayer, ever.

## The Five Schools of Magic

| School  | Color | Identity |
|---------|-------|----------|
| Life    | White | Blessing, protection, exaltation. The most powerful summons in the game — and the hardest to cast. |
| Death   | Black | Corruption, conversion, attrition. The *most* summoning access, generally weaker — often by converting mundane units or population directly into creatures. |
| Chaos   | Red   | Destruction, fire, raw force. Thrives in the normal world. |
| Nature  | Green | Growth, beasts, terrain. Thrives in the normal world. |
| Sorcery | Blue  | Illusion, counter-magic, manipulation. Thrives in the normal world. |

Rules:

- A wizard commits to **1–3 schools**.
- **Life and Death can never be mixed.**
- Every legal school combination has a **premade wizard** with perks (retorts)
  tuned to that build: 5 single-school + 9 two-school + 7 three-school = **21
  premade wizards**.
- The player picks a premade wizard to play as and may customize their
  **perks/retorts only** — never their school selection.

## The Eight Planes

Three **main worlds** plus five **school dimensions**.

### Main worlds

| World | Character |
|-------|-----------|
| **Meridia** — the normal world | Red/green/blue magic thrives here. Default starting world. 18 playable races. |
| **Umbra** — the dark world | Black (Death) magic thrives. 6 playable races. |
| **Lumina** — the light world | White (Life) magic thrives. 6 playable races. |

*(World and dimension names approved by design 2026-07-20.)*

Starting world: players start in Meridia by default. A **perk** allows starting
in Umbra or Lumina, with restrictions:

- Death wizards **cannot** start in Lumina.
- Life wizards **cannot** start in Umbra.

### School dimensions

Each school has its own **mini dimension** — a small side-map, not a full
world — accessible only by **pure mages** (single-school wizards) of that
school. The dimension is the pure mage's late-game power arc, earned in four
steps:

1. **Unlock through research** — a capstone line in the school's magical
   studies attunes the wizard to their dimension and opens a rift.
2. **Expedition** — the player travels there with a **hero-led army**; only a
   hero can hold a rift open for troops.
3. **Themed challenge** — each dimension poses a special challenge in its
   school's character (see below). This is a real fight/quest, not a toll.
4. **Reward** — completing the challenge grants **powerful, permanent
   late-game bonuses**. Dedicated single-school wizards should be the most
   dangerous wizards in a long game; the dimension is why.

| School  | Dimension        | Challenge sketch *(placeholder — design pass pending)* |
|---------|------------------|--------------------------------------------------------|
| Life    | The Empyrean     | A trial of protection: shepherd and defend the innocent against waves of corruption. |
| Death   | The Charnel Deep | A great harvest: claim what is owed from things that refuse to die. |
| Chaos   | The Maelstrom    | Survive the storm: hold an anchor-point as the dimension itself escalates against you. |
| Nature  | The Wildroot     | Tame the primeval: subdue or befriend the apex beasts of the first forest. |
| Sorcery | The Aether       | Unravel the labyrinth: a shifting puzzle-maze of illusions and mirrored foes. |

## Races — 30 total

- **18 races** native to the normal world, **6** to the dark world, **6** to the
  light world.
- **Orcs are the generic baseline race** (the "Humans of MoM" role).
- Research is limited to **magical studies only** — each race has a unique
  "tech tree" of magical study paths.
- As in MoM, **buildings provide powerful bonuses**; races differ in which
  buildings they can construct, plus growth rates and yields. We want notably
  **more diversity than MoM** delivered here.
- **Humans** lean toward Life magic. Their playstyle is built around erecting
  **larger and larger temples**, culminating in monumental high-tier temples —
  aesthetically **LDS-style** (gleaming white/gold spires, celestial grandeur)
  rather than Catholic gothic.

## Combat

- Tactical encounters are **fought automatically by the troops**.
- The player gets a **viewer** to watch battles and learn from them.
- Units employ **realistic tactics** derived from their skill, race, equipment,
  morale, and situation — archers kite, veterans hold formation, green troops
  rout. The battle viewer is a learning tool: watching *why* you lost teaches
  you how to build better armies.
- Implementation consequence: combat is a **deterministic simulation** producing
  a replayable event log; the viewer is a pure playback layer.

### No rock-paper-scissors — physics of the fiction

Counters are **emergent from simulated causes**, never from bonus-vs-tag
lookup tables:

- Spearmen blunt cavalry because **reach** strikes chargers first, not because
  of an anti-cavalry tag.
- Cavalry shatters loose or routing infantry because **mass × speed** is
  charge impact against low cohesion.
- Archers beat slow melee by **kiting** (speed + range), and lose when pinned.
- Veterans matter because **skill drives the unit AI**: green troops blob,
  break formation, and panic; veterans hold lines, screen their archers,
  focus wounded targets, and rally.
- **Morale and discipline** decide as many fights as damage does. Casualties,
  fear auras, flanking, and a rout next door all test morale; broken units
  run, and pursuit cuts them down.

Units are **multi-figure formations** (MoM-style): a spearman unit is six
spearmen; damage kills figures, and a half-strength unit hits half as hard.

### Fantastical elements — small to massive

Realistic army composition is the canvas; magic is the paint. Abilities are a
**typed effect vocabulary** implemented one by one in the engine — some small
(a poison blade, a regenerating troll wound), some battle-warping (a dragon's
breath, an angel's radiance, terror that breaks a flank without a sword drawn).
The design goal: most battles are decided by composition and tactics, and
every so often a fantastical element **rewrites** one.

### Where battles come from (this milestone)

Armies are **stacks of co-located units** (cap 9). Moving onto a hostile tile
starts a battle on a small tactical field derived from the strategic terrain.
The first hostiles are **monster lairs** seeded at worldgen (a very Master of
Magic institution): clearing one yields loot and clears the region. Wizard-vs-
wizard warfare arrives with the AI-opponents milestone.

## Summons

- Every school summons mythical creatures.
- **Life**: fewest, most powerful, highest casting cost/difficulty.
- **Death**: broadest access, generally weaker; signature mechanic is
  **conversion** — turning mundane units or town population directly into
  undead/demonic creatures.
- Chaos/Nature/Sorcery sit between, each with a distinct flavor.

## Management Philosophy

MoO1-style abstraction. Sliders, ranked priorities, and smart defaults over
micromanagement. If a screen would make the player do arithmetic, abstract it.

## Art

Pixel graphics. Base pixel assets are generated by **Fable** (Claude) through a
scripted asset pipeline (`tools/pixelsmith`), so all art is reproducible from
source data and restyleable in bulk.

## Project Roles

- **Jacob** — Lead Designer. Final say on all design and taste questions.
- **Claude** — Lead Developer. Owns the codebase; aggressively delegates
  implementation to Sonnet/Opus agents; works directly only on matters of
  extreme taste; escalates design questions to Jacob.
