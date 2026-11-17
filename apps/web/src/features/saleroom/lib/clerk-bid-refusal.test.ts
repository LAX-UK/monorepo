import {
  type ClerkBidLimitRefusal,
  clerkBidRefusalNotice,
  readClerkBidLimitRefusal,
} from "@/features/saleroom/lib/clerk-bid-refusal";
import { describe, expect, it } from "vitest";

const notice = (refusal: ClerkBidLimitRefusal, bidder = "Paddle 142", amount = 6000) =>
  clerkBidRefusalNotice({ refusal, bidder, amount, currency: "GBP" });

describe("clerkBidRefusalNotice", () => {
  it("names the limit, how much it allows and the next step for each kind", () => {
    expect(notice({ kind: "paddle", limit: "5000.00", available: null })).toEqual({
      title: "Paddle 142's bid of £6,000.00 wasn't placed",
      body: "The paddle's limit for this sale is £5,000.00. Take a bid within the limit. To bid higher, the bidder's limit for this sale must be raised first.",
    });
    expect(
      notice({ kind: "telephone", limit: "8000.00", available: null }, "Tel buyer", 9000),
    ).toEqual({
      title: "Tel buyer's bid of £9,000.00 wasn't placed",
      body: "The telephone booking allows bids up to £8,000.00. Take a bid within the limit. To bid higher, the booking's maximum must be raised first.",
    });
    expect(notice({ kind: "registration", limit: "5000.00", available: null }).body).toBe(
      "Their approved limit for this sale is £5,000.00. Take a bid within the limit. To bid higher, their registration limit must be raised first.",
    );
    expect(notice({ kind: "per_lot", limit: "20000.00", available: "20000.00" }).body).toBe(
      "Their buyer agent authorisation allows up to £20,000.00 a lot. Take a bid within the limit. Only the organisation's owners or admins can raise it.",
    );
    expect(
      notice({ kind: "authorisation_total", limit: "30000.00", available: "1500.00" }).body,
    ).toBe(
      "It would take them past the £30,000.00 their buyer agent authorisation allows in total. They can bid up to £1,500.00 on this lot. Take a bid within the limit. Only the organisation's owners or admins can raise it.",
    );
  });

  it("gives only the room left on this lot for the organisation's own limit", () => {
    expect(notice({ kind: "organisation", limit: null, available: "2000.00" }).body).toBe(
      "It's above what their organisation's bidding limit allows. They can bid up to £2,000.00 on this lot. Take a bid within the limit. Only the organisation's owners or admins can raise it.",
    );
    expect(notice({ kind: "organisation", limit: null, available: "0.00" }).body).toBe(
      "It's above what their organisation's bidding limit allows. There's no room left for them to bid on this lot. Take a bid within the limit. Only the organisation's owners or admins can raise it.",
    );
  });
});

describe("readClerkBidLimitRefusal", () => {
  it("reads each limit the API reports", () => {
    expect(readClerkBidLimitRefusal({ kind: "registration", limit: "5000.00" })).toEqual({
      kind: "registration",
      limit: "5000.00",
      available: null,
    });
    expect(
      readClerkBidLimitRefusal({ kind: "organisation", limit: null, available: "2000.00" }),
    ).toEqual({ kind: "organisation", limit: null, available: "2000.00" });
  });

  it("never keeps an organisation's total, even if one is sent", () => {
    expect(
      readClerkBidLimitRefusal({ kind: "organisation", limit: "50000.00", available: "2000.00" }),
    ).toEqual({ kind: "organisation", limit: null, available: "2000.00" });
  });

  it("is null for anything that is not a limit refusal", () => {
    expect(readClerkBidLimitRefusal(undefined)).toBeNull();
    expect(readClerkBidLimitRefusal({ kind: "lot_closed", limit: "1.00" })).toBeNull();
    expect(readClerkBidLimitRefusal({ kind: "paddle", limit: "lots" })).toBeNull();
    expect(readClerkBidLimitRefusal({ kind: "organisation", limit: null })).toBeNull();
  });
});
