import type {
  INotificationChannel,
  NotificationPayload,
} from "../services/interfaces/notification-channel.js";
import type {
  IPushSender,
  IPushSubscriptionRepository,
  PushPayload,
} from "../services/interfaces/push.js";
import { notificationLotWebPath } from "../services/notification-payload.js";

const PUSH_TYPES = new Set([
  "outbid",
  "lot_won",
  "lot_ending_soon",
  "watchlist_ending_soon",
  "payment_received",
  "payment_due",
  "lot_cancelled",
]);

export class PushNotificationChannel implements INotificationChannel {
  readonly channelKind = "push" as const;

  constructor(
    private readonly sender: IPushSender,
    private readonly subscriptions: IPushSubscriptionRepository,
  ) {}

  supports(type: string): boolean {
    return PUSH_TYPES.has(type);
  }

  async send(userId: string, payload: NotificationPayload): Promise<void> {
    const subs = await this.subscriptions.findByUser(userId);
    const pushPayload: PushPayload = {
      title: payload.title,
      body: payload.message,
      url: notificationLotWebPath(payload),
      tag: payload.lotId ? `${payload.type}:${payload.lotId}` : payload.type,
    };
    for (const sub of subs) {
      try {
        const ok = await this.sender.send(sub.endpoint, sub.p256dh, sub.auth, pushPayload);
        if (!ok) {
          await this.subscriptions.deleteByEndpoint(sub.endpoint);
        }
      } catch (err) {
        console.warn("[PushNotificationChannel] send failed", {
          userId,
          endpoint: sub.endpoint,
          err,
        });
      }
    }
  }
}
