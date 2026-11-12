import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bid,
  buyerDefault,
  legalEntity,
  lot,
  lotReoffer,
  payment,
  sale,
  sellerConsent,
  user,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { lotSoldAfterAuctionSql } from "../lib/lot-result-pending.sql.js";
import { DrizzleLotRepository } from "./drizzle-lot.repository.js";
import { DrizzlePublicLotResultReader } from "./drizzle-public-lot-result.reader.js";
import { DrizzleSaleResultLotsReader } from "./drizzle-sale-result-lots.reader.js";
import { sumEndedLotHammer } from "./lot/lot-analytics-queries.js";
import { listCatalogLotsBySalePage } from "./lot/lot-catalog-queries.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("public lot result (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzlePublicLotResultReader(db);
  const tag = randomUUID().slice(0, 8);
  const userIds = { seller: `pr-seller-${tag}`, buyer: `pr-buyer-${tag}`, next: `pr-next-${tag}` };
  const entities = { seller: randomUUID(), buyer: randomUUID(), next: randomUUID() };
  const lotIds: string[] = [];
  const closed = new Date("2026-10-10T10:00:00Z");

  async function seed() {
    const now = new Date();
    for (const [key, id] of Object.entries(userIds)) {
      await db
        .insert(user)
        .values({
          id,
          name: key,
          email: `${id}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }
    for (const key of ["seller", "buyer", "next"] as const) {
      await db
        .insert(legalEntity)
        .values({
          id: entities[key],
          displayName: key,
          kind: "individual",
          subkind: "private_collector",
          createdByUserId: userIds[key],
          status: "approved",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }
  }

  /** An ended lot that was won by `buyer` and defaulted. `winner` is who holds it now. */
  async function defaultedLot(options: {
    outcome?: "offered_to_underbidder" | "returned_to_inventory";
    winner?: "none" | "next";
    endTime?: Date;
  }) {
    await seed();
    const lotId = randomUUID();
    lotIds.push(lotId);
    const winner = options.winner ?? "none";
    await db.insert(lot).values({
      id: lotId,
      title: `Result ${lotId.slice(0, 4)}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: winner === "next" ? "900.00" : "1000.00",
      minBidIncrement: "10.00",
      startTime: new Date("2026-10-01T10:00:00Z"),
      endTime: options.endTime ?? closed,
      status: "ended",
      sellerLegalEntityId: entities.seller,
      winnerId: winner === "next" ? userIds.next : null,
      buyerLegalEntityId: winner === "next" ? entities.next : null,
    });
    const [sourceBid] = await db
      .insert(bid)
      .values({
        lotId,
        bidderId: userIds.next,
        buyerLegalEntityId: entities.next,
        amount: "900.00",
      })
      .returning({ id: bid.id });
    const [def] = await db
      .insert(buyerDefault)
      .values({
        lotId,
        buyerId: userIds.buyer,
        buyerLegalEntityId: entities.buyer,
        sellerLegalEntityId: entities.seller,
        hammerPrice: "1000.00",
        wonAt: closed,
        reason: "No payment",
        outcome: options.outcome ?? "offered_to_underbidder",
      })
      .returning({ id: buyerDefault.id });
    return { lotId, defaultId: def?.id as string, sourceBidId: sourceBid?.id as string };
  }

  async function reaward(scenario: { lotId: string; defaultId: string; sourceBidId: string }) {
    const [consent] = await db
      .insert(sellerConsent)
      .values({
        subjectType: "lot_reoffer",
        subjectId: randomUUID(),
        sellerLegalEntityId: entities.seller,
        lotId: scenario.lotId,
        termsSnapshot: {},
        status: "not_needed",
        channel: "house_stock",
      })
      .returning({ id: sellerConsent.id });
    const now = new Date();
    await db.insert(lotReoffer).values({
      lotId: scenario.lotId,
      buyerDefaultId: scenario.defaultId,
      sequence: 1,
      offeredUserId: userIds.next,
      offeredLegalEntityId: entities.next,
      sourceBidId: scenario.sourceBidId,
      amountPence: 90_000,
      status: "accepted",
      sellerConsentId: consent?.id as string,
      respondedAt: now,
      reawardedAt: now,
    });
  }

  async function pay(lotId: string, status: "pending" | "captured") {
    await db.insert(payment).values({
      lotId,
      buyerId: userIds.next,
      buyerLegalEntityId: entities.next,
      sellerLegalEntityId: entities.seller,
      amount: "1125.00",
      platformFee: "0.00",
      status,
    });
  }

  const pendingOf = async (lotId: string) => (await reader.pendingAmong([lotId])).has(lotId);
  const soldAfterAuction = async (lotId: string) => {
    const [row] = await db
      .select({ value: lotSoldAfterAuctionSql() })
      .from(lot)
      .where(eq(lot.id, lotId));
    return row?.value === true;
  };

  afterAll(async () => {
    for (const lotId of lotIds) await db.delete(lot).where(eq(lot.id, lotId));
  });

  it("is open for a defaulted lot that has no buyer yet", async () => {
    const { lotId } = await defaultedLot({});
    expect(await pendingOf(lotId)).toBe(true);
  });

  it("is not open for a lot that went back to inventory", async () => {
    const { lotId } = await defaultedLot({ outcome: "returned_to_inventory" });
    expect(await pendingOf(lotId)).toBe(false);
  });

  it("is not open once the lot has closed again after the default", async () => {
    const { lotId } = await defaultedLot({ endTime: new Date(Date.now() + 86_400_000) });
    expect(await pendingOf(lotId)).toBe(false);
  });

  it("stays open while the re-awarded buyer has not paid", async () => {
    const scenario = await defaultedLot({ winner: "next" });
    await reaward(scenario);
    expect(await pendingOf(scenario.lotId)).toBe(true);
    await pay(scenario.lotId, "pending");
    expect(await pendingOf(scenario.lotId)).toBe(true);
  });

  it("is final once the re-awarded buyer has paid", async () => {
    const scenario = await defaultedLot({ winner: "next" });
    await reaward(scenario);
    await pay(scenario.lotId, "captured");
    expect(await pendingOf(scenario.lotId)).toBe(false);
  });

  it("is not open for a buyer who was not re-awarded the lot", async () => {
    const { lotId } = await defaultedLot({ winner: "next" });
    expect(await pendingOf(lotId)).toBe(false);
  });

  it("never reports a lot that is not ended", async () => {
    const { lotId } = await defaultedLot({});
    await db.update(lot).set({ status: "draft" }).where(eq(lot.id, lotId));
    expect(await pendingOf(lotId)).toBe(false);
  });

  it("marks a lot sold after the auction only for its re-awarded buyer", async () => {
    const reawarded = await defaultedLot({ winner: "next" });
    await reaward(reawarded);
    const plain = await defaultedLot({ winner: "next" });
    expect(await soldAfterAuction(reawarded.lotId)).toBe(true);
    expect(await soldAfterAuction(plain.lotId)).toBe(false);
  });

  it("leaves a lot with an open result out of the archive total, and flags it in a sale's results", async () => {
    // A year no other data uses, so the total reads only these lots.
    const year = new Date(Date.UTC(2093, 5, 1));
    const open = await defaultedLot({ winner: "next", endTime: year });
    await reaward(open);
    const paid = await defaultedLot({ winner: "next", endTime: year });
    await reaward(paid);
    await pay(paid.lotId, "captured");
    const totals = await sumEndedLotHammer(db, { endYear: 2093 });
    // Both lots hammered at 900.00; only the paid one is a result.
    expect(Number(totals.total)).toBe(900);

    const [saleRow] = await db
      .insert(sale)
      .values({
        title: `Results ${tag}`,
        status: "ended",
        startTime: new Date(year.getTime() - 86_400_000),
        endTime: year,
        createdByLegalEntityId: entities.seller,
      })
      .returning({ id: sale.id });
    const saleId = saleRow?.id as string;
    await db.update(lot).set({ saleId }).where(eq(lot.id, open.lotId));
    await db.update(lot).set({ saleId }).where(eq(lot.id, paid.lotId));
    const rows = (await new DrizzleSaleResultLotsReader(db).listBySaleIds([saleId])).get(saleId);
    expect(rows?.find((row) => row.id === open.lotId)?.resultPending).toBe(true);
    expect(rows?.find((row) => row.id === paid.lotId)?.resultPending).toBe(false);
    await db.delete(sale).where(eq(sale.id, saleId));
  });

  it("orders a lot with an open result by the starting price it shows, not its hammer", async () => {
    // Hammered at 1000.00, shown at its 100.00 start while the result is open.
    const open = await defaultedLot({});
    // An ordinary sold lot at 900.00.
    const sold = await defaultedLot({ winner: "next" });
    const [saleRow] = await db
      .insert(sale)
      .values({
        title: `Order ${tag}`,
        status: "ended",
        startTime: new Date(closed.getTime() - 86_400_000),
        endTime: closed,
        createdByLegalEntityId: entities.seller,
      })
      .returning({ id: sale.id });
    const saleId = saleRow?.id as string;
    await db.update(lot).set({ saleId }).where(eq(lot.id, open.lotId));
    await db.update(lot).set({ saleId }).where(eq(lot.id, sold.lotId));

    const page = async (sort: "priceAsc" | "priceDesc") =>
      (await listCatalogLotsBySalePage(db, { saleId, sort, limit: 10, offset: 0 })).items.map(
        (row) => row.id,
      );
    expect(await page("priceDesc")).toEqual([sold.lotId, open.lotId]);
    expect(await page("priceAsc")).toEqual([open.lotId, sold.lotId]);
    const hammer = await new DrizzleLotRepository(db).list({
      saleId,
      sort: "hammerDesc",
      limit: 10,
      offset: 0,
    });
    expect(hammer.map((row) => row.id)).toEqual([sold.lotId, open.lotId]);
    await db.update(lot).set({ saleId: null }).where(eq(lot.saleId, saleId));
    await db.delete(sale).where(eq(sale.id, saleId));
  });
});
