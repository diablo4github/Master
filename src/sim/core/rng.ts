/**
 * Deterministic seeded PRNG for the sim.
 *
 * ALL randomness in src/sim must flow through this module. No Math.random,
 * no Date.now, anywhere in the sim.
 *
 * Algorithm: sfc32 ("Small Fast Counter" 32-bit), a well-regarded
 * public-domain generator (128-bit state, passes PractRand well beyond any
 * game's needs). The 4-word state is seeded via splitmix32, which is used
 * both to expand a single 32-bit seed into good initial state and to derive
 * independent substreams for `fork`.
 *
 * State is a plain, JSON-serializable object: { a, b, c, d }, all uint32.
 */

/** Serializable snapshot of an Rng's internal state. */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [minIncl, maxExcl). */
  int(minIncl: number, maxExcl: number): number;
  /** Uniformly random element of a non-empty array. */
  pick<T>(arr: readonly T[]): T;
  /** Returns a new, shuffled copy of the array (Fisher-Yates). Does not mutate input. */
  shuffle<T>(arr: readonly T[]): T[];
  /**
   * Derives an independent, deterministic substream identified by `streamId`.
   * Forking does NOT consume the parent's stream, so:
   *  - the parent is unaffected by having forked
   *  - forking twice with the same id (at the same point in the parent's
   *    lifecycle) yields the same child stream
   *  - different ids yield independent, non-correlated streams
   *  - consuming a forked stream never affects the parent or sibling forks
   */
  fork(streamId: string): Rng;
  /** Snapshot of internal state, safe to store in a save file. */
  getState(): RngState;
}

/** Creates a new Rng from a 32-bit integer seed. */
export function createRng(seed: number): Rng {
  return makeRng(seedToSfcState(seed >>> 0));
}

/** Reconstructs an Rng from a previously captured state (e.g. loading a save). */
export function fromState(state: RngState): Rng {
  return makeRng({ a: state.a >>> 0, b: state.b >>> 0, c: state.c >>> 0, d: state.d >>> 0 });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** splitmix32: cheap, well-mixed 32-bit generator used only for seeding. */
function makeSplitMix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    z = (z ^ (z >>> 15)) >>> 0;
    return z;
  };
}

/** Expands a single seed into a well-distributed sfc32 state, then warms it up. */
function seedToSfcState(seed: number): RngState {
  const gen = makeSplitMix32(seed);
  const state: RngState = { a: gen(), b: gen(), c: gen(), d: gen() };
  // sfc32 can start weak from certain seeds; discard a handful of outputs.
  for (let i = 0; i < 16; i++) sfc32Step(state);
  return state;
}

/** One step of sfc32, mutating `state` in place and returning a float in [0, 1). */
function sfc32Step(state: RngState): number {
  let a = state.a >>> 0;
  let b = state.b >>> 0;
  let c = state.c >>> 0;
  let d = state.d >>> 0;

  let t = (a + b) | 0;
  a = (b ^ (b >>> 9)) >>> 0;
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) >>> 0;

  state.a = a;
  state.b = b;
  state.c = c;
  state.d = d >>> 0;

  return (t >>> 0) / 4294967296;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** FNV-1a 32-bit string hash, used to derive fork substream seeds. */
function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeRng(state: RngState): Rng {
  const next = (): number => sfc32Step(state);

  const int = (minIncl: number, maxExcl: number): number => {
    const range = maxExcl - minIncl;
    if (!(range > 0)) {
      throw new Error(`Rng.int: invalid range [${minIncl}, ${maxExcl})`);
    }
    return minIncl + Math.floor(next() * range);
  };

  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    const item = arr[int(0, arr.length)];
    // arr.length > 0 and index is within bounds, so this is always defined.
    return item as T;
  };

  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i + 1);
      const a = out[i] as T;
      const b = out[j] as T;
      out[i] = b;
      out[j] = a;
    }
    return out;
  };

  const fork = (streamId: string): Rng => {
    const h = fnv1a32(streamId);
    // Mix all four current state words plus the stream hash without
    // consuming (advancing) the parent's own stream.
    const mixed =
      (state.a ^ rotl(state.b, 7) ^ rotl(state.c, 13) ^ rotl(state.d, 19) ^ h) >>> 0;
    return makeRng(seedToSfcState(mixed));
  };

  const getState = (): RngState => ({ a: state.a, b: state.b, c: state.c, d: state.d });

  return { next, int, pick, shuffle, fork, getState };
}
