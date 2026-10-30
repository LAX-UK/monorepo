import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { absenteeBid, bid, legalEntity, lot, payment, user } from "@auction/db/schema";
import { decideBiddingLimits, exposureOf } from "@auction/domain";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleBiddingExposureReader } from "./drizzle-bidding-exposure.reader.js";
import { DrizzleOrganisationBiddingLimitRepository } from "./drizzle-organisation-bidding-limit.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleBiddingExposureReader (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleBiddingExposureReader(db);
  const limits = new DrizzleOrganisationBiddingLimitRepository(db);
  const agentId = `exposure-agent-${randomUUID()}`;
  const otherId = `exposure-other-${randomUUID()}`;
  const orgId = randomUUID();
  const raceOrgId = randomUUID();
  const otherOrgId = randomUUID();
  const sellerId = randomUUID();
  const lots = {
    leading: randomUUID(),
    exhausted: randomUUID(),
    absentee: randomUUID(),
    wonUnpaid: randomUUID(),
    wonPaid: randomUUID(),
    otherOrg: randomUUID(),
    raceA: randomUUID(),
    raceB: randomUUID(),
  };
  const now = new Date();
  const hour = 3_600_000;

  const newLot = (
    id: string,
    fields: Partial<typeof lot.$inferInsert> = {},
  ): typeof lot.$inferInsert => ({
    id,
    title: `Exposure ${id.slice(0, 4)}`,
    images: [],
    auctionType: "english",
    startingPrice: "100.00",
    currentPrice: "800.00",
    minBidIncrement: "10.00",
    startTime: new Date(now.getTime() - hour),
    endTime: new Date(now.getTime() + 24 * hour),
    status: "active",
    sellerLegalEntityId: sellerId,
    createdAt: now,
    updatedAt: now,
    ...fields,
  });

  const newBid = (
    lotId: string,
    buyerLegalEntityId: string,
    fields: Partial<typeof bid.$inferInsert> = {},
  ): typeof bid.$inferInsert => ({
    lotId,
    bidderId: agentId,
    buyerLegalEntityId,
    amount: "800.00",
    isWinning: false,
    ...fields,
  });

  beforeAll(async () => {
    for (const id of [agentId, otherId]) {
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    for (const [id, kind, subkind] of [
      [orgId, "organisation", "gallery"],
      [raceOrgId, "organisation", "gallery"],
      [otherOrgId, "organisation", "gallery"],
      [sellerId, "individual", "private_collector"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Exposure ${id.slice(0, 4)}`,
        kind,
        subkind,
        createdByUserId: agentId,
        status: "approved",
        createdAt: now,
        updatedAt: now,
      });
    }
    await db.insert(lot).values([
      newLot(lots.leading),
      newLot(lots.exhausted),
      newLot(lots.absentee, { status: "scheduled", startTime: new Date(now.getTime() + hour) }),
      newLot(lots.wonUnpaid, {
        status: "ended",
        currentPrice: "5000.00",
        winnerId: otherId,
        buyerLegalEntityId: orgId,
      }),
      newLot(lots.wonPaid, {
        status: "ended",
        currentPrice: "7000.00",
        winnerId: agentId,
        buyerLegalEntityId: orgId,
      }),
      newLot(lots.otherOrg),
      newLot(lots.raceA),
      newLot(lots.raceB),
    ]);
    await db.insert(bid).values([
      newBid(lots.leading, orgId, { amount: "1000.00", isWinning: true }),
      newBid(lots.leading, orgId, { amount: "900.00", maxAutoBidAmount: "3000.00" }),
      // Outbid past its maximum: it can no longer bid, so it no longer counts.
      newBid(lots.exhausted, orgId, { amount: "400.00", maxAutoBidAmount: "500.00" }),
      newBid(lots.otherOrg, otherOrgId, { amount: "9000.00", isWinning: true }),
    ]);
    await db.insert(absenteeBid).values({
      lotId: lots.absentee,
      userId: agentId,
      buyerLegalEntityId: orgId,
      maxAmount: "2000.00",
    });
    await db.insert(payment).values({
      lotId: lots.wonPaid,
      buyerId: agentId,
      buyerLegalEntityId: orgId,
      sellerLegalEntityId: sellerId,
      amount: "7350.00",
      platformFee: "350.00",
      status: "captured",
      createdAt: now,
    });
  });

  afterAll(async () => {
    const lotIds = Object.values(lots);
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(absenteeBid).where(inArray(absenteeBid.lotId, lotIds));
    await db.delete(bid).where(inArray(bid.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await limits.clear(raceOrgId);
    for (const id of [orgId, raceOrgId, otherOrgId, sellerId]) {
      await db.delete(legalEntity).where(eq(legalEntity.id, id));
    }
    await db.delete(user).where(inArray(user.id, [agentId, otherId]));
  });

  it("lists leading and live maximum bids, scheduled absentee bids and unpaid wins", async () => {
    const rows = await reader.listCommitments(orgId);
    expect(rows.map((r) => `${r.kind}:${r.amount}`).sort()).toEqual([
      "absentee_bid:2000.00",
      "leading_bid:1000.00",
      "maximum_bid:3000.00",
      "unpaid_win:5000.00",
    ]);
    expect(rows.find((r) => r.kind === "unpaid_win")).toMatchObject({
      lotId: lots.wonUnpaid,
      userId: otherId,
    });
    const commitments = rows.map((r) => ({ ...r, amount: Number(r.amount) }));
    // The leading bid and its maximum are one lot: 3000 + 2000 + 5000.
    expect(exposureOf(commitments)).toBe(10_000);
    expect(exposureOf(commitments, { userId: agentId })).toBe(5000);
  });

  it("sets, replaces and clears an organisation limit", async () => {
    expect(await limits.find(raceOrgId)).toBeNull();
    expect(
      await limits.set({ legalEntityId: raceOrgId, limitAmount: "2000.00", setByUserId: agentId }),
    ).toEqual({ previousAmount: null });
    expect(
      await limits.set({ legalEntityId: raceOrgId, limitAmount: "1000.00", setByUserId: agentId }),
    ).toEqual({ previousAmount: "2000.00" });
    expect(await limits.find(raceOrgId)).toMatchObject({ limitAmount: "1000.00" });
  });

  it("lets only one of two bids racing on different lots past the organisation limit", async () => {
    await limits.set({ legalEntityId: raceOrgId, limitAmount: "1000.00", setByUserId: agentId });

    const place = (lotId: string) =>
      db.transaction(async (tx) => {
        const conn = tx as unknown as Database;
        const txReader = new DrizzleBiddingExposureReader(conn);
        await txReader.lockForLegalEntity(conn, raceOrgId);
        const limit = await limits.find(raceOrgId, conn);
        const rows = await txReader.listCommitments(raceOrgId, conn);
        const exposure = exposureOf(
          rows.map((r) => ({ ...r, amount: Number(r.amount) })),
          {},
          lotId,
        );
        const decision = decideBiddingLimits(600, [
          { kind: "organisation", limit: Number(limit?.limitAmount), exposure },
        ]);
        if (!decision.allowed) return "refused";
        await tx
          .insert(bid)
          .values(newBid(lotId, raceOrgId, { amount: "600.00", isWinning: true }));
        // Hold the transaction open so the other bid would read stale exposure without the lock.
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "placed";
      });

    const outcomes = await Promise.all([place(lots.raceA), place(lots.raceB)]);
    expect(outcomes.sort()).toEqual(["placed", "refused"]);
    const exposure = exposureOf(
      (await reader.listCommitments(raceOrgId)).map((r) => ({ ...r, amount: Number(r.amount) })),
    );
    expect(exposure).toBe(600);
  });
});
