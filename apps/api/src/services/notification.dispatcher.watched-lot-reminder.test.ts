import type { INotificationPreferenceReader } from "@auction/persistence/interfaces";
import {
  defaultNotificationPreference,
  emailPreferenceKey,
  inAppPreferenceKey,
} from "@auction/persistence/lib";
import type { NotificationPreference } from "@auction/types";
import { describe, expect, it } from "vitest";
import type {
  INotificationChannel,
  NotificationPayload,
} from "./interfaces/notification-channel.js";
import { NotificationDispatcher } from "./notification.dispatcher.js";

class SpyChannel implements INotificationChannel {
  sent = 0;
  constructor(readonly channelKind: "email" | "in_app") {}
  supports() {
    return true;
  }
  async send(_userId: string, _payload: NotificationPayload) {
    this.sent += 1;
  }
}

/** Preferences read through the real type-to-switch table, as the repository does. */
function prefsWith(patch: Partial<NotificationPreference>): INotificationPreferenceReader {
  const prefs = { ...defaultNotificationPreference("u1"), ...patch };
  return {
    async getForUser() {
      return prefs;
    },
    async isChannelEnabled(_userId, type, channel) {
      const key = channel === "email" ? emailPreferenceKey(type) : inAppPreferenceKey(type);
      return key ? prefs[key] === true : true;
    },
  };
}

const reminder: NotificationPayload = {
  type: "watchlist_reminder",
  legalEntityId: null,
  title: 'Reminder: "Red chair, evening"',
  message: "It closes in about an hour.",
  lotId: "lot-1",
};

describe("watched-lot reminders and the Lots you watch switches", () => {
  it.each([
    [true, 1],
    [false, 0],
  ])("emails when the Lots you watch email switch is %s", async (watchlistEmail, emails) => {
    const email = new SpyChannel("email");
    const inApp = new SpyChannel("in_app");
    const dispatcher = new NotificationDispatcher([email, inApp], prefsWith({ watchlistEmail }), {
      isQuietTime: () => false,
    });
    await dispatcher.dispatch("u1", reminder);
    expect(email.sent).toBe(emails);
    expect(inApp.sent).toBe(1);
  });

  it("holds the email back in quiet hours, keeping the in-app notice", async () => {
    const email = new SpyChannel("email");
    const inApp = new SpyChannel("in_app");
    const dispatcher = new NotificationDispatcher(
      [email, inApp],
      prefsWith({ watchlistEmail: true, quietStart: "22:00", quietEnd: "07:00" }),
      { isQuietTime: () => true },
    );
    await dispatcher.dispatch("u1", reminder);
    expect(email.sent).toBe(0);
    expect(inApp.sent).toBe(1);
  });
});
