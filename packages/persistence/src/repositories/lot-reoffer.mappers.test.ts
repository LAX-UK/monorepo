import { describe, expect, it } from "vitest";
import {
  decimalToPence,
  penceToDecimal,
  toLotReofferView,
  toReofferRecord,
  toSellerConsentView,
} from "./lot-reoffer.mappers.js";

const at = new Date("2026-11-12T10:00:00.000Z");

const offerRow = (over: Record<string, unknown> = {}) =>
  ({
    id: "offer-1",
    lotId: "lot-1",
    buyerDefaultId: "default-1",
    sequence: 2,
    offeredUserId: "user-2",
    offeredLegalEntityId: "entity-2",
    sourceBidId: "bid-2",
    amountPence: 90_000,
    status: "offered",
    sellerConsentId: "consent-1",
    offerSentAt: at,
    offerEndsAt: at,
    respondedAt: null,
    reawardedAt: null,
    declineReason: null,
    invoiceId: null,
    paymentId: null,
    createdBy: "staff-1",
    closedBy: null,
    closeReason: null,
    createdAt: at,
    updatedAt: at,
    ...over,
  }) as Parameters<typeof toLotReofferView>[0];

const consentRow = (over: Record<string, unknown> = {}) =>
  ({
    id: "consent-1",
    subjectType: "lot_reoffer",
    subjectId: "offer-1",
    sellerLegalEntityId: "seller-1",
    lotId: "lot-1",
    termsSnapshot: {
      amountPence: 90_000,
      originalHammerPence: 100_000,
      proceedsAtOfferPence: 72_000,
      proceedsAtOriginalPence: 80_000,
      reservePence: null,
    },
    status: "requested",
    channel: null,
    answeredByUserId: null,
    answeredAt: null,
    note: null,
    requestedAt: at,
    dueAt: at,
    remindedAt: null,
    preferredNext: null,
    ...over,
  }) as Parameters<typeof toSellerConsentView>[0];

describe("toLotReofferView", () => {
  it("maps every column of the row", () => {
    expect(toLotReofferView(offerRow())).toEqual({
      id: "offer-1",
      lotId: "lot-1",
      buyerDefaultId: "default-1",
      sequence: 2,
      offeredUserId: "user-2",
      offeredLegalEntityId: "entity-2",
      sourceBidId: "bid-2",
      amountPence: 90_000,
      status: "offered",
      sellerConsentId: "consent-1",
      offerSentAt: at,
      offerEndsAt: at,
      respondedAt: null,
      reawardedAt: null,
      declineReason: null,
      invoiceId: null,
      paymentId: null,
      createdBy: "staff-1",
      closedBy: null,
      closeReason: null,
      createdAt: at,
      updatedAt: at,
    });
  });

  it("refuses a status the rules do not know", () => {
    expect(() => toLotReofferView(offerRow({ status: "frozen" }))).toThrow(/re-offer status/);
  });
});

describe("toReofferRecord", () => {
  it("takes offerSentAt from offer_sent_at, null when the bidder was never sent it", () => {
    expect(toReofferRecord({ status: "offered", offerSentAt: at })).toEqual({
      status: "offered",
      offerSentAt: at,
    });
    expect(toReofferRecord({ status: "seller_declined", offerSentAt: null })).toEqual({
      status: "seller_declined",
      offerSentAt: null,
    });
  });

  it("refuses a status the rules do not know", () => {
    expect(() => toReofferRecord({ status: "paused", offerSentAt: null })).toThrow();
  });
});

describe("toSellerConsentView", () => {
  it("maps a request that has not been answered", () => {
    const view = toSellerConsentView(consentRow());
    expect(view).toMatchObject({
      subjectType: "lot_reoffer",
      status: "requested",
      channel: null,
      preferredNext: null,
    });
    expect(view.termsSnapshot.reservePence).toBeNull();
  });

  it("maps a refusal recorded by staff with the seller's preference", () => {
    expect(
      toSellerConsentView(
        consentRow({
          status: "refused",
          channel: "recorded_by_staff",
          note: "Phoned on Tuesday",
          preferredNext: "return_to_me",
        }),
      ),
    ).toMatchObject({
      status: "refused",
      channel: "recorded_by_staff",
      preferredNext: "return_to_me",
    });
  });

  it("refuses a channel or preference it does not know", () => {
    expect(() => toSellerConsentView(consentRow({ channel: "carrier_pigeon" }))).toThrow(
      /consent channel/,
    );
    expect(() => toSellerConsentView(consentRow({ preferredNext: "sell_now" }))).toThrow(
      /seller preference/,
    );
  });
});

describe("pence and pounds", () => {
  it("writes whole pence as the pounds string the lot stores", () => {
    expect(penceToDecimal(0)).toBe("0.00");
    expect(penceToDecimal(5)).toBe("0.05");
    expect(penceToDecimal(90_000)).toBe("900.00");
    expect(penceToDecimal(123_456)).toBe("1234.56");
  });

  it("reads the stored pounds string as whole pence", () => {
    expect(decimalToPence("900.00")).toBe(90_000);
    expect(decimalToPence("1234.56")).toBe(123_456);
    expect(decimalToPence("0.05")).toBe(5);
    expect(decimalToPence("100")).toBe(10_000);
    expect(decimalToPence("12.5")).toBe(1_250);
  });

  it("refuses an amount that is not a plain pounds figure", () => {
    expect(() => decimalToPence("-1.00")).toThrow();
    expect(() => decimalToPence("abc")).toThrow();
    expect(() => penceToDecimal(-1)).toThrow();
    expect(() => penceToDecimal(1.5)).toThrow();
  });

  it("refuses stored consent terms that are not in the expected shape", () => {
    for (const bad of [null, {}, { amountPence: "9" }, { amountPence: -1 }]) {
      expect(() => toSellerConsentView(consentRow({ termsSnapshot: bad }))).toThrow(
        /Unreadable seller consent terms/,
      );
    }
  });

  it("carries when the offer re-awarded the lot", () => {
    expect(toLotReofferView(offerRow({ reawardedAt: at })).reawardedAt).toEqual(at);
  });
});
