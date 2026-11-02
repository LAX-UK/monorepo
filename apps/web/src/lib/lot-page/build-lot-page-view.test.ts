import type { LotLifecycleKind } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { type LotPageViewInput, buildLotPageView } from "./build-lot-page-view";
import { type LotViewerView, NO_LOT_VIEWER } from "./lot-viewer";

const NOW = new Date("2026-11-01T12:00:00Z");
const HOUR = 3_600_000;

function input(over: Partial<LotPageViewInput> = {}): LotPageViewInput {
  return {
    lifecycle: "live",
    now: NOW,
    msLeft: 62 * HOUR,
    startsAt: "2026-10-30T18:00:00Z",
    endsAt: "2026-11-03T21:06:00Z",
    amounts: { starting: "4200.00", current: "7000.00", hammer: null, soldForWithPremium: null },
    estimate: { low: "6000", high: "9000" },
    bidCount: 6,
    reserve: "met",
    nextBid: "7250.00",
    extendedByMs: null,
    saleroom: null,
    signedIn: true,
    viewer: { ...NO_LOT_VIEWER, registration: "approved" },
    ...over,
  };
}

function viewer(over: Partial<LotViewerView>): LotViewerView {
  return { ...NO_LOT_VIEWER, registration: "approved", ...over };
}

describe("buildLotPageView lifecycles", () => {
  it("live: current bid, estimate and a calm clock", () => {
    const view = buildLotPageView(input());
    expect(view.badge).toEqual({ label: "Live", tone: "neutral", dot: true });
    expect(view.price).toMatchObject({
      label: "Current bid",
      amountText: "£7,000",
      subLine: "6 bids · Reserve met",
    });
    expect(view.rows.map((r) => [r.label, r.value, r.tone])).toEqual([
      ["Estimate", "£6,000–£9,000", "calm"],
      ["Time left", "2 days 14 hours", "calm"],
    ]);
    expect(view.rows[1]?.sub).toBe("Closes Tue 3 Nov, 21:06 GMT");
    expect(view.action).toBe("bid");
    expect(view.actionSurface).toBe("bid_entry");
    expect(view.sections).toEqual({ watchShare: true, history: true });
  });

  it("closing soon turns the clock to the soon tone with its own words", () => {
    const view = buildLotPageView(input({ msLeft: 42 * 60_000, endsAt: "2026-11-01T21:06:00Z" }));
    expect(view.rows[1]).toMatchObject({
      label: "Closing soon",
      value: "42 minutes",
      tone: "soon",
      sub: "Closes today, 21:06 GMT",
    });
  });

  it("counts seconds through the whole final hour", () => {
    const view = buildLotPageView(
      input({ msLeft: 42 * 60_000 + 10_000, endsAt: "2026-11-01T12:42:10Z" }),
    );
    expect(view.rows[1]).toMatchObject({
      label: "Closing soon",
      value: "42 minutes 10 seconds",
      tone: "soon",
    });
    const hour = buildLotPageView(input({ msLeft: HOUR, endsAt: "2026-11-01T13:00:00Z" }));
    expect(hour.rows[1]?.value).toBe("1 hour");
  });

  it("tells the day, not a count, beyond seven days; a week exactly still counts", () => {
    const far = buildLotPageView(
      input({ msLeft: 7 * 24 * HOUR + 1, endsAt: "2026-11-08T12:00:01Z" }),
    );
    expect(far.rows[1]).toMatchObject({ label: "Closes", value: "Sun 8 Nov", tone: "calm" });
    const week = buildLotPageView(input({ msLeft: 7 * 24 * HOUR, endsAt: "2026-11-08T12:00:00Z" }));
    expect(week.rows[1]).toMatchObject({ label: "Time left", value: "7 days" });
  });

  it("extended: final tone with seconds, and the extension said once", () => {
    const view = buildLotPageView(
      input({ lifecycle: "extended", msLeft: 108_000, extendedByMs: 120_000, bidCount: 7 }),
    );
    expect(view.badge).toEqual({ label: "Extended", tone: "warning", dot: true });
    expect(view.rows[1]).toMatchObject({
      label: "Final minutes",
      value: "1 minute 48 seconds",
      tone: "final",
    });
    expect(view.price.subLine).toBe("Extended by 2 minutes after a late bid");
    expect(view.rows[1]?.sub).not.toMatch(/Extended/);
  });

  it("upcoming: starting bid, opens-in clock and the opening day in the badge", () => {
    const view = buildLotPageView(
      input({
        lifecycle: "scheduled",
        msLeft: 9 * 24 * HOUR,
        startsAt: "2026-11-10T18:00:00Z",
        bidCount: 0,
        reserve: "none",
        nextBid: "4200.00",
      }),
    );
    expect(view.badge.label).toBe("Opens Tue 10 Nov");
    expect(view.price).toMatchObject({ label: "Starting bid", amountText: "£4,200" });
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({
      label: "Opens",
      value: "Tue 10 Nov",
      sub: "18:00 GMT",
    });
    expect(view.sections.history).toBe(false);
    expect(view.action).toBe("set_maximum");
  });

  it("in the room: no countdown, the auctioneer closes the lot", () => {
    const view = buildLotPageView(
      input({
        lifecycle: "liveSaleroom",
        msLeft: null,
        saleroom: { onBlock: false, lotsAway: 3 },
      }),
    );
    expect(view.badge.label).toBe("Live · In the room");
    expect(view.price.subLine).toBe("3 lots away");
    expect(view.rows.at(-1)).toMatchObject({
      label: "Closing",
      value: "In the room",
      clock: false,
    });
    expect(view.action).toBe("bid_and_watch_saleroom");
  });

  it("room paused: bidding stays on the bid entry, which explains the pause", () => {
    const view = buildLotPageView(input({ lifecycle: "saleroomPaused", msLeft: null }));
    expect(view.badge.label).toBe("Paused");
    expect(view.price.subLine).toBe("The auctioneer has paused the sale");
    expect(view.rows.map((r) => r.label)).toEqual(["Estimate"]);
    expect(view.actionSurface).toBe("bid_entry");
  });

  it("sold: the price with premium first and the hammer beneath", () => {
    const view = buildLotPageView(
      input({
        lifecycle: "endedSold",
        msLeft: null,
        amounts: {
          starting: "4200.00",
          current: "7000.00",
          hammer: "7000.00",
          soldForWithPremium: "8750.00",
        },
      }),
    );
    expect(view.badge.label).toBe("Sold");
    expect(view.price).toMatchObject({
      label: "Sold for",
      amountText: "£8,750",
      subLine: "Hammer £7,000 plus 25% buyer's premium",
    });
    expect(view.rows.at(-1)).toMatchObject({
      label: "Ended",
      value: "Tue 3 Nov",
      sub: "21:06 GMT",
      tone: "ended",
    });
    expect(view.actionSurface).toBe("artist_alerts");
  });

  it("not sold: the estimate leads and is not repeated", () => {
    const view = buildLotPageView(input({ lifecycle: "endedNoSale", msLeft: null }));
    expect(view.price).toMatchObject({
      label: "Estimate",
      amountText: "£6,000–£9,000",
      subLine: "This work did not sell in this sale",
    });
    expect(view.rows.map((r) => r.label)).toEqual(["Ended"]);
    expect(view.actionSurface).toBe("enquire");
  });

  it.each<LotLifecycleKind>(["withdrawn", "cancelled"])(
    "%s: no price, no actions, no sections",
    (lifecycle) => {
      const view = buildLotPageView(input({ lifecycle, msLeft: null }));
      expect(view.withdrawn).toBe(true);
      expect(view.price.amountText).toBeNull();
      expect(view.rows).toEqual([]);
      expect(view.sections).toEqual({ watchShare: false, history: false });
      expect(view.actionSurface).toBe("back_to_sale");
    },
  );
});

