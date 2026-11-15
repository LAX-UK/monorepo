import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const reader = vi.hoisted(() => ({
  getAdminDataRequests: vi.fn(),
  getAdminDataRequestSummary: vi.fn(),
  getAdminDataRequestErasureHolds: vi.fn(),
}));
vi.mock("@/lib/data/http/admin-data-requests.reader", () => reader);

const { loadAdminDataRequestsPage } = await import("./load-data-requests-page");

const FLAG = { reference: "DR-0004", reason: "end_unknown", heldUntil: null };

describe("loadAdminDataRequestsPage held erasures", () => {
  beforeEach(() => {
    reader.getAdminDataRequests.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    reader.getAdminDataRequestSummary.mockResolvedValue(null);
  });

  it("carries the flags, and reads as checked, when the read worked", async () => {
    reader.getAdminDataRequestErasureHolds.mockResolvedValue([FLAG]);
    expect(await loadAdminDataRequestsPage({})).toMatchObject({
      erasureHolds: [FLAG],
      erasureHoldsUnreadable: false,
    });
  });

  it("tells none held apart from could not check", async () => {
    reader.getAdminDataRequestErasureHolds.mockResolvedValue([]);
    expect(await loadAdminDataRequestsPage({})).toMatchObject({ erasureHoldsUnreadable: false });
    reader.getAdminDataRequestErasureHolds.mockResolvedValue(null);
    expect(await loadAdminDataRequestsPage({})).toMatchObject({
      erasureHolds: [],
      erasureHoldsUnreadable: true,
    });
    reader.getAdminDataRequestErasureHolds.mockRejectedValue(new Error("down"));
    expect(await loadAdminDataRequestsPage({})).toMatchObject({ erasureHoldsUnreadable: true });
  });

  it("still says so when the list itself fails", async () => {
    reader.getAdminDataRequests.mockRejectedValue(new Error("down"));
    reader.getAdminDataRequestErasureHolds.mockResolvedValue(null);
    expect(await loadAdminDataRequestsPage({})).toMatchObject({
      list: null,
      erasureHoldsUnreadable: true,
    });
  });
});
