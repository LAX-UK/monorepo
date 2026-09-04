import type { IBidRepository, ILotRepository } from "@auction/persistence/interfaces";
import type { IWatchlistRepository } from "@auction/persistence/interfaces";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { LotService } from "../services/lot.service.js";
import { stubCatalogRouteServices } from "../testing/stub-catalog-route-services.js";
import { createLotRoutes } from "./lots.js";

const lotId = "11111111-1111-4111-8111-111111111111";
const bidderId = "bidder-1";
const RESOURCE_AUTHORIZATION = "Bearer test-lax-bid-api-token";

function mount(user: { id: string; role: string; staffRole?: string } | null) {
  const app = new Hono();
  const lotServiceCreate = vi.fn();
  const lotRepo: ILotRepository = {
    findById: vi.fn().mockResolvedValue({ id: lotId, auctionType: "english", status: "active" }),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as ILotRepository;
  const bids: IBidRepository = {
    listForLot: vi.fn().mockResolvedValue([
      {
        id: "bid-1",
        lotId,
        placedByUserId: bidderId,
        buyerLegalEntityId: "22222222-2222-4222-8222-222222222222",
        amount: "100.00",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: new Date(),
      },
    ]),
  } as unknown as IBidRepository;
  const watchlist = {} as unknown as IWatchlistRepository;
  const lotCore = new LotService({
    lotRepo,
    bids,
    watchlist,
    jobScheduler: null,
    lotNotifications: null,
  });
  const lotService = Object.assign(lotCore, { create: lotServiceCreate });
  const base = stubCatalogRouteServices();
  const createMock = vi.fn(async (input: { userId: string; body: unknown }) => {
    const r = await lotServiceCreate(input.userId, input.body);
    if (r && typeof r === "object" && "isErr" in r && r.isErr()) {
      return { kind: "err" as const, error: r.error as Error };
    }
    const value =
      r && typeof r === "object" && "value" in r
        ? (r.value as { id: string; marketingDetails: object; images: string[] })
        : { id: "lot-1", marketingDetails: {}, images: [] };
    return { kind: "ok" as const, data: value, status: 201 as const };
  });
  const create = createMock as typeof base.lotLifecycleHttp.create;
  const listForLot = vi.fn(async (input: Parameters<typeof lotCore.listBidsForPublicApi>[0]) => {
    const result = await lotCore.listBidsForPublicApi(input);
    if (result.kind === "not_found") return { kind: "not_found" as const };
    return { kind: "ok" as const, data: result.data };
  });
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    lotService,
    mediaUrlResolver: { resolveMany: vi.fn().mockResolvedValue([]) },
    catalogRoutes: stubCatalogRouteServices({
      lotLifecycleHttp: { ...base.lotLifecycleHttp, create },
    }),
    bidding: {
      lotBidHistoryHttp: { listForLot },
      placeBidHttp: { placeBid: vi.fn() },
      autoBidHttp: {},
      absenteeBidHttp: {},
      saleRegistrationHttp: {},
      conditionReportHttp: {},
    },
    env: {},
    redis: {},
    kycService: { isConfigured: () => false },
    requireSubmissionsLegalEntityContext: vi.fn(),
    db: {},
    objectStorage: {},
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue(user ? { ...user, scopes: ["bid.read", "bid.write"] } : null),
  };
  app.route("/lots", createLotRoutes(container, authenticator));
  return { app, lotServiceCreate, create: createMock };
}

describe("lot bid history privacy", () => {
  it("redacts bidder user ids for anonymous readers", async () => {
    const res = await mount(null).app.request(`/lots/${lotId}/bids`);
    const body = (await res.json()) as {
      data: Array<{ placedByUserId: string | null; bidderRef: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.data[0]?.placedByUserId).toBeNull();
    expect(body.data[0]?.bidderRef).toMatch(/^[a-f0-9]{16}$/);
  });

  it("keeps bidder user id visible to the bidder", async () => {
    const res = await mount({ id: bidderId, role: "client" }).app.request(`/lots/${lotId}/bids`, {
      headers: { authorization: RESOURCE_AUTHORIZATION },
    });
    const body = (await res.json()) as { data: Array<{ placedByUserId: string | null }> };

    expect(res.status).toBe(200);
    expect(body.data[0]?.placedByUserId).toBe(bidderId);
  });

  it("keeps bidder user id visible to administrators", async () => {
    const res = await mount({ id: "admin-1", role: "staff", staffRole: "super_admin" }).app.request(
      `/lots/${lotId}/bids`,
      { headers: { authorization: RESOURCE_AUTHORIZATION } },
    );
    const body = (await res.json()) as { data: Array<{ placedByUserId: string | null }> };

    expect(res.status).toBe(200);
    expect(body.data[0]?.placedByUserId).toBe(bidderId);
  });
});

describe("POST /lots persists artistId from request body", () => {
  const sellerLegalEntityId = "33333333-3333-4333-8333-333333333333";
  const artistId = "44444444-4444-4444-8444-444444444444";
  const categoryId = "55555555-5555-4555-8555-555555555555";
  const saleId = "66666666-6666-4666-8666-666666666666";

  function buildBody(overrides: Record<string, unknown> = {}) {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      sellerLegalEntityId,
      saleId,
      title: "Test Lot",
      categoryIds: [categoryId],
      auctionType: "english",
      startingPrice: "100.00",
      reservePrice: "100.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      ...overrides,
    };
  }

  it("forwards artistId straight through to the lot service", async () => {
    const { app, lotServiceCreate } = mount({
      id: "admin-1",
      role: "staff",
      staffRole: "super_admin",
    });
    lotServiceCreate.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { id: "lot-1", marketingDetails: {}, images: [] },
    });

    const res = await app.request("/lots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBody({ artistId })),
    });

    expect(res.status).toBe(201);
    expect(lotServiceCreate).toHaveBeenCalledWith("admin-1", expect.objectContaining({ artistId }));
  });

  it("rejects non-administrator callers", async () => {
    const { AuthzError } = await import("../lib/errors.js");
    const { app, lotServiceCreate, create } = mount({ id: "user-1", role: "client" });
    create.mockResolvedValue({
      kind: "err",
      error: new AuthzError(
        "Only staff with auction.manage or catalogue.write can create lots",
        403,
      ),
    });

    const res = await app.request("/lots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBody({ artistId })),
    });

    expect(res.status).toBe(403);
    expect(lotServiceCreate).not.toHaveBeenCalled();
  });
});
