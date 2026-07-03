import type { Database } from "@auction/db";
import { newsletterSignupLog } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { INewsletterSignupRepository } from "../interfaces/newsletter-signup.repository.js";

export class DrizzleNewsletterSignupRepository implements INewsletterSignupRepository {
  constructor(private readonly db: Database) {}

  async findByEmailHash(emailHash: string): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: newsletterSignupLog.id })
      .from(newsletterSignupLog)
      .where(eq(newsletterSignupLog.emailHash, emailHash))
      .limit(1);
    return row ?? null;
  }

  async createQueuedSignup(input: {
    emailHash: string;
    source: string;
  }): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(newsletterSignupLog)
      .values({
        emailHash: input.emailHash,
        source: input.source,
        status: "queued",
      })
      .returning({ id: newsletterSignupLog.id });
    if (!row) throw new Error("newsletter signup log insert failed");
    return row;
  }
}
