import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { bidInvoice, bidUserProfile, legalEntity, lot, payment, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleAdminWorkItemsReader } from "./drizzle-admin-work-items.reader.js";
import { DrizzleBidInvoiceRepository } from "./drizzle-bid-invoice.repository.js";
import { DrizzlePaymentRepository } from "./drizzle-payment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const DAY_MS = 86_400_000;

/**
 * A buyer with two won lots, each with a payment and a stored invoice. Runs in a transaction that
 * is rolled back, so it leaves no rows behind.
 */
async function seedTwoInvoices(tx: Database, tag: string, now: Date) {
  const buyerId = `invoice-due-buyer-${tag}`;
  const sellerEntityId = randomUUID();
  const buyerEntityId = randomUUID();
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
      displayName: id,
      kind: "organisation" as const,
      subkind: "gallery" as const,
      createdByUserId: buyerId,
      status: "approved" as const,
      createdAt: now,
      updatedAt: now,
    })),
  );
  const lotIds = [randomUUID(), randomUUID()];
  await tx.insert(lot).values(
    lotIds.map((id, index) => ({
      id,
      sellerLegalEntityId: sellerEntityId,
      title: `Invoice due lot ${index} ${tag}`,
      images: [],
      auctionType: "english" as const,
      startingPrice: "100.00",
      currentPrice: "250.00",
      minBidIncrement: "10.00",
      startTime: new Date(now.getTime() - 20 * DAY_MS),
      endTime: new Date(now.getTime() - 15 * DAY_MS),
      status: "ended" as const,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntityId,
      createdAt: now,
      updatedAt: now,
    })),
  );
  return { buyerId, sellerEntityId, buyerEntityId, lotIds };
}

async function addInvoice(
  tx: Database,
  input: {
    lotId: string;
    buyerId: string;
    buyerEntityId: string;
    sellerEntityId: string;
    paymentCreatedAt: Date;
    dueAt: Date;
  },
) {
  const [invoice] = await tx
    .insert(bidInvoice)
    .values({
      lotId: input.lotId,
      buyerLegalEntityId: input.buyerEntityId,
      sellerLegalEntityId: input.sellerEntityId,
      totalPence: 31_250,
      raisedAt: input.paymentCreatedAt,
      dueAt: input.dueAt,
    })
    .returning();
  const [row] = await tx
    .insert(payment)
    .values({
      lotId: input.lotId,
      buyerId: input.buyerId,
      buyerLegalEntityId: input.buyerEntityId,
      sellerLegalEntityId: input.sellerEntityId,
      amount: "312.50",
      platformFee: "0.00",
      status: "pending",
      invoiceId: invoice?.id,
      createdAt: input.paymentCreatedAt,
    })
    .returning();
  return { invoiceId: invoice?.id as string, paymentId: row?.id as string };
}

describe.skipIf(!HAS_DB)("stored invoice due dates (integration)", () => {
  it("the staff overdue list reads the stored due date, not the payment's age", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const base = await seedTwoInvoices(tx as unknown as Database, tag, now);
        const common = {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
        };
        // Raised just now, but its stored due date has passed: overdue.
        await addInvoice(tx as unknown as Database, {
          ...common,
          lotId: base.lotIds[0] as string,
          paymentCreatedAt: now,
          dueAt: new Date(now.getTime() - 2 * DAY_MS),
        });
        // Its payment row is ten days old, but its stored due date is still ahead: not overdue.
        await addInvoice(tx as unknown as Database, {
          ...common,
          lotId: base.lotIds[1] as string,
          paymentCreatedAt: new Date(now.getTime() - 10 * DAY_MS),
          dueAt: new Date(now.getTime() + 3 * DAY_MS),
        });

        const reader = new DrizzleAdminWorkItemsReader(tx as unknown as Database);
        const overdue = await reader.listOverduePayments(500, now);
        const lotIds = overdue.map((item) => item.sourceId);
        expect(lotIds).toContain(base.lotIds[0]);
        expect(lotIds).not.toContain(base.lotIds[1]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("the staff overdue list does not drop a payment that has no stored invoice", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const bare = (lotId: string, daysAgo: number) =>
          database.insert(payment).values({
            lotId,
            buyerId: base.buyerId,
            buyerLegalEntityId: base.buyerEntityId,
            sellerLegalEntityId: base.sellerEntityId,
            amount: "312.50",
            platformFee: "0.00",
            status: "pending",
            createdAt: new Date(now.getTime() - daysAgo * DAY_MS),
          });
        // Raised ten days ago with no invoice: its term has ended. Raised two days ago: it has not.
        await bare(base.lotIds[0] as string, 10);
        await bare(base.lotIds[1] as string, 2);

        const overdue = await new DrizzleAdminWorkItemsReader(database).listOverduePayments(
          500,
          now,
        );
        const lotIds = overdue.map((item) => item.sourceId);
        expect(lotIds).toContain(base.lotIds[0]);
        expect(lotIds).not.toContain(base.lotIds[1]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("extending a due date moves it later and never earlier", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const dueAt = new Date(now.getTime() + 2 * DAY_MS);
        const { invoiceId, paymentId } = await addInvoice(database, {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
          lotId: base.lotIds[0] as string,
          paymentCreatedAt: now,
          dueAt,
        });
        const repo = new DrizzleBidInvoiceRepository(database);
        const dueOf = async () =>
          (await database.select().from(bidInvoice).where(eq(bidInvoice.id, invoiceId)))[0]?.dueAt;

        // An earlier date changes nothing.
        expect(await repo.extendDueAt(invoiceId, new Date(dueAt.getTime() - DAY_MS))).toBe(false);
        expect(await repo.extendDueAt(invoiceId, dueAt)).toBe(false);
        expect(await dueOf()).toEqual(dueAt);

        // A later date moves it.
        const later = new Date(dueAt.getTime() + 5 * DAY_MS);
        expect(await repo.extendDueAt(invoiceId, later)).toBe(true);
        expect(await dueOf()).toEqual(later);

        // The expiry job reads it through the payment.
        const found = await new DrizzlePaymentRepository(database).findById(paymentId);
        expect(found?.invoiceDueAt).toEqual(later);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
