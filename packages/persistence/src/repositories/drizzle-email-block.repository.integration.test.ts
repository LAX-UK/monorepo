import { createDb } from "@auction/db";
import { emailSuppression, zohoCampaignsOptOutLift } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleEmailBlockRepository } from "./drizzle-email-block.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleEmailBlockRepository staff lift (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleEmailBlockRepository(db);
  const tag = Date.now().toString(36);
  const campaigns = `block-it-${tag}-campaigns`;
  const bounce = `block-it-${tag}-bounce`;

  afterAll(async () => {
    for (const h of [campaigns, bounce]) {
      await db.delete(emailSuppression).where(eq(emailSuppression.emailHash, h));
      await db.delete(zohoCampaignsOptOutLift).where(eq(zohoCampaignsOptOutLift.emailHash, h));
    }
  });

  it("records a staff lift of a Campaigns opt-out, so the lift is on file for the next sync", async () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(emailSuppression).values({
      emailHash: campaigns,
      reason: "unsubscribed_marketing",
      source: "zoho_campaigns",
      createdAt: since,
    });

    const removed = await db.transaction((tx) =>
      repo.removeIfUnchangedInTransaction(tx, { emailHash: campaigns, expectedSince: since }),
    );

    expect(removed?.reason).toBe("unsubscribed_marketing");
    const [lift] = await db
      .select()
      .from(zohoCampaignsOptOutLift)
      .where(eq(zohoCampaignsOptOutLift.emailHash, campaigns));
    // The same old unsubscribe (dated before the lift) is now held back by the sync.
    expect(lift?.liftedAt.getTime()).toBeGreaterThan(since.getTime());
  });

  it("records no lift for a hard bounce", async () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    await db
      .insert(emailSuppression)
      .values({ emailHash: bounce, reason: "hard_bounce", createdAt: since });
    await db.transaction((tx) =>
      repo.removeIfUnchangedInTransaction(tx, { emailHash: bounce, expectedSince: since }),
    );
    const rows = await db
      .select()
      .from(zohoCampaignsOptOutLift)
      .where(eq(zohoCampaignsOptOutLift.emailHash, bounce));
    expect(rows).toHaveLength(0);
  });
});
