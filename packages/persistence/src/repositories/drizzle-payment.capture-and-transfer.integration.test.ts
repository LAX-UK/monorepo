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

      expect(await repo.recordTransferReceivedInTransaction(tx, id, 4_000, "pi_t")).toBe(true);
      // A replayed or older notice reports the same or less: nothing changes.
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 4_000, "pi_t")).toBe(false);
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 2_500, "pi_t")).toBe(false);
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(4_000);

      expect(await repo.recordTransferReceivedInTransaction(tx, id, 7_500, "pi_t")).toBe(true);
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 15_000, "pi_t")).toBe(true);
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(10_000);
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 20_000, "pi_t")).toBe(false);
      expect(await repo.recordTransferReceivedInTransaction(tx, id, -1, "pi_t")).toBe(false);
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(10_000);
    });
  });

  it("records nothing for an invoice that is no longer waiting for its money", async () => {
    await inRolledBack(async (tx) => {
      const repo = new DrizzlePaymentRepository(tx);
      const id = await seedPayment(tx, { status: "captured" });
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 5_000, "pi_t")).toBe(false);
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(0);
    });
  });

  it("ties the figure to its payment intent: a new intent starts again, a late notice for an old one is ignored", async () => {
    await inRolledBack(async (tx) => {
      const repo = new DrizzlePaymentRepository(tx);
      const id = await seedPayment(tx, { status: "authorized", stripePaymentIntentId: "pi_one" });
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 3_000, "pi_one")).toBe(true);
      expect(await readRow(tx, id)).toMatchObject({
        transferReceivedPence: 3_000,
        transferReceivedPaymentIntentId: "pi_one",
      });

      // A new transfer checkout replaces the intent: the earlier attempt's figure is cleared.
      await repo.updateStripePaymentIntentId(id, "pi_two");
      expect(await readRow(tx, id)).toMatchObject({
        transferReceivedPence: 0,
        transferReceivedPaymentIntentId: null,
      });
      // A late notice for the first intent is not the invoice's current one: ignored.
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 9_000, "pi_one")).toBe(false);
      // The new intent's own figure starts from what it holds, even below the old one.
      expect(await repo.recordTransferReceivedInTransaction(tx, id, 1_000, "pi_two")).toBe(true);
      expect(await readRow(tx, id)).toMatchObject({
        transferReceivedPence: 1_000,
        transferReceivedPaymentIntentId: "pi_two",
      });
      // Setting the same intent again keeps its figure.
      await repo.updateStripePaymentIntentId(id, "pi_two");
      expect((await readRow(tx, id))?.transferReceivedPence).toBe(1_000);
    });
  });

  it("clears the figure when the invoice stops waiting: cancelled, reopened, or released from review", async () => {
    await inRolledBack(async (tx) => {
      const repo = new DrizzlePaymentRepository(tx);
      const id = await seedPayment(tx, { status: "authorized" });
      await repo.recordTransferReceivedInTransaction(tx, id, 3_000, "pi_a");
      expect(await repo.applyCancelledInTransaction(tx, id)).toBe(true);
      expect(await readRow(tx, id)).toMatchObject({
        transferReceivedPence: 0,
        transferReceivedPaymentIntentId: null,
      });
      expect(await repo.applyReopenedFromCancelledInTransaction(tx, id)).toBe(true);
      await repo.applyAuthorizedInTransaction(tx, id);
      await repo.recordTransferReceivedInTransaction(tx, id, 2_000, "pi_b");
      await repo.applyHeldMoneyInTransaction(tx, id, {
        stripePaymentIntentId: "pi_b",
        stripeChargeId: null,
      });
      expect(await repo.applyReleasedFromManualReviewInTransaction(tx, id)).toBe(true);
      expect(await readRow(tx, id)).toMatchObject({
        transferReceivedPence: 0,
        transferReceivedPaymentIntentId: null,
      });
    });
  });
});
