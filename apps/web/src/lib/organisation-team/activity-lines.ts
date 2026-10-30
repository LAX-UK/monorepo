import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import type {
  ActivityDetailValue,
  ActivityEntryView,
} from "@/lib/data/http/organisation-team.types";
import { organisationRoleLabel } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import type { ActivityGroup } from "@auction/domain";

/**
 * Each Activity entry as one sentence a person reads ("Daniel Reyes changed Priya Shah from
 * Viewer to Finance"), from one table keyed by the entry's kind. A kind missing from the table
 * reads as a plain "made a change", never as a raw code.
 */

type Line = { actor: string; subject: string; organisation: string; detail: Detail };
type Detail = Record<string, ActivityDetailValue | undefined>;

function text(value: ActivityDetailValue | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value: ActivityDetailValue | undefined): string | null {
  if (typeof value === "number") return formatPounds(value);
  const raw = text(value);
  return raw ? formatPounds(raw) || null : null;
}

function role(value: ActivityDetailValue | undefined): string {
  const raw = text(value);
  return raw ? organisationRoleLabel(raw) : "a member";
}

const UNSOLD_CHOICE: Record<string, string> = {
  relist: "offer it again",
  private_sale: "offer it by private sale",
  collect: "collect it",
};

function authorisationLimits(detail: Detail): string {
  const perLot = money(detail.bid_limit);
  const total = money(detail.total_limit);
  const parts = [perLot ? `up to ${perLot} a lot` : null, total ? `${total} in total` : null];
  const words = parts.filter(Boolean).join(", ");
  return words ? `, ${words}` : "";
}

const LINES: Record<string, (line: Line) => string> = {
  member_invited: ({ actor, detail }) =>
    `${actor} invited ${text(detail.email) ?? "someone"} as ${role(detail.role)}`,
  invitation_withdrawn: ({ actor, detail }) =>
    `${actor} withdrew an invitation to join as ${role(detail.role)}`,
  invitation_declined: ({ subject }) => `${subject} declined the invitation`,
  member_joined: ({ subject, detail }) => `${subject} joined as ${role(detail.role)}`,
  role_changed: ({ actor, subject, detail }) =>
    `${actor} changed ${subject} from ${role(detail.from_role)} to ${role(detail.to_role)}`,
  member_removed: ({ actor, subject, organisation }) =>
    `${actor} removed ${subject} from ${organisation}`,
  member_left: ({ subject, organisation }) => `${subject} left ${organisation}`,
  authorisation_granted: ({ actor, subject, detail }) =>
    `${actor} authorised ${subject} to bid in ${detail.sale_id ? "one sale" : "every sale"}${authorisationLimits(detail)}`,
  authorisation_revoked: ({ actor, subject }) =>
    `${actor} ended ${subject}'s authorisation to bid`,
  bidding_limit_changed: ({ actor, organisation, detail }) => {
    const limit = money(detail.limit);
    const previous = money(detail.previous_limit);
    if (!limit) return `${actor} removed ${organisation}'s bidding limit`;
    if (!previous) return `${actor} set ${organisation}'s bidding limit to ${limit}`;
    return `${actor} changed ${organisation}'s bidding limit from ${previous} to ${limit}`;
  },
  agreement_accepted: ({ actor }) => `${actor} accepted a consignment agreement`,
  unsold_choice_made: ({ actor, detail }) => {
    const choice = UNSOLD_CHOICE[text(detail.choice) ?? ""];
    return choice
      ? `${actor} chose to ${choice} for a work that didn't sell`
      : `${actor} chose what happens to a work that didn't sell`;
  },
  payout_sent: ({ detail }) => {
    const amount = money(detail.netAmount);
    return amount ? `LAX sent a payout of ${amount}` : "LAX sent a payout";
  },
  bank_details_changed: ({ actor, detail }) => {
    const bank = text(detail.bank_name);
    const last4 = text(detail.bank_last4);
    const account = [bank, last4 ? `ending ${last4}` : null].filter(Boolean).join(" ");
    return account
      ? `${actor} changed the payout account to ${account}`
      : `${actor} changed the payout account`;
  },
  invoice_details_changed: ({ actor }) => `${actor} changed the invoice details`,
  two_step_policy_changed: ({ actor, detail }) =>
    detail.required === true
      ? `${actor} made two-step required for everyone`
      : `${actor} made two-step optional`,
};

/** A note under the sentence for changes everyone running the organisation is told about. */
const NOTES: Partial<Record<string, string>> = {
  bank_details_changed: "Every owner and admin was emailed",
};

export type ActivityLineView = {
  id: number;
  group: ActivityGroup;
  sentence: string;
  note: string | null;
  occurredAt: string;
};

export function activityLine(entry: ActivityEntryView, organisation: string): ActivityLineView {
  const write = LINES[entry.kind];
  const line: Line = {
    actor: entry.actorName,
    subject: entry.subjectName ?? "a former member",
    organisation,
    detail: entry.detail,
  };
  return {
    id: entry.id,
    group: entry.group,
    sentence: write ? write(line) : `${entry.actorName} made a change`,
    note: NOTES[entry.kind] ?? null,
    occurredAt: entry.occurredAt,
  };
}

export type ActivityDayView = { key: string; label: string; lines: ActivityLineView[] };

const LONDON = "Europe/London";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: LONDON });
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  day: "numeric",
  month: "short",
});
const dayLabelWithYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  hour: "2-digit",
  minute: "2-digit",
});

/** "10:42", in London time. */
export function activityTime(iso: string): string {
  return timeLabel.format(new Date(iso));
}

/** Lines grouped by London day, newest first: "Today", "Yesterday", "28 Oct", "3 Dec 2025". */
export function activityDays(lines: readonly ActivityLineView[], now: Date): ActivityDayView[] {
  const today = dayKey.format(now);
  const yesterday = dayKey.format(new Date(now.getTime() - 86_400_000));
  const days: ActivityDayView[] = [];
  for (const line of lines) {
    const at = new Date(line.occurredAt);
    const key = dayKey.format(at);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      const label =
        key === today
          ? "Today"
          : key === yesterday
            ? "Yesterday"
            : at.getUTCFullYear() === now.getUTCFullYear()
              ? dayLabel.format(at)
              : dayLabelWithYear.format(at);
      day = { key, label, lines: [] };
      days.push(day);
    }
    day.lines.push(line);
  }
  return days;
}
