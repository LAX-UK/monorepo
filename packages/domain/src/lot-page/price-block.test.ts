import { describe, expect, it } from "vitest";
import { LOT_LIFECYCLE_KINDS } from "./lifecycle-copy.js";
import { type PriceBlockInput, buildPriceBlock, premiumPercentLabel } from "./price-block.js";
import { type LotViewerState, NO_VIEWER_STATE } from "./viewer-state.js";

const format = {
  money: (amount: string) =>
    `£${Number(amount).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`,
  date: (iso: string) => `date(${iso.slice(0, 10)})`,
};

function input(over: Partial<PriceBlockInput> = {}): PriceBlockInput {
  return {
    lifecycle: "live",
    amounts: { starting: "4200.00", current: "7000.00", hammer: null, soldForWithPremium: null },
    estimate: { low: "6000", high: "9000" },
    bidCount: 6,
    reserve: "met",
    nextBid: "7250.00",
    extendedByMs: null,
    saleroom: null,
    signedIn: true,
    registrationRequired: false,
    viewer: NO_VIEWER_STATE,
    purchase: null,
    agentLimitLeft: null,
    format,
    ...over,
  };
}

const viewer = (over: Partial<LotViewerState>): LotViewerState => ({ ...NO_VIEWER_STATE, ...over });

describe("live headline before and after the first bid", () => {
  const LIVE_KINDS = ["live", "extended", "liveSaleroom", "saleroomPaused"] as const;

  it.each(LIVE_KINDS)("%s: starting bid, at the starting price, until a bid is placed", (kind) => {
    const vm = buildPriceBlock(
      input({
        lifecycle: kind,
        bidCount: 0,
        amounts: {
          starting: "4200.00",
          current: "4200.00",
          hammer: null,
          soldForWithPremium: null,
        },
      }),
    );
    expect(vm.label).toBe("Starting bid");
    expect(vm.amountText).toBe("£4,200");
  });

  it.each(LIVE_KINDS)("%s: current bid once there is a bid", (kind) => {
    expect(buildPriceBlock(input({ lifecycle: kind, bidCount: 3 })).label).toBe("Current bid");
  });
});

