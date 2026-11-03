import { LAX_PRODUCT_NAMES, legalEntityNamesFor } from "@auction/branding";
import {
  DATA_REQUEST_CHANNELS,
  type DATA_REQUEST_EXTENSION_REASONS,
  DATA_REQUEST_OUTCOMES,
  DATA_REQUEST_PRODUCTS,
  DATA_REQUEST_REASONS,
  type DATA_REQUEST_TOLD_VIA,
  DATA_REQUEST_VIEWS,
  type DataRequestChannel,
  type DataRequestListView,
  type DataRequestOutcome,
  type DataRequestProduct,
  type DataRequestReason,
  type DataRequestSummary,
  type DataRequestView,
  type DueState,
  type DueStateKind,
  SUBJECT_EXPORT_STATUSES,
  type SubjectExportStatus,
} from "@auction/identity-contracts/data-requests";
import type { AttentionStripItem, Metric, StatusPresentation } from "@auction/staff-ui";

const COUNT = new Intl.NumberFormat("en-GB");

// Vocabulary: one table per set, so a new value is one more row. ---------------------------------

export const PRODUCT_LABELS: Readonly<Record<DataRequestProduct, string>> = {
  account: "Account",
  bid: "Bid",
  shop: "Shop",
};

/** The product as it is named on the record, with the company that answers for it. */
export const PRODUCT_DETAILS: Readonly<
  Record<DataRequestProduct, { name: string; company: string }>
> = {
  account: { name: LAX_PRODUCT_NAMES.account, company: legalEntityNamesFor("account") },
  bid: { name: LAX_PRODUCT_NAMES.bid, company: legalEntityNamesFor("bid") },
  shop: {
    name: `${LAX_PRODUCT_NAMES.shop} and ${LAX_PRODUCT_NAMES.art}`,
    company: legalEntityNamesFor("shop"),
  },
};

export const REASON_LABELS: Readonly<Record<DataRequestReason, string>> = {
  full_copy: "Full copy",
  after_deletion: "After account deletion",
  guest_orders: "Unlinked guest orders",
  other: "Other",
};

export const REASON_HINTS: Readonly<Record<DataRequestReason, string>> = {
  full_copy: "Staff notes, emails and outside systems",
  after_deletion: "The account has been deleted",
  guest_orders: "Orders placed without an account",
  other: "A note is required for Other",
};

export const CHANNEL_LABELS: Readonly<Record<DataRequestChannel, string>> = {
  support_form: "Support form",
  email: "Email",
  post: "Post",
  phone: "Phone",
  in_person: "In person",
  other: "Other",
};

export const TOLD_VIA_LABELS: Readonly<Record<(typeof DATA_REQUEST_TOLD_VIA)[number], string>> = {
  email: "Email",
  post: "Post",
  phone: "Phone",
  in_person: "In person",
  other: "Other",
};

export const EXTENSION_REASON_LABELS: Readonly<
  Record<(typeof DATA_REQUEST_EXTENSION_REASONS)[number], string>
> = {
  complex: "The request is complex",
  multiple_requests: "The person made several requests",
};

export const EXTENSION_NOTE_LABELS: Readonly<
  Record<(typeof DATA_REQUEST_EXTENSION_REASONS)[number], string>
> = {
  complex: "Why it's complex",
  multiple_requests: "Which requests",
};

export const OUTCOME_LABELS: Readonly<Record<DataRequestOutcome, string>> = {
  sent: "Copy sent",
  sent_partial: "Copy sent, some information withheld",
  nothing_held: "We hold nothing about them",
  refused: "Refused as manifestly unfounded or excessive",
  withdrawn: "Withdrawn by the person",
};

/** The shorter form for a status badge and the Closed view. */
export const OUTCOME_SHORT_LABELS: Readonly<Record<DataRequestOutcome, string>> = {
  sent: "Copy sent",
  sent_partial: "Copy sent, some withheld",
  nothing_held: "Nothing held",
  refused: "Refused",
  withdrawn: "Withdrawn",
};

