import type { CapabilityRequirement } from "@auction/types";

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
  /** Verified-account id for trusted identity-linking workflows. */
  findVerifiedIdByEmail(email: string): Promise<string | null>;
  listIdsByRole(role: string): Promise<string[]>;
  /** Staff user ids that should receive new-item-submission notifications (appraisal / catalogue / auction). */
  listStaffIdsForSubmissionNotifications(): Promise<string[]>;
  /** Active staff email addresses for ops notifications. */
  listStaffEmails(): Promise<string[]>;
  /** Emails of active staff whose roles grant `requirement` and who can enter platform admin. */
  listStaffEmailsWithAccess(requirement: CapabilityRequirement): Promise<string[]>;
  /** The same people as `listStaffEmailsWithAccess`, with their account ids. */
  listStaffRecipientsWithAccess(
    requirement: CapabilityRequirement,
  ): Promise<{ userId: string; email: string }[]>;
  /** Public directory rows (no email) for marketing / mega-menu. */
  listPublicProfiles(params: {
    limit: number;
    offset: number;
  }): Promise<{ id: string; name: string; image: string | null }[]>;
  /** Mark the acting context tooltip as seen for the user. */
  updateActingContextTooltipSeen(userId: string, seen: boolean): Promise<void>;
}