describe("price block by lifecycle", () => {
  it("upcoming: starting bid with the estimate beneath", () => {
    const vm = buildPriceBlock(input({ lifecycle: "scheduled" }));
    expect(vm).toMatchObject({
      label: "Starting bid",
      amountText: "£4,200",
      subLine: "Estimate £6,000–£9,000",
    });
  });

  it("upcoming with no starting price falls back to the estimate, never to £0", () => {
    const vm = buildPriceBlock(
      input({
        lifecycle: "scheduled",
        amounts: { starting: "0.00", current: "0.00", hammer: null, soldForWithPremium: null },
      }),
    );
    expect(vm).toMatchObject({ label: "Estimate", amount: null, amountText: "£6,000–£9,000" });
  });

  it("upcoming with neither price nor estimate shows no figure", () => {
    const vm = buildPriceBlock(
      input({
        lifecycle: "scheduled",
        estimate: null,
        amounts: { starting: "0.00", current: "0.00", hammer: null, soldForWithPremium: null },
      }),
    );
    expect(vm).toMatchObject({ label: "Starting bid", amountText: null, subLine: null });
  });

  it("live: current bid, bid count and reserve status", () => {
    expect(buildPriceBlock(input())).toMatchObject({
      label: "Current bid",
      amount: "7000.00",
      amountText: "£7,000",
      subLine: "6 bids · Reserve met",
    });
    expect(buildPriceBlock(input({ bidCount: 1, reserve: "below" })).subLine).toBe(
      "1 bid · Reserve not yet met",
    );
    expect(buildPriceBlock(input({ bidCount: 0, reserve: "none" })).subLine).toBe("No bids yet");
  });

  it("extended: names the extension", () => {
    expect(buildPriceBlock(input({ lifecycle: "extended", extendedByMs: 120_000 })).subLine).toBe(
      "Extended by 2 minutes after a late bid",
    );
    expect(buildPriceBlock(input({ lifecycle: "extended", extendedByMs: 30_000 })).subLine).toBe(
      "Extended by 30 seconds after a late bid",
    );
    expect(buildPriceBlock(input({ lifecycle: "extended" })).subLine).toBe(
      "Bidding was extended after a late bid",
    );
  });

  it("in the room: on the block, how many lots away, or the bid count", () => {
    const room = (saleroom: PriceBlockInput["saleroom"]) =>
      buildPriceBlock(input({ lifecycle: "liveSaleroom", saleroom })).subLine;
    expect(room({ onBlock: true, lotsAway: 0 })).toBe("On the block now");
    expect(room({ onBlock: false, lotsAway: 3 })).toBe("3 lots away");
    expect(room({ onBlock: false, lotsAway: 1 })).toBe("1 lot away");
    expect(room(null)).toBe("6 bids · Reserve met");
  });

  it("room paused: says so and keeps the figure", () => {
    expect(buildPriceBlock(input({ lifecycle: "saleroomPaused" }))).toMatchObject({
      label: "Current bid",
      subLine: "The auctioneer has paused the sale",
    });
  });

  it("sold: the price with premium leads, the hammer and premium follow", () => {
    const vm = buildPriceBlock(
      input({
        lifecycle: "endedSold",
        amounts: {
          starting: "4200",
          current: "7000",
          hammer: "7000.00",
          soldForWithPremium: "8750.00",
        },
      }),
    );
    expect(vm).toMatchObject({
      label: "Sold for",
      amountText: "£8,750",
      subLine: "Hammer £7,000 plus 25% buyer's premium",
    });
  });

  it("sold with no premium information reports the hammer honestly", () => {
    const vm = buildPriceBlock(
      input({
        lifecycle: "endedSold",
        amounts: { starting: "4200", current: "7000", hammer: "7000.00", soldForWithPremium: null },
      }),
    );
    expect(vm).toMatchObject({ label: "Hammer price", amountText: "£7,000", subLine: null });
  });

  it("sold with a zero premium is simply the hammer", () => {
    const vm = buildPriceBlock(
      input({
        lifecycle: "endedSold",
        amounts: {
          starting: "4200",
          current: "7000",
          hammer: "7000.00",
          soldForWithPremium: "7000.00",
        },
      }),
    );
    expect(vm).toMatchObject({ label: "Sold for", amountText: "£7,000", subLine: null });
  });

  it("not sold: the estimate, never the last bid", () => {
    const vm = buildPriceBlock(input({ lifecycle: "endedNoSale" }));
    expect(vm).toMatchObject({
      label: "Estimate",
      amount: null,
      amountText: "£6,000–£9,000",
      subLine: "This work did not sell in this sale",
    });
    expect(buildPriceBlock(input({ lifecycle: "endedNoSale", estimate: null }))).toMatchObject({
      label: "Not sold",
      amountText: null,
    });
  });

  it.each([
    ["withdrawn", "This lot was withdrawn from the sale"],
    ["cancelled", "This lot was cancelled"],
  ] as const)("%s: no price and the reason", (lifecycle, subLine) => {
    expect(buildPriceBlock(input({ lifecycle }))).toMatchObject({
      label: "No price",
      amount: null,
      amountText: null,
      subLine,
    });
  });

  it("never prints a live word on a closed lot", () => {
    for (const lifecycle of ["endedSold", "endedNoSale", "withdrawn", "cancelled"] as const) {
      const vm = buildPriceBlock(
        input({
          lifecycle,
          amounts: {
            starting: "4200",
            current: "7000",
            hammer: "7000",
            soldForWithPremium: "8750",
          },
        }),
      );
      expect(vm.label).not.toMatch(/current|minimum next/i);
    }
  });

  it("covers every lifecycle", () => {
    for (const lifecycle of LOT_LIFECYCLE_KINDS) {
      expect(buildPriceBlock(input({ lifecycle })).label).toBeTruthy();
    }
  });
});

