import type { IdentityDatabase } from "@auction/identity-db";
import { user } from "@auction/identity-db/schema";
import { and, eq, isNotNull, lte, ne, sql } from "drizzle-orm";
import { isPendingEmailExpired } from "../lib/pending-email-change.js";
import type {
  IIdentityEmailChangeRepository,
  IdentityEmailChangeRecord,
  IdentityOperationTransaction,
} from "../services/identity-operations.ports.js";
import { identityOperationDb } from "./drizzle-identity-unit-of-work.js";

export class DrizzleIdentityEmailChangeRepository implements IIdentityEmailChangeRepository {
  constructor(private readonly db: IdentityDatabase) {}

  /**
   * The unique index on the pending address cannot know about expiry, so claiming an address first
   * frees it from any expired change, in the same transaction. A live change by someone else still
   * holds it.
   */
  async startChange(input: {
    subjectId: string;
    newEmail: string;
    expiresAt: Date;
    now: Date;
  }): Promise<"started" | "address_pending"> {
    return this.db.transaction(async (tx) => {
      const holders = await tx
        .select({
          id: user.id,
          emailChangeExpiresAt: user.emailChangeExpiresAt,
        })
        .from(user)
        .where(
          and(
            sql`lower(trim(${user.pendingNewEmail})) = ${input.newEmail.trim().toLowerCase()}`,
            ne(user.id, input.subjectId),
          ),
        )
        .for("update");
      const live = holders.some(
        (holder) => !isPendingEmailExpired(holder.emailChangeExpiresAt, input.now),
      );
      if (live) return "address_pending";
      for (const holder of holders) await this.clearPendingWith(tx, holder.id, input.now);
      await tx
        .update(user)
        .set({
          pendingNewEmail: input.newEmail,
          emailChangeOldOk: false,
          emailChangeNewOk: false,
          emailChangeExpiresAt: input.expiresAt,
          updatedAt: input.now,
        })
        .where(eq(user.id, input.subjectId));
      return "started";
    });
  }

  async clearExpired(now: Date): Promise<number> {
    const cleared = await this.db
      .update(user)
      .set({
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
        updatedAt: now,
      })
      .where(and(isNotNull(user.pendingNewEmail), lte(user.emailChangeExpiresAt, now)))
      .returning({ id: user.id });
    return cleared.length;
  }

  private async clearPendingWith(
    db: Pick<IdentityDatabase, "update">,
    subjectId: string,
    now: Date,
  ): Promise<void> {
    await db
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

  async readPending(subjectId: string) {
    const [row] = await this.db
      .select({
        pendingNewEmail: user.pendingNewEmail,
        emailChangeExpiresAt: user.emailChangeExpiresAt,
      })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);
    return row ?? null;
  }

  async clearPending(subjectId: string, now: Date): Promise<boolean> {
    const cleared = await this.db
      .update(user)
      .set({
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
        updatedAt: now,
      })
      .where(and(eq(user.id, subjectId), isNotNull(user.pendingNewEmail)))
      .returning({ id: user.id });
    return cleared.length > 0;
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
