import {
  type BidDialogState,
  openBidDialog,
  reduceBidDialog,
} from "@/lib/lot-page/bid-dialog/bid-dialog-state";
import {
  type BidDialogViewInput,
  buildBidDialogView,
} from "@/lib/lot-page/bid-dialog/bid-dialog-view";
import { describe, expect, it } from "vitest";

const money = (amount: string) => `£${Number(amount).toLocaleString("en-GB")}`;
const ladder = ["7250.00", "7500.00", "7750.00", "9000.00"];

function input(state: BidDialogState, patch: Partial<BidDialogViewInput> = {}): BidDialogViewInput {
  return {
    state,
    lot: { lotNumber: 4, title: "Estuary, evening", artistName: "Anna Whitcombe" },
    ladder,
    modes: ["next", "maximum"],
    terms: { kind: "flat", rate: "0.25" },
    agentLimitLeft: null,
    pricing: {
      lot: {
        auctionType: "english",
        currentPrice: "7000.00",
        startingPrice: "4200.00",
        minBidIncrement: "250.00",
      },
      estimateHigh: "9000",
    },
    accountName: null,
    scheduled: false,
    format: { money },
    ...patch,
  };
}

const idle = () => openBidDialog({ mode: "next", nextBid: "7250.00", ladder });
const choosingMaximum = () => {
  const s = reduceBidDialog(idle(), { type: "chose_mode", mode: "maximum", ladder });
  return reduceBidDialog(s, { type: "chose_maximum", maximum: "9000.00" });
};

