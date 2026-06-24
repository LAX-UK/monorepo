import type { Lot } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createLotRoutes } from "./lots.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_COOKIE = "better-auth.session_token=test-session-token-fixture";

function draftLot(): Lot {
  return {
    id: lotId,
    saleId: null,
    lotNumber: 1,
    title: "Draft lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-06-01T12:00:00.000Z"),
    endTime: new Date("2026-06-02T12:00:00.000Z"),
    status: "draft",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
  };
}

function activeLot(): Lot {
  return {
    ...draftLot(),
    status: "active",
    reservePrice: "27000.00",
    currentPrice: "1101.00",
    saleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  };
}

function mount(
  user: { id: string; role: string; staffRole?: string } | null,
  lot: Lot = draftLot(),
) {
  const app = new Hono();
  const listLotsForPublicApi = vi.fn().mockResolvedValue({ data: [] });
  const getById = vi.fn().mockResolvedValue(lot);
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    lotService: { getById, listLotsForPublicApi },
    saleService: {
      getById: vi.fn().mockResolvedValue(null),
      findByIds: vi.fn().mockResolvedValue([]),
    },
    mediaUrlResolver: {
      resolve: vi.fn(async (url: string) => url),
      resolveMany: vi.fn(async (urls: string[]) => urls),
    },
    lotSoftDeleteService: { getDeleteEligibility: vi.fn() },
    lotLifecycleQueryService: { getSnapshotsForLots: vi.fn().mockResolvedValue(new Map()) },
    cachedCatalogueListService: {
      buildKey: (_route: string, query: Record<string, unknown>) => JSON.stringify(query),
      getOrLoad: async (_key: string, load: () => Promise<unknown>) => load(),
    },
    redis: null,
    env: {},
    kycService: null,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(user),
  };
  app.route("/lots", createLotRoutes(container, authenticator));
  return { app, listLotsForPublicApi, getById };
}

describe("lots public contract", () => {
  it("lists via listLotsForPublicApi for anonymous callers", async () => {
    const { app, listLotsForPublicApi } = mount(null);
    const res = await app.request("http://t/lots?limit=10");
    expect(res.status).toBe(200);
    expect(listLotsForPublicApi).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
      undefined,
      undefined,
    );
  });

  it("returns 403 for needsPhotos when caller cannot manage catalogue", async () => {
    const { app } = mount(null);
    const res = await app.request("http://t/lots?needsPhotos=1");
    expect(res.status).toBe(403);
  });

  it("returns 404 for draft lot detail when anonymous", async () => {
    const { app } = mount(null);
    const res = await app.request(`http://t/lots/${lotId}`);
    expect(res.status).toBe(404);
  });

  it("strips reservePrice from public lot detail for anonymous callers", async () => {
    const saleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const lot = activeLot();
    const app = new Hono();
    const getById = vi.fn().mockResolvedValue(lot);
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      lotService: { getById, listLotsForPublicApi: vi.fn() },
      saleService: {
        getById: vi.fn().mockResolvedValue({
          id: saleId,
          status: "active",
          deliveryMode: "online",
          allowOnlineBidsBeforeGoLive: true,
        }),
        findByIds: vi.fn().mockResolvedValue([]),
      },
      mediaUrlResolver: {
        resolve: vi.fn(async (url: string) => url),
        resolveMany: vi.fn(async (urls: string[]) => urls),
      },
      lotSoftDeleteService: { getDeleteEligibility: vi.fn() },
      lotLifecycleQueryService: { getSnapshotsForLots: vi.fn().mockResolvedValue(new Map()) },
      cachedCatalogueListService: {
        buildKey: (_route: string, query: Record<string, unknown>) => JSON.stringify(query),
        getOrLoad: async (_key: string, load: () => Promise<unknown>) => load(),
      },
      redis: null,
      env: {},
      kycService: null,
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    };
    app.route("/lots", createLotRoutes(container, authenticator));

    const res = await app.request(`http://t/lots/${lotId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).not.toHaveProperty("reservePrice");
    expect(body.data).toMatchObject({
      hasReserve: true,
      reserveMet: false,
      currentPrice: "1101.00",
    });
  });

  it("returns 200 for draft lot detail when catalogue staff", async () => {
    const { app } = mount({ id: "staff-1", role: "staff", staffRole: "catalogue_manager" });
    const res = await app.request(`http://t/lots/${lotId}`, {
      headers: { cookie: SESSION_COOKIE },
    });
    expect(res.status).toBe(200);
  });

  it("preserves ended archive list when status=ended", async () => {
    const { app, listLotsForPublicApi } = mount(null);
    const res = await app.request("http://t/lots?status=ended&limit=5");
    expect(res.status).toBe(200);
    expect(listLotsForPublicApi).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ended" }),
      undefined,
      undefined,
    );
  });
});
