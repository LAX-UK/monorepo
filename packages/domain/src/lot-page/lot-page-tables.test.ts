import { describe, expect, it } from "vitest";
import { groupBidderAttention } from "./bidder-attention.js";
import { buyersPremiumTerms, premiumRateFor } from "./buyers-premium.js";
import { cardStateLine } from "./card-state-line.js";
import {
  LOT_LIFECYCLE_COPY,
  LOT_LIFECYCLE_KINDS,
  isLotLifecycleClosed,
  lotLifecycleHasCountdown,
} from "./lifecycle-copy.js";
import { resolveLotAction } from "./lot-action.js";
import { nextBidAmount, validBidAmounts } from "./next-bid.js";
import { publicBidChannel, toPublicBidHistory } from "./public-bid-history.js";
import { formatTimeLeft, timeLeftBand, timeLeftView, timeMarkCrossed } from "./time-left.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("lifecycle copy table", () => {
  it("has a row, a badge and a headline label for every lifecycle", () => {
    for (const kind of LOT_LIFECYCLE_KINDS) {
      const row = LOT_LIFECYCLE_COPY[kind];
      expect(row.badge.label).toBeTruthy();
      expect(row.headlineLabel).toBeTruthy();
    }
  });

  it("an ended lot never says current bid or offers a bid", () => {
    for (const kind of ["endedSold", "endedNoSale", "cancelled", "withdrawn"] as const) {
      expect(LOT_LIFECYCLE_COPY[kind].headlineLabel).not.toMatch(/current|next/i);
      expect(LOT_LIFECYCLE_COPY[kind].biddingOpen).toBe(false);
      expect(isLotLifecycleClosed(kind)).toBe(true);
    }
  });

  it("the live badge is the neutral dot badge, not a red one", () => {
    expect(LOT_LIFECYCLE_COPY.live.badge).toEqual({ label: "Live", tone: "neutral", dot: true });
  });

  it("the phone bar shows while bidding is open and hides on results", () => {
    expect(LOT_LIFECYCLE_COPY.scheduled.phoneBar).toBe(true);
    expect(LOT_LIFECYCLE_COPY.live.phoneBar).toBe(true);
    expect(LOT_LIFECYCLE_COPY.endedNoSale.phoneBar).toBe(false);
    expect(LOT_LIFECYCLE_COPY.withdrawn.phoneBar).toBe(false);
  });

  it("only clocked lots count down", () => {
    expect(lotLifecycleHasCountdown("live")).toBe(true);
    expect(lotLifecycleHasCountdown("liveSaleroom")).toBe(false);
  });
});

describe("time-left tones", () => {
  it("calm over an hour, soon under an hour, final under two minutes", () => {
    expect(timeLeftBand(3 * DAY).tone).toBe("calm");
    expect(timeLeftBand(HOUR).tone).toBe("calm");
    expect(timeLeftBand(HOUR - 1).tone).toBe("soon");
    expect(timeLeftBand(2 * MIN).tone).toBe("soon");
    expect(timeLeftBand(2 * MIN - 1).tone).toBe("final");
    expect(timeLeftBand(0).tone).toBe("final");
  });

  it("an extension is always final", () => {
    expect(timeLeftBand(3 * HOUR, { extended: true }).tone).toBe("final");
  });

  it("the label changes with the tone, not only the colour", () => {
    expect(timeLeftView(DAY).label).toBe("Time left");
    expect(timeLeftView(10 * MIN).label).toBe("Closing soon");
    expect(timeLeftView(30_000).label).toBe("Final minutes");
  });

  it("formats two units, with seconds only in the final band", () => {
    expect(formatTimeLeft(2 * DAY + 3 * HOUR)).toBe("2 days 3 hours");
    expect(formatTimeLeft(DAY)).toBe("1 day");
    expect(formatTimeLeft(5 * HOUR + 12 * MIN)).toBe("5 hours 12 minutes");
    expect(formatTimeLeft(45 * MIN + 30_000)).toBe("45 minutes");
    expect(formatTimeLeft(90_000, { showSeconds: true })).toBe("1 minute 30 seconds");
    expect(formatTimeLeft(45_000, { showSeconds: true })).toBe("45 seconds");
    expect(timeLeftView(90_000).text).toBe("1 minute 30 seconds");
  });

  it("announces a time mark once, when the clock crosses it", () => {
    expect(timeMarkCrossed(5 * MIN + 1000, 5 * MIN - 1000)).toBe("5 minutes left");
    expect(timeMarkCrossed(MIN + 1000, MIN - 1000)).toBe("1 minute left");
    expect(timeMarkCrossed(4 * MIN, 3 * MIN)).toBeNull();
    expect(timeMarkCrossed(10 * MIN, 30_000)).toBe("1 minute left");
    expect(timeMarkCrossed(MIN, 2 * MIN)).toBeNull();
  });
});

