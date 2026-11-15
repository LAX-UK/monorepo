import {
  LIVE_CARD_FIELDS,
  liveCardFields,
  pendingCardVM,
  saleCatalogueLiveReads,
  withLiveCardFields,
} from "@/lib/marketing/saleroom/card-live-state";
import type { SaleLotCardVM } from "@/lib/marketing/saleroom/view-models";
import { describe, expect, it } from "vitest";

const card = {
  id: "lot-1",
  href: "/lot/a/lot-1",
  title: "A painting",
  lotNumber: 1,
  lotLabel: "Lot 1",
  imageUrl: null,
  imageAlt: "A painting",
  displayStyle: "wall",
  estimateValue: "£1,000",
  currentBidLabel: "Current bid",
  currentBidValue: "£7,000",
  cardLine: {
    label: "Current bid",
    value: "£7,000",
    time: "closes",
    startsAt: "2026-10-30T18:00:00.000Z",
    endsAt: "2026-11-03T21:06:00.000Z",
  },
  bidsCountLabel: null,
  closingLabel: "3 Nov 2026, 21:06",
  closingShort: "2 days",
  isLive: true,
  viewerOwnsLot: false,
  artistOrMedium: null,
  viewerIsWatching: false,
  winnerId: "bidder-9",
  hasWinner: true,
  resultPending: true,
  status: "active",
  startTime: "2026-10-30T18:00:00.000Z",
  endTime: "2026-11-03T21:06:00.000Z",
} satisfies SaleLotCardVM;

const LIVE_VALUES = ["£7,000", "Current bid", "2026-11-03T21:06", "21:06", "2 days", "bidder-9"];

describe("pendingCardVM (CO-7)", () => {
  it("leaves no bid state in the card", () => {
    const pending = pendingCardVM(card);
    const text = JSON.stringify(pending);
    expect(LIVE_VALUES.filter((v) => text.includes(v))).toEqual([]);
    expect(pending.pending).toBe(true);
    expect(pending.isLive).toBe(false);
    expect("hasWinner" in pending).toBe(false);
    expect("resultPending" in pending).toBe(false);
    // The catalogue stays.
    expect(pending.title).toBe("A painting");
    expect(pending.estimateValue).toBe("£1,000");
    expect(pending.startTime).toBe(card.startTime);
  });

  it("neutralises every live field", () => {
    const pending = pendingCardVM(card) as Record<string, unknown>;
    for (const field of LIVE_CARD_FIELDS) {
      expect(pending[field]).not.toEqual((card as Record<string, unknown>)[field]);
    }
  });
});

describe("withLiveCardFields", () => {
  it("fills a pending card from the live read and clears pending", () => {
    const filled = withLiveCardFields(
      pendingCardVM(card),
      new Map([[card.id, liveCardFields(card)]]),
    );
    expect(filled).toEqual(card);
    expect(filled.pending).toBeUndefined();
  });

  it("keeps the placeholder when the live read has not landed or lacks the lot", () => {
    const pending = pendingCardVM(card);
    expect(withLiveCardFields(pending, null)).toBe(pending);
    expect(withLiveCardFields(pending, new Map())).toBe(pending);
  });
});

describe("saleCatalogueLiveReads", () => {
  const base = { sort: "lot", total: 130, loadAllBatch: 48, loadAllCap: 200, pageSize: 40 };

  it("repeats the one page the server read", () => {
    expect(saleCatalogueLiveReads({ ...base, loadAll: false, page: 3 })).toEqual([
      { limit: 40, offset: 80, sort: "lot" },
    ]);
  });

  it("repeats every batch of a load-all read, up to the cap", () => {
    expect(saleCatalogueLiveReads({ ...base, loadAll: true, page: 1 })).toEqual([
      { limit: 48, offset: 0, sort: "lot" },
      { limit: 48, offset: 48, sort: "lot" },
      { limit: 48, offset: 96, sort: "lot" },
    ]);
    expect(saleCatalogueLiveReads({ ...base, loadAll: true, page: 1, total: 900 })).toHaveLength(5);
  });
});
