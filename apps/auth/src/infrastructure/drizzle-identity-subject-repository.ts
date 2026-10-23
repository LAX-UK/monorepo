import type { IdentityDatabase } from "@auction/identity-db";
import { account, twoFactor, user } from "@auction/identity-db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type {
  IIdentitySubjectRepository,
  IdentityOperationTransaction,
  IdentitySubjectRecord,
} from "../services/identity-operations.ports.js";
import { identityOperationDb } from "./drizzle-identity-unit-of-work.js";

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown; cause?: { code?: unknown } } | null) ?? {};
  return code.code === "23505" || code.cause?.code === "23505";
}

const subjectSelection = {
  id: user.id,
  email: user.email,
  name: user.name,
  emailVerified: user.emailVerified,
  identityDisabledAt: user.identityDisabledAt,
  mergedIntoSubjectId: user.mergedIntoSubjectId,
};

export class DrizzleIdentitySubjectRepository implements IIdentitySubjectRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async findById(subjectId: string): Promise<IdentitySubjectRecord | null> {
    const [row] = await this.db
      .select(subjectSelection)
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);
    return row ?? null;
  }

  async findByEmail(email: string): Promise<IdentitySubjectRecord | null> {
    const [row] = await this.db
      .select(subjectSelection)
      .from(user)
      .where(sql`lower(trim(${user.email})) = ${email.trim().toLowerCase()}`)
      .limit(1);
    return row ?? null;
  }

  async readSecurityStatus(subjectId: string) {
    const [row] = await this.db
      .select({
        twoFactorEnabled: user.twoFactorEnabled,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified,
        pendingNewEmail: user.pendingNewEmail,
        emailChangeExpiresAt: user.emailChangeExpiresAt,
      })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);
    return row ?? null;
  }

  async updateProfile(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    patch: { name?: string; image?: string | null },
    now: Date,
  ): Promise<{ id: string; name: string; image: string | null } | null> {
    const tx = identityOperationDb(this.db, transaction);
    const [updated] = await tx
      .update(user)
      .set({ ...patch, updatedAt: now })
      .where(eq(user.id, subjectId))
      .returning({ id: user.id, name: user.name, image: user.image });
    return updated ?? null;
  }

  async setVerifiedPhone(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    phone: string,
    now: Date,
  ): Promise<"updated" | "phone_taken" | "not_found"> {
    const tx = identityOperationDb(this.db, transaction);
    const [holder] = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.phoneNumber, phone), ne(user.id, subjectId)))
      .limit(1);
    if (holder) return "phone_taken";
    try {
      const rows = await tx
        .update(user)
        .set({ phoneNumber: phone, phoneNumberVerified: true, updatedAt: now })
        .where(eq(user.id, subjectId))
        .returning({ id: user.id });
      return rows[0] ? "updated" : "not_found";
    } catch (error) {
      // Two people verifying the same number at once: the partial unique index decides.
      if (isUniqueViolation(error)) return "phone_taken";
      throw error;
    }
  }

  async markDeletionRequested(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    now: Date,
  ): Promise<boolean> {
    const tx = identityOperationDb(this.db, transaction);
    const rows = await tx
      .update(user)
      .set({ deletionRequestedAt: now, updatedAt: now })
      .where(eq(user.id, subjectId))
      .returning({ id: user.id });
    return Boolean(rows[0]);
  }

  async cancelDeletionRequested(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    now: Date,
  ): Promise<boolean> {
    const tx = identityOperationDb(this.db, transaction);
    const rows = await tx
      .update(user)
      .set({ deletionRequestedAt: null, updatedAt: now })
      .where(eq(user.id, subjectId))
      .returning({ id: user.id });
    return Boolean(rows[0]);
  }

  async lockForCompensation(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<{ id: string; createdAt: Date } | null> {
    const tx = identityOperationDb(this.db, transaction);
    const [subject] = await tx
      .select({ id: user.id, createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1)
      .for("update");
    return subject ?? null;
  }

  async listAccountProviders(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<string[]> {
    const tx = identityOperationDb(this.db, transaction);
    const rows = await tx
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, subjectId));
    return rows.map((row) => row.providerId);
  }

  async deleteSubject(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<boolean> {
    const tx = identityOperationDb(this.db, transaction);
    const rows = await tx.delete(user).where(eq(user.id, subjectId)).returning({ id: user.id });
    return rows.length > 0;
  }

  async resetTwoFactorEnrollment(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    now: Date,
  ): Promise<boolean> {
    const tx = identityOperationDb(this.db, transaction);
    await tx.delete(twoFactor).where(eq(twoFactor.userId, subjectId));
    const rows = await tx
      .update(user)
      .set({ twoFactorEnabled: false, updatedAt: now })
      .where(eq(user.id, subjectId))
      .returning({ id: user.id });
    return rows.length > 0;
  }
}
