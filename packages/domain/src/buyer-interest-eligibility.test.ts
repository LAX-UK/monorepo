import { describe, expect, it } from "vitest";
import {
  isBuyerInterestPersonaEligible,
  reconcileBuyerInterestSelection,
} from "./buyer-interest-eligibility.js";

describe("isBuyerInterestPersonaEligible", () => {
  it("allows individual and legacy null personas", () => {
    expect(isBuyerInterestPersonaEligible("individual")).toBe(true);
    expect(isBuyerInterestPersonaEligible(null)).toBe(true);
  });

  it("blocks organisation personas", () => {
    expect(isBuyerInterestPersonaEligible("organisation")).toBe(false);
  });
});

describe("reconcileBuyerInterestSelection", () => {
  it("keeps persisted ids that still exist in the catalog", () => {
    expect(
      reconcileBuyerInterestSelection({
        selectedIds: ["keep", "gone"],
        availableCatalogIds: ["keep", "other"],
      }),
    ).toEqual({
      selectedAvailableIds: ["keep"],
      selectedUnavailableIds: ["gone"],
    });
  });

  it("preserves requested order", () => {
    expect(
      reconcileBuyerInterestSelection({
        selectedIds: ["b", "a"],
        availableCatalogIds: ["a", "b"],
      }).selectedAvailableIds,
    ).toEqual(["b", "a"]);
  });
});
