import { describe, expect, it, vi } from "vitest";
import { defaultNotificationPreference } from "../lib/notification-preference-keys.js";
import type {
  INotificationChannel,
  NotificationPayload,
} from "./interfaces/notification-channel.js";
import type { INotificationPreferenceReader } from "./interfaces/notification-preference.js";
import { NotificationDispatcher } from "./notification.dispatcher.js";

class FailingChannel implements INotificationChannel {
  readonly channelKind = "push" as const;

  supports() {
    return true;
  }

  async send() {
    throw new Error("push provider down");
  }
}

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

const enabledPrefs: INotificationPreferenceReader = {
  async getForUser(userId) {
    return defaultNotificationPreference(userId);
  },
  async isChannelEnabled() {
    return true;
  },
};

describe("NotificationDispatcher resilience", () => {
  it("delivers through later channels when an earlier channel throws", async () => {
    const email = new SpyChannel();
    const dispatcher = new NotificationDispatcher([new FailingChannel(), email], enabledPrefs, {
      isQuietTime: () => false,
    });

    await dispatcher.dispatch("user_1", {
      type: "outbid",
      title: "Outbid",
      message: "Another bidder is ahead",
    });

    expect(email.sent).toBe(1);
  });

  it("logs channel failures without rethrowing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dispatcher = new NotificationDispatcher([new FailingChannel()], enabledPrefs, {
      isQuietTime: () => false,
    });

    await expect(
      dispatcher.dispatch("user_1", {
        type: "outbid",
        title: "Outbid",
        message: "Another bidder is ahead",
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("throws from dispatchStrict when any attempted channel fails", async () => {
    const dispatcher = new NotificationDispatcher([new FailingChannel()], enabledPrefs, {
      isQuietTime: () => false,
    });

    await expect(
      dispatcher.dispatchStrict("user_1", {
        type: "outbid",
        title: "Outbid",
        message: "Another bidder is ahead",
      }),
    ).rejects.toThrow(/push/);
  });
});
