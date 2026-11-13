import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate, zNullableStringFromEmpty } from "@/lib/data/http/schema-coerce";
import type { Bid } from "@auction/types";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBidRow } from "./bid-row";
import { bidSchema } from "./bid.schema";

/**
 * `parseBidRow` replaced the Zod bid schema on lot and sale pages. These tests hold it to that
 * schema, kept here verbatim: same output for the same row, and the same output as the schema that
 * now wraps it.
 */
const previousBidRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): Bid => {
    const placedByUserId =
      row.placedByUserId == null || row.placedByUserId === ""
        ? undefined
        : String(row.placedByUserId);
    const bidderRef =
      row.bidderRef == null || row.bidderRef === "" ? undefined : String(row.bidderRef);
    const bidderId =
      row.bidderId == null || row.bidderId === ""
        ? (placedByUserId ?? bidderRef)
        : String(row.bidderId);
    const placedVia = zNullableStringFromEmpty.parse(row.placedVia);
    const clerkUserId = zNullableStringFromEmpty.parse(row.clerkUserId);
    return {
      id: String(row.id),
      lotId: String(row.lotId ?? row.auctionId),
      ...(bidderId ? { bidderId } : {}),
      ...(placedByUserId ? { placedByUserId } : {}),
      amount: String(row.amount),
      isWinning: Boolean(row.isWinning),
      isAutoBid: Boolean(row.isAutoBid),
      maxAutoBidAmount: row.maxAutoBidAmount == null ? null : String(row.maxAutoBidAmount),
      autoBidStepAmount: row.autoBidStepAmount == null ? null : String(row.autoBidStepAmount),
      placedVia,
      clerkUserId,
      createdAt: zCoerceDate.parse(row.createdAt),
    };
  });

/** Dates compared by value, invalid dates included (`NaN` never equals itself). */
function comparable(bid: Bid) {
  return { ...bid, createdAt: String(bid.createdAt.getTime()) };
}

function expectSameAnswer(raw: unknown) {
  const expected = previousBidRowSchema.parse(raw);
  const actual = parseBidRow(raw);
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  expect(comparable(actual)).toEqual(comparable(expected));
  expect(actual.createdAt).toBeInstanceOf(Date);
  expect(comparable(bidSchema.parse(raw))).toEqual(comparable(expected));
}

const full = {
  id: "bid-1",
  lotId: "lot-1",
  bidderId: "u-1",
  placedByUserId: "u-2",
  bidderRef: "B12",
  amount: "120.00",
  isWinning: true,
  isAutoBid: false,
  maxAutoBidAmount: "200.00",
  autoBidStepAmount: "10.00",
  placedVia: "web",
  clerkUserId: "clerk-1",
  createdAt: "2026-11-13T10:00:00.000Z",
};

describe("parseBidRow matches the Zod bid schema", () => {
  it.each([
    ["full row", full],
    ["public row", { ...full, bidderId: null, placedByUserId: null }],
    ["empty ids", { ...full, bidderId: "", placedByUserId: "", bidderRef: "" }],
    ["auction id fallback", { ...full, lotId: undefined, auctionId: "a-1" }],
    ["numbers", { ...full, id: 7, amount: 120, maxAutoBidAmount: 0, autoBidStepAmount: 0 }],
    ["numeric date", { ...full, createdAt: 1_700_000_000_000 }],
    ["date object", { ...full, createdAt: new Date("2026-01-01T00:00:00Z") }],
    ["bad date", { ...full, createdAt: "not a date" }],
    ["missing date", { ...full, createdAt: undefined }],
    ["empty via", { ...full, placedVia: "", clerkUserId: null }],
    ["truthy strings", { ...full, isWinning: "false", isAutoBid: 1 }],
    ["empty object", {}],
    ["null", null],
    ["array", [full]],
    ["string", "bid-1"],
  ])("%s", (_label, raw) => {
    expectSameAnswer(raw);
  });

  it("agrees on random rows", () => {
    let seed = 11;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const values = [undefined, null, "", "x", "0", 0, 1, -2.5, true, false, [], {}] as const;
    for (let i = 0; i < 2000; i++) {
      const row: Record<string, unknown> = {};
      for (const [key, good] of Object.entries({ ...full, auctionId: "a-1" })) {
        if (random() < 0.85)
          row[key] = random() < 0.5 ? good : values[Math.floor(random() * values.length)];
      }
      expectSameAnswer(row);
    }
  });
});
