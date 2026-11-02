import { describe, expect, it } from "vitest";
import { bidPlacedAnnouncement, positionAnnouncement } from "./bid-announcements.js";
import { bidFailureNotice, noticeBlocksConfirm } from "./bid-dialog-notice.js";
import { type BidEntryInput, bidModesFor, buildBidEntry } from "./bid-entry.js";
import { amountsWithinLimit, keepMaximum, limitCovers } from "./bid-ladder.js";
import { bidSummary } from "./bid-summary.js";

const money = (amount: string) => `£${Number(amount).toLocaleString("en-GB")}`;
const format = { money };

describe("bidSummary", () => {
  const flat = { kind: "flat", rate: "0.25" } as const;

  it("works the premium and the total from a flat rate", () => {
    expect(bidSummary(flat, "7250.00")).toEqual({
      hammer: "7250.00",
      rate: "0.25",
      percentLabel: "25%",
      premium: "1812.50",
      total: "9062.50",
    });
  });

  it("applies the band the hammer reaches to the whole hammer", () => {
    const banded = {
      kind: "banded",
      bands: [
        { fromHammer: "0.00", rate: "0.25" },
        { fromHammer: "10000.00", rate: "0.2" },
      ],
    } as const;
    expect(bidSummary(banded, "9999.00").premium).toBe("2499.75");
    expect(bidSummary(banded, "10000.00")).toMatchObject({
      percentLabel: "20%",
      premium: "2000.00",
    });
  });

  it("rounds half pennies to the even penny", () => {
    expect(bidSummary({ kind: "flat", rate: "0.25" }, "0.02").premium).toBe("0.00");
    expect(bidSummary({ kind: "flat", rate: "0.25" }, "0.06").premium).toBe("0.02");
  });

  it("has no premium when the rate is zero", () => {
    expect(bidSummary({ kind: "flat", rate: "0" }, "500.00")).toMatchObject({
      percentLabel: null,
      premium: "0.00",
      total: "500.00",
    });
  });
});

describe("agent limits", () => {
  const ladder = ["7250.00", "7500.00", "7750.00"];

  it("keeps the amounts the limit covers", () => {
    expect(amountsWithinLimit(ladder, "7500.00")).toEqual(["7250.00", "7500.00"]);
    expect(amountsWithinLimit(ladder, null)).toEqual(ladder);
    expect(amountsWithinLimit(ladder, "5000.00")).toEqual([]);
  });

  it("says whether the limit covers an amount", () => {
    expect(limitCovers(null, "99999.00")).toBe(true);
    expect(limitCovers("7250.00", "7250.00")).toBe(true);
    expect(limitCovers("7000.00", "7250.00")).toBe(false);
  });

  it("keeps a maximum still on the ladder, or falls back to the lowest", () => {
    expect(keepMaximum(ladder, "7500.00")).toBe("7500.00");
    expect(keepMaximum(ladder, "9000.00")).toBe("7250.00");
    expect(keepMaximum([], "9000.00")).toBeNull();
  });
});

