import { describe, expect, it } from "vitest";
import { listAllowedAutoBidSteps, validateAutoBidStepAmount } from "./auto-bid.js";

const baseRules = {
  autoBidEnabled: true,
  minBidIncrement: "10",
  autoBidStepMin: "10",
  autoBidStepMax: "50",
  autoBidStepPresets: [10, 20, 50] as number[],
};

describe("validateAutoBidStepAmount", () => {
  it("accepts preset steps within staff list", () => {
    expect(validateAutoBidStepAmount(baseRules, 20)).toBeNull();
  });

  it("rejects steps outside presets", () => {
    expect(validateAutoBidStepAmount(baseRules, 15)).toMatch(/Choose a step/);
  });

  it("rejects when auto-bid disabled on lot", () => {
    expect(validateAutoBidStepAmount({ ...baseRules, autoBidEnabled: false }, 10)).toMatch(
      /not enabled/,
    );
  });
});

describe("listAllowedAutoBidSteps", () => {
  it("returns presets when configured", () => {
    expect(listAllowedAutoBidSteps(baseRules)).toEqual([10, 20, 50]);
  });

  it("generates range when presets absent", () => {
    const steps = listAllowedAutoBidSteps({
      autoBidEnabled: true,
      minBidIncrement: "10",
      autoBidStepMin: "10",
      autoBidStepMax: "30",
    });
    expect(steps).toEqual([10, 20, 30]);
  });
});
