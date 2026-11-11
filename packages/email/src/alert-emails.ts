import {
  type ConfirmationMessage,
  type DigestMessage,
  type DigestVm,
  TOPIC_CATALOGUE,
} from "@auction/alerts";
import { LAX_PRODUCT_NAMES } from "@auction/branding";
import { RecipientClock } from "./recipient-clock.js";
import type { AlertDigestGroup, AlertTemplateVars } from "./templates/types/sale-alerts.js";

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

/** "new sales", "new sales and saved searches", "new sales, artists you follow and saved searches". */
function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Why the person gets the email: it names only the topics they have switched on. */
function reasonFor(message: DigestMessage): string {
  const name = LAX_PRODUCT_NAMES[message.product];
  const topics = listOf(message.activeTopics.map((t) => TOPIC_CATALOGUE[t].listName));
  return `You get this because you asked ${name} for alerts about ${topics}. At most one email a day.`;
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

/** The title leads with the strongest item, as the subject does: "New sale: Modern British and Irish Art". */
function titleFor(vm: DigestVm): string {
  const lead = vm.groups[0];
  if (!lead) return "Your alerts";
  const def = TOPIC_CATALOGUE[lead.topic];
  const first = lead.subgroups[0]?.items[0];
  return lead.total === 1 && first
    ? def.subjectForOne(first.title)
    : def.subjectForMany(lead.total);
}

function groupsFor(message: DigestMessage, clock: RecipientClock): AlertDigestGroup[] {
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
        ...(item.moments.length > 0
          ? {
              moments: item.moments.map((entry) => ({
                label: entry.label,
                moment: clock.moment(new Date(entry.at), entry.zone),
              })),
            }
          : {}),
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

/** What an alert email puts on the outbox: the template, its variables and how it is keyed. */
export type AlertEmail<T extends "alert-confirm" | "alert-digest"> = {
  template: T;
  vars: AlertTemplateVars[T];
  idempotencyKey: string;
  /** Digests go on the broadcast stream; confirmations stay on the transactional one. */
  stream?: "broadcast";
};

/** The double opt-in email, keyed by subscriber and request so a retry collapses into one row. */
export function confirmationEmail(message: ConfirmationMessage): AlertEmail<"alert-confirm"> {
  return {
    template: "alert-confirm",
    idempotencyKey: `alert-confirm:${message.subscriberId}:${message.requestedAtMs}`,
    vars: {
      product: message.product,
      ...CONFIRM_COPY[message.product],
      confirmUrl: message.confirmUrl,
      expirationHours: message.expirationHours,
      unsubscribeUrl: message.stopUrl,
      listUnsubscribeUrl: message.oneClickUrl,
    },
  };
}

/** The daily digest, keyed by the digest ledger's key. */
export function digestEmail(message: DigestMessage): AlertEmail<"alert-digest"> {
  const lead = message.vm.groups[0];
  const visitorStop = lead ? TOPIC_CATALOGUE[lead.topic].stopLabel : "Stop these emails";
  // Times are the sale's own; an account holder with a saved zone also sees their own clock, and
  // only where there is a page to change it, so a local time never appears without its footer.
  const clock = new RecipientClock(
    message.changeZoneUrl ? message.viewerZone : null,
    new Date(`${message.localDate}T12:00:00Z`),
    message.changeZoneUrl ?? "",
  );
  const groups = groupsFor(message, clock);
  const zoneNote = clock.zoneNote;
  return {
    template: "alert-digest",
    stream: "broadcast",
    idempotencyKey: message.idempotencyKey,
    vars: {
      product: message.product,
      subject: message.vm.subject,
      title: titleFor(message.vm),
      dateLabel: digestDateLabel(message.localDate),
      groups,
      ...(zoneNote ? { zoneNote } : {}),
      reason: reasonFor(message),
      ...(message.audience === "visitor" ? { address: message.to } : {}),
      ...(message.manageUrl ? { manageUrl: message.manageUrl } : {}),
      unsubscribeUrl: message.stopUrl,
      listUnsubscribeUrl: message.oneClickUrl,
      stopLabel: message.audience === "visitor" ? visitorStop : "Stop these emails",
    },
  };
}
