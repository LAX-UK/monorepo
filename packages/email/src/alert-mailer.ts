import {
  type AlertMailer,
  type ConfirmationMessage,
  type DigestMessage,
  type DigestVm,
  TOPIC_CATALOGUE,
} from "@auction/alerts";
import { LAX_PRODUCT_NAMES } from "@auction/branding";
import type { IEmailService } from "./service.js";
import type { AlertDigestGroup } from "./templates/types/sale-alerts.js";

export type AlertMailerOptions = { email: IEmailService };

const CONFIRM_COPY = {
  bid: {
    subject: "Confirm your LAX Bid sale alerts",
    title: "Confirm your sale alerts",
    intro:
      "Confirm that you want an email when LAX Bid announces a new sale. At most one email a day.",
    buttonLabel: "Confirm sale alerts",
    sourceName: "LAX Bid sale alerts form",
    stopLabel: "Never email this address about sale alerts",
  },
  shop: {
    subject: "Confirm your LAX Shop release alerts",
    title: "Confirm your release alerts",
    intro:
      "Confirm that you want an email when LAX Shop releases new editions. At most one email a day.",
    buttonLabel: "Confirm release alerts",
    sourceName: "LAX Shop release alerts form",
    stopLabel: "Never email this address about release alerts",
  },
  art: {
    subject: "Confirm your lax.art alerts",
    title: "Confirm your alerts",
    intro:
      "Confirm that you want an email when new work arrives on lax.art. At most one email a day.",
    buttonLabel: "Confirm alerts",
    sourceName: "lax.art alerts form",
    stopLabel: "Never email this address about alerts",
  },
} as const;

function reasonFor(message: DigestMessage): string {
  const name = LAX_PRODUCT_NAMES[message.product];
  const cap = "At most one email a day.";
  if (message.product === "shop") {
    return `You asked ${name} to email you when new editions are released. ${cap}`;
  }
  if (message.product === "art") return `You follow artists on ${name}. ${cap}`;
  return message.audience === "visitor"
    ? `You get this because you asked ${name} to email you when a sale is announced. ${cap}`
    : `You get this because you asked ${name} for alerts about new sales, artists you follow and saved searches. ${cap}`;
}

/** "Wednesday 4 November": the London day a digest is for, from its `YYYY-MM-DD` date. */
export function digestDateLabel(localDate: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(new Date(`${localDate}T12:00:00Z`));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

function titleFor(vm: DigestVm): string {
  const [lead, ...rest] = vm.groups;
  if (!lead) return "Your alerts";
  const title = TOPIC_CATALOGUE[lead.topic].digestTitle(lead.total);
  return rest.length > 0 ? `${title}, and more that matches your alerts` : title;
}

function groupsFor(message: DigestMessage): AlertDigestGroup[] {
  return message.vm.groups.map((group) => ({
    heading: group.heading,
    total: group.total,
    subgroups: group.subgroups.map((sub) => ({
      ...(sub.label ? { label: sub.label } : {}),
      ...(sub.criteria ? { criteria: sub.criteria } : {}),
      items: sub.items.map((item) => ({
        title: item.title,
        ...(item.subtitle ? { subtitle: item.subtitle } : {}),
        ...(item.detail ? { detail: item.detail } : {}),
        ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
        url: message.siteUrl(item.path),
      })),
    })),
    ...(group.truncated
      ? {
          more: {
            url: message.siteUrl(TOPIC_CATALOGUE[group.topic].seeAllPath),
            label: `See all ${group.total} matches`,
          },
        }
      : {}),
  }));
}

/**
 * Hands the engine's emails to the outbox. Confirmations go at once on the transactional stream;
 * digests go on the broadcast stream, which keeps bulk mail apart from receipts and sign-in codes.
 * The outbox keys make a retried send collapse into one row.
 */
export class OutboxAlertMailer implements AlertMailer {
  constructor(private readonly options: AlertMailerOptions) {}

  async sendConfirmation(message: ConfirmationMessage): Promise<void> {
    const copy = CONFIRM_COPY[message.product];
    await this.options.email.enqueue({
      template: "alert-confirm",
      to: message.to,
      category: "transactional",
      idempotencyKey: `alert-confirm:${message.subscriberId}:${message.requestedAtMs}`,
      vars: {
        product: message.product,
        ...copy,
        confirmUrl: message.confirmUrl,
        expirationHours: message.expirationHours,
        unsubscribeUrl: message.stopUrl,
        listUnsubscribeUrl: message.oneClickUrl,
      },
    });
  }

  async sendDigest(message: DigestMessage): Promise<void> {
    const lead = message.vm.groups[0];
    const visitorStop = lead ? TOPIC_CATALOGUE[lead.topic].stopLabel : "Stop these emails";
    await this.options.email.enqueue({
      template: "alert-digest",
      to: message.to,
      category: "transactional",
      stream: "broadcast",
      idempotencyKey: message.idempotencyKey,
      vars: {
        product: message.product,
        subject: message.vm.subject,
        title: titleFor(message.vm),
        dateLabel: digestDateLabel(message.localDate),
        groups: groupsFor(message),
        reason: reasonFor(message),
        ...(message.audience === "visitor" ? { address: message.to } : {}),
        ...(message.manageUrl ? { manageUrl: message.manageUrl } : {}),
        unsubscribeUrl: message.stopUrl,
        listUnsubscribeUrl: message.oneClickUrl,
        stopLabel: message.audience === "visitor" ? visitorStop : "Stop these emails",
      },
    });
  }
}
