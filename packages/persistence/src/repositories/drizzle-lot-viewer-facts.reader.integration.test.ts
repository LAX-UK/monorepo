import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  absenteeBid,
  bid,
  legalEntity,
  lot,
  payment,
  sale,
  saleRegistration,
  user,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleLotViewerFactsReader } from "./drizzle-lot-viewer-facts.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleLotViewerFactsReader (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleLotViewerFactsReader(db);
  const me = `viewer-me-${randomUUID()}`;
  const rival = `viewer-rival-${randomUUID()}`;
  const myEntity = randomUUID();
  const rivalEntity = randomUUID();
  const sellerEntity = randomUUID();
  const saleId = randomUUID();
  const lots = {
    leading: randomUUID(),
    outbid: randomUUID(),
    scheduledMax: randomUUID(),
    won: randomUUID(),
    lost: randomUUID(),
    untouched: randomUUID(),
  };
  const now = new Date();
  const hour = 3_600_000;

  const newLot = (
    id: string,
    fields: Partial<typeof lot.$inferInsert> = {},
  ): typeof lot.$inferInsert => ({
    id,
    saleId,
    title: `Viewer ${id.slice(0, 4)}`,
    images: [],
    auctionType: "english",
    startingPrice: "100.00",
    currentPrice: "800.00",
    minBidIncrement: "10.00",
    startTime: new Date(now.getTime() - hour),
    endTime: new Date(now.getTime() + 24 * hour),
    status: "active",
    sellerLegalEntityId: sellerEntity,
    createdAt: now,
    updatedAt: now,
    ...fields,
  });

  beforeAll(async () => {
    for (const id of [me, rival]) {
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const [id, subkind] of [
      [myEntity, "private_collector"],
      [rivalEntity, "private_collector"],
      [sellerEntity, "private_collector"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Viewer ${id.slice(0, 4)}`,
        kind: "individual",
        subkind,
        createdByUserId: me,
        status: "approved",
        createdAt: now,
        updatedAt: now,
      });
    }
    await db.insert(sale).values({
      id: saleId,
      title: "Viewer sale",
      startTime: new Date(now.getTime() - hour),
      endTime: new Date(now.getTime() + 24 * hour),
      createdByLegalEntityId: sellerEntity,
    });
    await db.insert(lot).values([
      newLot(lots.leading),
      newLot(lots.outbid),
      newLot(lots.scheduledMax, { status: "scheduled", startTime: new Date(now.getTime() + hour) }),
      newLot(lots.won, {
        status: "ended",
        currentPrice: "5000.00",
        winnerId: me,
        buyerLegalEntityId: myEntity,
      }),
      newLot(lots.lost, {
        status: "ended",
        currentPrice: "5000.00",
        winnerId: rival,
        buyerLegalEntityId: rivalEntity,
      }),
      newLot(lots.untouched),
    ]);
    const mine = (lotId: string, fields: Partial<typeof bid.$inferInsert>) => ({
      lotId,
      bidderId: me,
      buyerLegalEntityId: myEntity,
      amount: "800.00",
      isWinning: false,
      ...fields,
    });
    await db.insert(bid).values([
      mine(lots.leading, { amount: "800.00", isWinning: true, maxAutoBidAmount: "2000.00" }),
      mine(lots.outbid, { amount: "700.00" }),
      {
        lotId: lots.outbid,
        bidderId: rival,
        buyerLegalEntityId: rivalEntity,
        amount: "800.00",
        isWinning: true,
      },
      mine(lots.won, { amount: "5000.00", isWinning: true }),
      mine(lots.lost, { amount: "4000.00" }),
    ]);
    await db.insert(absenteeBid).values({
      lotId: lots.scheduledMax,
      userId: me,
      buyerLegalEntityId: myEntity,
      maxAmount: "3000.00",
    });
    await db.insert(saleRegistration).values({
      saleId,
      userId: me,
      buyerLegalEntityId: myEntity,
      status: "approved",
    });
    await db.insert(payment).values({
      lotId: lots.won,
      buyerId: me,
      buyerLegalEntityId: myEntity,
      sellerLegalEntityId: sellerEntity,
      amount: "6250.00",
      platformFee: "250.00",
      status: "pending",
      createdAt: now,
    });
  });

  afterAll(async () => {
    const lotIds = Object.values(lots);
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(absenteeBid).where(inArray(absenteeBid.lotId, lotIds));
    await db.delete(bid).where(inArray(bid.lotId, lotIds));
    await db.delete(saleRegistration).where(eq(saleRegistration.saleId, saleId));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(sale).where(eq(sale.id, saleId));
    for (const id of [myEntity, rivalEntity, sellerEntity]) {
      await db.delete(legalEntity).where(eq(legalEntity.id, id));
    }
    await db.delete(user).where(inArray(user.id, [me, rival]));
  });

  const load = async () => {
    const rows = await reader.load({
      lotIds: Object.values(lots),
      userId: me,
      legalEntityId: myEntity,
    });
    return new Map(rows.map((row) => [row.lotId, row]));
  };

  it("finds the account's standing on every lot in one call", async () => {
    const byLot = await load();
    expect(byLot.size).toBe(6);

    expect(byLot.get(lots.leading)).toMatchObject({
      leading: true,
      hasBid: true,
      highestBid: "800.00",
      maxBid: "2000.00",
      registration: "approved",
    });
    expect(byLot.get(lots.outbid)).toMatchObject({
      leading: false,
      hasBid: true,
      highestBid: "700.00",
      maxBid: null,
    });
    expect(byLot.get(lots.scheduledMax)).toMatchObject({
      hasBid: false,
      maxBid: "3000.00",
      lotStatus: "scheduled",
    });
    expect(byLot.get(lots.untouched)).toMatchObject({
      leading: false,
      won: false,
      hasBid: false,
      highestBid: null,
      maxBid: null,
    });
  });

  it("reads a win with its invoice, and a loss without one", async () => {
    const byLot = await load();
    expect(byLot.get(lots.won)).toMatchObject({ won: true, leading: false, hasBid: true });
    expect(byLot.get(lots.won)?.payment).toMatchObject({ status: "pending" });
    expect(byLot.get(lots.lost)).toMatchObject({ won: false, hasBid: true, payment: null });
  });

  it("sees nothing of another account's bids", async () => {
    const rows = await reader.load({
      lotIds: [lots.outbid],
      userId: rival,
      legalEntityId: rivalEntity,
    });
    expect(rows[0]).toMatchObject({ leading: true, hasBid: true, highestBid: "800.00" });
    const stranger = await reader.load({
      lotIds: [lots.outbid],
      userId: rival,
      legalEntityId: randomUUID(),
    });
    expect(stranger[0]).toMatchObject({ leading: false, hasBid: false, registration: null });
  });

  it("returns nothing for no lots, and skips lots that do not exist", async () => {
    expect(await reader.load({ lotIds: [], userId: me, legalEntityId: myEntity })).toEqual([]);
    expect(
      await reader.load({ lotIds: [randomUUID()], userId: me, legalEntityId: myEntity }),
    ).toEqual([]);
  });
});
