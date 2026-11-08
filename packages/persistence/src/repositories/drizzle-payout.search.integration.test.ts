import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, payout, user } from "@auction/db/schema";
import { formatPayoutReference } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The staff Payouts search finds a payout by the reference people quote (`PO-YYYY-XXXXXXXX`), by
 * the start of its id, or by its seller's name. Rolled back, so it leaves no rows behind.
 */
describe.skipIf(!HAS_DB)("payout list search (integration)", () => {
  it("matches a reference by id prefix and year, and counts the same rows", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const ownerId = `payout-search-owner-${tag}`;
    const sellerId = randomUUID();
    const periodEnd = new Date("2026-06-30T00:00:00Z");

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
          displayName: `Searchable Gallery ${tag}`,
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: ownerId,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });
        const [created] = await tx
          .insert(payout)
          .values({
            legalEntityId: sellerId,
            periodStart: new Date("2026-06-01T00:00:00Z"),
            periodEnd,
            grossAmount: "1000.00",
            platformFee: "150.00",
            stripeFee: "0.00",
            netAmount: "850.00",
          })
          .returning();
        if (!created) throw new Error("payout_not_created");

        const repo = new DrizzlePayoutRepository(tx);
        const reference = formatPayoutReference({ id: created.id, periodEnd });
        const base = { legalEntityId: sellerId, limit: 10, offset: 0 };

        const byReference = await repo.list({ ...base, search: reference });
        expect(byReference.map((p) => p.id)).toEqual([created.id]);
        expect(await repo.countMatching({ legalEntityId: sellerId, search: reference })).toBe(1);

        const wrongYear = reference.replace("PO-2026-", "PO-2025-");
        expect(await repo.list({ ...base, search: wrongYear })).toHaveLength(0);

        const byIdStart = await repo.list({ ...base, search: created.id.slice(0, 8) });
        expect(byIdStart).toHaveLength(1);

        const bySeller = await repo.list({ ...base, search: `searchable gallery ${tag}` });
        expect(bySeller).toHaveLength(1);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
