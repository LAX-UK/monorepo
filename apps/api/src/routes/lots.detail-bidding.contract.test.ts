import type { Lot, Sale } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createCatalogLotReadHttpFixture } from "../testing/catalog-lot-read-http-fixture.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { stubBiddingRouteServices } from "../testing/stub-bidding-route-services.js";
import { stubCatalogRouteServices } from "../testing/stub-catalog-route-services.js";
import { createLotRoutes } from "./lots.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const saleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-11-03T20:00:00.000Z");

function lot(over: Partial<Lot> = {}): Lot {
  return {
    id: lotId,
    saleId,
    lotNumber: 4,
    title: "Estuary, evening",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    auctionType: "english",
    startingPrice: "4200.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "7000.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "250.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-11-01T12:00:00.000Z"),
    endTime: new Date("2026-11-03T21:00:00.000Z"),
    status: "active",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...over,
  };
}

function sale(over: Partial<Sale> = {}): Partial<Sale> {
  return { id: saleId, status: "active", deliveryMode: "online", ...over };
}

async function getDetail(row: Lot, saleRow: Partial<Sale> = sale()) {
  const app = new Hono();
  const lotReadHttp = createCatalogLotReadHttpFixture({
    lotService: {
      getById: vi.fn().mockResolvedValue(row),
      listLotsForPublicApi: vi.fn(),
      countMatching: vi.fn(),
      archiveEndedSummary: vi.fn(),
    },
    saleService: {
      getByIdForPublicCatalog: vi.fn().mockResolvedValue(saleRow),
      findByIds: vi.fn().mockResolvedValue([]),
    },
    cachedCatalogueListService: {} as never,
    now: () => NOW,
  });
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    catalogRoutes: stubCatalogRouteServices({ lotReadHttp }),
    redis: null,
    env: {},
    kycService: null,
    bidding: stubBiddingRouteServices(),
    requireSubmissionsLegalEntityContext: vi.fn(),
  } as unknown as Container;
  const authenticator: IAuthenticator = { getSessionUser: vi.fn().mockResolvedValue(null) };
  app.route("/lots", createLotRoutes(container, authenticator, passThroughAccountOnboarding));
  const res = await app.request(`http://t/lots/${lotId}`);
  return { res, body: (await res.json()) as { data: Record<string, unknown> } };
}

describe("GET /lots/:id bidding facts", () => {
  it("says when a late bid extended the close, and null when none did", async () => {
    const extended = await getDetail(
      lot({
        endTime: new Date("2026-11-03T21:02:00.000Z"),
        extendedUntil: new Date("2026-11-03T21:02:00.000Z"),
      }),
    );
    expect(extended.body.data).toMatchObject({
      endTime: "2026-11-03T21:02:00.000Z",
      extendedUntil: "2026-11-03T21:02:00.000Z",
    });
    const plain = await getDetail(lot());
    expect(plain.body.data).toMatchObject({ extendedUntil: null });
  });

  it("always carries real timing and the server clock", async () => {
    const { res, body } = await getDetail(lot());
    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      startTime: "2026-11-01T12:00:00.000Z",
      endTime: "2026-11-03T21:00:00.000Z",
      serverNow: "2026-11-03T20:00:00.000Z",
    });
  });

  it("returns the next bid and the next 20 valid amounts from the increment", async () => {
    const { body } = await getDetail(lot());
    expect(body.data.nextBidAmount).toBe("7250.00");
    const amounts = body.data.validBidAmounts as string[];
    expect(amounts).toHaveLength(20);
    expect(amounts.slice(0, 2)).toEqual(["7250.00", "7500.00"]);
  });

  it("returns a flat buyer's premium, or bands when the sale sets them", async () => {
    const flat = await getDetail(lot());
    expect(flat.body.data.buyersPremium).toEqual({ kind: "flat", rate: "0.25" });

    const banded = await getDetail(
      lot(),
      sale({
        buyerPremiumTiers: [
          { hammerThresholdMinor: 0, rate: "0.2" },
          { hammerThresholdMinor: 50_000_000, rate: "0.1" },
        ],
      }),
    );
    expect(banded.body.data.buyersPremium).toEqual({
      kind: "banded",
      bands: [
        { fromHammer: "0.00", rate: "0.2" },
        { fromHammer: "500000.00", rate: "0.1" },
      ],
    });
  });

  it("exposes the hammer and the price with premium on an ended sold lot, and no next bid", async () => {
    const { body } = await getDetail(
      lot({ status: "ended", winnerId: "user-1", currentPrice: "7000.00" }),
    );
    expect(body.data).toMatchObject({
      hammerPrice: "7000.00",
      soldForWithPremium: "8750.00",
      nextBidAmount: null,
      validBidAmounts: [],
    });
  });

  it("keeps the last bid of an unsold lot out of the result", async () => {
    const { body } = await getDetail(lot({ status: "ended", winnerId: null }));
    expect(body.data).toMatchObject({ hammerPrice: null, soldForWithPremium: null });
  });

  it("never reveals a sealed lot's current price through the next bid", async () => {
    const { body } = await getDetail(lot({ auctionType: "sealed", currentPrice: "9000.00" }));
    expect(body.data.nextBidAmount).toBe("4200.00");
    expect(JSON.stringify(body.data)).not.toContain("9000.00");
  });
});
