import { describe, expect, it } from 'vitest';
import { createRng, fromState } from './rng';

describe('rng determinism', () => {
  it('same seed produces identical sequences', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() values are always in [0, 1)', () => {
    const rng = createRng(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rng.fork', () => {
  it('forked streams are independent of each other', () => {
    const root = createRng(42);
    const forkA = root.fork('a');
    const forkB = root.fork('b');

    const beforeBState = forkB.getState();
    // Consume a bunch from fork A.
    for (let i = 0; i < 100; i++) forkA.next();

    expect(forkB.getState()).toEqual(beforeBState);
  });

  it('forking does not perturb the parent stream', () => {
    const root = createRng(7);
    const rootBefore = root.getState();
    root.fork('anything');
    expect(root.getState()).toEqual(rootBefore);
  });

  it('forking with the same id at the same point yields the same substream', () => {
    const root = createRng(7);
    const forkA1 = root.fork('combat');
    const forkA2 = root.fork('combat');
    const seqA1 = Array.from({ length: 20 }, () => forkA1.next());
    const seqA2 = Array.from({ length: 20 }, () => forkA2.next());
    expect(seqA1).toEqual(seqA2);
  });

  it('forking with different ids yields different substreams', () => {
    const root = createRng(7);
    const forkCombat = root.fork('combat');
    const forkMapgen = root.fork('mapgen');
    const seq1 = Array.from({ length: 20 }, () => forkCombat.next());
    const seq2 = Array.from({ length: 20 }, () => forkMapgen.next());
    expect(seq1).not.toEqual(seq2);
  });

  it('consuming the parent after forking does not affect an already-created fork', () => {
    const root = createRng(7);
    const child = root.fork('stream');
    const childSeqBefore = Array.from({ length: 5 }, () => child.next());

    // Re-derive from a fresh rng with the same seed to get an unconsumed
    // reference child stream for comparison.
    const rootAgain = createRng(7);
    const childAgain = rootAgain.fork('stream');
    // Advance the root (rootAgain) stream now, after forking.
    for (let i = 0; i < 30; i++) rootAgain.next();
    const childSeqAfter = Array.from({ length: 5 }, () => childAgain.next());

    expect(childSeqAfter).toEqual(childSeqBefore);
  });
});

describe('rng state serialization', () => {
  it('getState/fromState round-trips mid-stream', () => {
    const rng = createRng(2024);
    for (let i = 0; i < 37; i++) rng.next();
    const state = rng.getState();

    const resumed = fromState(state);
    const original = Array.from({ length: 25 }, () => rng.next());
    const fromResumed = Array.from({ length: 25 }, () => resumed.next());
    expect(fromResumed).toEqual(original);
  });

  it('state is a plain JSON-serializable object', () => {
    const rng = createRng(5);
    rng.next();
    const state = rng.getState();
    const roundTripped = JSON.parse(JSON.stringify(state));
    expect(roundTripped).toEqual(state);
  });
});

describe('rng.int', () => {
  it('respects [minIncl, maxExcl) bounds', () => {
    const rng = createRng(3);
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('handles a single-valued range', () => {
    const rng = createRng(3);
    for (let i = 0; i < 20; i++) {
      expect(rng.int(4, 5)).toBe(4);
    }
  });

  it('throws on an empty or inverted range', () => {
    const rng = createRng(3);
    expect(() => rng.int(5, 5)).toThrow();
    expect(() => rng.int(10, 5)).toThrow();
  });
});

describe('rng.pick', () => {
  it('always returns an element of the array', () => {
    const rng = createRng(11);
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('throws on an empty array', () => {
    const rng = createRng(11);
    expect(() => rng.pick([])).toThrow();
  });
});

describe('rng.shuffle', () => {
  it('returns a permutation of the input (same multiset of elements)', () => {
    const rng = createRng(21);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle(arr);
    expect(shuffled.slice().sort((a, b) => a - b)).toEqual(arr.slice().sort((a, b) => a - b));
    expect(shuffled).toHaveLength(arr.length);
  });

  it('does not mutate the input array', () => {
    const rng = createRng(21);
    const arr = [1, 2, 3, 4, 5];
    const copy = arr.slice();
    rng.shuffle(arr);
    expect(arr).toEqual(copy);
  });

  it('is deterministic for a given seed', () => {
    const a = createRng(99);
    const b = createRng(99);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(a.shuffle(arr)).toEqual(b.shuffle(arr));
  });
});
