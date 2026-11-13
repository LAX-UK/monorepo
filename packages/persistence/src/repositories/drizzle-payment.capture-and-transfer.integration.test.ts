import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidUserProfile, legalEntity, lot, payment, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzlePaymentRepository } from "./drizzle-payment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

type Tx = Parameters<Parameters<ReturnType<typeof createDb>["transaction"]>[0]>[0];

/** One buyer, one seller and one £100 invoice per call. Inside a rolled-back transaction. */
async function seedPayment(
  tx: Tx,
  overrides: {
    status?: "pending" | "authorized" | "captured";
    stripePaymentIntentId?: string | null;
  },
) {
  const now = new Date();
  const tag = randomUUID().slice(0, 8);
  const buyerId = `capture-transfer-${tag}`;
  const [sellerEntityId, buyerEntityId, lotId] = [randomUUID(), randomUUID(), randomUUID()];
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
  await tx.insert(lot).values({
    id: lotId,
    sellerLegalEntityId: sellerEntityId,
    title: `Capture and transfer ${tag}`,
    images: [],
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: "100.00",
    minBidIncrement: "10.00",
    startTime: new Date(now.getTime() - 86_400_000),
    endTime: new Date(now.getTime() - 3_600_000),
    status: "ended" as const,
    winnerId: buyerId,
    buyerLegalEntityId: buyerEntityId,
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await tx
    .insert(payment)
    .values({
      lotId,
      buyerId,
      buyerLegalEntityId: buyerEntityId,
      sellerLegalEntityId: sellerEntityId,
      amount: "100.00",
      platformFee: "0.00",
      status: overrides.status ?? "pending",
      stripePaymentIntentId: overrides.stripePaymentIntentId ?? null,
    })
    .returning({ id: payment.id });
  return (row as { id: string }).id;
}

async function readRow(tx: Tx, id: string) {
  const [row] = await tx.select().from(payment).where(eq(payment.id, id));
  return row;
}

async function inRolledBack(fn: (tx: Tx) => Promise<void>) {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const rollback = new Error("rollback_test_tx");
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describe.skipIf(!HAS_DB)("payment capture and transfer receipts (integration)", () => {
  it("a card capture stores the payment intent with the charge when the row has none", async () => {
    await inRolledBack(async (tx) => {
      const repo = new DrizzlePaymentRepository(tx);
      const id = await seedPayment(tx, { stripePaymentIntentId: null });
      expect(
        await repo.applyCapturedInTransaction(tx, id, {
          stripeChargeId: "ch_card",
          stripePaymentIntentId: "pi_card",
        }),
      ).toBe(true);
      expect(await readRow(tx, id)).toMatchObject({
        status: "captured",
        stripeChargeId: "ch_card",
        stripePaymentIntentId: "pi_card",
      });
    });
  });

  it("an empty-string intent is filled too, and a recorded one is never replaced", async () => {
    await inRolledBack(async (tx) => {
      const repo = new DrizzlePaymentRepository(tx);
      const blank = await seedPayment(tx, { stripePaymentIntentId: "" });
      await repo.applyCapturedInTransaction(tx, blank, { stripePaymentIntentId: "pi_new" });
      expect((await readRow(tx, blank))?.stripePaymentIntentId).toBe("pi_new");

      const kept = await seedPayment(tx, { stripePaymentIntentId: "pi_recorded" });
      await repo.applyCapturedInTransaction(tx, kept, {
        stripeChargeId: "ch_2",
        stripePaymentIntentId: "pi_other",
      });
      expect(await readRow(tx, kept)).toMatchObject({
        stripeChargeId: "ch_2",
        stripePaymentIntentId: "pi_recorded",
      });
    });
  });

  it("raises what a £100 transfer has received, never lowers it and never passes the invoice", async () => {
    await inRolledBack(async (tx) => {
      const repo = new DrizzlePaymentRepository(tx);
      const id = await seedPayment(tx, { status: "authorized" });
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(0);

      expect(await repo.recordTransferReceivedInTransaction(tx, id, 4_000)).toBe(true);
      // A replayed or older notice reports the same or less: nothing changes.
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 4_000)).toBe(false);
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 2_500)).toBe(false);
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(4_000);

      expect(await repo.recordTransferReceivedInTransaction(tx, id, 7_500)).toBe(true);
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 15_000)).toBe(true);
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(10_000);
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 20_000)).toBe(false);
      expect(await repo.recordTransferReceivedInTransaction(tx, id, -1)).toBe(false);
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(10_000);
    });
  });

  it("records nothing for an invoice that is no longer waiting for its money", async () => {
    await inRolledBack(async (tx) => {
      const repo = new DrizzlePaymentRepository(tx);
      const id = await seedPayment(tx, { status: "captured" });
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 5_000)).toBe(false);
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(0);
    });
  });
});