export const KIND_FILTER_LABELS: Readonly<Record<string, string>> = {
  download: "Download",
  manual: "Manual, any reason",
  ...REASON_LABELS,
};

export const VIEW_LABELS: Readonly<Record<DataRequestListView, string>> = {
  open: "Open",
  overdue: "Overdue",
  waiting: "Waiting for ID",
  closed: "Closed",
  all: "All",
};

// Status ------------------------------------------------------------------------------------

export const DOWNLOAD_STATUS_BADGE: Readonly<Record<SubjectExportStatus, StatusPresentation>> = {
  requested: { label: "Requested", tone: "info" },
  collecting: { label: "Collecting", tone: "info" },
  delayed: { label: "Delayed", tone: "warning" },
  ready: { label: "Ready", tone: "success" },
  expired: { label: "Expired", tone: "neutral", shape: "ring" },
  deleted: { label: "Deleted by person", tone: "neutral", shape: "ring" },
  failed: { label: "Failed", tone: "danger" },
};

export const MANUAL_STATUS_BADGE = {
  waiting_for_id: { label: "Waiting for ID", tone: "neutral", shape: "ring" },
  in_progress: { label: "In progress", tone: "info" },
  closed: { label: "Closed", tone: "success" },
} as const satisfies Record<string, StatusPresentation>;

/** The status filter's options, in the order a request moves through them. */
export const STATUS_FILTER_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    SUBJECT_EXPORT_STATUSES.map((status) => [status, DOWNLOAD_STATUS_BADGE[status].label]),
  ),
  waiting_for_id: MANUAL_STATUS_BADGE.waiting_for_id.label,
  in_progress: MANUAL_STATUS_BADGE.in_progress.label,
  closed: MANUAL_STATUS_BADGE.closed.label,
};

/** What a status badge says for one request: a closed request names its outcome. */
export function requestStatus(request: DataRequestView): StatusPresentation {
  if (request.kind === "download") {
    return request.continuedAs
      ? { label: "Continued manually", tone: "neutral", shape: "ring" }
      : DOWNLOAD_STATUS_BADGE[request.status];
  }
  const badge = MANUAL_STATUS_BADGE[request.status];
  if (request.status === "closed" && request.outcome) {
    return { ...badge, label: `Closed · ${OUTCOME_SHORT_LABELS[request.outcome]}` };
  }
  return badge;
}

/**
 * Whether the person already has what they asked for, so the due date no longer matters: a
 * closed manual request, a copy that was delivered, or a download staff took over.
 */
export function isAnswered(request: DataRequestView): boolean {
  if (request.kind === "manual") return request.status === "closed";
  return (
    request.continuedAs !== null ||
    request.status === "ready" ||
    request.status === "expired" ||
    request.status === "deleted"
  );
}

// Deadline ----------------------------------------------------------------------------------

/** One tone per deadline state, so the list, the record and the nav read it the same way. */
export const DUE_TONE: Readonly<Record<DueStateKind, "neutral" | "warning" | "danger">> = {
  none: "neutral",
  ok: "neutral",
  due_soon: "warning",
  overdue: "danger",
};

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A London calendar date `2026-11-01` as "1 Nov 2026". */
export function formatDay(date: string): string {
  return DAY.format(new Date(`${date}T00:00:00.000Z`));
}

const plural = (count: number, one: string, other: string) => (count === 1 ? one : other);

/** "7 days left", "Due today", "1 day overdue"; null when the clock has not started. */
export function daysLeftText(due: DueState): string | null {
  const { daysLeft } = due;
  if (due.state === "none" || daysLeft === null) return null;
  if (daysLeft === 0) return "Due today";
  if (daysLeft < 0) {
    const late = Math.abs(daysLeft);
    return `${late} ${plural(late, "day", "days")} overdue`;
  }
  return `${daysLeft} ${plural(daysLeft, "day", "days")} left`;
}