describe("bidFailureNotice", () => {
  const next = { mode: "next", format } as const;

  it("tells a bidder who was outbid while confirming the new amount, without raising it", () => {
    const notice = bidFailureNotice(
      {
        kind: "refused",
        refusal: { code: "outbid_during_confirm", details: { nextBidAmount: "7500.00" } },
      },
      next,
    );
    expect(notice.tone).toBe("warning");
    expect(notice.detail).toBe("The next bid is now £7,500. Confirm if you'd like to bid it.");
    expect(notice.remedy).toEqual({ kind: "reconfirm", amount: "7500.00" });
    expect(noticeBlocksConfirm(notice)).toBe(false);
  });

  it("names the amount the bidder saw when the price moved while the dialog was open", () => {
    const notice = bidFailureNotice(
      { kind: "moved", seenNextBid: "7250.00", nextBid: "7500.00" },
      next,
    );
    expect(notice.title).toBe("Someone bid £7,250 first");
    expect(notice.remedy).toEqual({ kind: "reconfirm", amount: "7500.00" });
  });

  it("asks a maximum bidder to check the maximum again", () => {
    const notice = bidFailureNotice(
      { kind: "moved", seenNextBid: "7250.00", nextBid: "7500.00" },
      { mode: "maximum", format },
    );
    expect(notice.detail).toContain("Check your maximum");
  });

  it("offers limit help with what is left", () => {
    const notice = bidFailureNotice(
      { kind: "refused", refusal: { code: "over_limit", details: { remaining: "5000.00" } } },
      next,
    );
    expect(notice.title).toBe("This bid is over your limit");
    expect(notice.detail).toContain("£5,000 left of your limit for this sale");
    expect(notice.remedy).toEqual({ kind: "limit_help" });
    expect(noticeBlocksConfirm(notice)).toBe(true);
  });

  it("still offers limit help when the room left is unknown", () => {
    const notice = bidFailureNotice(
      { kind: "refused", refusal: { code: "over_limit", details: {} } },
      next,
    );
    expect(notice.remedy).toEqual({ kind: "limit_help" });
    expect(notice.detail).not.toContain("left of your limit");
  });

  it("offers the nearest valid amount", () => {
    const notice = bidFailureNotice(
      {
        kind: "refused",
        refusal: { code: "amount_invalid", details: { nearestValidAmount: "7250.00" } },
      },
      next,
    );
    expect(notice.detail).toBe("The nearest valid amount is £7,250.");
    expect(notice.remedy).toEqual({ kind: "use_amount", amount: "7250.00" });
  });

  it("sends an unregistered bidder to register", () => {
    const notice = bidFailureNotice(
      { kind: "refused", refusal: { code: "registration_required", details: {} } },
      next,
    );
    expect(notice.remedy).toEqual({ kind: "register" });
    expect(noticeBlocksConfirm(notice)).toBe(true);
  });

  it("tells a bidder whose registration is pending to wait", () => {
    const notice = bidFailureNotice(
      { kind: "refused", refusal: { code: "registration_pending", details: {} } },
      next,
    );
    expect(notice.title).toBe("Registration pending");
    expect(notice.remedy).toEqual({ kind: "close" });
  });

  it("says a closed lot took no bid", () => {
    const notice = bidFailureNotice(
      { kind: "refused", refusal: { code: "lot_closed", details: {} } },
      next,
    );
    expect(notice.title).toBe("Bidding has closed on this lot");
    expect(notice.remedy).toEqual({ kind: "close" });
  });

  it("offers a retry that cannot place the bid twice when the connection dropped", () => {
    const notice = bidFailureNotice({ kind: "unreachable" }, next);
    expect(notice.tone).toBe("danger");
    expect(notice.detail).toContain("never place the same bid twice");
    expect(notice.remedy).toEqual({ kind: "retry" });
    expect(noticeBlocksConfirm(notice)).toBe(false);
  });

  it("shows the server's own words for a refusal it has no row for", () => {
    expect(
      bidFailureNotice({ kind: "rejected", message: "Your account cannot bid." }, next).detail,
    ).toBe("Your account cannot bid.");
    expect(bidFailureNotice({ kind: "rejected", message: null }, next).detail).toContain(
      "Try again",
    );
  });
});

