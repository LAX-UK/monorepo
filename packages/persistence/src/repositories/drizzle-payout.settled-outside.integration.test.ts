import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { domainEvent, legalEntity, lot, payment, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";
import { SETTLED_OUTSIDE_EVENT } from "./drizzle-staff-seller-proceeds.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * A sale staff marked as settled with the seller outside LAX is never waiting for a payout run:
 * the run neither lists, locks nor pays it, and a seller with only such sales is not offered to
 * the nightly run. An unmarked captured sale beside it still is. Rolled back.
 */
describe.skipIf(!HAS_DB)("payout run leaves sales settled outside LAX alone (integration)", () => {
  it("excludes a marked sale from what the run reads, locks and lists", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const buyerId = `settled-outside-buyer-${tag}`;
    const sellerA = randomUUID();
    const sellerB = randomUUID();
    const buyer = randomUUID();
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: buyerId,
          name: "Fixture Buyer",
          email: `${buyerId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        for (const id of [sellerA, sellerB, buyer]) {
          await tx.insert(legalEntity).values({
            id,
            displayName: `Entity ${id.slice(0, 4)}`,
            kind: "organisation",
            subkind: "gallery",
            primaryCountry: "GB",
            createdByUserId: buyerId,
          } as typeof legalEntity.$inferInsert);
        }

        async function capturedSale(seller: string, settledOutside: boolean) {
          const lotId = randomUUID();
          await tx.insert(lot).values({
            id: lotId,
            title: `Settled outside ${tag}`,
            images: [],
            auctionType: "english",
            startingPrice: "100.00",
            currentPrice: "6200.00",
            minBidIncrement: "10.00",
            startTime: new Date(Date.now() - 10 * 86_400_000),
            endTime: new Date(Date.now() - 2 * 86_400_000),
            status: "ended",
            sellerLegalEntityId: seller,
            winnerId: buyerId,
            buyerLegalEntityId: buyer,
          });
          const [paid] = await tx
            .insert(payment)
            .values({
              lotId,
              buyerId,
              buyerLegalEntityId: buyer,
              sellerLegalEntityId: seller,
              amount: "7750.00",
              platformFee: "0.00",
              status: "captured",
            })
            .returning({ id: payment.id });
          if (!paid) throw new Error("payment not stored");
          if (settledOutside) {
            await tx.insert(domainEvent).values({
              aggregateType: "lot",
              aggregateId: lotId,
              eventType: SETTLED_OUTSIDE_EVENT,
              payload: { lotId, paymentId: paid.id, reason: "Paid by bank transfer per runbook" },
              producer: "integration-test",
            });
          }
          return paid.id;
        }

        const unmarked = await capturedSale(sellerA, false);
        const marked = await capturedSale(sellerA, true);
        await capturedSale(sellerB, true);

        const repo = new DrizzlePayoutRepository(tx as unknown as Database);
        expect((await repo.findUnlinkedCapturedPayments(sellerA)).map((p) => p.id)).toEqual([
          unmarked,
        ]);
        expect(await repo.lockPendingPayments(sellerA)).toEqual([unmarked]);
        const listed = await repo.listLegalEntityIdsWithUnlinkedCapturedPayments();
        expect(listed).toContain(sellerA);
        expect(listed).not.toContain(sellerB);
        expect(await repo.findUnlinkedCapturedPayments(sellerB)).toEqual([]);
        expect(marked).not.toBe(unmarked);
        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});