describe("bid dialog view", () => {
  it("opens on the next bid with the premium and the total", () => {
    const view = buildBidDialogView(input(idle()));
    expect(view.title).toBe("Place a bid");
    expect(view.description).toBe("Lot 4 · Estuary, evening · Anna Whitcombe");
    expect(view.options?.map((o) => o.label)).toEqual(["Bid £7,250", "Set a maximum bid"]);
    expect(view.maximum).toBeNull();
    expect(view.summary?.rows).toEqual([
      { label: "Your bid", value: "£7,250" },
      { label: "Buyer's premium (25%)", value: "£1,812.5" },
    ]);
    expect(view.summary?.total).toEqual({ label: "Total if you win", value: "£9,062.5" });
    expect(view.confirm).toEqual({ kind: "ready", label: "Confirm bid of £7,250" });
    expect(view.notice).toBeNull();
    expect(view.cancelLabel).toBe("Cancel");
  });

  it("shows the maximum field and works the most the bidder would pay", () => {
    const view = buildBidDialogView(input(choosingMaximum()));
    expect(view.title).toBe("Set a maximum bid");
    expect(view.maximum?.value).toBe("9000.00");
    expect(view.maximum?.choices[0]).toEqual({ value: "7250.00", label: "£7,250" });
    expect(view.summary?.rows[0]).toEqual({ label: "Your maximum", value: "£9,000" });
    expect(view.summary?.total).toEqual({ label: "Most you would pay", value: "£11,250" });
    expect(view.confirm).toEqual({ kind: "ready", label: "Confirm maximum of £9,000" });
  });

  it("offers only a maximum before the lot opens", () => {
    const state = openBidDialog({ mode: "maximum", nextBid: "7250.00", ladder });
    const view = buildBidDialogView(input(state, { modes: ["maximum"], scheduled: true }));
    expect(view.options).toBeNull();
    expect(view.maximum).not.toBeNull();
  });

  it("says a bid is on its way and takes nothing else", () => {
    const view = buildBidDialogView(input(reduceBidDialog(idle(), { type: "submitted" })));
    expect(view.confirm).toEqual({ kind: "submitting", label: "Placing your bid…" });
    const maximum = buildBidDialogView(
      input(reduceBidDialog(choosingMaximum(), { type: "submitted" })),
    );
    expect(maximum.confirm).toEqual({ kind: "submitting", label: "Setting your maximum…" });
    const scheduled = buildBidDialogView(
      input(reduceBidDialog(choosingMaximum(), { type: "submitted" }), { scheduled: true }),
    );
    expect(scheduled.confirm.kind === "submitting" && scheduled.confirm.label).toBe(
      "Saving your maximum…",
    );
  });

  it("shows the new amount and asks again after being outbid while confirming", () => {
    const state = reduceBidDialog(reduceBidDialog(idle(), { type: "submitted" }), {
      type: "failed",
      failure: {
        kind: "refused",
        refusal: { code: "outbid_during_confirm", details: { nextBidAmount: "7500.00" } },
      },
      ladder: ladder.slice(1),
    });
    const view = buildBidDialogView(input(state, { ladder: ladder.slice(1) }));
    expect(view.notice?.title).toBe("Someone bid £7,250 first");
    expect(view.notice?.detail).toBe(
      "The next bid is now £7,500. Confirm if you'd like to bid it.",
    );
    expect(view.confirm).toEqual({ kind: "ready", label: "Confirm bid of £7,500" });
    expect(view.summary?.total.value).toBe("£9,375");
  });

  it("offers the nearest valid amount and keeps confirm ready", () => {
    const state = reduceBidDialog(idle(), {
      type: "failed",
      failure: {
        kind: "refused",
        refusal: { code: "amount_invalid", details: { nearestValidAmount: "7500.00" } },
      },
      ladder,
    });
    const view = buildBidDialogView(input(state));
    expect(view.notice?.remedy).toEqual({ kind: "use_amount", amount: "7500.00" });
    expect(view.confirm.kind).toBe("ready");
  });

  it("disables confirm and says why when an agent is over their limit", () => {
    const state = reduceBidDialog(idle(), {
      type: "failed",
      failure: {
        kind: "refused",
        refusal: { code: "over_limit", details: { remaining: "5000.00" } },
      },
      ladder,
    });
    const view = buildBidDialogView(input(state));
    expect(view.notice?.title).toBe("This bid is over your limit");
    expect(view.confirm).toEqual({
      kind: "disabled",
      label: "Confirm bid of £7,250",
      reason: "This bid is over your limit",
    });
  });

  it("warns an agent before they press when the limit cannot cover the next bid", () => {
    const view = buildBidDialogView(input(idle(), { agentLimitLeft: "5000.00", ladder: [] }));
    expect(view.notice?.remedy).toEqual({ kind: "limit_help" });
    expect(view.confirm.kind).toBe("disabled");
  });

  it("names the organisation and what is left of its limit", () => {
    const view = buildBidDialogView(
      input(idle(), { accountName: "Northbank Gallery", agentLimitLeft: "18500.00" }),
    );
    expect(view.accountNote).toEqual({
      title: "Bidding for Northbank Gallery",
      detail: "£18,500 left of your limit for this sale.",
    });
    expect(view.confirm.kind).toBe("ready");
  });

  it("never shows two different limit figures: the server's refusal updates the account note", () => {
    const state = reduceBidDialog(idle(), {
      type: "failed",
      failure: {
        kind: "refused",
        refusal: { code: "over_limit", details: { remaining: "5000.00" } },
      },
      ladder,
    });
    const view = buildBidDialogView(
      input(state, { accountName: "Northbank Gallery", agentLimitLeft: "18500.00" }),
    );
    const text = [view.notice?.detail, view.accountNote?.detail].join(" ");
    const figures = new Set(text.match(/£[\d,]+(?= left of your limit)/g));
    expect(figures).toEqual(new Set(["£5,000"]));
  });

  it("offers a retry after the connection dropped", () => {
    const state = reduceBidDialog(idle(), {
      type: "failed",
      failure: { kind: "unreachable" },
      ladder,
    });
    const view = buildBidDialogView(input(state));
    expect(view.notice?.title).toBe("We couldn't confirm your bid");
    expect(view.confirm).toEqual({ kind: "retry", label: "Try again" });
  });

  it("leaves only Close when the lot has closed", () => {
    const state = reduceBidDialog(idle(), {
      type: "failed",
      failure: { kind: "refused", refusal: { code: "lot_closed", details: {} } },
      ladder,
    });
    const view = buildBidDialogView(input(state));
    expect(view.notice?.title).toBe("Bidding has closed on this lot");
    expect(view.confirm).toEqual({ kind: "none" });
    expect(view.cancelLabel).toBe("Close");
    expect(view.summary).toBeNull();
  });

  it("explains a pending registration and leaves only Close", () => {
    const state = reduceBidDialog(idle(), {
      type: "failed",
      failure: { kind: "refused", refusal: { code: "registration_pending", details: {} } },
      ladder,
    });
    const view = buildBidDialogView(input(state));
    expect(view.notice?.title).toBe("Registration pending");
    expect(view.confirm.kind).toBe("none");
  });

  it("sends an unregistered bidder to register and holds confirm", () => {
    const state = reduceBidDialog(idle(), {
      type: "failed",
      failure: { kind: "refused", refusal: { code: "registration_required", details: {} } },
      ladder,
    });
    const view = buildBidDialogView(input(state));
    expect(view.notice?.remedy).toEqual({ kind: "register" });
    expect(view.confirm.kind).toBe("disabled");
  });

  it("tells the bidder when the price moved while they looked", () => {
    const state = reduceBidDialog(idle(), { type: "price_moved", nextBid: "7500.00", ladder });
    const view = buildBidDialogView(input(state));
    expect(view.notice?.title).toBe("Someone bid £7,250 first");
    expect(view.confirm).toEqual({ kind: "ready", label: "Confirm bid of £7,500" });
  });

  it("a typed maximum is snapped down, said aloud, and the summary follows it", () => {
    let state = reduceBidDialog(idle(), { type: "chose_mode", mode: "maximum", ladder });
    state = reduceBidDialog(state, { type: "chose_entry", entry: "type" });
    state = reduceBidDialog(state, { type: "typed", text: "49,600" });
    const view = buildBidDialogView(input(state));
    expect(view.maximum?.snapNote).toBe("Your maximum will be £49,500, the nearest valid step.");
    expect(view.amount).toBe("49500.00");
    expect(view.summary?.total.value).toBe("£61,875");
    expect(view.confirm).toEqual({ kind: "ready", label: "Confirm maximum of £49,500" });
  });

  it("asks once about a very large amount, then lets it through", () => {
    let state = reduceBidDialog(idle(), { type: "chose_mode", mode: "maximum", ladder });
    state = reduceBidDialog(state, { type: "chose_entry", entry: "type" });
    state = reduceBidDialog(state, { type: "typed", text: "95000" });
    expect(buildBidDialogView(input(state)).maximum?.large).toEqual({ amount: "95000.00" });
    state = reduceBidDialog(state, { type: "confirmed_large" });
    const view = buildBidDialogView(input(state));
    expect(view.maximum?.large).toBeNull();
    expect(view.confirm.kind).toBe("ready");
    // Typing again asks again.
    state = reduceBidDialog(state, { type: "typed", text: "96000" });
    expect(buildBidDialogView(input(state)).maximum?.large).not.toBeNull();
  });

  it("holds confirm for an empty, invalid or too-low typed amount", () => {
    let state = reduceBidDialog(idle(), { type: "chose_mode", mode: "maximum", ladder });
    state = reduceBidDialog(state, { type: "chose_entry", entry: "type" });
    expect(buildBidDialogView(input(state)).confirm.kind).toBe("disabled");
    state = reduceBidDialog(state, { type: "typed", text: "lots" });
    expect(buildBidDialogView(input(state)).maximum?.error).toContain("Enter an amount in pounds");
    state = reduceBidDialog(state, { type: "typed", text: "100" });
    expect(buildBidDialogView(input(state)).maximum?.error).toBe(
      "Enter at least £7,250, the next bid.",
    );
  });

  it("an agent typing past their limit gets the over-limit notice before confirming", () => {
    let state = reduceBidDialog(idle(), { type: "chose_mode", mode: "maximum", ladder });
    state = reduceBidDialog(state, { type: "chose_entry", entry: "type" });
    state = reduceBidDialog(state, { type: "typed", text: "9500" });
    const view = buildBidDialogView(input(state, { agentLimitLeft: "9000.00" }));
    expect(view.notice?.remedy).toEqual({ kind: "limit_help" });
    expect(view.confirm.kind).toBe("disabled");
  });

  it("shows no summary when the premium terms are missing", () => {
    expect(buildBidDialogView(input(idle(), { terms: null })).summary).toBeNull();
  });
});
