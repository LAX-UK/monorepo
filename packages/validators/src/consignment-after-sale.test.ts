import { describe, expect, it } from "vitest";
import {
  consignmentMoveBodySchema,
  relistReserveFloorBodySchema,
  unsoldLotChoiceDecisionBodySchema,
  unsoldLotChoiceRequestBodySchema,
} from "./consignment-after-sale.js";

describe("unsoldLotChoiceRequestBodySchema", () => {
  it("reads a relist with a lower reserve", () => {
    expect(unsoldLotChoiceRequestBodySchema.parse({ choice: "relist", reserve: " 4500 " })).toEqual(
      { choice: "relist", reserve: "4500" },
    );
  });

  it("treats an empty reserve as none", () => {
    expect(unsoldLotChoiceRequestBodySchema.parse({ choice: "relist", reserve: "" })).toEqual({
      choice: "relist",
      reserve: null,
    });
    expect(unsoldLotChoiceRequestBodySchema.parse({ choice: "collect" })).toEqual({
      choice: "collect",
      reserve: null,
    });
  });

  it("refuses an unknown choice or an amount that is not money", () => {
    expect(unsoldLotChoiceRequestBodySchema.safeParse({ choice: "auction" }).success).toBe(false);
    expect(
      unsoldLotChoiceRequestBodySchema.safeParse({ choice: "relist", reserve: "£4k" }).success,
    ).toBe(false);
  });
});

describe("unsoldLotChoiceDecisionBodySchema", () => {
  it("keeps a trimmed note and drops an empty one", () => {
    expect(
      unsoldLotChoiceDecisionBodySchema.parse({ choice: "private_sale", note: "  Buyer found  " }),
    ).toEqual({ choice: "private_sale", reserve: null, note: "Buyer found" });
    expect(unsoldLotChoiceDecisionBodySchema.parse({ choice: "collect", note: " " }).note).toBe(
      null,
    );
  });

  it("limits the note", () => {
    expect(
      unsoldLotChoiceDecisionBodySchema.safeParse({ choice: "collect", note: "x".repeat(1001) })
        .success,
    ).toBe(false);
  });
});

describe("relistReserveFloorBodySchema and consignmentMoveBodySchema", () => {
  it("clears the floor when empty", () => {
    expect(relistReserveFloorBodySchema.parse({ floor: "" })).toEqual({ floor: null });
    expect(relistReserveFloorBodySchema.parse({ floor: "3000.50" })).toEqual({ floor: "3000.50" });
  });

  it("needs an organisation id", () => {
    expect(consignmentMoveBodySchema.safeParse({ legalEntityId: "nope" }).success).toBe(false);
  });
});