describe("price block by bidder state", () => {
  it("signed out shows no state line", () => {
    const vm = buildPriceBlock(input({ signedIn: false, viewer: viewer({ position: "leading" }) }));
    expect(vm.stateLine).toBeNull();
  });

  it("leading is success with a tick, and names a maximum when one is set", () => {
    expect(buildPriceBlock(input({ viewer: viewer({ position: "leading" }) })).stateLine).toEqual({
      text: "You're the highest bidder",
      tone: "success",
      icon: "tick",
    });
    expect(
      buildPriceBlock(input({ viewer: viewer({ position: "leading", myMaxBid: "9000.00" }) }))
        .stateLine?.text,
    ).toBe("You're the highest bidder. Your maximum is £9,000");
  });

  it("outbid is a warning with an alert and the next bid", () => {
    const vm = buildPriceBlock(input({ viewer: viewer({ position: "outbid" }) }));
    expect(vm.stateLine).toEqual({
      text: "You've been outbid. The next bid is £7,250",
      tone: "warning",
      icon: "alert",
    });
    expect(vm.tone).toBe("warning");
  });

  it("maximum set on an upcoming lot starts at the opening", () => {
    const vm = buildPriceBlock(
      input({
        lifecycle: "scheduled",
        viewer: viewer({ position: "maximum_set", myMaxBid: "9000.00" }),
      }),
    );
    expect(vm.stateLine?.text).toBe(
      "Your maximum bid is £9,000. It starts bidding when the lot opens",
    );
  });

  it("won: success, then payment due, overdue and paid", () => {
    const won = (purchase: PriceBlockInput["purchase"]) =>
      buildPriceBlock(
        input({ lifecycle: "endedSold", viewer: viewer({ position: "won" }), purchase }),
      );
    expect(won(null).stateLine).toMatchObject({ text: "You won this lot", tone: "success" });
    expect(won({ status: "due", dueAt: "2026-11-10T00:00:00Z" }).stateLine).toMatchObject({
      text: "You won this lot. Pay by date(2026-11-10)",
      tone: "warning",
      icon: "alert",
    });
    expect(won({ status: "overdue", dueAt: "2026-11-01T00:00:00Z" }).stateLine).toMatchObject({
      tone: "danger",
      icon: "alert",
    });
    expect(won({ status: "paid", dueAt: null }).stateLine).toMatchObject({ tone: "success" });
  });

  it("lost is a neutral fact", () => {
    const vm = buildPriceBlock(
      input({ lifecycle: "endedSold", viewer: viewer({ position: "lost" }) }),
    );
    expect(vm.stateLine).toMatchObject({ text: "You didn't win this lot", tone: "neutral" });
  });

  it("registration pending and declined show only where registration is required", () => {
    const pending = viewer({ registration: "pending" });
    expect(buildPriceBlock(input({ viewer: pending })).stateLine).toBeNull();
    expect(
      buildPriceBlock(input({ viewer: pending, registrationRequired: true })).stateLine?.text,
    ).toBe("Your registration is waiting for approval");
    expect(
      buildPriceBlock(
        input({ viewer: viewer({ registration: "declined" }), registrationRequired: true }),
      ).stateLine,
    ).toMatchObject({ tone: "warning", icon: "alert" });
  });

  it("an agent sees what is left of their limit while bidding is open", () => {
    expect(buildPriceBlock(input({ agentLimitLeft: "1500.00" })).agentLine).toEqual({
      text: "£1,500 left of your limit",
      tone: "info",
      icon: "dot",
    });
    expect(buildPriceBlock(input({ agentLimitLeft: "0.00" })).agentLine).toMatchObject({
      text: "You are at your limit for this sale",
      tone: "warning",
    });
    expect(
      buildPriceBlock(input({ lifecycle: "endedSold", agentLimitLeft: "1500.00" })).agentLine,
    ).toBeNull();
    expect(buildPriceBlock(input()).agentLine).toBeNull();
  });

  it("the block takes the tone of its strongest line", () => {
    const vm = buildPriceBlock(
      input({ viewer: viewer({ position: "leading" }), agentLimitLeft: "0.00" }),
    );
    expect(vm.tone).toBe("warning");
  });
});

describe("premiumPercentLabel", () => {
  it("derives the percentage from the two figures", () => {
    expect(premiumPercentLabel("7000.00", "8750.00")).toBe("25%");
    expect(premiumPercentLabel("1000.00", "1202.50")).toBe("20.25%");
  });

  it("is null when there is no premium or no hammer", () => {
    expect(premiumPercentLabel("7000.00", "7000.00")).toBeNull();
    expect(premiumPercentLabel("0.00", "10.00")).toBeNull();
  });
});
