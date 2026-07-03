import type { DbTransaction } from "./artist-delete.repository.js";

export type UserProfileRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  staffRole: string | null;
  /** Public avatar URL (OAuth / profile); safe to expose on public user endpoints */
  image: string | null;
  hasSeenActingContextTooltip: boolean;
};

export interface IUserRepository {
  findById(id: string): Promise<UserProfileRow | null>;
  /** Case-insensitive email lookup (invitation duplicate checks). */
  findByEmail(email: string): Promise<UserProfileRow | null>;
  listIdsByRole(role: string): Promise<string[]>;
  /** Staff user ids that should receive new-item-submission notifications (appraisal / catalogue / auction). */
  listStaffIdsForSubmissionNotifications(): Promise<string[]>;
  /** Active staff email addresses for ops notifications. */
  listStaffEmails(): Promise<string[]>;
  /** Public directory rows (no email) for marketing / mega-menu. */
  listPublicProfiles(params: {
    limit: number;
    offset: number;
  }): Promise<{ id: string; name: string; image: string | null }[]>;
  /** Mark the acting context tooltip as seen for the user. */
  updateActingContextTooltipSeen(userId: string, seen: boolean): Promise<void>;
  /** Record account deletion request inside an open transaction. */
  markDeletionRequested(userId: string, tx: DbTransaction): Promise<void>;
}
