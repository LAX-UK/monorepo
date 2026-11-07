import { createDb } from "@auction/db";
import { emailSuppression, zohoCampaignsOptOutLift } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleEmailSuppressionRepository } from "./drizzle-email-suppression.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleEmailSuppressionRepository (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleEmailSuppressionRepository(db);
  const tag = Date.now().toString(36);
  const hashes = ["a", "b", "c", "d"].map((n) => `suppression-it-${tag}-${n}`);
  const [campaigns, postmarkOver, bounce, plainUnsub] = hashes as [string, string, string, string];

  afterAll(async () => {
    await db.delete(emailSuppression).where(inArray(emailSuppression.emailHash, hashes));
    await db
      .delete(zohoCampaignsOptOutLift)
      .where(
        inArray(zohoCampaignsOptOutLift.emailHash, [
          ...hashes,
          "suppression-it-missing",
          "suppression-it-latest",
        ]),
      );
  });

  const read = async (hash: string) =>
    (await db.select().from(emailSuppression).where(eq(emailSuppression.emailHash, hash)))[0];

  it("labels a later Postmark report as Postmark, not Campaigns", async () => {
    await db.insert(emailSuppression).values({
      emailHash: postmarkOver,
      reason: "unsubscribed_marketing",
      source: "zoho_campaigns",
    });

    await repo.upsert(postmarkOver, "complaint");

    expect(await read(postmarkOver)).toMatchObject({ reason: "complaint", source: null });
  });

  it("lifts only a marketing opt-out that came from Campaigns", async () => {
    await db
      .insert(emailSuppression)
      .values({ emailHash: campaigns, reason: "unsubscribed_marketing", source: "zoho_campaigns" });
    await db.insert(emailSuppression).values({ emailHash: bounce, reason: "hard_bounce" });
    await db.insert(emailSuppression).values({ emailHash: plainUnsub, reason: "unsubscribe" });

    expect(await repo.liftMarketingOptOut(campaigns, new Date())).toBe(true);
    expect(await repo.liftMarketingOptOut(bounce, new Date())).toBe(false);
    expect(await repo.liftMarketingOptOut(plainUnsub, new Date())).toBe(false);
    expect(await repo.liftMarketingOptOut("suppression-it-missing", new Date())).toBe(false);

    expect(await read(campaigns)).toBeUndefined();
    expect(await read(bounce)).toMatchObject({ reason: "hard_bounce" });
    expect(await read(plainUnsub)).toMatchObject({ reason: "unsubscribe" });
  });

  it("records the lift even when there is no entry, keeping the latest time", async () => {
    const hash = "suppression-it-latest";
    const early = new Date("2026-01-01T00:00:00Z");
    const late = new Date("2026-02-01T00:00:00Z");
    await repo.liftMarketingOptOut(hash, late);
    await repo.liftMarketingOptOut(hash, early);
    const [row] = await db
      .select()
      .from(zohoCampaignsOptOutLift)
      .where(eq(zohoCampaignsOptOutLift.emailHash, hash));
    expect(row?.liftedAt).toEqual(late);
  });
});
