import type { PortalSaleAuthority, PortalSaleAuthorityRequest } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  buildEditionsPage,
  clampAvailableToSell,
  describeChange,
  describeSaleRequestDraft,
  editionCounts,
} from "./selling-editions.vm";

const ART_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ART_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function edition(overrides: Partial<PortalSaleAuthority> = {}): PortalSaleAuthority {
  return {
    artworkId: ART_A,
    artworkSlug: "harbour-print",
    artworkTitle: "Harbour Print",
    ownerPartyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    authorisedCount: 3,
    committedCount: 2,
    lastGrantAt: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function request(overrides: Partial<PortalSaleAuthorityRequest> = {}): PortalSaleAuthorityRequest {
  return {
    requestId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    artworkId: ART_A,
    artworkSlug: "harbour-print",
    artworkTitle: "Harbour Print",
    requestedCount: 6,
    note: null,
    status: "pending",
    createdAt: "2026-10-12T09:00:00Z",
    handledAt: null,
    ...overrides,
  };
}

describe("editionCounts", () => {
  it("approved is listed plus sold or reserved; available now is approved minus sold or reserved", () => {
    const counts = editionCounts({ authorisedCount: 3, committedCount: 2 });
    expect(counts).toEqual({ approved: 5, soldOrReserved: 2, availableNow: 3 });
    expect(counts.availableNow).toBe(counts.approved - counts.soldOrReserved);
  });

  it("never shows a negative count", () => {
    expect(editionCounts({ authorisedCount: -1, committedCount: -2 })).toEqual({
      approved: 0,
      soldOrReserved: 0,
      availableNow: 0,
    });
  });
});

describe("describeChange", () => {
  it("says more, fewer or no change against what is available now", () => {
    expect(describeChange(6, 3)).toBe("3 more");
    expect(describeChange(1, 3)).toBe("2 fewer");
    expect(describeChange(3, 3)).toBe("no change");
  });
});

describe("buildEditionsPage", () => {
  it("uses the seller's words and never Shop's internal ones", () => {
    const page = buildEditionsPage([edition()], []);
    const text = JSON.stringify(page);
    for (const word of ["authorised", "Authorised", "committed", "Committed", "grant", "party"]) {
      expect(text).not.toContain(word);
    }
    expect(page.rows[0]).toMatchObject({
      title: "Harbour Print",
      approved: 5,
      soldOrReserved: 2,
      availableNow: 3,
      lastApprovedOn: "1 Sept 2026",
      pending: null,
      action: { label: "Request more", current: 3 },
    });
    expect(page.totals).toEqual({
      availableNow: 3,
      soldOrReserved: 2,
      artworks: 1,
      pendingRequests: 0,
    });
  });

  it("shows a pending request on its row in place of the action", () => {
    const page = buildEditionsPage([edition()], [request({ note: "  For the autumn fair " })]);
    expect(page.rows[0]?.action).toBeNull();
    expect(page.rows[0]?.pending).toEqual({
      requestId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      summary: "Request pending: 3 more · sent 12 Oct 2026",
      note: "For the autumn fair",
    });
  });

  it("shows the seller LAX's reason for a declined request beside their own note", () => {
    const page = buildEditionsPage(
      [edition()],
      [
        request({
          status: "rejected",
          note: "For the autumn fair",
          declineReason: "  We need the signed consignment agreement first. ",
          handledAt: "2026-10-14T09:00:00Z",
        }),
      ],
    );
    expect(page.history[0]).toMatchObject({
      outcome: "Declined",
      note: "For the autumn fair",
      declineReason: "We need the signed consignment agreement first.",
    });
  });

  it("offers Change rather than Request more once the most Shop allows is listed", () => {
    const page = buildEditionsPage([edition({ authorisedCount: 10, committedCount: 0 })], []);
    expect(page.rows[0]?.action?.label).toBe("Change");
  });

  it("lists answered requests newest first, with their outcome in plain words", () => {
    const page = buildEditionsPage(
      [edition(), edition({ artworkId: ART_B, artworkTitle: "Low Tide" })],
      [
        request({
          requestId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          status: "approved",
          createdAt: "2026-08-01T09:00:00Z",
          handledAt: "2026-08-03T09:00:00Z",
        }),
        request({
          requestId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          artworkId: ART_B,
          artworkTitle: "Low Tide",
          requestedCount: 2,
          status: "rejected",
          createdAt: "2026-09-20T09:00:00Z",
          handledAt: "2026-09-22T09:00:00Z",
        }),
        request({
          requestId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3",
          status: "cancelled",
          createdAt: "2026-07-01T09:00:00Z",
          handledAt: "2026-07-02T09:00:00Z",
        }),
      ],
    );
    expect(page.history.map((row) => [row.title, row.outcome])).toEqual([
      ["Low Tide", "Declined"],
      ["Harbour Print", "Approved"],
      ["Harbour Print", "Withdrawn"],
    ]);
    expect(page.history[0]?.detail).toBe(
      "Asked for 2 available to sell · sent 20 Sept 2026 · answered 22 Sept 2026",
    );
    expect(page.history[2]?.detail).toContain("withdrawn 2 Jul 2026");
    expect(page.history.every((row) => row.declineReason === null)).toBe(true);
  });
});

describe("the request dialog's wording", () => {
  it("follows the direction of the change and blocks a request for no change", () => {
    expect(describeSaleRequestDraft(5, 3)).toMatchObject({
      title: "Request more editions",
      changeText: "2 more than now",
      canSubmit: true,
    });
    expect(describeSaleRequestDraft(1, 3)).toMatchObject({
      title: "Sell fewer editions",
      changeText: "2 fewer than now",
      canSubmit: true,
    });
    expect(describeSaleRequestDraft(3, 3)).toMatchObject({
      changeText: "The same as now",
      canSubmit: false,
    });
  });

  it("keeps a typed number inside what Shop accepts", () => {
    expect(clampAvailableToSell(14)).toBe(10);
    expect(clampAvailableToSell(-3)).toBe(0);
    expect(clampAvailableToSell(2.6)).toBe(3);
    expect(clampAvailableToSell(Number.NaN)).toBe(0);
  });
});
