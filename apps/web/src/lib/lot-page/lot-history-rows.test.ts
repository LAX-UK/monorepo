import type { PublicBidHistory } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { buildLotHistoryView, relativeBidTime } from "./lot-history-rows";

const NOW = Date.parse("2026-11-03T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const HISTORY: PublicBidHistory = {
  total: 6,
  entries: [
    { amount: "7000.00", channel: "online", placedAt: ago(2 * 60_000), isViewer: true },
    { amount: "6750.00", channel: "online", placedAt: ago(14 * 60_000), isViewer: false },
    { amount: "6500.00", channel: "room", placedAt: ago(3_600_000), isViewer: false },
    { amount: "6250.00", channel: "phone", placedAt: ago(5 * 3_600_000), isViewer: false },
  ],
};

describe("relativeBidTime", () => {
  it.each([
    [10_000, "just now"],
    [2 * 60_000, "2 min ago"],
    [3_600_000, "1 h ago"],
    [26 * 3_600_000, "1 day ago"],
    [3 * 86_400_000, "3 days ago"],
  ])("%d ms reads %s", (elapsed, text) => {
    expect(relativeBidTime(ago(elapsed), NOW)).toBe(text);
  });
});

describe("buildLotHistoryView", () => {
  it("shows the last three, newest first, with the viewer marked", () => {
    const view = buildLotHistoryView(HISTORY, NOW, false);
    expect(view.summary).toBe("6 bids");
    expect(view.rows.map((r) => [r.amount, r.isViewer, r.detail])).toEqual([
      ["£7,000", true, "Online · 2 min ago"],
      ["£6,750", false, "Online · 14 min ago"],
      ["£6,500", false, "In the room · 1 h ago"],
    ]);
    expect(view.hiddenCount).toBe(3);
  });

  it("expanded lists every fetched bid", () => {
    const view = buildLotHistoryView(HISTORY, NOW, true);
    expect(view.rows).toHaveLength(4);
    expect(view.rows[3]?.detail).toBe("Phone · 5 h ago");
    expect(view.hiddenCount).toBe(2);
  });

  it("says so when there are no bids", () => {
    const view = buildLotHistoryView({ entries: [], total: 0 }, NOW, false);
    expect(view).toEqual({ summary: "No bids yet", rows: [], hiddenCount: 0 });
    expect(buildLotHistoryView(null, NOW, false).summary).toBe("No bids yet");
  });

  it("uses the singular for one bid", () => {
    expect(
      buildLotHistoryView({ entries: HISTORY.entries.slice(0, 1), total: 1 }, NOW, false).summary,
    ).toBe("1 bid");
  });
});
