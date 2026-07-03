import type { Database } from "@auction/db";
import type { EmailChangeConfirmPayload } from "./user-email-change.types.js";

export interface IUserEmailChangeRepository {
  /** True when another user already owns the normalized email. */
  isEmailTakenByOtherUser(normalizedEmail: string, excludeUserId: string): Promise<boolean>;

  setPendingChange(userId: string, newEmail: string, expiresAt: Date): Promise<void>;

  getPendingNewEmail(userId: string): Promise<string | null>;

  clearPendingChange(userId: string): Promise<void>;

  /**
   * Runs the confirm step inside `authDb.transaction` (preserves existing dual-DB boundary).
   * Returns true when both sides confirmed and email applied; false when only one side confirmed.
   */
  confirmInAuthTransaction(authDb: Database, payload: EmailChangeConfirmPayload): Promise<boolean>;
}
