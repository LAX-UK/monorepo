import { describe, expect, it } from "vitest";
import { claimableShortfall } from "./reoffer-shortfall.js";

describe("claimableShortfall", () => {
  it("adds the hammer drop to the premium lost on the original sale", () => {
    expect(
      claimableShortfall({
        originalHammerMinor: 88_000_00,
        newHammerMinor: 82_000_00,
        originalPremiumMinor: 22_000_00,
      }),
    ).toEqual({
      hammerDifferenceMinor: 6_000_00,
      premiumLostMinor: 22_000_00,
      totalMinor: 28_000_00,
    });
  });

  it("never lets the hammer difference go negative", () => {
    expect(
      claimableShortfall({
        originalHammerMinor: 100,
        newHammerMinor: 150,
        originalPremiumMinor: 25,
      }),
    ).toEqual({ hammerDifferenceMinor: 0, premiumLostMinor: 25, totalMinor: 25 });
  });

  it("is zero when nothing is lost", () => {
    expect(
      claimableShortfall({ originalHammerMinor: 100, newHammerMinor: 100, originalPremiumMinor: 0 })
        .totalMinor,
    ).toBe(0);
  });

  it("never returns a negative total, even for a negative premium input", () => {
    expect(
      claimableShortfall({
        originalHammerMinor: 50,
        newHammerMinor: 100,
        originalPremiumMinor: -10,
      }).totalMinor,
    ).toBe(0);
  });

  it("stays in whole pence", () => {
    expect(
      claimableShortfall({
        originalHammerMinor: 1_000_01,
        newHammerMinor: 999_99,
        originalPremiumMinor: 250_00,
      }),
    ).toEqual({ hammerDifferenceMinor: 2, premiumLostMinor: 250_00, totalMinor: 250_02 });
  });
});
