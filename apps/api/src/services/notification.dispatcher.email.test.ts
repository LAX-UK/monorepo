import { describe, expect, it } from "vitest";
import { defaultNotificationPreference } from "../lib/notification-preference-keys.js";
import type { INotificationChannel, NotificationPayload } from "./interfaces/notification-channel.js";
import type { INotificationPreferenceReader } from "./interfaces/notification-preference.js";
import { NotificationDispatcher } from "./notification.dispatcher.js";

class SpyChannel implements INotificationChannel {
  readonly channelKind = "email" as const;
  sent = 0;

  supports() {
    return true;
  }

  async send(_userId: string, _payload: NotificationPayload) {
    this.sent += 1;
  }
}

describe("NotificationDispatcher email channel", () => {
  it("respects email notification preferences", async () => {
    const channel = new SpyChannel();
    const prefs: INotificationPreferenceReader = {
      async getForUser(userId) {
        return { ...defaultNotificationPreference(userId), outbidEmail: false };
      },
      async isChannelEnabled(_userId, _type, channelKind) {
        return channelKind !== "email";
      },
    };
    const dispatcher = new NotificationDispatcher([channel], prefs, {
      isQuietTime: () => false,
    });

    await dispatcher.dispatch("user_1", {
      type: "outbid",
      title: "Outbid",
      message: "Another bidder is ahead",
    });

    expect(channel.sent).toBe(0);
  });
});