describe("buildLotPageView bidder states", () => {
  const states: Array<[string, Partial<LotPageViewInput>, string, string | null]> = [
    ["signed out", { signedIn: false, viewer: NO_LOT_VIEWER }, "sign_in", null],
    [
      "registration pending",
      { viewer: viewer({ registration: "pending", registrationRequired: true }) },
      "registration_pending",
      "Your registration is waiting for approval",
    ],
    [
      "registration declined",
      { viewer: viewer({ registration: "declined", registrationRequired: true }) },
      "registration_declined",
      "Your registration was declined. Contact client services for help",
    ],
    [
      "leading",
      { viewer: viewer({ position: "leading", myHighestBid: "7000.00" }) },
      "bid",
      "You're the highest bidder",
    ],
    [
      "outbid",
      { viewer: viewer({ position: "outbid", myHighestBid: "6750.00" }) },
      "bid",
      "You've been outbid. The next bid is £7,250",
    ],
  ];

  it.each(states)("%s", (_name, over, action, stateText) => {
    const view = buildLotPageView(input(over));
    expect(view.action).toBe(action);
    expect(view.price.stateLine?.text ?? null).toBe(stateText);
  });

  it("outbid reads with a warning tone and an alert, never colour alone", () => {
    const view = buildLotPageView(input({ viewer: viewer({ position: "outbid" }) }));
    expect(view.price.stateLine).toMatchObject({ tone: "warning", icon: "alert" });
    expect(view.price.tone).toBe("warning");
  });

  it("won: payment due names the day", () => {
    const view = buildLotPageView(
      input({
        lifecycle: "endedSold",
        msLeft: null,
        amounts: {
          starting: "4200.00",
          current: "7000.00",
          hammer: "7000.00",
          soldForWithPremium: "8750.00",
        },
        viewer: viewer({
          position: "won",
          purchase: { id: "p1", status: "due", dueAt: "2026-11-10T12:00:00Z" },
        }),
      }),
    );
    expect(view.price.stateLine).toMatchObject({
      text: "You won this lot. Pay by Tue 10 Nov",
      tone: "warning",
    });
  });

  it("a buyer agent sees their room under the limit", () => {
    const view = buildLotPageView(
      input({ viewer: viewer({ registrationRequired: true, agentLimitLeft: "18500.00" }) }),
    );
    expect(view.price.agentLine?.text).toBe("£18,500 left of your limit");
  });

  it("an upcoming lot with a maximum set says it starts bidding at the opening", () => {
    const view = buildLotPageView(
      input({
        lifecycle: "scheduled",
        msLeft: 24 * HOUR,
        startsAt: "2026-11-02T12:00:00Z",
        viewer: viewer({ position: "maximum_set", myMaxBid: "9000.00" }),
      }),
    );
    expect(view.price.stateLine?.text).toBe(
      "Your maximum bid is £9,000. It starts bidding when the lot opens",
    );
  });
});
