import type { Lot, Sale } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createLotRoutes } from "./lots.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const saleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_COOKIE = "better-auth.session_token=test-session-token-fixture";

type Viewer = { id: string; role: string; staffRole?: string } | null;

function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: lotId,
    saleId,
    lotNumber: 1,
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    auctionType: "sealed",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "5000.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-06-01T12:00:00.000Z"),
    endTime: new Date("2026-06-02T12:00:00.000Z"),
    status: "active",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

async function getLotDetail(lotRow: Lot, viewer: Viewer) {
  const app = new Hono();
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    lotService: { getById: vi.fn().mockResolvedValue(lotRow), listLotsForPublicApi: vi.fn() },
    saleService: {
      getByIdForPublicCatalog: vi.fn().mockResolvedValue({
        id: saleId,
        status: "active",
        deliveryMode: "online",
        allowOnlineBidsBeforeGoLive: true,
        buyerPremiumTiers: null,
      } as unknown as Sale),
      findByIds: vi.fn().mockResolvedValue([]),
    },
    mediaUrlResolver: {
      resolve: vi.fn(async (url: string) => url),
      resolveMany: vi.fn(async (urls: string[]) => urls),
    },
    lotSoftDeleteService: { getDeleteEligibility: vi.fn().mockResolvedValue(null) },
    redis: null,
    env: {},
    kycService: null,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(viewer),
  };
  app.route("/lots", createLotRoutes(container, authenticator));
  const res = await app.request(`http://t/lots/${lotId}`, {
    headers: viewer ? { cookie: SESSION_COOKIE } : {},
  });
  expect(res.status).toBe(200);
  const text = await res.text();
  return { text, data: (JSON.parse(text) as { data: Record<string, unknown> }).data };
}

const anonymous: Viewer = null;
const bidder: Viewer = { id: "user-1", role: "client" };
const auctionManager: Viewer = { id: "staff-1", role: "staff", staffRole: "auction_manager" };

describe("GET /lots/:id checkout pricing for sealed lots", () => {
  for (const [label, viewer] of [
    ["anonymous", anonymous],
    ["signed-in client", bidder],
  ] as const) {
    it(`does not derive any figure from the hidden sealed price (${label})`, async () => {
      const { data, text } = await getLotDetail(lot(), viewer);
      expect(data.currentPrice).toBe("100.00");
      expect(data.checkoutPricing).toMatchObject({
        hammerMajor: "100.00",
        premiumMajor: "25.00",
        totalMajor: "125.00",
      });
      // Real price 5000.00 → premium 1250.00 → total 6250.00; none may appear anywhere.
      expect(text).not.toMatch(/5000|1250|6250/);
    });
  }

  it("keeps real sealed figures for auction staff", async () => {
    const { data } = await getLotDetail(lot(), auctionManager);
    expect(data.currentPrice).toBe("5000.00");
    expect(data.checkoutPricing).toMatchObject({
      hammerMajor: "5000.00",
      premiumMajor: "1250.00",
      totalMajor: "6250.00",
    });
  });

  it("leaves non-sealed lots unchanged for the public", async () => {
    const { data } = await getLotDetail(lot({ auctionType: "english" }), anonymous);
    expect(data.currentPrice).toBe("5000.00");
    expect(data.checkoutPricing).toMatchObject({
      hammerMajor: "5000.00",
      totalMajor: "6250.00",
    });
  });

  it("leaves ended sealed lots unchanged for the public", async () => {
    const { data } = await getLotDetail(lot({ status: "ended" }), anonymous);
    expect(data.currentPrice).toBe("5000.00");
    expect(data.checkoutPricing).toMatchObject({ hammerMajor: "5000.00" });
  });
});
