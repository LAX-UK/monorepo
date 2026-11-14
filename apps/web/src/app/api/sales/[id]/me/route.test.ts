import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const reads = vi.hoisted(() => ({
  publicShell: vi.fn(),
  staffShell: vi.fn(),
  session: vi.fn(),
  follow: vi.fn(),
  kyc: vi.fn(),
  watched: vi.fn(),
  telephone: vi.fn(),
  acting: vi.fn(),
  regs: vi.fn(),
}));
vi.mock("@/lib/data/http/public-catalogue.server", () => ({
  getPublicSaleShell: reads.publicShell,
}));
vi.mock("@/lib/data/http/sales.server", () => ({
  getServerSaleShell: reads.staffShell,
  getServerSaleMyRegistrations: reads.regs,
}));
vi.mock("@/lib/data/http/session.server", () => ({ getServerSessionUser: reads.session }));
vi.mock("@/lib/data/http/saleroom.server", () => ({ getServerSaleFollowState: reads.follow }));
vi.mock("@/lib/data/http/kyc.server", () => ({ getServerKycStatusSummary: reads.kyc }));
vi.mock("@/lib/data/http/watchlist.server", () => ({ getServerWatchedLotIdSet: reads.watched }));
vi.mock("@/lib/data/http/telephone-booking.server", () => ({
  getServerTelephoneBookingForSale: reads.telephone,
}));
vi.mock("@/lib/legal-entity/acting-context.server", () => ({ lookupActingContext: reads.acting }));
vi.mock("@/lib/legal-entity/org-module-host.server", () => ({
  resolveOrgModuleEnabledFromRequest: async () => true,
}));
vi.mock("@/lib/catalog/public-catalog-visibility", () => ({
  isPublicCatalogSale: (sale: { hidden?: boolean }) => !sale.hidden,
  viewerCanSeeNonPublicCatalog: (role?: string | null) => role === "staff",
}));

const { GET } = await import("./route");
const { SIGNED_OUT_SALE_VIEWER } = await import("@/lib/marketing/sale-viewer");

const publicSale = { id: "s1", status: "active", deliveryMode: "online" };
const alice = { id: "user-alice", role: "client", kycStatus: "approved" };

async function get(id = "s1") {
  const res = await GET(new Request(`https://lax.bid/api/sales/${id}/me`), {
    params: Promise.resolve({ id }),
  });
  return { res, body: (await res.json()) as { data?: Record<string, unknown> } };
}

beforeEach(() => {
  for (const fn of Object.values(reads)) fn.mockReset();
  reads.publicShell.mockResolvedValue({ sale: publicSale, resultsSummary: null });
  reads.staffShell.mockResolvedValue(null);
  reads.session.mockResolvedValue(null);
  reads.follow.mockResolvedValue({ isFollowing: true });
  reads.kyc.mockResolvedValue(null);
  reads.watched.mockResolvedValue(new Set(["lot-a"]));
  reads.telephone.mockResolvedValue(null);
  reads.acting.mockResolvedValue({ ok: true, context: { memberships: [] } });
  reads.regs.mockResolvedValue([]);
});

describe("GET /api/sales/:id/me", () => {
  it("is never stored by a browser, CDN or proxy", async () => {
    const { res } = await get();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("answers a signed-out caller with the signed-out shape and reads nothing personal", async () => {
    const { res, body } = await get();
    expect(res.status).toBe(200);
    expect(body.data).toEqual(JSON.parse(JSON.stringify(SIGNED_OUT_SALE_VIEWER)));
    expect(reads.follow).not.toHaveBeenCalled();
    expect(reads.watched).not.toHaveBeenCalled();
    expect(reads.regs).not.toHaveBeenCalled();
  });

  it("answers with the caller's own follow and watch state", async () => {
    reads.session.mockResolvedValue(alice);
    const { body } = await get();
    expect(body.data).toMatchObject({
      isAuthenticated: true,
      isFollowing: true,
      watchedLotIds: ["lot-a"],
      kycApproved: true,
    });
  });

  it("gives another person only their own data", async () => {
    reads.session.mockResolvedValue({ id: "user-bob", role: "client" });
    reads.follow.mockResolvedValue({ isFollowing: false });
    reads.watched.mockResolvedValue(new Set());
    const { body } = await get();
    expect(body.data).toMatchObject({ isFollowing: false, watchedLotIds: [] });
    expect(JSON.stringify(body)).not.toContain("user-alice");
    expect(JSON.stringify(body)).not.toContain("lot-a");
  });

  it("is a 404 for a sale the public cannot see, signed out or as a client", async () => {
    reads.publicShell.mockResolvedValue(null);
    expect((await get("hidden")).res.status).toBe(404);

    reads.session.mockResolvedValue(alice);
    reads.staffShell.mockResolvedValue({ sale: { ...publicSale, hidden: true } });
    expect((await get("hidden")).res.status).toBe(404);
    expect(reads.staffShell).not.toHaveBeenCalled();
  });

  it("lets staff read their part of a sale they may preview", async () => {
    reads.publicShell.mockResolvedValue({ sale: { ...publicSale, hidden: true } });
    reads.session.mockResolvedValue({ id: "staff-1", role: "staff" });
    reads.staffShell.mockResolvedValue({ sale: { ...publicSale, hidden: true } });
    const { res } = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
