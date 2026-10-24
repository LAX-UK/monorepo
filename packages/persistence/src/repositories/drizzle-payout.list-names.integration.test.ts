import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, payout, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The staff Payouts list names each seller from the list read itself, never one lookup per row.
 * Runs in a transaction that is rolled back, so it leaves no rows behind.
 */
describe.skipIf(!HAS_DB)("payout list seller names (integration)", () => {
  it("returns each payout with its seller's display name", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const ownerId = `payout-names-owner-${tag}`;
    const sellerId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: ownerId,
          name: ownerId,
          email: `${ownerId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values({
          id: sellerId,
          displayName: `Halcyon Gallery ${tag}`,
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: ownerId,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(payout).values({
          legalEntityId: sellerId,
          periodStart: new Date(now.getTime() - 30 * 86_400_000),
          periodEnd: now,
          grossAmount: "1000.00",
          platformFee: "150.00",
          stripeFee: "0.00",
          netAmount: "850.00",
        });

        const rows = await new DrizzlePayoutRepository(tx).list({
          legalEntityId: sellerId,
          limit: 10,
          offset: 0,
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          legalEntityId: sellerId,
          legalEntityName: `Halcyon Gallery ${tag}`,
          netAmount: "850.00",
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