export type DueCell = {
  /** The date, or "No date yet" while the clock has not started. */
  date: string;
  /** The line under it. */
  text: string;
  /** A badge for a deadline that is close or missed; the tone is never the only cue. */
  tone: "neutral" | "warning" | "danger" | "success";
  badge: boolean;
};

/** The Due column: the legal date and where the request stands against it. */
export function dueCell(request: DataRequestView): DueCell {
  if (request.kind === "manual" && request.status === "closed") {
    const late = request.daysLate;
    return {
      date: request.dueOn ? formatDay(request.dueOn) : "No date",
      text:
        late === null
          ? "Closed"
          : late === 0
            ? "On time"
            : `${late} ${plural(late, "day", "days")} late`,
      tone: late === null || late === 0 ? "success" : "warning",
      badge: true,
    };
  }
  if (request.kind === "download" && request.continuedAs) {
    return {
      date: request.dueOn ? formatDay(request.dueOn) : "No date",
      text: `Continued as ${request.continuedAs}`,
      tone: "neutral",
      badge: false,
    };
  }
  if (isAnswered(request)) {
    return {
      date: request.dueOn ? formatDay(request.dueOn) : "No date",
      text: "Copy delivered",
      tone: "success",
      badge: true,
    };
  }
  if (request.due.state === "none" || request.dueOn === null) {
    return { date: "No date yet", text: "Starts when ID arrives", tone: "neutral", badge: false };
  }
  const left = daysLeftText(request.due) ?? "";
  const tone = DUE_TONE[request.due.state];
  return {
    date: formatDay(request.dueOn),
    text: request.extended && tone === "neutral" ? `Extended · ${left}` : left,
    tone,
    badge: tone !== "neutral",
  };
}

// Products done ------------------------------------------------------------------------------

export type ProductDot = "done" | "wait" | "retry";

/** "2 of 3", and a dot per product in scope (the list shows the count; the dots follow it). */
export function productsDoneText(request: DataRequestView): string {
  return `${request.productsDone.done} of ${request.productsDone.total}`;
}

export function productDots(request: DataRequestView): ProductDot[] {
  const { done, total } = request.productsDone;
  return Array.from({ length: total }, (_, index) => (index < done ? "done" : "wait"));
}

// Tabs, attention, metrics --------------------------------------------------------------------

export type DataRequestsViewTab = { id: DataRequestListView; label: string; count?: number };

/** The view tabs. Open, Overdue and Waiting for ID carry the counts that need action. */
export function dataRequestsViewTabs(summary: DataRequestSummary | null): DataRequestsViewTab[] {
  const counts: Partial<Record<DataRequestListView, number>> = summary
    ? { open: summary.open, overdue: summary.overdue, waiting: summary.waitingForId }
    : {};
  return DATA_REQUEST_VIEWS.map((id) => {
    const count = counts[id];
    return { id, label: VIEW_LABELS[id], ...(count ? { count } : {}) };
  });
}

type AttentionLinks = { overdue: string; dueSoon: string };

/** Work waiting on the list: one line per issue, the missed deadlines first. */
export function dataRequestsAttention(
  summary: DataRequestSummary | null,
  links: AttentionLinks,
): AttentionStripItem[] {
  if (!summary) return [];
  return [
    {
      id: "overdue",
      count: summary.overdue,
      label: plural(
        summary.overdue,
        "request is past its legal due date",
        "requests are past their legal due date",
      ),
      href: links.overdue,
      actionLabel: "Show overdue",
      tone: "danger",
    },
    {
      id: "due-soon",
      count: summary.dueSoon,
      label: plural(
        summary.dueSoon,
        "request is due within 7 days",
        "requests are due within 7 days",
      ),
      href: links.dueSoon,
      actionLabel: "Show open",
      tone: "warning",
    },
  ];
}

