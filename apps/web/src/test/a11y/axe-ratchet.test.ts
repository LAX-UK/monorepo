import { describe, expect, it } from "vitest";
import { type FoundViolation, describeRatchet, evaluateRatchet } from "./axe-ratchet";

const v = (route: string, rule: string, impact: FoundViolation["impact"]): FoundViolation => ({
  route,
  rule,
  impact,
  variant: "1440 light",
});

describe("evaluateRatchet", () => {
  it("fails serious and critical violations even when they are in the baseline", () => {
    const result = evaluateRatchet(
      [v("home", "region", "serious"), v("home", "label", "critical")],
      { home: ["region", "label"] },
      ["home"],
    );
    expect(result.blocking).toHaveLength(2);
  });

  it("allows moderate violations that the baseline lists", () => {
    const result = evaluateRatchet(
      [v("home", "heading-order", "moderate")],
      { home: ["heading-order"] },
      ["home"],
    );
    expect(result.newModerate).toEqual([]);
    expect(result.fixedModerate).toEqual([]);
  });

  it("fails a moderate violation that is not in the baseline", () => {
    const result = evaluateRatchet(
      [v("contact", "heading-order", "moderate")],
      { home: ["heading-order"] },
      ["home", "contact"],
    );
    expect(result.newModerate).toHaveLength(1);
  });

  it("fails a baseline entry that no longer occurs, so the baseline only shrinks", () => {
    const result = evaluateRatchet([], { home: ["heading-order"] }, ["home"]);
    expect(result.fixedModerate).toEqual([{ route: "home", rule: "heading-order" }]);
  });

  it("ignores baseline entries for routes that were not checked in this run", () => {
    const result = evaluateRatchet([], { lot: ["heading-order"] }, ["home"]);
    expect(result.fixedModerate).toEqual([]);
  });

  it("ignores minor violations", () => {
    const result = evaluateRatchet([v("home", "tabindex", "minor")], {}, ["home"]);
    expect(describeRatchet(result)).toEqual([]);
  });
});
