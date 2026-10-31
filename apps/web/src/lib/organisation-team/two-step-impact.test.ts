import { describe, expect, it } from "vitest";
import { twoStepImpact } from "./two-step-impact";

const people = [
  { userId: "maya", name: "Maya Okafor", role: "owner" as const },
  { userId: "tom", name: "Tom Whitfield", role: "buyer_agent" as const },
  { userId: "lena", name: "Lena Fischer", role: "consignor" as const },
];

describe("twoStepImpact", () => {
  it("names who doesn't have it on and what happens to them", () => {
    const impact = twoStepImpact(people, { maya: true, tom: false, lena: null });
    expect(impact.coverage).toBe("1 of 3 people");
    expect(impact.percent).toBe(33);
    expect(impact.missingLine).toBe("Tom Whitfield and Lena Fischer don't have it on.");
    expect(impact.affected[0]).toEqual({
      userId: "tom",
      name: "Tom Whitfield",
      detail: "Buyer agent · bids already placed stay; new ones wait until it's on",
    });
  });

  it("says nothing is missing when everyone has it", () => {
    const impact = twoStepImpact(people, { maya: true, tom: true, lena: true });
    expect(impact.missingLine).toBeNull();
    expect(impact.affected).toEqual([]);
  });
});
