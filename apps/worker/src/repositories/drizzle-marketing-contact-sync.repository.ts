import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  emailSuppression,
  marketingContactSyncLog,
} from "@auction/db/schema";
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
        id: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        emailVerified: bidIdentityDirectory.emailVerified,
        role: bidUserProfile.role,
        firstName: bidUserProfile.firstName,
        lastName: bidUserProfile.lastName,
        country: bidUserProfile.mobileCountry,
        kycStatus: bidUserProfile.kycStatus,
        signupPersona: bidUserProfile.signupPersona,
        emailStatus: bidUserProfile.emailStatus,
        suspendedAt: bidUserProfile.suspendedAt,
        deletionRequestedAt: bidIdentityDirectory.deletionRequestedAt,
        createdAt: bidIdentityDirectory.identityCreatedAt,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      role: row.role ?? "client",
      emailStatus: row.emailStatus ?? "ok",
      kycStatus: row.kycStatus ?? "unverified",
    };
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
