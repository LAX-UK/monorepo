import type { TemplateName, TemplateVarsByName } from "@auction/email";
import { formatMoneyMajor } from "@auction/email";
import type { IEmailService } from "@auction/email";
import type { IInvoiceDetailsReader, IUserRepository } from "@auction/persistence/interfaces";
import { notificationTypeToTemplate } from "@auction/persistence/lib";
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
    /** An organisation's billing email: invoices are copied there. */
    private readonly invoiceDetails: IInvoiceDetailsReader,
  ) {}

  supports(type: string): boolean {
    return notificationTypeToTemplate(type) !== null;
  }

  async send(userId: string, payload: NotificationPayload): Promise<void> {
    const template = notificationTypeToTemplate(payload.type) as TemplateName | null;
    if (!template) return;
    // The receipt is worded for the buyer ("we received your payment"); the seller side of the same
    // event has no email template, so sellers are told in-app and by push only.
    if (template === "payment-receipt" && payload.meta?.audience === "seller") return;
    const recipient = await this.users.findById(userId);
    if (!recipient) return;
    await this.email.enqueue({
      template,
      to: recipient.email,
      userId,
      category: "transactional",
      ...(payload.meta?.emailIdempotencyKey
        ? { idempotencyKey: payload.meta.emailIdempotencyKey }
        : {}),
      vars: this.varsFor(template, payload, recipient.name, userId) as never,
    });
    if (template === "payment-invoice") await this.copyInvoiceToBilling(payload, recipient.email);
  }

  /**
   * An organisation's invoice also goes to the billing email its finance team set, once per
   * payment, unless that is the member's own address. The member keeps their copy: there is no
   * cc in the outbox, so the billing inbox gets its own message.
   */
  private async copyInvoiceToBilling(payload: NotificationPayload, memberEmail: string) {
    if (!payload.legalEntityId) return;
    const details = await this.invoiceDetails.find(payload.legalEntityId);
    const billingEmail = details?.billingEmail;
    if (!billingEmail || billingEmail.toLowerCase() === memberEmail.toLowerCase()) return;
    const key = payload.meta?.paymentId ?? payload.meta?.invoiceNumber ?? payload.lotId ?? null;
    await this.email.enqueue({
      template: "payment-invoice",
      to: billingEmail,
      recipientResolution: "snapshot",
      category: "transactional",
      ...(key ? { idempotencyKey: `payment-invoice-billing:${payload.legalEntityId}:${key}` } : {}),
      vars: this.varsFor("payment-invoice", payload, "", "") as never,
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
          currentBid: formatMoneyMajor(payload.meta?.bidAmount, payload.meta?.currency),
          unsubscribeUrl,
        };
      case "lot-won": {
        const m = payload.meta;
        const hammerPrice = formatMoneyMajor(m?.hammerPrice, m?.currency);
        const totalDue = formatMoneyMajor(m?.totalDue, m?.currency);
        return {
          userName,
          lotTitle,
          lotUrl,
          winningBid: formatMoneyMajor(m?.bidAmount ?? m?.hammerPrice, m?.currency),
          // The call to action is paying for this lot, not browsing it.
          paymentUrl: payload.lotId
            ? `${this.baseUrl()}/purchases/checkout/${encodeURIComponent(payload.lotId)}`
            : `${this.baseUrl()}/purchases/checkout`,
          unsubscribeUrl,
          ...(hammerPrice ? { hammerPrice } : {}),
          ...(totalDue ? { totalDue } : {}),
        };
      }
      case "lot-ended-seller":
        return {
          userName,
          lotTitle,
          lotUrl,
          outcome: payload.meta?.outcome === "sold" ? "sold" : "unsold",
          hammerPrice: formatMoneyMajor(payload.meta?.hammerPrice, payload.meta?.currency),
          saleUrl: `${this.baseUrl()}/selling/consignments`,
          unsubscribeUrl,
        };
      case "lot-fulfilment-update":
        return {
          userName,
          lotTitle,
          heading: payload.title,
          message: payload.message,
          purchaseUrl: `${this.baseUrl()}/purchases`,
        };
      case "payment-receipt":
        return {
          userName,
          lotTitle,
          amount: formatMoneyMajor(payload.meta?.amount, payload.meta?.currency),
          receiptUrl: `${this.baseUrl()}/purchases`,
        };
      case "payment-invoice": {
        const m = payload.meta;
        const amount = m?.amount ?? payload.message;
        const invoiceNumber = m?.invoiceNumber ?? "Invoice";
        const dueDate = typeof m?.dueDate === "string" ? m.dueDate : undefined;
        const base = this.apiBaseUrl.replace(/\/$/, "");
        const invoiceUrl =
          m?.invoiceUrl && /^https?:\/\//i.test(m.invoiceUrl) ? m.invoiceUrl : `${base}/home`;
        const billTo: BillToContext = {
          kind: "individual",
          billToName: userName,
          addressLines: [],
          vatLine: null,
          addressIncomplete: true,
          poReference: null,
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
          ? `${this.apiBaseUrl.replace(/\/$/, "")}/selling/new?fromRejected=${encodeURIComponent(submissionId)}`
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
      case "submission-changes-requested": {
        return {
          userName,
          submissionTitle: payload.message.match(/"(.+?)"/)?.[1] ?? "Your item",
          submissionUrl: this.absoluteWebPath(payload),
          note: payload.message.includes(": ")
            ? payload.message.split(": ").slice(1).join(": ")
            : null,
          unsubscribeUrl,
        };
      }
      case "consignment-agreement-reminder": {
        return {
          userName,
          submissionTitle: payload.message.match(/"(.+?)"/)?.[1] ?? "Your item",
          submissionUrl: this.absoluteWebPath(payload),
          unsubscribeUrl,
        };
      }
      case "consignment-update": {
        return {
          userName,
          heading: payload.title,
          message: payload.message,
          submissionUrl: this.absoluteWebPath(payload),
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
      case "payout-bank-changed-notice":
        return {
          userName,
          entityName: payload.meta?.organisationName ?? "your organisation",
          bankLast4: payload.meta?.bankLast4 ?? null,
          payoutsUrl: `${this.baseUrl()}/organisation/payouts`,
        };
      default:
        throw new Error(`Notification payload cannot render template ${template}`);
    }
  }

  private baseUrl(): string {
    return this.apiBaseUrl.replace(/\/$/, "");
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