export function dataRequestsMetrics(summary: DataRequestSummary | null): Metric[] {
  if (!summary) return [];
  const { answered, onTime } = summary.answeredLast12Months;
  return [
    { id: "open", label: "Open", value: COUNT.format(summary.open) },
    {
      id: "due-soon",
      label: "Due within 7 days",
      value: COUNT.format(summary.dueSoon),
      ...(summary.dueSoon > 0 ? { tone: "attention" as const } : {}),
    },
    {
      id: "overdue",
      label: "Overdue",
      value: COUNT.format(summary.overdue),
      ...(summary.overdue > 0 ? { tone: "critical" as const } : {}),
    },
    {
      id: "on-time",
      label: "Answered on time",
      value: answered > 0 ? `${COUNT.format(onTime)} of ${COUNT.format(answered)}` : null,
      emptyText: "None answered yet",
    },
  ];
}

// Nav and Dashboard ---------------------------------------------------------------------------

export type DataRequestsNavCount = { count: number; tone: "danger" | "warning" } | null;

/**
 * The sidebar count: open requests that are overdue or due within 7 days. Danger once any is
 * overdue, warning otherwise, and nothing when none is close.
 */
export function dataRequestsNavCount(
  summary: Pick<DataRequestSummary, "dueSoon" | "overdue"> | null,
): DataRequestsNavCount {
  if (!summary) return null;
  const count = summary.dueSoon + summary.overdue;
  if (count === 0) return null;
  return { count, tone: summary.overdue > 0 ? "danger" : "warning" };
}

// Empty states ---------------------------------------------------------------------------------

export const DATA_REQUESTS_EMPTY: Readonly<
  Record<DataRequestListView, { title: string; description: string }>
> = {
  open: {
    title: "No open data requests",
    description:
      "Every request has been answered. New downloads and the requests you log appear here.",
  },
  overdue: {
    title: "No overdue requests",
    description: "Every open request is still inside its legal due date.",
  },
  waiting: {
    title: "No requests waiting for ID",
    description:
      "Requests you log as waiting for proof of identity appear here until the proof arrives.",
  },
  closed: {
    title: "No closed requests",
    description: "Requests you close with an outcome appear here, with whether they were on time.",
  },
  all: {
    title: "No data requests yet",
    description: "Downloads people ask for and requests you log appear here, on one clock.",
  },
};

/** The list carries the masked contact only; the reference sits under it. */
export function personLabelParts(request: DataRequestView): { primary: string; secondary: string } {
  const noAccount = request.hasAccount ? "" : " · No account";
  return { primary: request.personLabel, secondary: `${request.reference}${noAccount}` };
}

/** Kind and channel, e.g. "Full copy" over "Manual · Email". */
export function kindParts(request: DataRequestView): { primary: string; secondary: string } {
  if (request.kind === "download") return { primary: "Download", secondary: "Automatic" };
  return {
    primary: REASON_LABELS[request.reason],
    secondary: `Manual · ${CHANNEL_LABELS[request.channel]}`,
  };
}

export const ALL_PRODUCTS: readonly DataRequestProduct[] = DATA_REQUEST_PRODUCTS;
export const ALL_REASONS: readonly DataRequestReason[] = DATA_REQUEST_REASONS;
export const ALL_CHANNELS: readonly DataRequestChannel[] = DATA_REQUEST_CHANNELS;
export const ALL_OUTCOMES: readonly DataRequestOutcome[] = DATA_REQUEST_OUTCOMES;

// Record page --------------------------------------------------------------------------------------

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** 18,432,000 as "17.6 MB"; the file's size as a person reads it. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

const DAY_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

/** An ISO moment in London time, "29 Oct, 14:02". */
export function formatMoment(iso: string): string {
  return DAY_TIME.format(new Date(iso)).replace(/^(\d+ \w+) at /, "$1, ");
}

/** How much of the time allowed has gone, for the deadline meter. Null while the clock has not started. */
export function deadlineProgress(
  request: Pick<DataRequestView, "requestedOn" | "dueOn">,
  today: string,
  daysBetween: (from: string, to: string) => number,
): { used: number; total: number } | null {
  if (request.dueOn === null) return null;
  const total = Math.max(1, daysBetween(request.requestedOn, request.dueOn));
  const used = Math.min(total, Math.max(0, daysBetween(request.requestedOn, today)));
  return { used, total };
}
