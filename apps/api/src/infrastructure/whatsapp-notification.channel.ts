import type {
  INotificationChannel,
  NotificationPayload,
} from "../services/interfaces/notification-channel.js";

const SUPPORTED_TYPES = new Set([
  "outbid",
  "lot_won",
  "lot_lost",
  "lot_ending_soon",
  "watchlist_ending_soon",
  "payment_received",
  "payment_due",
  "lot_ended_seller",
]);

export class WhatsappNotificationChannel implements INotificationChannel {
  readonly channelKind = "whatsapp" as const;

  supports(type: string): boolean {
    return SUPPORTED_TYPES.has(type);
  }

  async send(_userId: string, _payload: NotificationPayload): Promise<void> {
    throw new Error(
      "WhatsApp channel is registered but not yet wired; enable it only with an implementation",
    );
  }
}
