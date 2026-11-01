import { describe, expect, it } from "vitest";
import { allocateHomeLots } from "./home-lot-pool.js";

const lots = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (xs: { id: string }[] | undefined) => xs?.map((x) => x.id);

describe("allocateHomeLots", () => {
  it("gives each lot to the highest-priority slot only", () => {
    const r = allocateHomeLots([
      { key: "hero", candidates: lots("a", "b"), limit: 1 },
      { key: "rail", candidates: lots("a", "b", "c"), limit: 2 },
      { key: "more", candidates: lots("a", "b", "c", "d", "e"), limit: 10 },
    ]);
    expect(ids(r.hero)).toEqual(["a"]);
    expect(ids(r.rail)).toEqual(["b", "c"]);
    expect(ids(r.more)).toEqual(["d", "e"]);
  });

  it("drops duplicates inside one slot", () => {
    const r = allocateHomeLots([{ key: "s", candidates: lots("a", "a", "b"), limit: 5 }]);
    expect(ids(r.s)).toEqual(["a", "b"]);
  });

  it("leaves a slot empty below its minimum and lets later slots use its lots", () => {
    const r = allocateHomeLots([
      { key: "rail", candidates: lots("a", "b"), limit: 4, min: 3 },
      { key: "more", candidates: lots("a", "b", "c"), limit: 4 },
    ]);
    expect(r.rail).toEqual([]);
    expect(ids(r.more)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty slot for no candidates or a zero limit", () => {
    const r = allocateHomeLots([
      { key: "none", candidates: [], limit: 3 },
      { key: "zero", candidates: lots("a"), limit: 0 },
    ]);
    expect(r.none).toEqual([]);
    expect(r.zero).toEqual([]);
  });
});
