import type { Lot } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { AuthzError } from "../lib/errors.js";
import { createLotRoutes } from "../routes/lots.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { stubBiddingRouteServices } from "../testing/stub-bidding-route-services.js";
import { stubCatalogRouteServices } from "../testing/stub-catalog-route-services.js";

const lotId = "00000000-0000-4000-8000-000000000001";

const noAuth: IAuthenticator = { getSessionUser: async () => null };

const adminAuth: IAuthenticator = {
  getSessionUser: async () => ({ id: "ad", role: "staff", staffRole: "super_admin" }),
};

const userAuth: IAuthenticator = {
  getSessionUser: async () => ({ id: "u1", role: "client" }),
};

const sampleLot: Lot = {
  id: lotId,
  saleId: null,
  lotNumber: 1,
  sellerId: "s1",
  title: "T",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "00000000-0000-4000-8000-0000000000c0",
  auctionType: "english",
  startingPrice: "1",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "1",
  buyerPremiumRate: "0.25",
  minBidIncrement: "1",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: { artistNote: "hello" },
};

const marketingPayload = { artistNote: "hello" };

function makeContainer() {
  const updateMarketingDetails = vi.fn(async (input: { role: string }) => {
    if (input.role !== "staff") {
      return {
        kind: "err" as const,
        error: new AuthzError("Only staff can update marketing details", 403),
      };
    }
    return { kind: "ok" as const, data: sampleLot };
  });
  const base = stubCatalogRouteServices();
  return {
    redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), ping: vi.fn() },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    lotService: {
      getById: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      countMatching: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      publish: vi.fn(),
      cancel: vi.fn(),
      archiveEndedSummary: vi.fn().mockResolvedValue({ total: "0", count: 0 }),
    },
    bidService: { listForLot: vi.fn() },
    catalogRoutes: stubCatalogRouteServices({
      lotLifecycleHttp: { ...base.lotLifecycleHttp, updateMarketingDetails },
    }),
    bidding: stubBiddingRouteServices(),
    env: {},
    kycService: { isConfigured: () => false },
    requireSubmissionsLegalEntityContext: vi.fn(),
    lotSoftDeleteService: { getDeleteEligibility: vi.fn() },
    saleService: { getById: vi.fn() },
    mediaUrlResolver: {},
    lotLifecycleQueryService: { getSnapshotsForLots: vi.fn() },
  } as unknown as Container;
}

function mount(authenticator: IAuthenticator, container: Container) {
  return new Hono().route("/lots", createLotRoutes(container, authenticator));
}

describe("PUT /lots/:id/marketing-details", () => {
  it("returns 401 without session", async () => {
    const app = mount(noAuth, makeContainer());
    const res = await app.request(`http://t/lots/${lotId}/marketing-details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(marketingPayload),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const app = mount(userAuth, makeContainer());
    const res = await app.request(`http://t/lots/${lotId}/marketing-details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(marketingPayload),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 for admin with valid body", async () => {
    const app = mount(adminAuth, makeContainer());
    const res = await app.request(`http://t/lots/${lotId}/marketing-details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(marketingPayload),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { marketingDetails: unknown } };
    expect(body.data.marketingDetails).toEqual({ artistNote: "hello" });
  });

  it("returns 400 for invalid downloadUrl in body", async () => {
    const app = mount(adminAuth, makeContainer());
    const res = await app.request(`http://t/lots/${lotId}/marketing-details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conditionReport: { downloadUrl: "not a url" } }),
    });
    expect(res.status).toBe(400);
  });
});
