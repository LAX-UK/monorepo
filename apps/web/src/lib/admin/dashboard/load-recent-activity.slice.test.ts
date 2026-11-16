import { LOT_STATUS, staffStatus } from "@/lib/admin/staff-kit-status";
import { lotStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { mapRecentActivity } from "./load-recent-activity.slice";

type RecentLot = Parameters<typeof mapRecentActivity>[0][number];

function lot(status: string, winnerId: string | null = null): RecentLot {
  return {
    id: "lot-1",
    title: "Harbour at dusk",
    status,
    endTime: "2026-11-20T18:00:00.000Z",
    winnerId,
    currentPrice: 1200,
  } as unknown as RecentLot;
}

describe("recent activity rows", () => {
  it("says the lot's status in staff words on the second line", () => {
    const [row] = mapRecentActivity([lot("active")]);
    expect(row?.meta).toMatch(/^Live · ends /);
  });

  it("says Sold for an ended lot with a winner, like the badge beside it", () => {
    const [row] = mapRecentActivity([lot("ended", "buyer-1")]);
    expect(row?.meta).toMatch(/^Sold · ends /);
  });

  it.each(lotStatuses)("never shows the stored code for %s", (status) => {
    // staffStatus falls back to humanised text for an unknown value, so require a real entry.
    expect(Object.keys(LOT_STATUS)).toContain(status);
    const [row] = mapRecentActivity([lot(status)]);
    const label = staffStatus("lot", status, { lot: { winnerId: null } }).label;
    expect(row?.meta.startsWith(`${label} · `)).toBe(true);
    expect(row?.meta.startsWith(`${status} · `)).toBe(false);
  });
});
