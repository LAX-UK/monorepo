import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  publicShell: vi.fn(),
  publicSecondary: vi.fn(),
  session: vi.fn(),
  personalShell: vi.fn(),
  personalSecondary: vi.fn(),
  withdrawn: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("@/lib/marketing/public-lot-page-data", () => ({
  loadPublicLotShell: m.publicShell,
  loadPublicLotSecondary: m.publicSecondary,
}));
vi.mock("@/lib/data/http/session.server", () => ({ getServerSessionUser: m.session }));
vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => ({
    lotPage: { loadShell: m.personalShell, loadSecondary: m.personalSecondary },
  }),
}));
vi.mock("@/lib/lot-page/load-withdrawn-lot.server", () => ({
  withdrawnLotPageExists: m.withdrawn,
}));
vi.mock("@/components/shell/restore-frame", () => ({ pendingRestore: m.restore }));
vi.mock("@/lib/catalog/public-catalog-visibility", () => ({
  isPublicCatalogLot: (lot: { hidden?: boolean }) => !lot.hidden,
  viewerCanSeeNonPublicCatalog: (role?: string | null) => role === "staff",
}));
vi.mock("@/lib/auth/client-audience", () => ({ usesBidAsClient: () => true }));
// The view model is the page's own; here it only has to carry the personal fields through.
vi.mock("@/lib/marketing/lot-page-vm", () => ({
  buildLotPageViewModel: ({ shell }: { shell: Record<string, unknown> }) => ({
    auction: shell.auction,
    session: shell.session,
    viewer: {
      isAuthenticated: Boolean(shell.session),
      canParticipateAsBuyer: true,
      isStaff: false,
    },
    watching: (shell.watchlist as Array<{ lotId: string }>).some((w) => w.lotId === "lot-1"),
    watchedLotIds: (shell.watchlist as Array<{ lotId: string }>).map((w) => w.lotId),
    isOwnLot: false,
    actingLegalEntityId: null,
    actingCtx: { needsRestore: false },
    biddingAccount: null,
    kycSummary: null,
    kycUnavailable: false,
    saleRegistrationBidGate: null,
    orgModuleEnabled: false,
    conditionReport: { session: { signedIn: Boolean(shell.session) } },
  }),
}));

const { GET } = await import("./route");

const lot = { id: "lot-1", title: "Study", saleId: null };
const publicShell = { auction: lot, session: null, watchlist: [], saleBundle: null };
const alice = { id: "user-alice", role: "client" };

async function get(id = "lot-1") {
  const res = await GET(new Request(`https://lax.bid/api/lots/${id}/me`), {
    params: Promise.resolve({ id }),
  });
  return { res, body: (await res.json()) as { data?: Record<string, unknown> } };
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.publicShell.mockResolvedValue(publicShell);
  m.publicSecondary.mockResolvedValue({});
  m.session.mockResolvedValue(null);
  m.personalShell.mockResolvedValue(null);
  m.personalSecondary.mockResolvedValue({});
  m.withdrawn.mockResolvedValue("missing");
  m.restore.mockResolvedValue(null);
});

describe("GET /api/lots/:id/me", () => {
  it("is never stored by a browser, CDN or proxy", async () => {
    const { res } = await get();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("answers a signed-out caller with the signed-out shape and reads nothing personal", async () => {
    const { res, body } = await get();
    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      isAuthenticated: false,
      currentUserId: null,
      sessionUser: null,
      watching: false,
      watchedLotIds: [],
      restore: null,
    });
    expect(m.personalShell).not.toHaveBeenCalled();
  });

  it("answers with the caller's own session and watchlist", async () => {
    m.session.mockResolvedValue(alice);
    m.personalShell.mockResolvedValue({
      ...publicShell,
      session: alice,
      watchlist: [{ lotId: "lot-1" }, { lotId: "lot-9" }],
    });
    const { body } = await get();
    expect(body.data).toMatchObject({
      isAuthenticated: true,
      currentUserId: "user-alice",
      watching: true,
      watchedLotIds: ["lot-1", "lot-9"],
    });
  });

  it("gives another person only their own data", async () => {
    const bob = { id: "user-bob", role: "client" };
    m.session.mockResolvedValue(bob);
    m.personalShell.mockResolvedValue({ ...publicShell, session: bob, watchlist: [] });
    const { body } = await get();
    expect(body.data).toMatchObject({ currentUserId: "user-bob", watching: false });
    expect(JSON.stringify(body)).not.toContain("user-alice");
  });

  it("is a 404 for a lot the public cannot see, signed out or as a client", async () => {
    m.publicShell.mockResolvedValue({ ...publicShell, auction: { ...lot, hidden: true } });
    expect((await get()).res.status).toBe(404);
    m.session.mockResolvedValue(alice);
    expect((await get()).res.status).toBe(404);
    expect(m.personalShell).not.toHaveBeenCalled();
  });

  it("tells a browser that must first be put in its account where to hop", async () => {
    m.session.mockResolvedValue(alice);
    m.personalShell.mockResolvedValue({ ...publicShell, session: alice, watchlist: [] });
    m.restore.mockResolvedValue({ step: "hop", href: "/accounts/restore?next=%2Flot" });
    const { body } = await get();
    expect(body.data?.restore).toEqual({ step: "hop", href: "/accounts/restore?next=%2Flot" });
  });
});
