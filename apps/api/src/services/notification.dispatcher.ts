import type {
  INotificationChannel,
  NotificationChannelKind,
  NotificationPayload,
} from "./interfaces/notification-channel.js";
import type { INotificationPreferenceReader } from "./interfaces/notification-preference.js";
import type { IQuietHoursChecker } from "./quiet-hours.checker.js";

/** Orchestrates notification delivery with preference + quiet-hours gates. */
export class NotificationDispatcher {
  constructor(
    private readonly channels: INotificationChannel[],
    private readonly preferences: INotificationPreferenceReader,
    private readonly quietHours: IQuietHoursChecker,
  ) {}

  async dispatch(userId: string, payload: NotificationPayload): Promise<void> {
    const prefs = await this.preferences.getForUser(userId);
    const quiet =
      prefs?.quietStart && prefs?.quietEnd
        ? this.quietHours.isQuietTime(prefs.quietStart, prefs.quietEnd)
        : false;

    for (const ch of this.channels) {
      if (!(await this.shouldDeliver(userId, payload.type, ch, quiet))) continue;
      try {
        await ch.send(userId, payload);
      } catch (err) {
        console.error(`[NotificationDispatcher] ${ch.channelKind} delivery failed`, err);
      }
    }
  }

  private async shouldDeliver(
    userId: string,
    type: string,
    channel: INotificationChannel,
    quiet: boolean,
  ): Promise<boolean> {
    if (!channel.supports(type)) return false;
    const kind = channel.channelKind;
    if (kind === "in_app") {
      return this.preferences.isChannelEnabled(userId, type, "in_app");
    }
    if (quiet) return false;
    return this.preferences.isChannelEnabled(userId, type, kind as NotificationChannelKind);
  }
}
