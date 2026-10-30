/** An organisation a person has muted, as their settings list it. */
export type NotificationAccountMuteRecord = {
  legalEntityId: string;
  displayName: string;
  mutedAt: Date;
};

/** Which accounts a person has muted; delivery reads this before sending anything. */
export interface INotificationAccountMuteReader {
  listMutedAccountIds(userId: string): Promise<string[]>;
}

/** A person's organisation mutes. */
export interface INotificationAccountMuteStore extends INotificationAccountMuteReader {
  listForUser(userId: string): Promise<NotificationAccountMuteRecord[]>;
  /** Whether `legalEntityId` is an organisation (not a personal account) the person belongs to. */
  isMemberOfOrganisation(userId: string, legalEntityId: string): Promise<boolean>;
  /** Idempotent: muting twice keeps the first time. */
  mute(userId: string, legalEntityId: string): Promise<void>;
  /** `false` when the account was not muted. */
  unmute(userId: string, legalEntityId: string): Promise<boolean>;
}
