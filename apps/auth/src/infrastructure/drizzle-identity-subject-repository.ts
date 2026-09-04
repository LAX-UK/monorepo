import type { IdentityDatabase } from "@auction/identity-db";
import { account, user } from "@auction/identity-db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  IIdentitySubjectRepository,
  IdentityOperationTransaction,
  IdentitySubjectRecord,
} from "../services/identity-operations.ports.js";
import { identityOperationDb } from "./drizzle-identity-unit-of-work.js";

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
}
