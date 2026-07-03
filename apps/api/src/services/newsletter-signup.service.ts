import crypto from "node:crypto";
import type { INewsletterSignupRepository } from "@auction/persistence";
import type { Queue } from "bullmq";

export type ZohoCampaignsSyncJobData = {
  signupLogId: string;
  email: string;
};

export type NewsletterSubscribeResult =
  | { ok: true; status: "already_subscribed" }
  | { ok: true; status: "subscribed" };

export class NewsletterSignupService {
  constructor(
    private readonly signups: INewsletterSignupRepository,
    private readonly marketingSyncQueue: Queue<ZohoCampaignsSyncJobData>,
  ) {}

  async subscribe(input: {
    email: string;
    source?: string | undefined;
  }): Promise<NewsletterSubscribeResult> {
    const emailHash = hashEmail(input.email);
    const existing = await this.signups.findByEmailHash(emailHash);
    if (existing) return { ok: true, status: "already_subscribed" };

    const row = await this.signups.createQueuedSignup({
      emailHash,
      source: input.source ?? "web",
    });

    await this.marketingSyncQueue.add(
      "zoho-campaigns-sync",
      { signupLogId: row.id, email: input.email } satisfies ZohoCampaignsSyncJobData,
      {
        jobId: row.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    return { ok: true, status: "subscribed" };
  }
}

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
