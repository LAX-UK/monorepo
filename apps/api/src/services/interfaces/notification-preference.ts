import type { NotificationPreference } from "@auction/types";

export interface INotificationPreferenceReader {
  getForUser(userId: string): Promise<NotificationPreference | null>;
  isChannelEnabled(userId: string, type: string, channel: "in_app" | "push"): Promise<boolean>;
}

export interface INotificationPreferenceWriter {
  upsert(
    userId: string,
    prefs: Partial<NotificationPreferenceInput>,
  ): Promise<NotificationPreference>;
}

/** Writable preference fields (no userId / updatedAt from client). */
export type NotificationPreferenceInput = Omit<NotificationPreference, "userId" | "updatedAt">;
