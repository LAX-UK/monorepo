import type {
  INotificationChannel,
  NotificationPayload,
} from "./interfaces/notification-channel.js";
import type { INotificationPreferenceReader } from "./interfaces/notification-preference.js";
import type { IQuietHoursChecker } from "./quiet-hours.checker.js";

/** Orchestrates in-app + push delivery with preference + quiet-hours gates. */
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
      if (!ch.supports(payload.type)) continue;
      if (ch.channelKind === "in_app") {
        if (!(await this.preferences.isChannelEnabled(userId, payload.type, "in_app"))) continue;
        await ch.send(userId, payload);
      } else if (ch.channelKind === "push") {
        if (!(await this.preferences.isChannelEnabled(userId, payload.type, "push"))) continue;
        if (quiet) continue;
        await ch.send(userId, payload);
      }
    }
  }
}
