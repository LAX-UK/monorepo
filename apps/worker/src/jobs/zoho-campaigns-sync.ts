import type { Database } from "@auction/db";
import { newsletterSignupLog } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";

export type ZohoCampaignsSyncJobData = {
  signupLogId: string;
  email: string;
};

export async function zohoCampaignsSyncJob({
  db,
  env,
  log,
  data,
}: {
  db: Database;
  env: WorkerEnv;
  log: pino.Logger;
  data: ZohoCampaignsSyncJobData;
}) {
  if (!env.ZOHO_CAMPAIGNS_API_KEY || !env.ZOHO_CAMPAIGNS_LIST_KEY) {
    log.warn({ signupLogId: data.signupLogId }, "Zoho Campaigns env not configured");
    await db
      .update(newsletterSignupLog)
      .set({ status: "failed", zohoResponseCode: null })
      .where(eq(newsletterSignupLog.id, data.signupLogId));
    return;
  }

  const url = new URL("/api/v1.1/json/listsubscribe", env.ZOHO_API_HOST);
  const body = new URLSearchParams({
    resfmt: "JSON",
    listkey: env.ZOHO_CAMPAIGNS_LIST_KEY,
    contactinfo: JSON.stringify({ "Contact Email": data.email }),
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${env.ZOHO_CAMPAIGNS_API_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (res.ok) {
    await db
      .update(newsletterSignupLog)
      .set({ status: "pushed", zohoResponseCode: res.status })
      .where(eq(newsletterSignupLog.id, data.signupLogId));
    return;
  }

  if (res.status >= 400 && res.status < 500) {
    await db
      .update(newsletterSignupLog)
      .set({ status: "rejected", zohoResponseCode: res.status })
      .where(eq(newsletterSignupLog.id, data.signupLogId));
    return;
  }

  throw new Error(`Zoho Campaigns push failed with ${res.status}`);
}
