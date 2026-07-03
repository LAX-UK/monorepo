import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import type { IUserEmailChangeRepository } from "./interfaces/user-email-change.repository.js";
import {
  EmailChangeConfirmError,
  type EmailChangeConfirmPayload,
} from "./user-email-change.types.js";

export class DrizzleUserEmailChangeRepository implements IUserEmailChangeRepository {
  constructor(private readonly db: Database) {}

  async isEmailTakenByOtherUser(normalizedEmail: string, excludeUserId: string): Promise<boolean> {
    const [clash] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${normalizedEmail}`)
      .limit(1);
    return Boolean(clash && clash.id !== excludeUserId);
  }

  async setPendingChange(userId: string, newEmail: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(user)
      .set({
        pendingNewEmail: newEmail,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }

  async getPendingNewEmail(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ pendingNewEmail: user.pendingNewEmail })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.pendingNewEmail ?? null;
  }

  async clearPendingChange(userId: string): Promise<void> {
    await this.db
      .update(user)
      .set({
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }

  async confirmInAuthTransaction(
    authDb: Database,
    payload: EmailChangeConfirmPayload,
  ): Promise<boolean> {
    return authDb.transaction(async (tx) => {
      const [row] = await tx.select().from(user).where(eq(user.id, payload.userId)).limit(1);
      if (!row) throw new EmailChangeConfirmError("user_not_found");
      if (!row.pendingNewEmail || row.pendingNewEmail !== payload.newEmail) {
        throw new EmailChangeConfirmError("stale_flow");
      }
      if (row.email !== payload.oldEmail) {
        throw new EmailChangeConfirmError("stale_flow");
      }
      if (row.emailChangeExpiresAt && row.emailChangeExpiresAt.getTime() < Date.now()) {
        throw new EmailChangeConfirmError("expired");
      }

      if (payload.confirmFor === "old") {
        await tx
          .update(user)
          .set({ emailChangeOldOk: true, updatedAt: new Date() })
          .where(eq(user.id, payload.userId));
      } else {
        await tx
          .update(user)
          .set({ emailChangeNewOk: true, updatedAt: new Date() })
          .where(eq(user.id, payload.userId));
      }

      const [fresh] = await tx.select().from(user).where(eq(user.id, payload.userId)).limit(1);
      if (!fresh?.pendingNewEmail) return false;
      if (!fresh.emailChangeOldOk || !fresh.emailChangeNewOk) return false;

      const [other] = await tx
        .select({ id: user.id })
        .from(user)
        .where(
          and(sql`lower(${user.email}) = ${fresh.pendingNewEmail}`, ne(user.id, payload.userId)),
        )
        .limit(1);
      if (other) throw new EmailChangeConfirmError("email_taken");

      await tx
        .update(user)
        .set({
          email: fresh.pendingNewEmail,
          emailVerified: true,
          emailStatus: "ok",
          emailStatusChangedAt: new Date(),
          pendingNewEmail: null,
          emailChangeOldOk: false,
          emailChangeNewOk: false,
          emailChangeExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, payload.userId));
      return true;
    });
  }
}
