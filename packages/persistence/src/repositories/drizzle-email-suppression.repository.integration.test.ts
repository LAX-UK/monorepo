import { createDb } from "@auction/db";
import { emailSuppression } from "@auction/db/schema";
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

    expect(await repo.liftMarketingOptOut(campaigns)).toBe(true);
    expect(await repo.liftMarketingOptOut(bounce)).toBe(false);
    expect(await repo.liftMarketingOptOut(plainUnsub)).toBe(false);
    expect(await repo.liftMarketingOptOut("suppression-it-missing")).toBe(false);

    expect(await read(campaigns)).toBeUndefined();
    expect(await read(bounce)).toMatchObject({ reason: "hard_bounce" });
    expect(await read(plainUnsub)).toMatchObject({ reason: "unsubscribe" });
  });
});
