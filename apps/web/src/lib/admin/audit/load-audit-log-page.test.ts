import { describe, expect, it, vi } from "vitest";
import { loadAdminAuditLogPage } from "./load-audit-log-page";

const { getLog } = vi.hoisted(() => ({ getLog: vi.fn() }));
vi.mock("@/lib/data/http/admin-audit.reader", () => ({ getAdminAuditLog: getLog }));

const viewer = { canOpenPlatformRoutes: true };
const event = (id: string) => ({
  id,
  aggregateType: "lot",
  aggregateId: "lot-1",
  eventType: "lot.created",
  payload: {},
  actorUserId: null,
  actingLegalEntityId: null,
  occurredAt: new Date("2026-10-24T09:00:00Z"),
  actor: null,
});

describe("loadAdminAuditLogPage", () => {
  it("passes the URL's filters to the API and pages by 50", async () => {
    getLog.mockResolvedValue({ rows: [event("1")], total: 120 });

    const page = await loadAdminAuditLogPage(
      {
        view: "catalogue",
        actor: "u1",
        action: "lot.created",
        entity: "lot",
        from: "2026-10-01",
        offset: "50",
      },
      viewer,
    );

    expect(getLog).toHaveBeenCalledWith({
      limit: 50,
      offset: 50,
      actorUserId: "u1",
      view: "catalogue",
      aggregateType: "lot",
      eventTypes: ["lot.created"],
      from: "2026-10-01",
    });
    expect(page.pagination?.summary).toBe("51–51 of 120 events");
    expect(page.pagination?.prevHref).not.toContain("offset=");
    expect(page.pagination?.nextHref).toContain("offset=100");
    expect(page.pagination?.nextHref).toContain("view=catalogue");
    expect(page.model.hasFilters).toBe(true);
    expect(page.loadError).toBeNull();
  });

  it("has no paging links when everything fits on one page", async () => {
    getLog.mockResolvedValue({ rows: [event("1"), event("2")], total: 2 });
    const page = await loadAdminAuditLogPage({}, viewer);
    expect(page.pagination).toEqual({ summary: "2 events", prevHref: null, nextHref: null });
    expect(page.model.hasFilters).toBe(false);
  });

  it("returns an empty page without paging for no events", async () => {
    getLog.mockResolvedValue({ rows: [], total: 0 });
    const page = await loadAdminAuditLogPage({ q: "zzz" }, viewer);
    expect(page.rows).toEqual([]);
    expect(page.pagination).toBeNull();
  });

  it("contains failures in a friendly message and keeps the filters", async () => {
    getLog.mockRejectedValue(new Error("Audit log unavailable: 500"));
    const page = await loadAdminAuditLogPage({ q: "ada" }, viewer);
    expect(page.loadError).toBe("The audit log could not be loaded. Try again in a moment.");
    expect(page.model.filters.q).toBe("ada");

    getLog.mockRejectedValue(new Error("forbidden"));
    expect((await loadAdminAuditLogPage({}, viewer)).loadError).toBe(
      "You do not have access to the audit log.",
    );
  });
});
