import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  bidUserProfile,
  legalEntity,
  lot,
  payment,
  purchaseProblem,
  sale,
  user,
} from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import {
  DrizzlePurchaseProblemDeskRepository,
  DrizzlePurchaseProblemNoteRepository,
} from "./drizzle-purchase-problem-desk.repository.js";
import { DrizzlePurchaseProblemRepository } from "./drizzle-purchase-problem.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

async function inRollback(run: (tx: Database) => Promise<void>) {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const rollback = new Error("rollback_purchase_problem_desk_test");
  try {
    await db.transaction(async (tx) => {
      await run(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

/** A paid lot in a sale, bought by an organisation, and one staff member. */
async function seed(tx: Database) {
  const now = new Date();
  const tag = randomUUID().slice(0, 8);
  const staffId = `pp-staff-${tag}`;
  const buyerId = `pp-buyer-${tag}`;
  const sellerEntityId = randomUUID();
  const buyerEntityId = randomUUID();
  const saleId = randomUUID();
  await tx.insert(user).values(
    [staffId, buyerId].map((id) => ({
      id,
      name: id,
      email: `${id}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await tx.insert(bidUserProfile).values({ userId: buyerId, createdAt: now, updatedAt: now });
  await tx.insert(legalEntity).values(
    [sellerEntityId, buyerEntityId].map((id) => ({
      id,
      displayName: id === buyerEntityId ? `Buyer ${tag} Ltd` : `Seller ${tag} Ltd`,
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
    title: `Autumn sale ${tag}`,
    startTime: new Date(now.getTime() - 86_400_000),
    endTime: new Date(now.getTime() - 3_600_000),
    createdByLegalEntityId: sellerEntityId,
  });

  async function report(lotNumber: number, status: "open" | "in_progress" | "resolved" = "open") {
    const lotId = randomUUID();
    await tx.insert(lot).values({
      id: lotId,
      sellerLegalEntityId: sellerEntityId,
      saleId,
      lotNumber,
      title: `Pool study ${tag} ${lotNumber}`,
      images: [],
      auctionType: "english" as const,
      startingPrice: "100.00",
      currentPrice: "250.00",
      minBidIncrement: "10.00",
      startTime: new Date(now.getTime() - 86_400_000),
      endTime: new Date(now.getTime() - 3_600_000),
      status: "ended" as const,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntityId,
      createdAt: now,
      updatedAt: now,
    });
    const [paid] = await tx
      .insert(payment)
      .values({
        lotId,
        buyerId,
        buyerLegalEntityId: buyerEntityId,
        sellerLegalEntityId: sellerEntityId,
        amount: "4800.50",
        platformFee: "25.00",
        status: "captured",
        createdAt: now,
      })
      .returning({ id: payment.id });
    const [row] = await tx
      .insert(purchaseProblem)
      .values({
        lotId,
        buyerLegalEntityId: buyerEntityId,
        paymentId: paid?.id as string,
        category: "damaged",
        message: "The frame arrived cracked.",
        reportedByUserId: buyerId,
        status,
        ...(status === "resolved" ? { resolvedAt: now, resolvedByUserId: staffId } : {}),
      })
      .returning({ id: purchaseProblem.id });
    return { id: row?.id as string, lotId };
  }
  return { tag, staffId, buyerId, buyerEntityId, saleId, report };
}

describe.skipIf(!HAS_DB)("purchase problem desk (integration)", () => {
  it("lists a status with the lot, sale, buyer and payment, and counts every status", async () => {
    await inRollback(async (tx) => {
      const { tag, saleId, report } = await seed(tx);
      const first = await report(1);
      await report(2, "in_progress");
      await report(3, "resolved");
      const repo = new DrizzlePurchaseProblemDeskRepository(tx);

      const open = await repo.list({ status: "open", saleId, limit: 25, offset: 0 });
      expect(open.total).toBe(1);
      expect(open.rows[0]).toMatchObject({
        id: first.id,
        status: "open",
        version: 1,
        message: "The frame arrived cracked.",
        buyer: { name: `Buyer ${tag} Ltd` },
        lot: { lotNumber: 1, saleId, saleTitle: `Autumn sale ${tag}` },
        payment: { status: "captured", amountMinor: 480_050 },
      });
      expect(await repo.counts({ saleId })).toEqual({ open: 1, in_progress: 1, resolved: 1 });
      expect(await repo.salesWithReports()).toContainEqual({
        id: saleId,
        title: `Autumn sale ${tag}`,
      });
    });
  });

  it("searches by reference, buyer name and lot title, and filters by owner", async () => {
    await inRollback(async (tx) => {
      const { tag, saleId, staffId, report } = await seed(tx);
      const { id } = await report(1);
      const repo = new DrizzlePurchaseProblemDeskRepository(tx);
      const reference = `PR-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      for (const search of [reference, `Buyer ${tag}`, `Pool study ${tag}`]) {
        const found = await repo.list({ status: "open", saleId, search, limit: 25, offset: 0 });
        expect(
          found.rows.map((row) => row.id),
          search,
        ).toEqual([id]);
      }
      expect(
        (await repo.list({ status: "open", saleId, search: "%", limit: 25, offset: 0 })).total,
      ).toBe(0);
      expect(
        (await repo.list({ status: "open", saleId, assignee: "unassigned", limit: 25, offset: 0 }))
          .total,
      ).toBe(1);
      expect(
        (await repo.list({ status: "open", saleId, assignee: staffId, limit: 25, offset: 0 }))
          .total,
      ).toBe(0);
    });
  });

  it("applies a change at the version it was read, bumps the version, and refuses a stale one", async () => {
    await inRollback(async (tx) => {
      const { staffId, report } = await seed(tx);
      const { id } = await report(1);
      const repo = new DrizzlePurchaseProblemDeskRepository(tx);
      const taken = await repo.updateInTransaction(tx, id, 1, {
        status: "in_progress",
        assignedToUserId: staffId,
      });
      expect(taken).toMatchObject({ status: "in_progress", assignedToUserId: staffId, version: 2 });
      expect(await repo.updateInTransaction(tx, id, 1, { status: "resolved" })).toBeNull();

      const at = new Date();
      const resolved = await repo.updateInTransaction(tx, id, 2, {
        status: "resolved",
        resolved: { at, byUserId: staffId },
      });
      expect(resolved).toMatchObject({
        status: "resolved",
        resolvedByUserId: staffId,
        version: 3,
      });
      expect(resolved?.resolvedAt?.getTime()).toBe(at.getTime());
    });
  });

  it("keeps notes oldest first", async () => {
    await inRollback(async (tx) => {
      const { staffId, report } = await seed(tx);
      const { id } = await report(1);
      const notes = new DrizzlePurchaseProblemNoteRepository(tx);
      await notes.addInTransaction(tx, {
        purchaseProblemId: id,
        authorUserId: staffId,
        body: "One",
      });
      await notes.addInTransaction(tx, {
        purchaseProblemId: id,
        authorUserId: staffId,
        body: "Two",
      });
      expect((await notes.listForProblem(id)).map((note) => note.body)).toEqual(["One", "Two"]);
    });
  });

  it("keeps one unresolved report per purchase, whether or not it was taken on", async () => {
    await inRollback(async (tx) => {
      const { buyerId, buyerEntityId, report } = await seed(tx);
      const { id, lotId } = await report(1);
      const desk = new DrizzlePurchaseProblemDeskRepository(tx);
      await desk.updateInTransaction(tx, id, 1, { status: "in_progress" });

      const buyerSide = new DrizzlePurchaseProblemRepository(tx);
      expect((await buyerSide.findOpen(lotId, buyerEntityId))?.status).toBe("in_progress");
      const [paid] = await tx.select({ id: payment.id }).from(payment).limit(1);
      const again = await buyerSide.openInTransaction(tx, {
        lotId,
        buyerLegalEntityId: buyerEntityId,
        paymentId: paid?.id as string,
        category: "other",
        message: "Reporting it a second time.",
        reportedByUserId: buyerId,
      });
      expect(again).toMatchObject({ created: false, record: { id } });
    });
  });
});