describe("next bid and valid amounts", () => {
  const english = {
    auctionType: "english" as const,
    currentPrice: "7000.00",
    startingPrice: "4200.00",
    minBidIncrement: "250.00",
  };

  it("english: current plus the increment, then one increment at a time", () => {
    expect(nextBidAmount(english)).toBe("7250.00");
    const amounts = validBidAmounts(english);
    expect(amounts).toHaveLength(20);
    expect(amounts.slice(0, 3)).toEqual(["7250.00", "7500.00", "7750.00"]);
    expect(amounts[19]).toBe("12000.00");
  });

  it("a missing increment steps by a penny", () => {
    expect(nextBidAmount({ ...english, minBidIncrement: "0" })).toBe("7000.01");
  });

  it("sealed lots start at the starting price", () => {
    const sealed = { ...english, auctionType: "sealed" as const };
    expect(nextBidAmount(sealed)).toBe("4200.00");
  });

  it("dutch lots have one valid amount: the price as it stands", () => {
    const dutch = { ...english, auctionType: "dutch" as const };
    expect(validBidAmounts(dutch)).toEqual(["7000.00"]);
  });
});

describe("buyer's premium terms", () => {
  it("is flat when the sale has no bands", () => {
    expect(buyersPremiumTerms({ lotRate: "0.25", bands: null })).toEqual({
      kind: "flat",
      rate: "0.25",
    });
    expect(buyersPremiumTerms({ lotRate: "0.25", bands: [] }).kind).toBe("flat");
  });

  it("bands override the lot rate and convert thresholds to major units", () => {
    const terms = buyersPremiumTerms({
      lotRate: "0.25",
      bands: [
        { hammerThresholdMinor: 50_000_000, rate: "0.1" },
        { hammerThresholdMinor: 0, rate: "0.15" },
      ],
    });
    expect(terms).toEqual({
      kind: "banded",
      bands: [
        { fromHammer: "0.00", rate: "0.15" },
        { fromHammer: "500000.00", rate: "0.1" },
      ],
    });
    expect(premiumRateFor(terms, "499999.99")).toBe("0.15");
    expect(premiumRateFor(terms, "500000.00")).toBe("0.1");
  });
});

describe("public bid history", () => {
  it("maps placement to a public channel", () => {
    expect(publicBidChannel("web")).toBe("online");
    expect(publicBidChannel("absentee")).toBe("online");
    expect(publicBidChannel("saleroom")).toBe("room");
    expect(publicBidChannel("telephone")).toBe("phone");
    expect(publicBidChannel(null)).toBe("online");
    expect(publicBidChannel("something-new")).toBe("online");
  });

  it("carries amount, channel, time and whether it is the viewer's, and nothing else", () => {
    const history = toPublicBidHistory(
      [
        {
          amount: "7000.00",
          placedVia: "saleroom",
          createdAt: new Date("2026-11-03T20:00:00Z"),
          placedByViewer: false,
        },
        {
          amount: "6500.00",
          placedVia: "web",
          createdAt: "2026-11-03T19:00:00.000Z",
          placedByViewer: true,
        },
      ],
      9,
    );
    expect(history.total).toBe(9);
    expect(history.entries[0]).toEqual({
      amount: "7000.00",
      channel: "room",
      placedAt: "2026-11-03T20:00:00.000Z",
      isViewer: false,
    });
    expect(history.entries[1]?.isViewer).toBe(true);
    expect(Object.keys(history.entries[0] ?? {}).sort()).toEqual([
      "amount",
      "channel",
      "isViewer",
      "placedAt",
    ]);
  });

  it("the total is never below the rows listed", () => {
    expect(
      toPublicBidHistory([{ amount: "1.00", createdAt: new Date(), placedByViewer: false }], 0)
        .total,
    ).toBe(1);
  });
});

