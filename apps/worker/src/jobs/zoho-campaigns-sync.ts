import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import type { INewsletterSignupSyncRepository } from "../interfaces/newsletter-signup-sync.repository.js";

export type ZohoCampaignsSyncJobData = {
  signupLogId: string;
  email: string;
};

export async function zohoCampaignsSyncJob({
  newsletterSignupSyncRepo,
  env,
  log,
  data,
}: {
  newsletterSignupSyncRepo: INewsletterSignupSyncRepository;
  env: WorkerEnv;
  log: pino.Logger;
  data: ZohoCampaignsSyncJobData;
}) {
  if (!env.ZOHO_CAMPAIGNS_API_KEY || !env.ZOHO_CAMPAIGNS_LIST_KEY) {
    log.warn({ signupLogId: data.signupLogId }, "Zoho Campaigns env not configured");
    await newsletterSignupSyncRepo.markFailed(data.signupLogId);
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
    await newsletterSignupSyncRepo.markPushed(data.signupLogId, res.status);
    return;
  }

  if (res.status >= 400 && res.status < 500) {
    await newsletterSignupSyncRepo.markRejected(data.signupLogId, res.status);
    return;
  }

  throw new Error(`Zoho Campaigns push failed with ${res.status}`);
}
