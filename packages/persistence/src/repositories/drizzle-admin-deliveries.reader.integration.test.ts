import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  bidUserProfile,
  deliveryQuote,
  legalEntity,
  lot,
  lotFulfilment,
  payment,
  sale,
  saleRegistration,
  user,
} from "@auction/db/schema";
import {
  DELIVERY_QUOTE_STATUSES,
  DELIVERY_STATUSES,
  type DeliveryQuoteStatus,
  type FulfilmentFacts,
  type PurchaseInvoiceStatus,
  deliveryStatusOf,
} from "@auction/domain";
import { eq } from "drizzle-orm";
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
    method?: FulfilmentFacts["method"];
    /** The invoice's payment row, when one is raised. */
    payment?: "pending" | "captured" | "refunded" | null;
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
      const method = options.method === undefined ? "shipping" : options.method;
      await tx.insert(lotFulfilment).values({
        lotId,
        status: options.fulfilment,
        fulfilmentMethod: method,
        ...(options.fulfilment === "in_transit"
          ? { shippingCarrier: "Example Couriers", trackingNumber: "EX123456789GB" }
          : {}),
        ...(options.fulfilment === "delivered" && method === "collection"
          ? { collectedBy: "A. Example", collectedAt: new Date(requestedAt.getTime() + 5 * HOUR) }
          : {}),
      });
    }
    if (options.payment) {
      await tx.insert(payment).values({
        lotId,
        buyerId,
        buyerLegalEntityId: buyerEntityId,
        sellerLegalEntityId: sellerEntityId,
        amount: "1250.00",
        platformFee: "0.00",
        status: options.payment,
      });
    }
    return lotId;
  }
  return { tag, saleId, buyerEntityId, wonLot };
}

