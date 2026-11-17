import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  bidUserProfile,
  deliveryQuote,
  legalEntity,
  lot,
  lotFulfilment,
  sale,
  saleRegistration,
  user,
} from "@auction/db/schema";
import {
  DELIVERY_QUOTE_STATUSES,
  DELIVERY_STATUSES,
  type DeliveryQuoteStatus,
  type FulfilmentFacts,
  deliveryStatusOf,
} from "@auction/domain";
import { describe, expect, it } from "vitest";
import { DrizzleAdminDeliveriesReader } from "./drizzle-admin-deliveries.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

async function inRollback(run: (tx: Database) => Promise<void>) {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const rollback = new Error("rollback_admin_deliveries_test");
  try {
    await db.transaction(async (tx) => {
      await run(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

const HOUR = 3_600_000;

/** A closed sale with a buyer account holding paddle 118, and a way to add won lots to it. */
async function seed(tx: Database) {
  const now = new Date();
  const tag = randomUUID().slice(0, 8);
  const buyerId = `dl-buyer-${tag}`;
  const sellerEntityId = randomUUID();
  const buyerEntityId = randomUUID();
  const saleId = randomUUID();
  await tx.insert(user).values({
    id: buyerId,
    name: buyerId,
    email: `${buyerId}@integration.test`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(bidUserProfile).values({ userId: buyerId, createdAt: now, updatedAt: now });
  await tx.insert(legalEntity).values(
    [sellerEntityId, buyerEntityId].map((id) => ({
      id,
      displayName: id === buyerEntityId ? `Example Trading ${tag} Ltd` : `Seller ${tag} Ltd`,
      kind: "organisation" as const,
      subkind: "gallery" as const,
      createdByUserId: buyerId,
      status: "approved" as const,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await tx.insert(sale).values({
    id: saleId,
    title: `Modern British ${tag}`,
    startTime: new Date(now.getTime() - 48 * HOUR),
    endTime: new Date(now.getTime() - 24 * HOUR),
    createdByLegalEntityId: sellerEntityId,
  });
  await tx.insert(saleRegistration).values({
    saleId,
    userId: buyerId,
    buyerLegalEntityId: buyerEntityId,
    status: "approved",
    paddleNumber: 118,
  });

  let next = 0;
  async function wonLot(options: {
    quote?: DeliveryQuoteStatus;
    fulfilment?: FulfilmentFacts["status"] | null;
    destination?: string;
    /** Hours ago the buyer asked. */
    askedHoursAgo?: number;
    images?: string[];
  }) {
    next += 1;
    const lotId = randomUUID();
    await tx.insert(lot).values({
      id: lotId,
      sellerLegalEntityId: sellerEntityId,
      saleId,
      lotNumber: next,
      title: `Harbour study ${tag} ${next}`,
      images: options.images ?? [],
      dimensions: "61 × 76 cm",
      auctionType: "english" as const,
      startingPrice: "100.00",
      currentPrice: "1250.00",
      minBidIncrement: "10.00",
      startTime: new Date(now.getTime() - 48 * HOUR),
      endTime: new Date(now.getTime() - 24 * HOUR),
      status: "ended" as const,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntityId,
      createdAt: now,
      updatedAt: now,
    });
    const quote = options.quote ?? "requested";
    const requestedAt = new Date(now.getTime() - (options.askedHoursAgo ?? next) * HOUR);
    const priced = quote !== "requested";
    await tx.insert(deliveryQuote).values({
      lotId,
      buyerLegalEntityId: buyerEntityId,
      status: quote,
      destination: options.destination ?? "12 Rue Exemple, 69002 Lyon, France",
      amount: priced ? "180.00" : null,
      quoteNote: priced ? "Insured, two-person delivery" : null,
      requestedByUserId: buyerId,
      requestedAt,
      ...(priced ? { quotedAt: new Date(requestedAt.getTime() + HOUR) } : {}),
      ...(quote === "accepted" || quote === "withdrawn"
        ? { decidedAt: new Date(requestedAt.getTime() + 2 * HOUR), decidedByUserId: buyerId }
        : {}),
    });
    if (options.fulfilment) {
      await tx.insert(lotFulfilment).values({
        lotId,
        status: options.fulfilment,
        fulfilmentMethod: "shipping",
        ...(options.fulfilment === "in_transit"
          ? { shippingCarrier: "Example Couriers", trackingNumber: "EX123456789GB" }
          : {}),
      });
    }
    return lotId;
  }
  return { tag, saleId, buyerEntityId, wonLot };
}

const FULFILMENT_STATUSES = [
  null,
  "awaiting_payment",
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

describe.skipIf(!HAS_DB)("admin deliveries reader (integration)", () => {
  it("files every quote and fulfilment combination under the view deliveryStatusOf gives", async () => {
    await inRollback(async (tx) => {
      const { saleId, wonLot } = await seed(tx);
      const expected = new Map<string, string>();
      for (const quote of DELIVERY_QUOTE_STATUSES) {
        for (const fulfilment of FULFILMENT_STATUSES) {
          const lotId = await wonLot({ quote, fulfilment });
          const facts = fulfilment ? { status: fulfilment, method: "shipping" as const } : null;
          expected.set(lotId, deliveryStatusOf({ quote, fulfilment: facts }).status);
        }
      }
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const counts = await reader.counts({ saleId });
      for (const status of DELIVERY_STATUSES) {
        const page = await reader.list({ status, saleId, limit: 100, offset: 0 });
        const want = [...expected].filter(([, s]) => s === status).map(([id]) => id);
        expect(page.rows.map((row) => row.lotId).sort()).toEqual(want.sort());
        expect(page.total).toBe(want.length);
        expect(counts[status]).toBe(want.length);
        for (const row of page.rows) expect(row.status).toBe(status);
      }
    });
  });

  it("reads a waiting request with its lot, sale, buyer and paddle", async () => {
    await inRollback(async (tx) => {
      const { tag, saleId, buyerEntityId, wonLot } = await seed(tx);
      const lotId = await wonLot({ images: ["https://images.example.test/lot-1.jpg"] });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const { rows } = await reader.list({ status: "waiting", saleId, limit: 50, offset: 0 });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        lotId,
        status: "waiting",
        closedReason: null,
        awaitingPayment: false,
        quote: {
          status: "requested",
          destination: "12 Rue Exemple, 69002 Lyon, France",
          amount: null,
          currency: "GBP",
        },
        lot: {
          title: `Harbour study ${tag} 1`,
          lotNumber: 1,
          imageUrl: "https://images.example.test/lot-1.jpg",
          dimensions: "61 × 76 cm",
          hammerPrice: "1250.00",
        },
        sale: { id: saleId, title: `Modern British ${tag}` },
        buyer: {
          legalEntityId: buyerEntityId,
          name: `Example Trading ${tag} Ltd`,
          paddleNumber: 118,
        },
        fulfilment: null,
      });
      expect(rows[0]?.statusSince).toEqual(rows[0]?.quote.requestedAt);
    });
  });

  it("shows a lot's live quote, not the request the buyer withdrew before it", async () => {
    await inRollback(async (tx) => {
      const { saleId, buyerEntityId, wonLot } = await seed(tx);
      const lotId = await wonLot({ quote: "withdrawn", askedHoursAgo: 50 });
      await tx.insert(deliveryQuote).values({
        lotId,
        buyerLegalEntityId: buyerEntityId,
        status: "requested",
        destination: "4 Example Lane, Cork, Ireland",
        requestedAt: new Date(Date.now() - 2 * HOUR),
      });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const counts = await reader.counts({ saleId });
      expect(counts).toMatchObject({ waiting: 1, closed: 0 });
      const record = await reader.findByLotId(lotId);
      expect(record?.quote.destination).toBe("4 Example Lane, Cork, Ireland");
      expect(record?.status).toBe("waiting");
    });
  });

  it("searches lot title and number, paddle, buyer and destination", async () => {
    await inRollback(async (tx) => {
      const { tag, saleId, wonLot } = await seed(tx);
      const lyon = await wonLot({});
      const cork = await wonLot({ destination: "4 Example Lane, Cork, Ireland" });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const ids = async (search: string) =>
        (await reader.list({ status: "waiting", saleId, search, limit: 50, offset: 0 })).rows.map(
          (row) => row.lotId,
        );
      expect(await ids("cork")).toEqual([cork]);
      expect(await ids("Lot 1")).toEqual([lyon]);
      expect(await ids(`study ${tag} 2`)).toEqual([cork]);
      expect((await ids("118")).sort()).toEqual([lyon, cork].sort());
      expect((await ids(`Example Trading ${tag}`)).length).toBe(2);
      expect(await ids("Paris")).toEqual([]);
      expect((await reader.counts({ saleId, search: "cork" })).waiting).toBe(1);
    });
  });

  it("puts the newest request first, or the longest waiting first, and pages", async () => {
    await inRollback(async (tx) => {
      const { saleId, wonLot } = await seed(tx);
      const old = await wonLot({ askedHoursAgo: 72 });
      const mid = await wonLot({ askedHoursAgo: 24 });
      const fresh = await wonLot({ askedHoursAgo: 3 });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const newest = await reader.list({ status: "waiting", saleId, limit: 2, offset: 0 });
      expect(newest.rows.map((row) => row.lotId)).toEqual([fresh, mid]);
      expect(newest.total).toBe(3);
      const oldest = await reader.list({
        status: "waiting",
        saleId,
        sort: "oldest",
        limit: 50,
        offset: 0,
      });
      expect(oldest.rows.map((row) => row.lotId)).toEqual([old, mid, fresh]);
      const second = await reader.list({ status: "waiting", saleId, limit: 2, offset: 2 });
      expect(second.rows.map((row) => row.lotId)).toEqual([old]);
    });
  });

  it("carries the courier and tracking once on the way, and lists the sale for the filter", async () => {
    await inRollback(async (tx) => {
      const { tag, saleId, wonLot } = await seed(tx);
      const lotId = await wonLot({ quote: "accepted", fulfilment: "in_transit" });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const record = await reader.findByLotId(lotId);
      expect(record).toMatchObject({
        status: "on_the_way",
        fulfilment: {
          status: "in_transit",
          method: "shipping",
          carrier: "Example Couriers",
          trackingNumber: "EX123456789GB",
        },
      });
      expect(await reader.findByLotId(randomUUID())).toBeNull();
      expect(await reader.sales()).toContainEqual({ id: saleId, title: `Modern British ${tag}` });
    });
  });
});