describe("card state line", () => {
  const format = { money: (a: string) => `£${Number(a).toLocaleString("en-GB")}` };
  const line = (
    position: Parameters<typeof cardStateLine>[0]["position"],
    lifecycle = "live" as const,
    nextBid: string | null = "7500.00",
  ) => cardStateLine({ position, lifecycle, nextBid, format });

  it("has no line when the viewer has no bid on the lot", () => {
    expect(line("none")).toBeNull();
  });

  it("states each position in words, tone and shape", () => {
    expect(line("leading")).toMatchObject({
      text: "You're leading",
      tone: "success",
      icon: "tick",
    });
    expect(line("maximum_set")).toMatchObject({ text: "Maximum bid set", tone: "neutral" });
    expect(line("won", "endedSold")).toMatchObject({ text: "You won this lot", tone: "success" });
    expect(line("lost", "endedSold")).toMatchObject({ text: "You didn't win", tone: "neutral" });
  });

  it("only an outbid card has a button, and it names the amount", () => {
    expect(line("outbid")).toMatchObject({
      tone: "warning",
      icon: "alert",
      action: { kind: "bid", label: "Bid £7,500", amount: "7500.00" },
    });
    expect(line("leading")?.action).toBeNull();
    expect(line("outbid", "endedSold")?.action).toBeNull();
    expect(line("outbid", "live", null)?.action).toBeNull();
  });
});

describe("primary action", () => {
  const base = { signedIn: true, registrationRequired: false, registration: "none" as const };

  it("bidding actions give way to signing in", () => {
    expect(resolveLotAction({ ...base, lifecycle: "live", signedIn: false })).toBe("sign_in");
    expect(resolveLotAction({ ...base, lifecycle: "scheduled", signedIn: false })).toBe("sign_in");
  });

  it("an approved or unrestricted bidder bids, or sets a maximum before the opening", () => {
    expect(resolveLotAction({ ...base, lifecycle: "live" })).toBe("bid");
    expect(resolveLotAction({ ...base, lifecycle: "liveSaleroom" })).toBe("bid_and_watch_saleroom");
    expect(resolveLotAction({ ...base, lifecycle: "scheduled" })).toBe("set_maximum");
  });

  it("a buyer agent registers, waits or is declined before bidding", () => {
    const agent = { ...base, registrationRequired: true };
    expect(resolveLotAction({ ...agent, lifecycle: "live" })).toBe("register");
    expect(resolveLotAction({ ...agent, lifecycle: "live", registration: "pending" })).toBe(
      "registration_pending",
    );
    expect(resolveLotAction({ ...agent, lifecycle: "live", registration: "declined" })).toBe(
      "registration_declined",
    );
    expect(resolveLotAction({ ...agent, lifecycle: "live", registration: "approved" })).toBe("bid");
  });

  it("results and paused sales do not depend on who is looking", () => {
    expect(resolveLotAction({ ...base, lifecycle: "endedSold", signedIn: false })).toBe(
      "get_artist_alerts",
    );
    expect(resolveLotAction({ ...base, lifecycle: "endedNoSale" })).toBe("enquire");
    expect(resolveLotAction({ ...base, lifecycle: "withdrawn" })).toBe("back_to_sale");
    expect(resolveLotAction({ ...base, lifecycle: "saleroomPaused" })).toBe("bid_disabled");
  });
});

describe("bidder attention", () => {
  it("names the work, links one item to its lot and several to the list", () => {
    const [outbid] = groupBidderAttention([
      { kind: "outbid", lotId: "l1", title: "Estuary, evening" },
    ]);
    expect(outbid).toMatchObject({
      kind: "outbid",
      count: 1,
      url: "/lot/estuary-evening/l1#price",
    });
    expect(outbid?.items[0]?.title).toBe("Estuary, evening");

    const [many] = groupBidderAttention([
      { kind: "outbid", lotId: "l1", title: "A" },
      { kind: "outbid", lotId: "l2", title: "B" },
    ]);
    expect(many).toMatchObject({ count: 2, url: "/bids?tab=active" });
  });

  it("counts per kind, in priority order, once per lot", () => {
    const groups = groupBidderAttention([
      { kind: "payment_due", lotId: "p1", title: "Pay" },
      { kind: "outbid", lotId: "l1", title: "A" },
      { kind: "outbid", lotId: "l1", title: "A" },
    ]);
    expect(groups.map((g) => [g.kind, g.count])).toEqual([
      ["outbid", 1],
      ["payment_due", 1],
    ]);
  });

  it("is empty when nothing is waiting", () => {
    expect(groupBidderAttention([])).toEqual([]);
  });
});
