import { describe, expect, it } from "vitest";
import { parseBidUpdateFromRealtimeRaw } from "./lot-bid-update.js";
import {
  bidPlacedRedisMessageToBidUpdate,
  encodeBidPlacedPublicRedisMessage,
  encodeBidPlacedSealedRedisMessage,
  encodeLotExtendedRedisMessage,
  parseLotRealtimeRedisMessage,
} from "./lot-realtime-events.js";

/**
 * `parseBidUpdateFromRealtimeRaw` no longer goes through the Zod union. These tests hold it to the
 * Zod implementation it replaced: same accept/reject answer and the same output, key order included.
 */
function previousParse(raw: unknown) {
  const message = parseLotRealtimeRedisMessage(raw);
  if (!message) return null;
  return bidPlacedRedisMessageToBidUpdate(message);
}

function expectSameAnswer(raw: unknown) {
  const expected = previousParse(raw);
  const actual = parseBidUpdateFromRealtimeRaw(raw);
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
  expect(actual).toStrictEqual(expected);
}

const fullBid = {
  type: "bid_placed",
  lotId: "lot-1",
  bid: {
    id: "bid-1",
    amount: "120.00",
    bidderId: "bidder-1",
    placedByUserId: "user-1",
    isAutoBid: true,
    autoBidStepAmount: "10.00",
    placedVia: "web",
    extra: { kept: "by passthrough" },
  },
  currentPrice: "120.00",
  emittedAt: 1_700_000_000_000,
  outbidUserId: "user-2",
  nextBidAmount: "130.00",
  bidCount: 4,
  reserveMet: false,
  unknown: "stripped",
};

describe("parseBidUpdateFromRealtimeRaw matches the Zod contract", () => {
  it.each([
    ["full public bid", fullBid],
    [
      "encoded public bid",
      JSON.parse(
        encodeBidPlacedPublicRedisMessage({
          lotId: "lot-1",
          currentPrice: "120.00",
          bid: { id: "bid-1", amount: "120.00", placedByUserId: "user-1", isAutoBid: false },
          bidCount: 3,
          reserveMet: true,
        }),
      ),
    ],
    ["encoded sealed bid", JSON.parse(encodeBidPlacedSealedRedisMessage("lot-1"))],
    ["sealed flag on a full bid", { ...fullBid, sealed: true }],
    ["sealed false on a full bid", { ...fullBid, sealed: false }],
    [
      "lot extended",
      JSON.parse(
        encodeLotExtendedRedisMessage({ lotId: "lot-1", newEndTime: "2026-11-13T10:00Z" }),
      ),
    ],
    ["bidder only", { ...fullBid, bid: { id: "b", amount: "1", bidderId: "x" } }],
    ["no bidder", { ...fullBid, bid: { id: "b", amount: "1" } }],
    ["empty placedBy", { ...fullBid, bid: { id: "b", amount: "1", placedByUserId: "" } }],
    ["empty placedBy, bidder", { ...fullBid, bid: { ...fullBid.bid, placedByUserId: "" } }],
    [
      "null step and via",
      { ...fullBid, bid: { ...fullBid.bid, autoBidStepAmount: null, placedVia: null } },
    ],
    [
      "undefined optionals",
      { ...fullBid, emittedAt: undefined, bidCount: undefined, reserveMet: undefined },
    ],
    ["zero emittedAt and count", { ...fullBid, emittedAt: 0, bidCount: 0 }],
    ["empty outbid", { ...fullBid, outbidUserId: "" }],
    ["NaN count", { ...fullBid, bidCount: Number.NaN }],
    ["NaN emittedAt", { ...fullBid, emittedAt: Number.NaN }],
    ["Infinity count", { ...fullBid, bidCount: Number.POSITIVE_INFINITY }],
    ["string count", { ...fullBid, bidCount: "4" }],
    ["number amount", { ...fullBid, bid: { ...fullBid.bid, amount: 120 } }],
    ["numeric price", { ...fullBid, currentPrice: 120 }],
    ["null outbid", { ...fullBid, outbidUserId: null }],
    ["null bidCount", { ...fullBid, bidCount: null }],
    ["string isAutoBid", { ...fullBid, bid: { ...fullBid.bid, isAutoBid: "true" } }],
    ["array bid", { ...fullBid, bid: [] }],
    ["null bid", { ...fullBid, bid: null }],
    ["missing price", { ...fullBid, currentPrice: undefined }],
    ["other type", { ...fullBid, type: "lot_ended" }],
    ["array", [fullBid]],
    ["null", null],
    ["string", JSON.stringify(fullBid)],
    ["number", 1],
    ["date", new Date()],
  ])("%s", (_label, raw) => {
    expectSameAnswer(raw);
  });

  it("agrees on random payloads", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)] as T;
    const anyValue = [
      undefined,
      null,
      "",
      "x",
      "120.00",
      0,
      1,
      -1,
      Number.NaN,
      true,
      false,
      [],
      {},
    ] as const;
    const fieldOf = (good: unknown) => (random() < 0.6 ? good : pick(anyValue));
    for (let i = 0; i < 3000; i++) {
      const bid: Record<string, unknown> = {};
      for (const [key, good] of Object.entries(fullBid.bid)) {
        if (random() < 0.8) bid[key] = fieldOf(good);
      }
      const raw: Record<string, unknown> = {};
      for (const [key, good] of Object.entries(fullBid)) {
        if (key === "bid") raw.bid = random() < 0.9 ? bid : pick(anyValue);
        else if (random() < 0.8) raw[key] = fieldOf(good);
      }
      if (random() < 0.1) raw.sealed = pick([true, false, "true", 1]);
      expectSameAnswer(raw);
    }
  });
});