describe("bid entry", () => {
  const base: BidEntryInput = {
    action: "bid",
    lifecycle: "live",
    auctionType: "english",
    position: "none",
    nextBid: "7250.00",
    agentLimitLeft: null,
    premiumPercent: "25%",
    format,
  };

  it("offers the next bid, a maximum, and the premium", () => {
    const entry = buildBidEntry(base);
    expect(entry.primary).toEqual({
      control: { kind: "open_dialog", start: "next", label: "Bid £7,250" },
      disabledReason: null,
    });
    expect(entry.alt).toEqual({
      kind: "open_dialog",
      start: "maximum",
      label: "Set a maximum bid",
    });
    expect(entry.help?.text).toBe("25% buyer's premium is added to the hammer price.");
  });

  it("lets someone leading set a maximum instead of bidding again", () => {
    const entry = buildBidEntry({ ...base, position: "leading" });
    expect(entry.primary).toBeNull();
    expect(entry.secondary).toEqual({
      kind: "open_dialog",
      start: "maximum",
      label: "Set a maximum bid",
    });
  });

  it("lets someone with a maximum change it", () => {
    expect(buildBidEntry({ ...base, position: "maximum_set" }).secondary).toMatchObject({
      label: "Change your maximum",
    });
  });

  it("offers the next bid to someone outbid", () => {
    expect(buildBidEntry({ ...base, position: "outbid" }).primary?.control.label).toBe(
      "Bid £7,250",
    );
  });

  it("asks a signed-out visitor to sign in, and says register on an upcoming lot", () => {
    expect(buildBidEntry({ ...base, action: "sign_in" }).primary?.control).toEqual({
      kind: "go",
      to: "sign_in",
      label: "Sign in to bid",
    });
    expect(
      buildBidEntry({ ...base, action: "sign_in", lifecycle: "scheduled" }).primary?.control.label,
    ).toBe("Sign in to register");
  });

  it("sends an unregistered agent to register", () => {
    const entry = buildBidEntry({ ...base, action: "register" });
    expect(entry.primary?.control).toEqual({
      kind: "go",
      to: "register",
      label: "Register to bid",
    });
    expect(entry.help?.text).toContain("Register once");
  });

  it("explains a pending registration instead of hiding the button", () => {
    const entry = buildBidEntry({ ...base, action: "registration_pending" });
    expect(entry.primary?.disabledReason).toBe("You can bid once your registration is approved.");
    expect(entry.primary?.control.label).toBe("Bid £7,250");
  });

  it("points a declined registration to client services", () => {
    expect(buildBidEntry({ ...base, action: "registration_declined" }).secondary).toEqual({
      kind: "go",
      to: "client_services",
      label: "Contact client services",
    });
  });

  it("disables the bid with a reason while the sale is paused", () => {
    expect(buildBidEntry({ ...base, action: "bid_disabled" }).primary?.disabledReason).toBe(
      "Bidding resumes when the auctioneer restarts the sale.",
    );
  });

  it("disables the bid and offers to ask an admin when an agent's limit cannot cover it", () => {
    const entry = buildBidEntry({ ...base, agentLimitLeft: "5000.00" });
    expect(entry.primary?.disabledReason).toBe("Ask an organisation admin to raise your limit.");
    expect(entry.alt).toEqual({ kind: "go", to: "ask_admin", label: "Ask an admin" });
  });

  it("leaves a maximum as the only option before the lot opens", () => {
    const entry = buildBidEntry({ ...base, action: "set_maximum", lifecycle: "scheduled" });
    expect(entry.primary?.control).toEqual({
      kind: "open_dialog",
      start: "maximum",
      label: "Set a maximum bid",
    });
    expect(entry.alt).toBeNull();
    expect(entry.help).toBeNull();
  });

  it("offers nothing for an action that is not bidding", () => {
    expect(buildBidEntry({ ...base, action: "enquire" })).toEqual({
      primary: null,
      secondary: null,
      alt: null,
      help: null,
    });
  });

  it("offers the next bid alone where there is no proxy bidding", () => {
    expect(bidModesFor({ lifecycle: "live", auctionType: "dutch" })).toEqual(["next"]);
    expect(bidModesFor({ lifecycle: "live", auctionType: "english" })).toEqual(["next", "maximum"]);
    expect(bidModesFor({ lifecycle: "scheduled", auctionType: "english" })).toEqual(["maximum"]);
    expect(buildBidEntry({ ...base, auctionType: "dutch" }).alt).toBeNull();
  });
});

describe("announcements", () => {
  it("announces a bid and a maximum in words", () => {
    expect(bidPlacedAnnouncement({ mode: "next", amount: "7250.00", format })).toBe(
      "Bid placed at £7,250.",
    );
    expect(bidPlacedAnnouncement({ mode: "maximum", amount: "9000.00", format })).toBe(
      "Maximum set at £9,000.",
    );
  });

  const change = {
    lotTitle: "Estuary, evening",
    currentPrice: "7250.00",
    nextBid: "7500.00",
    format,
  } as const;

  it("announces taking the lead", () => {
    expect(positionAnnouncement({ ...change, from: "none", to: "leading" })).toBe(
      "You're the highest bidder at £7,250.",
    );
  });

  it("announces being outbid with the next bid", () => {
    expect(positionAnnouncement({ ...change, from: "leading", to: "outbid" })).toBe(
      "You've been outbid on Estuary, evening. The next bid is £7,500.",
    );
  });

  it("stays quiet when nothing about the viewer changed", () => {
    expect(positionAnnouncement({ ...change, from: "leading", to: "leading" })).toBeNull();
    expect(positionAnnouncement({ ...change, from: "none", to: "outbid" })).toBeNull();
    expect(positionAnnouncement({ ...change, from: "maximum_set", to: "leading" })).toBeNull();
  });
});
