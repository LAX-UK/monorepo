import { describe, expect, it } from "vitest";
import {
  unsoldChoiceDecisionBody,
  unsoldChoiceFormDefaults,
  unsoldChoiceFormSchema,
} from "./unsold-choice-form";

describe("unsold choice form", () => {
  it("starts from the seller's request", () => {
    expect(
      unsoldChoiceFormDefaults({
        requestedChoice: "relist",
        requestedReserve: "4000.00",
      } as never),
    ).toEqual({ choice: "relist", reserve: "4000.00", note: "" });
    expect(unsoldChoiceFormDefaults(null)).toEqual({ choice: "", reserve: "", note: "" });
  });

  it("needs an outcome", () => {
    expect(unsoldChoiceFormSchema.safeParse({ choice: "", reserve: "", note: "" }).success).toBe(
      false,
    );
  });

  it("sends a reserve only for a relist and drops an empty note", () => {
    expect(unsoldChoiceDecisionBody({ choice: "collect", reserve: "4000", note: "" })).toEqual({
      choice: "collect",
      reserve: null,
      note: null,
    });
    expect(unsoldChoiceDecisionBody({ choice: "relist", reserve: "4000", note: "Agreed" })).toEqual(
      { choice: "relist", reserve: "4000", note: "Agreed" },
    );
  });
});
