import {
  notificationIgnoresQuietHours,
  notificationIsMutable,
  notificationSilencedByMute,
} from "@auction/domain";
import type {
  INotificationAccountMuteReader,
  INotificationPreferenceReader,
} from "@auction/persistence/interfaces";
import type {
  INotificationChannel,
  NotificationChannelKind,
  NotificationPayload,
} from "./interfaces/notification-channel.js";
import type { IQuietHoursChecker } from "./quiet-hours.checker.js";

export class NotificationDispatchError extends Error {
  readonly failedChannels: string[];

  constructor(failedChannels: string[]) {
    super(`Notification delivery failed: ${failedChannels.join(", ")}`);
    this.name = "NotificationDispatchError";
    this.failedChannels = failedChannels;
  }
}

/** Orchestrates notification delivery with mute, preference and quiet-hours gates. */
export class NotificationDispatcher {
  constructor(
    private readonly channels: INotificationChannel[],
    private readonly preferences: INotificationPreferenceReader,
    private readonly quietHours: IQuietHoursChecker,
    /** Organisations the recipient muted get no delivery on any channel. */
    private readonly mutes: INotificationAccountMuteReader | null = null,
  ) {}

  /** Best-effort delivery: channel failures are logged and skipped. */
  async dispatch(userId: string, payload: NotificationPayload): Promise<void> {
    await this.deliver(userId, payload, "best_effort");
  }

  /** Strict delivery for outbox drain: throws when any attempted channel fails. */
  async dispatchStrict(userId: string, payload: NotificationPayload): Promise<void> {
    await this.deliver(userId, payload, "strict");
  }

  private async deliver(
    userId: string,
    payload: NotificationPayload,
    mode: "best_effort" | "strict",
  ): Promise<void> {
    if (await this.isSilencedByMute(userId, payload)) return;
    const prefs = await this.preferences.getForUser(userId);
    const quiet = prefs
      ? this.quietHours.isQuietTime({
          start: prefs.quietStart,
          end: prefs.quietEnd,
          timeZone: prefs.quietTimeZone,
        })
      : false;

    const failedChannels: string[] = [];

    for (const ch of this.channels) {
      if (!(await this.shouldDeliver(userId, payload.type, ch, quiet))) continue;
      try {
        await ch.send(userId, payload);
      } catch (err) {
        console.error(`[NotificationDispatcher] ${ch.channelKind} delivery failed`, err);
        if (mode === "strict") {
          failedChannels.push(ch.channelKind);
        }
      }
    }

    if (mode === "strict" && failedChannels.length > 0) {
      throw new NotificationDispatchError(failedChannels);
    }
  }

  /** Informational notices about a muted account are silenced; required notices never are. */
  private async isSilencedByMute(userId: string, payload: NotificationPayload) {
    if (!this.mutes || payload.legalEntityId == null || !notificationIsMutable(payload.type)) {
      return false;
    }
    return notificationSilencedByMute(payload, await this.mutes.listMutedAccountIds(userId));
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
    // Quiet hours hold back every notice except security alerts that cannot wait.
    if (quiet && !notificationIgnoresQuietHours(type)) return false;
    return this.preferences.isChannelEnabled(userId, type, kind as NotificationChannelKind);
  }
}
