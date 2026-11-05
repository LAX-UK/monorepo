import { describe, expect, it } from "vitest";
import {
  RETURN_MOVE_BLOCKERS,
  RETURN_MOVE_BLOCKER_MESSAGES,
  type ReturnMoveFacts,
  draftLotRequestSchema,
  returnMoveBlockers,
} from "./move-originals.js";

const lotFacts = (over: Partial<ReturnMoveFacts> = {}): ReturnMoveFacts => ({
  registerLinked: true,
  lotStatus: "ended",
  hasWinner: false,
  offerState: "withdrawn",
  offerLotId: null,
  lotId: "lot-1",
  ...over,
});

describe("returnMoveBlockers", () => {
  it("lets a lot that ended unsold, was withdrawn or voided hand the artwork back", () => {
    for (const lotStatus of ["ended", "cancelled", "voided"] as const) {
      expect(returnMoveBlockers(lotFacts({ lotStatus }))).toEqual([]);
    }
  });

  it("accepts a register that has not yet caught up with the lot ending", () => {
    expect(returnMoveBlockers(lotFacts({ offerState: "bid_sale", offerLotId: "lot-1" }))).toEqual(
      [],
    );
  });

  it("refuses a lot with no register link", () => {
    expect(returnMoveBlockers(lotFacts({ registerLinked: false }))).toEqual(["no_register_record"]);
  });

  it("refuses a lot still in a sale, or one that never was", () => {
    expect(returnMoveBlockers(lotFacts({ lotStatus: "active" }))).toEqual(["still_in_sale"]);
    expect(returnMoveBlockers(lotFacts({ lotStatus: "scheduled" }))).toEqual(["still_in_sale"]);
    expect(returnMoveBlockers(lotFacts({ lotStatus: "draft" }))).toEqual(["not_offered"]);
  });

  it("refuses a lot with a winner", () => {
    expect(returnMoveBlockers(lotFacts({ hasWinner: true }))).toEqual(["has_winner"]);
  });

  it("refuses when the register shows the artwork somewhere else", () => {
    expect(returnMoveBlockers(lotFacts({ offerState: "lax_art" }))).toEqual(["elsewhere"]);
    expect(returnMoveBlockers(lotFacts({ offerState: "sold" }))).toEqual(["elsewhere"]);
    expect(returnMoveBlockers(lotFacts({ offerState: "private_sale" }))).toEqual(["elsewhere"]);
    expect(returnMoveBlockers(lotFacts({ offerState: "bid_sale", offerLotId: "lot-2" }))).toEqual([
      "elsewhere",
    ]);
  });

  it("has a staff message for every blocker", () => {
    for (const blocker of RETURN_MOVE_BLOCKERS) {
      expect(RETURN_MOVE_BLOCKER_MESSAGES[blocker].length).toBeGreaterThan(20);
    }
  });
});

describe("draftLotRequestSchema", () => {
  const valid = {
    registerId: "11111111-1111-4111-8111-111111111111",
    saleId: "22222222-2222-4222-8222-222222222222",
    startingPrice: "250.00",
    actor: "staff:user-1",
    content: {
      title: "Blue room",
      artistName: "A. Artist",
      medium: null,
      dimensions: null,
      year: 2021,
      description: null,
      provenance: null,
      imageUrls: ["https://media.example/a.jpg"],
    },
  };

  it("accepts a complete request", () => {
    expect(draftLotRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses an actor that is not a staff member, and a malformed price", () => {
    expect(draftLotRequestSchema.safeParse({ ...valid, actor: "system" }).success).toBe(false);
    expect(draftLotRequestSchema.safeParse({ ...valid, startingPrice: "-5" }).success).toBe(false);
    expect(draftLotRequestSchema.safeParse({ ...valid, startingPrice: "1.234" }).success).toBe(
      false,
    );
  });
});
