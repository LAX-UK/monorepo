import { createDb } from "@auction/db";
import { emailSuppression, zohoCampaignsOptOutLift } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleZohoCampaignsSuppressionRepository } from "./drizzle-zoho-campaigns-suppression.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleZohoCampaignsSuppressionRepository (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleZohoCampaignsSuppressionRepository(db);
  const tag = Date.now().toString(36);
  const undated = `zcs-it-${tag}-undated`;
  const relifted = `zcs-it-${tag}-relifted`;

  afterAll(async () => {
    for (const h of [undated, relifted]) {
      await db.delete(emailSuppression).where(eq(emailSuppression.emailHash, h));
      await db.delete(zohoCampaignsOptOutLift).where(eq(zohoCampaignsOptOutLift.emailHash, h));
    }
  });

  it("stores an unsubscribe with no readable time as epoch, so a re-subscribe can lift it", async () => {
    expect(await repo.suppress(undated, "unsubscribed_marketing", null)).toBe("applied");
    const [row] = await db
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.emailHash, undated));
    expect(row?.createdAt.getTime()).toBe(0);

    const lifted = await repo.liftOptOut(undated, new Date("2026-06-01T00:00:00Z"), {
      onlyIfOlder: true,
    });
    expect(lifted).toBe(true);
  });

  it("keeps a person unblocked when the same old unsubscribe is synced after a lift", async () => {
    const old = new Date("2026-01-01T00:00:00Z");
    expect(await repo.suppress(relifted, "unsubscribed_marketing", old)).toBe("applied");
    await repo.liftOptOut(relifted, new Date()); // the lift a staff member now records
    expect(await repo.suppress(relifted, "unsubscribed_marketing", old)).toBe("lifted");
    const rows = await db
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.emailHash, relifted));
    expect(rows).toHaveLength(0);
  });
});
