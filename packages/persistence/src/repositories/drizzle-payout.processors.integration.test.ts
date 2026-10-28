import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { domainEvent, legalEntity, payout, payoutLine, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Who processed a payout decides who may reverse it. Runs in a transaction that is rolled back,
 * so it leaves no rows behind.
 */
describe.skipIf(!HAS_DB)("payout processors (integration)", () => {
  it("lists everyone who acted on the payout before a reversal, each once", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const [settler, adjuster, payer, reverser] = ["settler", "adjuster", "payer", "reverser"].map(
      (who) => `payout-processor-${who}-${tag}`,
    ) as [string, string, string, string];
    const sellerId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values(
          [settler, adjuster, payer, reverser].map((id) => ({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          })),
        );
        await tx.insert(legalEntity).values({
          id: sellerId,
          displayName: `Processor Gallery ${tag}`,
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: settler,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });
        const [created] = await tx
          .insert(payout)
          .values({
            legalEntityId: sellerId,
            periodStart: new Date(now.getTime() - 30 * 86_400_000),
            periodEnd: now,
            grossAmount: "1000.00",
            platformFee: "150.00",
            stripeFee: "0.00",
            netAmount: "850.00",
          })
          .returning({ id: payout.id });
        const payoutId = created?.id ?? "";
        const event = (eventType: string, actorUserId: string | null) => ({
          aggregateType: "payout",
          aggregateId: payoutId,
          eventType,
          payload: {},
          producer: "api",
          actorUserId,
        });
        await tx
          .insert(domainEvent)
          .values([
            event("payout.settlement_created", settler),
            event("payout.paid", payer),
            event("payout.paid", payer),
            event("payout.transfer_initiated", null),
            event("payout.reversed", reverser),
          ]);
        await tx.insert(payoutLine).values({
          payoutId,
          amount: "-10.00",
          kind: "adjustment",
          createdByUserId: adjuster,
          note: "Courier refund",
        });

        const processors = await new DrizzlePayoutRepository(tx).listProcessorUserIds(payoutId);
        expect([...processors].sort()).toEqual([adjuster, payer, settler].sort());
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
