import crypto from "node:crypto";
import { newsletterSignupLog } from "@auction/db/schema";
import { newsletterSubscribeSchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Container } from "../container.js";

export type ZohoCampaignsSyncJobData = {
  signupLogId: string;
  email: string;
};

export function createNewsletterRoutes(container: Container) {
  const r = new Hono();

  r.post("/subscribe", zValidator("json", newsletterSubscribeSchema), async (c) => {
    const body = c.req.valid("json");
    const emailHash = hashEmail(body.email);
    const [existing] = await container.db
      .select({ id: newsletterSignupLog.id })
      .from(newsletterSignupLog)
      .where(eq(newsletterSignupLog.emailHash, emailHash))
      .limit(1);
    if (existing) return c.json({ ok: true, status: "already_subscribed" });

    const [row] = await container.db
      .insert(newsletterSignupLog)
      .values({
        emailHash,
        source: body.source ?? "web",
        status: "queued",
      })
      .returning({ id: newsletterSignupLog.id });
    if (!row) throw new Error("newsletter signup log insert failed");

    await container.marketingSyncQueue.add(
      "zoho-campaigns-sync",
      { signupLogId: row.id, email: body.email } satisfies ZohoCampaignsSyncJobData,
      {
        jobId: row.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    return c.json({ ok: true, status: "subscribed" });
  });

  return r;
}

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
