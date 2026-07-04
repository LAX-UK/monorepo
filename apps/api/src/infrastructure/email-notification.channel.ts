import type { TemplateName, TemplateVarsByName } from "@auction/email";
import type { IEmailService } from "@auction/email";
import { notificationTypeToTemplate } from "@auction/persistence/lib";
import type { IUserRepository } from "@auction/persistence/interfaces";
import type { BillToContext } from "@auction/types";
import { createUnsubscribeToken } from "../lib/email-unsubscribe-token.js";
import type {
  INotificationChannel,
  NotificationPayload,
} from "../services/interfaces/notification-channel.js";
import {
  notificationLotTitle,
  notificationLotWebPath,
  notificationWebPath,
} from "../services/notification-payload.js";

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
    const lotUrl = this.lotUrl(payload);
    const lotTitle = notificationLotTitle(payload);
    const unsubscribeUrl = this.unsubscribeUrl(userId, payload.type);
    switch (template) {
      case "bid-outbid":
        return {
          userName,
          lotTitle,
          lotUrl,
          currentBid: payload.message,
          unsubscribeUrl,
        };
      case "lot-won": {
        const m = payload.meta;
        return {
          userName,
          lotTitle,
          lotUrl,
          winningBid: payload.message,
          unsubscribeUrl,
          ...(typeof m?.hammerPrice === "string" ? { hammerPrice: m.hammerPrice } : {}),
          ...(typeof m?.totalDue === "string" ? { totalDue: m.totalDue } : {}),
        };
      }
      case "lot-ended-seller":
        return {
          userName,
          lotTitle,
          lotUrl,
          unsubscribeUrl,
        };
      case "payment-receipt":
        return {
          userName,
          lotTitle,
          amount: payload.message,
        };
      case "payment-invoice": {
        const m = payload.meta;
        const amount = m?.amount ?? payload.message;
        const invoiceNumber = m?.invoiceNumber ?? "Invoice";
        const dueDate = typeof m?.dueDate === "string" ? m.dueDate : undefined;
        const base = this.apiBaseUrl.replace(/\/$/, "");
        const invoiceUrl =
          m?.invoiceUrl && /^https?:\/\//i.test(m.invoiceUrl) ? m.invoiceUrl : `${base}/dashboard`;
        const billTo: BillToContext = {
          kind: "individual",
          billToName: userName,
          addressLines: [],
          vatLine: null,
          addressIncomplete: true,
        };
        return {
          userName,
          invoiceNumber,
          amount,
          invoiceUrl,
          billTo,
          ...(dueDate ? { dueDate } : {}),
        };
      }
      case "submission-approved":
      case "submission-converted": {
        const submissionUrl = this.absoluteWebPath(payload);
        return {
          userName,
          submissionTitle: payload.message.match(/"(.+?)"/)?.[1] ?? "Your item",
          submissionUrl,
          unsubscribeUrl,
        };
      }
      case "submission-rejected": {
        const submissionUrl = this.absoluteWebPath(payload);
        const submissionId = payload.submissionId;
        const resubmitUrl = submissionId
          ? `${this.apiBaseUrl.replace(/\/$/, "")}/dashboard/submissions/new?fromRejected=${encodeURIComponent(submissionId)}`
          : submissionUrl;
        return {
          userName,
          submissionTitle: payload.message.match(/"(.+?)"/)?.[1] ?? "Your item",
          submissionUrl,
          resubmitUrl,
          reasonSummary: payload.message.includes(": ")
            ? payload.message.split(": ").slice(1).join(": ")
            : null,
          unsubscribeUrl,
        };
      }
      case "submission-draft-reminder": {
        const staleMatch = payload.message.match(/(\d+) days/);
        return {
          userName,
          submissionTitle: payload.message.match(/"(.+?)"/)?.[1] ?? "Your item",
          submissionUrl: this.absoluteWebPath(payload),
          staleDays: staleMatch ? Number(staleMatch[1]) : 7,
          unsubscribeUrl,
        };
      }
      default:
        throw new Error(`Notification payload cannot render template ${template}`);
    }
  }

  private lotUrl(payload: NotificationPayload): string {
    return this.absoluteWebPath(payload);
  }

  private absoluteWebPath(payload: NotificationPayload): string {
    const base = this.apiBaseUrl.replace(/\/$/, "");
    const path = notificationWebPath(payload) ?? notificationLotWebPath(payload);
    return path ? `${base}${path}` : base;
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
    return `${base}/unsubscribe?t=${encodeURIComponent(token)}`;
  }
}
