import type { INotificationPreferenceReader } from "@auction/persistence/interfaces";
import { defaultNotificationPreference } from "@auction/persistence/lib";
import { describe, expect, it } from "vitest";
import type {
  INotificationChannel,
  NotificationPayload,
} from "./interfaces/notification-channel.js";
import { NotificationDispatcher } from "./notification.dispatcher.js";

class SpyChannel implements INotificationChannel {
  readonly channelKind = "email" as const;
  readonly sent: (string | null)[] = [];

  supports() {
    return true;
  }

  async send(_userId: string, payload: NotificationPayload) {
    this.sent.push(payload.legalEntityId);
  }
}

const prefs: INotificationPreferenceReader = {
  async getForUser(userId) {
    return defaultNotificationPreference(userId);
  },
  async isChannelEnabled() {
    return true;
  },
};

const payload = (legalEntityId: string | null): NotificationPayload => ({
  type: "outbid",
  title: "Outbid",
  message: "Another bidder is ahead",
  legalEntityId,
});

describe("NotificationDispatcher organisation mutes", () => {
  it("delivers nothing about a muted organisation, and everything else", async () => {
    const channel = new SpyChannel();
    const dispatcher = new NotificationDispatcher(
      [channel],
      prefs,
      { isQuietTime: () => false },
      { listMutedAccountIds: async () => ["org-north"] },
    );

    await dispatcher.dispatch("ada", payload("org-north"));
    await dispatcher.dispatchStrict("ada", payload("org-north"));
    await dispatcher.dispatch("ada", payload("org-cedar"));
    await dispatcher.dispatch("ada", payload(null));

    expect(channel.sent).toEqual(["org-cedar", null]);
  });
});
