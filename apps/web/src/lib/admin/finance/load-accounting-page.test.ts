import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountingRow } from "./accounting-queue.fixture";

const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin-accounting.reader", () => ({ getAccountingQueuePage: getPage }));

const { loadAdminAccountingPage } = await import("./load-accounting-page");

const counts = { needs_person: 1, failed: 120, waiting: 0, issued: 3 };

function page(overrides: object = {}) {
  return {
    tab: "failed",
    organisation: null,
    reference: null,
    rows: [accountingRow()],
    total: 120,
    counts,
    issuedToday: 2,
    lastSent: { at: "2026-11-11T09:00:00.000Z", rehearsal: false },
    limit: 50,
    offset: 0,
    unreadable: 0,
    canAct: true,
    ...overrides,
  };
}

describe("loadAdminAccountingPage", () => {
  beforeEach(() => {
    getPage.mockReset();
  });

  it("reads the tab, company and page from the URL and pages through a long list", async () => {
    getPage.mockResolvedValue(page({ offset: 50, rows: Array(50).fill(accountingRow()) }));
    const loaded = await loadAdminAccountingPage({
      tab: "failed",
      organisation: "london_art_exchange",
      offset: "50",
    });
    expect(getPage).toHaveBeenCalledWith({
      tab: "failed",
      organisation: "london_art_exchange",
      reference: null,
      limit: 50,
      offset: 50,
    });
    expect(loaded).toMatchObject({
      tab: "failed",
      filtered: true,
      canAct: true,
      loadError: null,
      issuedToday: 2,
      lastSent: { at: "2026-11-11T09:00:00.000Z", rehearsal: false },
    });
    expect(loaded.pagination).toEqual({
      summary: "51–100 of 120 documents",
      prevHref: "/admin/finance/accounting?tab=failed&organisation=london_art_exchange&offset=0",
      nextHref: "/admin/finance/accounting?tab=failed&organisation=london_art_exchange&offset=100",
    });
  });

  it("passes a valid LAX reference to the API and marks the list filtered", async () => {
    getPage.mockResolvedValue(page());
    const loaded = await loadAdminAccountingPage({ reference: "  LAX-BID-INV-01hx3 " });
    expect(getPage).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "LAX-BID-INV-01hx3" }),
    );
    expect(loaded).toMatchObject({
      reference: "LAX-BID-INV-01hx3",
      referenceError: null,
      filtered: true,
    });
  });

  it("rejects a search that is not a LAX reference without troubling the API", async () => {
    const loaded = await loadAdminAccountingPage({ reference: "not a reference" });
    expect(getPage).not.toHaveBeenCalled();
    expect(loaded.rows).toEqual([]);
    expect(loaded.referenceError).toMatch(/LAX reference/);
    expect(loaded.filtered).toBe(true);
  });

  it("has no pagination for an empty tab, and passes view-only access through", async () => {
    getPage.mockResolvedValue(page({ rows: [], total: 0, canAct: false }));
    const loaded = await loadAdminAccountingPage({});
    expect(getPage).toHaveBeenCalledWith(
      expect.objectContaining({ tab: "needs_person", organisation: null }),
    );
    expect(loaded).toMatchObject({ rows: [], pagination: null, canAct: false, filtered: false });
  });

  it("notes a rehearsal and unreadable rows", async () => {
    getPage.mockResolvedValue(
      page({ rows: [accountingRow({ targetMode: "dry_run" })], unreadable: 2 }),
    );
    const loaded = await loadAdminAccountingPage({});
    expect(loaded).toMatchObject({ rehearsal: true, unreadable: 2 });
  });

  it("shows a plain error instead of the rows when the API cannot be reached or refuses", async () => {
    getPage.mockRejectedValue(new Error("Accounting unavailable: 503"));
    expect(await loadAdminAccountingPage({})).toMatchObject({
      rows: [],
      canAct: false,
      loadError: "We could not reach the accounting service. Try again in a moment.",
    });
    getPage.mockRejectedValue(new Error("forbidden"));
    expect((await loadAdminAccountingPage({})).loadError).toBe(
      "You do not have access to accounting documents.",
    );
  });
});
