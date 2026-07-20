/**
 * The Eight Planes: 3 main worlds + 5 school dimensions.
 *
 * Content-as-data: no logic beyond the plain constant below. See
 * docs/DESIGN.md "The Eight Planes" for the source design intent.
 */

import type { PlaneDef, PlaneId } from '@sim/types';

export const PLANES = {
  meridia: {
    id: 'meridia',
    name: 'Meridia',
    kind: 'world',
    thrivingSchools: ['chaos', 'nature', 'sorcery'],
    description:
      'The normal world, and the default starting ground for every wizard. ' +
      'Eighteen mortal races till its fields and raise its towers, while ' +
      'chaos, nature, and sorcery magic all thrive in its open air.',
  },
  umbra: {
    id: 'umbra',
    name: 'Umbra',
    kind: 'world',
    thrivingSchools: ['death'],
    description:
      'A dark, sunless world layered beneath Meridia, where death magic runs ' +
      'strongest and six grim races have adapted to its perpetual night. Life ' +
      'wizards can never call it home.',
  },
  lumina: {
    id: 'lumina',
    name: 'Lumina',
    kind: 'world',
    thrivingSchools: ['life'],
    description:
      'A radiant world bathed in unbroken celestial light, where life magic ' +
      'burns brightest and six luminous races have built their civilizations ' +
      'around its glow. Death wizards can never call it home.',
  },
  empyrean: {
    id: 'empyrean',
    name: 'The Empyrean',
    kind: 'dimension',
    school: 'life',
    thrivingSchools: ['life'],
    description:
      'A dimension of endless golden sky and floating sanctums, opened only ' +
      'to pure Life mages. It holds the rites and reagents behind the ' +
      'school’s rarest, most powerful summons.',
  },
  'charnel-deep': {
    id: 'charnel-deep',
    name: 'The Charnel Deep',
    kind: 'dimension',
    school: 'death',
    thrivingSchools: ['death'],
    description:
      'A dimension of bottomless catacombs and black ossuaries, opened only ' +
      'to pure Death mages. Its endless dead offer a well of conversion ' +
      'material no other school can match.',
  },
  maelstrom: {
    id: 'maelstrom',
    name: 'The Maelstrom',
    kind: 'dimension',
    school: 'chaos',
    thrivingSchools: ['chaos'],
    description:
      'A dimension of storm-wracked ash plains and rivers of fire, opened ' +
      'only to pure Chaos mages, who draw on its raw destructive power to ' +
      'field the strongest elemental hosts in the game.',
  },
  wildroot: {
    id: 'wildroot',
    name: 'The Wildroot',
    kind: 'dimension',
    school: 'nature',
    thrivingSchools: ['nature'],
    description:
      'A dimension of primordial, overgrown wilderness, opened only to pure ' +
      'Nature mages, who tend its ancient groves in exchange for beasts and ' +
      'bounties found nowhere else.',
  },
  aether: {
    id: 'aether',
    name: 'The Aether',
    kind: 'dimension',
    school: 'sorcery',
    thrivingSchools: ['sorcery'],
    description:
      'A dimension of shifting mirror-light and fractured space, opened only ' +
      'to pure Sorcery mages, who mine its illusions and captured echoes for ' +
      'secrets no other school can perceive.',
  },
} as const satisfies Record<PlaneId, PlaneDef>;
