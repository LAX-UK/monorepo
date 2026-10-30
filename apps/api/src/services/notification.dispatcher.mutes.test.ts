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

  it("still delivers required notices about a muted organisation, in-app and by email", async () => {
    const inApp = new SpyChannel();
    const email = new SpyChannel();
    Object.assign(inApp, { channelKind: "in_app" });
    const dispatcher = new NotificationDispatcher(
      [inApp, email],
      prefs,
      { isQuietTime: () => false },
      { listMutedAccountIds: async () => ["org-north"] },
    );

    for (const type of ["payment_due", "lot_won", "consignment_agreement_reminder"]) {
      await dispatcher.dispatch("ada", { ...payload("org-north"), type });
    }

    expect(inApp.sent).toEqual(["org-north", "org-north", "org-north"]);
    expect(email.sent).toEqual(["org-north", "org-north", "org-north"]);
  });
});
