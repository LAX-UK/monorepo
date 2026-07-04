import type { Database } from "@auction/db";
import { newsletterSignupLog } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { INewsletterSignupSyncRepository } from "../interfaces/newsletter-signup-sync.repository.js";

export class DrizzleNewsletterSignupSyncRepository implements INewsletterSignupSyncRepository {
  constructor(private readonly db: Database) {}

  async markFailed(signupLogId: string): Promise<void> {
    await this.db
      .update(newsletterSignupLog)
      .set({ status: "failed", zohoResponseCode: null })
      .where(eq(newsletterSignupLog.id, signupLogId));
  }

  async markPushed(signupLogId: string, responseCode: number): Promise<void> {
    await this.db
      .update(newsletterSignupLog)
      .set({ status: "pushed", zohoResponseCode: responseCode })
      .where(eq(newsletterSignupLog.id, signupLogId));
  }

  async markRejected(signupLogId: string, responseCode: number): Promise<void> {
    await this.db
      .update(newsletterSignupLog)
      .set({ status: "rejected", zohoResponseCode: responseCode })
      .where(eq(newsletterSignupLog.id, signupLogId));
  }
}
