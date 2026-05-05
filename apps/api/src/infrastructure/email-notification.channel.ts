import type { TemplateName, TemplateVarsByName } from "@auction/email";
import { createUnsubscribeToken } from "../lib/email-unsubscribe-token.js";
import { notificationTypeToTemplate } from "../lib/notification-preference-keys.js";
import type { IEmailService } from "../services/interfaces/email.js";
import type {
  INotificationChannel,
  NotificationPayload,
} from "../services/interfaces/notification-channel.js";
import type { IUserRepository } from "../services/interfaces/repositories.js";

const OPT_OUTABLE = new Set(["outbid", "lot_won", "lot_ended_seller"]);

export class EmailNotificationChannel implements INotificationChannel {
  readonly channelKind = "email" as const;

  constructor(
    private readonly email: IEmailService,
    private readonly users: IUserRepository,
    private readonly apiBaseUrl: string,
    private readonly unsubscribeSecret: string,
  ) {}

  supports(type: string): boolean {
    return notificationTypeToTemplate(type) !== null;
  }

  async send(userId: string, payload: NotificationPayload): Promise<void> {
    const template = notificationTypeToTemplate(payload.type) as TemplateName | null;
    if (!template) return;
    const recipient = await this.users.findById(userId);
    if (!recipient) return;
    await this.email.enqueue({
      template,
      to: recipient.email,
      userId,
      category: "transactional",
      vars: this.varsFor(template, payload, recipient.name, userId) as never,
    });
  }

  private varsFor(
    template: TemplateName,
    payload: NotificationPayload,
    userName: string,
    userId: string,
  ): TemplateVarsByName[TemplateName] {
    const lotUrl = this.lotUrl(payload.lotId);
    const unsubscribeUrl = this.unsubscribeUrl(userId, payload.type);
    switch (template) {
      case "bid-outbid":
        return {
          userName,
          lotTitle: payload.title,
          lotUrl,
          currentBid: payload.message,
          unsubscribeUrl,
        };
      case "lot-won":
        return {
          userName,
          lotTitle: payload.title,
          lotUrl,
          winningBid: payload.message,
          unsubscribeUrl,
        };
      case "lot-ended-seller":
        return {
          userName,
          lotTitle: payload.title,
          lotUrl,
          unsubscribeUrl,
        };
      case "payment-receipt":
        return {
          userName,
          lotTitle: payload.title,
          amount: payload.message,
        };
      default:
        throw new Error(`Notification payload cannot render template ${template}`);
    }
  }

  private lotUrl(lotId?: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, "");
    return lotId ? `${base}/artwork/${encodeURIComponent(lotId)}` : base;
  }

  private unsubscribeUrl(userId: string, type: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, "");
    const token = createUnsubscribeToken(
      OPT_OUTABLE.has(type)
        ? {
            scope: "type",
            userId,
            notificationType: type as "outbid" | "lot_won" | "lot_ended_seller",
          }
        : { scope: "global", userId },
      this.unsubscribeSecret,
    );
    return `${base}/api/email/unsubscribe?t=${encodeURIComponent(token)}`;
  }
}