/** The invoice the buyer's page reads from each payment row (a fresh invoice is not overdue). */
const INVOICE_OF: Record<"none" | "pending" | "captured" | "refunded", PurchaseInvoiceStatus> = {
  none: "not_invoiced",
  pending: "due",
  captured: "paid",
  refunded: "refunded",
};

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
  it("files every quote, fulfilment, method and invoice combination under the view deliveryStatusOf gives", async () => {
    await inRollback(async (tx) => {
      const { saleId, wonLot } = await seed(tx);
      const expected = new Map<string, string>();
      for (const quote of DELIVERY_QUOTE_STATUSES) {
        for (const fulfilment of FULFILMENT_STATUSES) {
          for (const method of fulfilment ? (["shipping", "collection", null] as const) : [null]) {
            for (const paid of ["none", "pending", "captured", "refunded"] as const) {
              const lotId = await wonLot({
                quote,
                fulfilment,
                method,
                payment: paid === "none" ? null : paid,
              });
              const facts = fulfilment ? { status: fulfilment, method } : null;
              const invoice = fulfilment === "cancelled" ? "cancelled" : INVOICE_OF[paid];
              expected.set(lotId, deliveryStatusOf({ quote, fulfilment: facts, invoice }).status);
            }
          }
        }
      }
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const counts = await reader.counts({ saleId });
      // The sidebar count reads the waiting quotes on their own, and agrees with the tab.
      const allWaiting = (await reader.counts({})).waiting;
      expect(await reader.waitingCount()).toBe(allWaiting);
      for (const status of DELIVERY_STATUSES) {
        const page = await reader.list({ status, saleId, limit: 1000, offset: 0 });
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
      const recent = new Date(Date.now() - 30 * 24 * HOUR);
      expect(await reader.sales({ since: recent, limit: 100 })).toContainEqual({
        id: saleId,
        title: `Modern British ${tag}`,
      });
    });
  });

  it("closes a refunded purchase's booked delivery, as the buyer's page shows it cancelled", async () => {
    await inRollback(async (tx) => {
      const { saleId, wonLot } = await seed(tx);
      const unpaid = await wonLot({ quote: "accepted", fulfilment: "awaiting_payment" });
      const refunded = await wonLot({
        quote: "accepted",
        fulfilment: "awaiting_payment",
        payment: "refunded",
      });
      const noRecord = await wonLot({ quote: "accepted", payment: "refunded" });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      expect(await reader.findByLotId(unpaid)).toMatchObject({
        status: "to_dispatch",
        awaitingPayment: true,
      });
      for (const lotId of [refunded, noRecord]) {
        expect(await reader.findByLotId(lotId)).toMatchObject({
          status: "closed",
          closedReason: "cancelled",
          awaitingPayment: false,
          statusSince: null,
        });
      }
      const counts = await reader.counts({ saleId });
      expect(counts).toMatchObject({ to_dispatch: 1, closed: 2 });
    });
  });

  it("is only on the way or delivered by courier: a lot collected in person closes the request", async () => {
    await inRollback(async (tx) => {
      const { saleId, wonLot } = await seed(tx);
      const collected = await wonLot({
        quote: "accepted",
        fulfilment: "delivered",
        method: "collection",
      });
      const couriered = await wonLot({ quote: "accepted", fulfilment: "delivered" });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const record = await reader.findByLotId(collected);
      expect(record).toMatchObject({ status: "closed", closedReason: "collected" });
      expect(record?.statusSince).toEqual(record?.fulfilment?.collectedAt);
      expect(record?.fulfilment?.collectedAt).toBeInstanceOf(Date);
      expect(await reader.findByLotId(couriered)).toMatchObject({ status: "delivered" });
      expect(await reader.counts({ saleId })).toMatchObject({ delivered: 1, closed: 1 });
    });
  });

  it("never takes the fulfilment's last edit as the dispatch time, so an edit does not reorder a view", async () => {
    await inRollback(async (tx) => {
      const { saleId, wonLot } = await seed(tx);
      const first = await wonLot({
        quote: "accepted",
        fulfilment: "in_transit",
        askedHoursAgo: 90,
      });
      const second = await wonLot({
        quote: "accepted",
        fulfilment: "in_transit",
        askedHoursAgo: 10,
      });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const view = async () =>
        (await reader.list({ status: "on_the_way", saleId, limit: 50, offset: 0 })).rows;
      const before = await view();
      expect(before.map((row) => row.lotId)).toEqual([second, first]);
      // The dispatch time is not recorded anywhere, so it is not made up.
      for (const row of before) expect(row.statusSince).toBeNull();
      // A later fix to the older lot's tracking number moves its updated_at to now.
      await tx
        .update(lotFulfilment)
        .set({ trackingNumber: "EX987654321GB", updatedAt: new Date() })
        .where(eq(lotFulfilment.lotId, first));
      expect((await view()).map((row) => row.lotId)).toEqual([second, first]);
    });
  });

  it("lists only sales with a recent request in the sale filter, at most the limit", async () => {
    await inRollback(async (tx) => {
      const { saleId, wonLot } = await seed(tx);
      await wonLot({ askedHoursAgo: 24 * 400 });
      const reader = new DrizzleAdminDeliveriesReader(tx);
      const lastYear = new Date(Date.now() - 365 * 24 * HOUR);
      expect((await reader.sales({ since: lastYear, limit: 100 })).map((s) => s.id)).not.toContain(
        saleId,
      );
      await wonLot({ askedHoursAgo: 2 });
      expect((await reader.sales({ since: lastYear, limit: 100 })).map((s) => s.id)).toContain(
        saleId,
      );
      const other = await seed(tx);
      await other.wonLot({ askedHoursAgo: 1 });
      expect((await reader.sales({ since: lastYear, limit: 100 })).map((s) => s.id)).toEqual(
        expect.arrayContaining([saleId, other.saleId]),
      );
      expect(await reader.sales({ since: lastYear, limit: 1 })).toHaveLength(1);
    });
  });
});
