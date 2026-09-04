import type { IdentityDatabase } from "@auction/identity-db";
import { user } from "@auction/identity-db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type {
  IIdentityEmailChangeRepository,
  IdentityEmailChangeRecord,
  IdentityOperationTransaction,
} from "../services/identity-operations.ports.js";
import { identityOperationDb } from "./drizzle-identity-unit-of-work.js";

export class DrizzleIdentityEmailChangeRepository implements IIdentityEmailChangeRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async startChange(input: {
    subjectId: string;
    newEmail: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void> {
    await this.db
      .update(user)
      .set({
        pendingNewEmail: input.newEmail,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: input.expiresAt,
        updatedAt: input.now,
      })
      .where(eq(user.id, input.subjectId));
  }

  async readPending(subjectId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ pendingNewEmail: user.pendingNewEmail })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);
    return row?.pendingNewEmail ?? null;
  }

  async clearPending(subjectId: string, now: Date): Promise<void> {
    await this.db
      .update(user)
      .set({
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(user.id, subjectId));
  }

  async loadForConfirmation(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<IdentityEmailChangeRecord | null> {
    const tx = identityOperationDb(this.db, transaction);
    const [row] = await tx
      .select({
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        pendingNewEmail: user.pendingNewEmail,
        emailChangeOldOk: user.emailChangeOldOk,
        emailChangeNewOk: user.emailChangeNewOk,
        emailChangeExpiresAt: user.emailChangeExpiresAt,
      })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);
    return row ?? null;
  }

  async markConfirmed(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    confirmFor: "old" | "new",
    now: Date,
  ): Promise<void> {
    const tx = identityOperationDb(this.db, transaction);
    const confirmation =
      confirmFor === "old" ? { emailChangeOldOk: true } : { emailChangeNewOk: true };
    await tx
      .update(user)
      .set({ ...confirmation, updatedAt: now })
      .where(eq(user.id, subjectId));
  }

  async findEmailOwner(
    transaction: IdentityOperationTransaction,
    email: string,
    exceptSubjectId: string,
  ): Promise<string | null> {
    const tx = identityOperationDb(this.db, transaction);
    const [clash] = await tx
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          sql`lower(trim(${user.email})) = ${email.trim().toLowerCase()}`,
          ne(user.id, exceptSubjectId),
        ),
      )
      .limit(1);
    return clash?.id ?? null;
  }

  async applyPendingEmail(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    newEmail: string,
    now: Date,
  ): Promise<void> {
    const tx = identityOperationDb(this.db, transaction);
    await tx
      .update(user)
      .set({
        email: newEmail,
        emailVerified: true,
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(user.id, subjectId));
  }
}
