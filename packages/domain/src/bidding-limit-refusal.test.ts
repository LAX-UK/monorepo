import { describe, expect, it } from "vitest";
import {
  bidderRefusalNotice,
  biddingLimitRefusalFrom,
  decidersRefusalNotice,
} from "./bidding-limit-refusal.js";

const money = (amount: string) => `£${Number(amount).toLocaleString("en-GB")}`;

describe("biddingLimitRefusalFrom", () => {
  it("reads each limit's error code with its facts", () => {
    expect(
      biddingLimitRefusalFrom("organisation_limit_exceeded", {
        limit: "50000.00",
        available: "2000.00",
      }),
    ).toEqual({ kind: "organisation", limit: "50000.00", available: "2000.00" });
    expect(
      biddingLimitRefusalFrom("bid_limit_exceeded", { limit: "20000.00", available: "20000.00" })
        ?.kind,
    ).toBe("per_lot");
    expect(
      biddingLimitRefusalFrom("authorisation_total_limit_exceeded", { limit: "1", available: "0" })
        ?.kind,
    ).toBe("authorisation_total");
  });

  it("is null for other refusals or without the facts", () => {
    expect(biddingLimitRefusalFrom("lot_closed", { limit: "1", available: "0" })).toBeNull();
    expect(biddingLimitRefusalFrom("organisation_limit_exceeded", undefined)).toBeNull();
    expect(biddingLimitRefusalFrom(undefined, { limit: "1", available: "0" })).toBeNull();
  });
});

const base = {
  amount: "4200",
  lotTitle: "Red chair, evening",
  organisationName: "Northbank Gallery",
  money,
};

describe("bidderRefusalNotice", () => {
  it("says why, the room left and whom to ask", () => {
    const notice = bidderRefusalNotice({
      ...base,
      refusal: { kind: "organisation", limit: "50000", available: "2000" },
    });
    expect(notice.title).toBe('Your bid on "Red chair, evening" wasn\'t placed');
    expect(notice.message).toBe(
      "Your bid of £4,200 for Northbank Gallery wasn't placed: it would take Northbank Gallery past its bidding limit of £50,000. You can bid up to £2,000 on this lot. An owner or admin can raise the organisation's limit in Team › Bidding.",
    );
  });

  it("leaves out the room when there is none", () => {
    const notice = bidderRefusalNotice({
      ...base,
      refusal: { kind: "authorisation_total", limit: "10000", available: "0" },
    });
    expect(notice.message).not.toContain("You can bid up to");
    expect(notice.message).toContain("past the £10,000 your authorisation allows in total");
  });
});

describe("decidersRefusalNotice", () => {
  it("tells owners and admins only about the organisation's own limit", () => {
    const refusal = { kind: "organisation" as const, limit: "50000", available: "0" };
    expect(
      decidersRefusalNotice({ ...base, refusal, bidderName: "Tom Whitfield" })?.message,
    ).toContain("Tom Whitfield's bid of £4,200");
    expect(
      decidersRefusalNotice({
        ...base,
        refusal: { ...refusal, kind: "per_lot" },
        bidderName: "Tom Whitfield",
      }),
    ).toBeNull();
  });
});
