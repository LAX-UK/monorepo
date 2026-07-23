import { describe, expect, it, vi } from "vitest";
import { loadAdminInvitationsListPage } from "./load-invitations-list-page";

const { getPage } = vi.hoisted(() => ({
  getPage: vi.fn(),
}));

vi.mock("@/lib/data/http/invitations.reader", () => ({
  getAdminInvitationsPage: getPage,
}));

describe("loadAdminInvitationsListPage", () => {
  it("returns authoritative summary and hydrates query cache", async () => {
    getPage.mockResolvedValue({
      rows: [{ id: "inv-1", email: "alice@example.com" }],
      total: 40,
      offset: 25,
      limit: 25,
      summary: { total: 40, pending: 10, accepted: 30 },
      hasNextPage: false,
      pendingTotal: 10,
      acceptedTotal: 30,
    });

    const result = await loadAdminInvitationsListPage({ offset: "25", status: "pending" });

    expect(result.loadError).toBeNull();
    expect(result.summary.pending).toBe(10);
    expect(result.dehydratedState).toBeDefined();
    expect(result.model.hasFilters).toBe(true);
  });

  it("contains list failures and preserves the page model", async () => {
    getPage.mockRejectedValue(new Error("Invitations unavailable"));

    const result = await loadAdminInvitationsListPage({ q: "alice" });

    expect(result.loadError).toBe("Invitations unavailable");
    expect(result.rows).toEqual([]);
    expect(result.summary.total).toBe(0);
    expect(result.model.hasFilters).toBe(true);
  });
});
