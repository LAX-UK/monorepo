import {
  type BidDialogState,
  openBidDialog,
  reduceBidDialog,
} from "@/lib/lot-page/bid-dialog/bid-dialog-state";
import { describe, expect, it } from "vitest";

const ladder = ["7250.00", "7500.00", "7750.00"];
const opened = (): BidDialogState => openBidDialog({ mode: "next", nextBid: "7250.00", ladder });

describe("bid dialog state", () => {
  it("opens on the next bid with the lowest maximum ready", () => {
    expect(opened()).toEqual({
      phase: "choosing",
      mode: "next",
      shownNextBid: "7250.00",
      maximum: "7250.00",
      entry: "choose",
      typedText: "",
      largeConfirmed: false,
      failure: null,
      attempt: 0,
    });
  });

  it("switches to choosing a maximum and keeps the choice while it is still on the ladder", () => {
    const choosing = reduceBidDialog(opened(), { type: "chose_mode", mode: "maximum", ladder });
    expect(choosing.mode).toBe("maximum");
    const picked = reduceBidDialog(choosing, { type: "chose_maximum", maximum: "7750.00" });
    expect(picked.maximum).toBe("7750.00");
    expect(picked.attempt).toBeGreaterThan(choosing.attempt);
  });

  it("goes through submitting to placed", () => {
    const submitting = reduceBidDialog(opened(), { type: "submitted" });
    expect(submitting.phase).toBe("submitting");
    expect(reduceBidDialog(submitting, { type: "placed" }).phase).toBe("placed");
  });

  it("freezes the choices while a bid is on its way", () => {
    const submitting = reduceBidDialog(opened(), { type: "submitted" });
    expect(reduceBidDialog(submitting, { type: "chose_maximum", maximum: "7750.00" })).toBe(
      submitting,
    );
    expect(reduceBidDialog(submitting, { type: "price_moved", nextBid: "7500.00", ladder })).toBe(
      submitting,
    );
  });

  it("shows the new next bid after being outbid while confirming, and asks again", () => {
    const submitting = reduceBidDialog(opened(), { type: "submitted" });
    const failed = reduceBidDialog(submitting, {
      type: "failed",
      failure: {
        kind: "refused",
        refusal: { code: "outbid_during_confirm", details: { nextBidAmount: "7500.00" } },
      },
      ladder: ladder.slice(1),
    });
    expect(failed.phase).toBe("choosing");
    expect(failed.shownNextBid).toBe("7500.00");
    expect(failed.failure).toEqual({ kind: "moved", seenNextBid: "7250.00", nextBid: "7500.00" });
  });

  it("keeps the attempt after a dropped connection so the retry reuses the same key", () => {
    const submitting = reduceBidDialog(opened(), { type: "submitted" });
    const failed = reduceBidDialog(submitting, {
      type: "failed",
      failure: { kind: "unreachable" },
      ladder,
    });
    expect(failed.attempt).toBe(submitting.attempt);
    expect(failed.phase).toBe("choosing");
  });

  it("starts a new attempt after a refusal, since the bid will differ", () => {
    const submitting = reduceBidDialog(opened(), { type: "submitted" });
    const failed = reduceBidDialog(submitting, {
      type: "failed",
      failure: { kind: "rejected", message: null },
      ladder,
    });
    expect(failed.attempt).toBe(submitting.attempt + 1);
  });

  it("tells the bidder when someone bids while the dialog is open, naming what they saw", () => {
    const moved = reduceBidDialog(opened(), {
      type: "price_moved",
      nextBid: "7500.00",
      ladder: ladder.slice(1),
    });
    expect(moved.shownNextBid).toBe("7500.00");
    expect(moved.failure).toEqual({ kind: "moved", seenNextBid: "7250.00", nextBid: "7500.00" });
    expect(moved.maximum).toBe("7500.00");
  });

  it("ignores a price that has not moved", () => {
    const state = opened();
    expect(reduceBidDialog(state, { type: "price_moved", nextBid: "7250.00", ladder })).toBe(state);
  });

  it("applies the nearest valid amount to the next bid or the maximum", () => {
    const next = reduceBidDialog(opened(), { type: "used_amount", amount: "7500.00" });
    expect(next.shownNextBid).toBe("7500.00");
    expect(next.failure).toBeNull();
    const choosing = reduceBidDialog(opened(), { type: "chose_mode", mode: "maximum", ladder });
    expect(reduceBidDialog(choosing, { type: "used_amount", amount: "7750.00" }).maximum).toBe(
      "7750.00",
    );
  });

  it("clears a notice when dismissed", () => {
    const failed = reduceBidDialog(opened(), {
      type: "failed",
      failure: { kind: "unreachable" },
      ladder,
    });
    expect(reduceBidDialog(failed, { type: "dismissed_notice" }).failure).toBeNull();
  });
});
