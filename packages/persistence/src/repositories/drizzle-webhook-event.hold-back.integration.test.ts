import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { webhookEvent } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleWebhookEventRepository } from "./drizzle-webhook-event.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** Runs in a transaction that is rolled back, so it leaves no rows behind. */
describe.skipIf(!HAS_DB)("webhook events held back (integration)", () => {
  it("stores a zoho_qc event, keeps it through a release and an excluded drain, and gives the attempt back", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const key = `zoho-qc-test-${randomUUID()}`;
    try {
      await db.transaction(async (tx) => {
        const repo = new DrizzleWebhookEventRepository(tx);
        // The source column takes the new source: it has no check constraint or enum.
        expect(
          (await repo.tryClaimEvent({ source: "zoho_qc", eventKey: key, payload: { body: {} } }))
            .claimed,
        ).toBe(true);

        const claim = await repo.tryClaimForProcessing(key, 60_000);
        expect(claim.claimed).toBe(true);
        await repo.releaseClaim(key);

        const [row] = await tx.select().from(webhookEvent).where(eq(webhookEvent.eventKey, key));
        expect(row?.processedAt).toBeNull();
        expect(row?.claimExpiresAt).toBeNull();
        expect(row?.attempts).toBe(0);

        const keysOf = async (excludeSources: string[]) =>
          (await repo.listUnprocessedForDrain(1000, { excludeSources })).map((r) => r.eventKey);
        expect(await keysOf([])).toContain(key);
        expect(await keysOf(["zoho_qc"])).not.toContain(key);

        // A processed row is not given back to the queue.
        await repo.markProcessed(key);
        await repo.releaseClaim(key);
        expect(await keysOf([])).not.toContain(key);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
