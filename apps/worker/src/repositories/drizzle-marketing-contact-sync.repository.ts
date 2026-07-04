import type { Database } from "@auction/db";
import { emailSuppression, marketingContactSyncLog, user } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { eq } from "drizzle-orm";
import type {
  IMarketingContactSyncRepository,
  MarketingContactSyncAuditInput,
  MarketingContactSyncUserRow,
} from "../interfaces/marketing-contact-sync.repository.js";

export class DrizzleMarketingContactSyncRepository implements IMarketingContactSyncRepository {
  constructor(private readonly db: Database) {}

  async findUserById(userId: string): Promise<MarketingContactSyncUserRow | null> {
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        country: user.mobileCountry,
        kycStatus: user.kycStatus,
        signupPersona: user.signupPersona,
        emailStatus: user.emailStatus,
        suspendedAt: user.suspendedAt,
        deletionRequestedAt: user.deletionRequestedAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  }

  async isEmailSuppressed(email: string): Promise<boolean> {
    const [hit] = await this.db
      .select({ emailHash: emailSuppression.emailHash })
      .from(emailSuppression)
      .where(eq(emailSuppression.emailHash, emailHash(email)))
      .limit(1);
    return Boolean(hit);
  }

  async writeAuditLog(input: MarketingContactSyncAuditInput): Promise<void> {
    await this.db.insert(marketingContactSyncLog).values({
      userId: input.userId,
      provider: input.provider,
      action: input.action,
      status: input.status,
      reason: input.reason,
      providerContactId: input.providerContactId ?? null,
      responseCode: input.responseCode ?? null,
      error: input.error ?? null,
    });
  }
}
