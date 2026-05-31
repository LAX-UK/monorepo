import type { Database } from "@auction/db";
import { kycVerification } from "@auction/db/schema";
import { desc, eq } from "drizzle-orm";
import type { AdminKycSession, IAdminUserKycReader } from "../services/interfaces/admin-user.js";

export class DrizzleAdminUserKycReader implements IAdminUserKycReader {
  constructor(private readonly db: Database) {}

  async listSessionsForUser(userId: string, limit = 50): Promise<AdminKycSession[]> {
    const cap = Math.min(100, Math.max(1, limit));
    const rows = await this.db
      .select({
        id: kycVerification.id,
        provider: kycVerification.provider,
        providerSessionId: kycVerification.providerSessionId,
        providerAttemptId: kycVerification.providerAttemptId,
        status: kycVerification.status,
        verifiedFirstName: kycVerification.verifiedFirstName,
        verifiedLastName: kycVerification.verifiedLastName,
        verifiedDateOfBirth: kycVerification.verifiedDateOfBirth,
        verifiedIdNumberLast4: kycVerification.verifiedIdNumberLast4,
        verifiedIdCountry: kycVerification.verifiedIdCountry,
        verifiedIdType: kycVerification.verifiedIdType,
        verifiedIdExpiry: kycVerification.verifiedIdExpiry,
        createdAt: kycVerification.createdAt,
        decisionAt: kycVerification.decisionAt,
      })
      .from(kycVerification)
      .where(eq(kycVerification.userId, userId))
      .orderBy(desc(kycVerification.createdAt))
      .limit(cap);

    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      providerSessionId: r.providerSessionId,
      providerAttemptId: r.providerAttemptId ?? null,
      status: r.status,
      verifiedFirstName: r.verifiedFirstName ?? null,
      verifiedLastName: r.verifiedLastName ?? null,
      verifiedDateOfBirth: r.verifiedDateOfBirth ?? null,
      verifiedIdNumberLast4: r.verifiedIdNumberLast4 ?? null,
      verifiedIdCountry: r.verifiedIdCountry ?? null,
      verifiedIdType: r.verifiedIdType ?? null,
      verifiedIdExpiry: r.verifiedIdExpiry ?? null,
      createdAt: r.createdAt,
      decisionAt: r.decisionAt ?? null,
    }));
  }
}
