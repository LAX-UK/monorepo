import { formatStaffDate, formatStaffDateTime } from "@auction/staff-ui";
import type { StaffStatusTone } from "@auction/staff-ui";
import type { EmailBlockView, EmailSendStatus, PersonEmailDeliveryView } from "@auction/types";
import {
  ALERT_STATE_COPY,
  BLOCK_COPY,
  EVENT_COPY,
  PRODUCT_LABEL,
  SEND_STATUS,
  firstNameOf,
} from "./email-delivery-copy";

export const SENDS_COLLAPSED = 5;

export type EmailFact = { label: string; value: string; sub?: string };

export type EmailBlockVm = {
  reason: EmailBlockView["reason"];
  title: string;
  tone: "danger" | "info";
  /** "Since 28 Oct 2026, 16:02 GMT. The receiving server …" */
  body: string;
  /** The provider's own words, shown under "Details". */
  detail: string | null;
  /** The lift button: absent for roles that can never lift, disabled with a reason otherwise. */
  lift: { kind: "hidden" } | { kind: "enabled" } | { kind: "disabled"; reason: string };
};

export type EmailSendRowVm = {
  id: string;
  label: string;
  necessity: "Essential" | "Optional";
  product: string;
  at: string;
  status: { label: string; tone: StaffStatusTone };
  statusKey: EmailSendStatus;
  events: { id: string; title: string; tone: StaffStatusTone; at: string }[];
};

export type EmailDeliveryPanelVm = {
  badge: { label: string; tone: StaffStatusTone };
  block: EmailBlockVm | null;
  facts: EmailFact[];
  sends: EmailSendRowVm[];
  /** Emails skipped while the address was blocked. They are listed, never resent. */
  skippedCount: number;
};

type Input = {
  view: PersonEmailDeliveryView;
  personName: string;
  /** The viewer holds the lift rule; without it the button is left out altogether. */
  viewerCanLift: boolean;
};

function liftVm(block: EmailBlockView, viewerCanLift: boolean): EmailBlockVm["lift"] {
  // An unsubscribe is the person's choice and a viewer without the rule never lifts: no button.
  if (!viewerCanLift || block.liftReasons.length === 0) return { kind: "hidden" };
  return block.lift.allowed ? { kind: "enabled" } : { kind: "disabled", reason: block.lift.reason };
}

function blockVm(block: EmailBlockView, who: string, viewerCanLift: boolean): EmailBlockVm {
  const copy = BLOCK_COPY[block.reason];
  return {
    reason: block.reason,
    title: copy.title,
    tone: block.stopsEssentialEmail ? "danger" : "info",
    body: `Since ${formatStaffDateTime(block.since, { zoneLabel: true })}. ${copy.body(who)}`,
    detail: block.providerDetail?.trim() || null,
    lift: liftVm(block, viewerCanLift),
  };
}

function factsFor(view: PersonEmailDeliveryView): EmailFact[] {
  const delivered = view.lastDeliveredAt
    ? `Last delivered ${formatStaffDateTime(view.lastDeliveredAt, { zoneLabel: true })}`
    : "No delivery report yet";
  const block = view.block;
  const facts: EmailFact[] = [];
  if (!block) {
    const status =
      view.addressStatus === "ok"
        ? "Delivering"
        : view.addressStatus === "bounced"
          ? "Bounced, with no block on record"
          : "Marked as spam, with no block on record";
    facts.push({ label: "Address", value: status, sub: delivered });
    facts.push({ label: "Optional email", value: "On" });
  } else if (block.stopsEssentialEmail) {
    facts.push({
      label: "Address",
      value: `Blocked since ${formatStaffDate(block.since)}`,
      sub: delivered,
    });
    facts.push({ label: "Stops", value: "All email, essential and optional" });
  } else {
    facts.push({ label: "Address", value: "Delivering essential email", sub: delivered });
    facts.push({ label: "Optional email", value: `Off since ${formatStaffDate(block.since)}` });
  }
  if (view.alerts) {
    const blockedOn = block?.stopsEssentialEmail && view.alerts.state === "on";
    facts.push({
      label: "Alerts",
      value: blockedOn ? "On, but not sent while blocked" : ALERT_STATE_COPY[view.alerts.state],
    });
  }
  return facts;
}

function badgeFor(view: PersonEmailDeliveryView): EmailDeliveryPanelVm["badge"] {
  if (view.block?.stopsEssentialEmail) return { label: "Blocked", tone: "danger" };
  if (view.block) return { label: "Optional off", tone: "neutral" };
  if (view.addressStatus !== "ok") return { label: "Needs a look", tone: "warning" };
  return { label: "Delivering", tone: "success" };
}

/** Everything the email delivery panel shows, in words, from the API's view of one person. */
export function buildEmailDeliveryPanelVm({
  view,
  personName,
  viewerCanLift,
}: Input): EmailDeliveryPanelVm {
  const who = firstNameOf(personName);
  return {
    badge: badgeFor(view),
    block: view.block ? blockVm(view.block, who, viewerCanLift) : null,
    facts: factsFor(view),
    sends: view.sends.map((send) => ({
      id: send.id,
      label: send.label,
      necessity: send.essential ? "Essential" : "Optional",
      product: PRODUCT_LABEL[send.product],
      at: formatStaffDateTime(send.sentAt ?? send.createdAt, { zoneLabel: true }),
      status: SEND_STATUS[send.status],
      statusKey: send.status,
      events: send.events.map((event, index) => ({
        id: `${send.id}-${index}`,
        title: EVENT_COPY[event.type].title,
        tone: EVENT_COPY[event.type].tone,
        at: event.receivedAt,
      })),
    })),
    skippedCount: view.sends.filter((send) => send.status === "not_sent_blocked").length,
  };
}
