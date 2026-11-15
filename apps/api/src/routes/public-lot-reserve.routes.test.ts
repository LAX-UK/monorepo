import type { Lot, Sale } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { SaleService } from "../services/sale.service.js";
import { UserDashboardReadService } from "../services/user-dashboard-read.service.js";
import { createSaleRoutes } from "./sales.js";
import { createUserRoutes } from "./users.js";

/**
 * Public and bidder reads that return lot rows, mounted over the real read services with fake
 * data: a non-staff viewer never receives a reserve amount (only hasReserve / reserveMet) or an
 * open sealed lot's real price; staff still read the lot as stored.
 */

const SALE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RESERVE = "4321.00";
const SEALED_HIGH_BID = "8765.00";

const sale = {
  id: SALE_ID,
  title: "Autumn sale",
  status: "active",
  coverImages: [],
  buyerPremiumTiers: null,
} as unknown as Sale;

function lot(id: string, overrides: Partial<Lot> = {}): Lot {
  return {
    id,
    saleId: SALE_ID,
    lotNumber: 1,
    title: `Lot ${id}`,
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c1",
    auctionType: "english",
    status: "active",
    startingPrice: "100.00",
    currentPrice: "5000.00",
    reservePrice: RESERVE,
    winnerId: null,
    buyerPremiumRate: null,
    startTime: new Date("2026-11-01T10:00:00Z"),
    endTime: new Date("2026-12-01T10:00:00Z"),
    marketingDetails: {},
    ...overrides,
  } as unknown as Lot;
}

const openLot = lot("open");
const sealedLot = lot("sealed", { auctionType: "sealed", currentPrice: SEALED_HIGH_BID });
const rows = [openLot, sealedLot];
const wonLot = lot("won", { status: "ended", winnerId: "user-1", currentPrice: "5000.00" });

const ANON = null;
const CLIENT = { id: "user-1", role: "client", staffRole: null };
const STAFF = { id: "staff-1", role: "staff", staffRole: "catalogue_manager" };
type Viewer = typeof ANON | typeof CLIENT | typeof STAFF;

function authenticatorFor(user: Viewer): IAuthenticator {
  return { getSessionUser: vi.fn().mockResolvedValue(user) } as unknown as IAuthenticator;
}

function headersFor(user: Viewer): Record<string, string> {
  return user ? { cookie: "better-auth.session_token=test" } : {};
}

function mount(user: Viewer) {
  const saleService = new SaleService({
    saleRepo: { findById: vi.fn().mockResolvedValue(sale) },
    lotRepo: {
      findBySaleId: vi.fn().mockResolvedValue(rows),
      listCatalogLotsBySalePage: vi.fn().mockResolvedValue({ items: rows, total: rows.length }),
    },
  } as never);
  (saleService as unknown as { findByIds: unknown }).findByIds = vi.fn(async () => [sale]);
  const userDashboardReadService = new UserDashboardReadService(
    {
      listBidsWithLotsForBidder: vi.fn(async () =>
        rows.map((l) => ({ bid: { id: `bid-${l.id}`, lotId: l.id, amount: "200.00" }, lot: l })),
      ),
    } as never,
    {
      listWithLots: vi.fn(async () =>
        rows.map((l) => ({ watchlistId: `w-${l.id}`, lotId: l.id, createdAt: new Date(), lot: l })),
      ),
    } as never,
    undefined,
    { findByIds: vi.fn(async () => [sale]) },
  );
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    saleService,
    userDashboardReadService,
    lotService: { list: vi.fn(async () => [wonLot]) },
    paymentService: { listMyPaymentsForBuyerApi: vi.fn(async () => ({ data: [] })) },
    mediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
  } as unknown as Container;
  const app = new Hono();
  app.route("/sales", createSaleRoutes(container, authenticatorFor(user)));
  app.route("/users", createUserRoutes(container, authenticatorFor(user)));
  return (path: string) => app.request(`http://t/${path}`, { headers: headersFor(user) });
}

type LotJson = Record<string, unknown> & { id: string };

async function lotsOf(res: Response, pick: (body: never) => LotJson[]): Promise<LotJson[]> {
  expect(res.status).toBe(200);
  return pick((await res.json()) as never);
}

const publicReads: {
  name: string;
  viewers: Viewer[];
  read: (user: Viewer) => Promise<LotJson[]>;
}[] = [
  {
    name: "GET /sales/:id",
    viewers: [ANON, CLIENT],
    read: async (user) =>
      lotsOf(
        await mount(user)(`sales/${SALE_ID}`),
        (b: { data: { lots: LotJson[] } }) => b.data.lots,
      ),
  },
  {
    name: "GET /sales/:id/lots",
    viewers: [ANON, CLIENT],
    read: async (user) =>
      lotsOf(
        await mount(user)(`sales/${SALE_ID}/lots?sort=priceDesc`),
        (b: { data: { items: LotJson[] } }) => b.data.items,
      ),
  },
  {
    name: "GET /users/me/bids",
    viewers: [CLIENT],
    read: async (user) =>
      lotsOf(await mount(user)("users/me/bids"), (b: { data: { lot: LotJson }[] }) =>
        b.data.map((r) => r.lot),
      ),
  },
  {
    name: "GET /users/me/watchlist",
    viewers: [CLIENT],
    read: async (user) =>
      lotsOf(await mount(user)("users/me/watchlist"), (b: { data: { lot: LotJson }[] }) =>
        b.data.map((r) => r.lot),
      ),
  },
];

describe.each(publicReads)("$name", ({ read, viewers }) => {
  it.each(viewers.map((v) => [v ? v.role : "anonymous", v] as const))(
    "gives a %s viewer no reserve amount, only hasReserve / reserveMet",
    async (_label, user) => {
      const lots = await read(user);
      expect(lots).toHaveLength(2);
      for (const row of lots) {
        expect(row).not.toHaveProperty("reservePrice");
        expect(row.hasReserve).toBe(true);
      }
      expect(lots.find((l) => l.id === "open")?.reserveMet).toBe(true);
      expect(JSON.stringify(lots)).not.toContain(RESERVE);
    },
  );

  it("does not give a non-staff viewer an open sealed lot's real price", async () => {
    const lots = await read(viewers[viewers.length - 1] ?? null);
    const sealed = lots.find((l) => l.id === "sealed");
    expect(sealed?.currentPrice).toBe("100.00");
    expect(JSON.stringify(lots)).not.toContain(SEALED_HIGH_BID);
  });

  it("gives staff the lot as stored, reserve included", async () => {
    const lots = await read(STAFF);
    expect(lots.find((l) => l.id === "open")?.reservePrice).toBe(RESERVE);
    expect(lots.find((l) => l.id === "sealed")?.currentPrice).toBe(SEALED_HIGH_BID);
  });
});

describe("GET /users/me/portfolio", () => {
  const read = async (user: Viewer) =>
    lotsOf(await mount(user)("users/me/portfolio"), (b: { data: { lot: LotJson }[] }) =>
      b.data.map((r) => r.lot),
    );

  it("gives the buyer no reserve amount, only hasReserve / reserveMet", async () => {
    const [won] = await read(CLIENT);
    expect(won).not.toHaveProperty("reservePrice");
    expect(won?.hasReserve).toBe(true);
    expect(won?.reserveMet).toBe(true);
  });

  it("gives staff the lot as stored, reserve included", async () => {
    const [won] = await read(STAFF);
    expect(won?.reservePrice).toBe(RESERVE);
  });
});
