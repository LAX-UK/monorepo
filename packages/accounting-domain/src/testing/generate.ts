/** Seeded generators for property-style tests (fast-check is not a dependency of this repo). */
export type Rng = () => number;

/** mulberry32: small, fast, deterministic. */
export function rngFrom(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[int(rng, 0, items.length - 1)] as T;
}

/** Run `check` for `runs` generated cases; the failing seed is in the error message. */
export function forAll(runs: number, check: (rng: Rng, run: number) => void): void {
  for (let run = 0; run < runs; run++) {
    const rng = rngFrom(0x1a2b3c + run);
    try {
      check(rng, run);
    } catch (error) {
      throw new Error(`property failed on run ${run}: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
}
