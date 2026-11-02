import type {
  EnquiryBudgetBand,
  EnquiryCloseReason,
  EnquiryContactPreference,
  EnquiryIntent,
  EnquiryView as EnquiryListView,
  EnquiryStatus,
  EnquiryTiming,
} from "@auction/domain";

/**
 * Words, tones and clocks for the Enquiries screens. Every vocabulary is one table keyed by the
 * domain's own union, so adding a value to the domain fails the build here until it has a label.
 */

export const ENQUIRIES_PATH = "/admin/enquiries";

export const ENQUIRY_STATUS_LABELS = {
  new: "New",
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
  converted: "Converted",
  closed: "Closed",
} as const satisfies Record<EnquiryStatus, string>;

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
type BadgeShape = "ring" | "dot" | "check" | "alert";

export const ENQUIRY_STATUS_BADGES = {
  new: { tone: "neutral", shape: "ring" },
  in_progress: { tone: "info", shape: "dot" },
  waiting_on_client: { tone: "warning", shape: "ring" },
  converted: { tone: "success", shape: "check" },
  closed: { tone: "neutral", shape: "check" },
} as const satisfies Record<EnquiryStatus, { tone: BadgeTone; shape: BadgeShape }>;

export const ENQUIRY_CLOSE_REASON_LABELS = {
  not_a_fit: "Not a fit",
  not_proceeding: "Not proceeding",
  sold_elsewhere: "Sold elsewhere",
  duplicate: "Duplicate",
  spam: "Spam",
} as const satisfies Record<EnquiryCloseReason, string>;

/** What each reason means, shown under it in the Close dialog. */
export const ENQUIRY_CLOSE_REASON_HINTS = {
  not_a_fit: "We can't help with this work or request.",
  not_proceeding: "The client has decided not to go ahead.",
  sold_elsewhere: "The work has been sold or placed elsewhere.",
  duplicate: "The same enquiry is already open under another reference.",
  spam: "Not a real enquiry.",
} as const satisfies Record<EnquiryCloseReason, string>;

export const ENQUIRY_CLOSE_REASONS_IN_ORDER = [
  "not_a_fit",
  "not_proceeding",
  "sold_elsewhere",
  "duplicate",
  "spam",
] as const satisfies readonly EnquiryCloseReason[];

/** The kind of enquiry as staff name it; the private sale paths are named by what the client wants. */
export const ENQUIRY_KIND_LABELS = {
  general: "General",
  private_sale_sell: "Sell privately",
  private_sale_buy: "Buy privately",
  buying: "Buying",
  selling: "Selling",
  shipping: "Shipping",
  press: "Press",
} as const satisfies Record<EnquiryIntent, string>;

export const ENQUIRY_BUDGET_LABELS = {
  under_10000: "Under £10,000",
  "10000_to_50000": "£10,000 to £50,000",
  "50000_to_250000": "£50,000 to £250,000",
  over_250000: "Over £250,000",
  prefer_not_to_say: "Prefers not to say",
} as const satisfies Record<EnquiryBudgetBand, string>;

export const ENQUIRY_TIMING_LABELS = {
  no_rush: "No rush",
  within_3_months: "Within 3 months",
  urgent: "Urgent",
} as const satisfies Record<EnquiryTiming, string>;

export const ENQUIRY_CONTACT_LABELS = {
  email: "Email",
  phone: "Phone",
  either: "Email or phone",
} as const satisfies Record<EnquiryContactPreference, string>;

const SENTENCE_STATUS_LABELS = {
  new: "new",
  in_progress: "in progress",
  waiting_on_client: "waiting on client",
  converted: "converted",
  closed: "closed",
} as const satisfies Record<EnquiryStatus, string>;

/** "Marked in progress" for the timeline and toasts. */
export function statusSentence(status: EnquiryStatus): string {
  return SENTENCE_STATUS_LABELS[status];
}

/** A department as the client chose it; unknown slugs read as words, never as a slug. */
export function humaniseSlug(slug: string): string {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ---------- views ---------- */

export const ENQUIRY_VIEW_IDS = [
  "assigned_to_me",
  "open",
  "unassigned",
  "private_sales",
  "closed",
  "all",
] as const satisfies readonly EnquiryListView[];

export const ENQUIRY_VIEW_LABELS = {
  assigned_to_me: "Assigned to me",
  open: "Open",
  unassigned: "Unassigned",
  private_sales: "Private sales",
  closed: "Closed",
  all: "All",
} as const satisfies Record<EnquiryListView, string>;

export const ENQUIRY_EMPTY_COPY = {
  assigned_to_me: {
    title: "Nothing assigned to you",
    description:
      "Enquiries routed or handed to you appear here. Open and Unassigned show the rest.",
  },
  open: {
    title: "No open enquiries",
    description: "Every enquiry has been answered or closed. New ones appear here as they arrive.",
  },
  unassigned: {
    title: "Nothing unassigned",
    description: "Every open enquiry has someone looking after it.",
  },
  private_sales: {
    title: "No open private sale enquiries",
    description: "Sell and buy enquiries from the private sales page appear here.",
  },
  closed: {
    title: "No closed enquiries yet",
    description: "Enquiries you close or convert to a deal are kept here.",
  },
  all: {
    title: "No enquiries yet",
    description: "Enquiries from the contact form and the private sales page appear here.",
  },
} as const satisfies Record<EnquiryListView, { title: string; description: string }>;

/** How the view orders its rows, said once under the table. */
export const ENQUIRY_ORDER_NOTE = {
  assigned_to_me: "Longest waiting first",
  open: "Longest waiting first",
  unassigned: "Longest waiting first",
  private_sales: "Longest waiting first",
  closed: "Latest first",
  all: "Latest first",
} as const satisfies Record<EnquiryListView, string>;

/* ---------- the two business day promise ---------- */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type EnquiryWaiting = {
  /** Neutral until the reply is close to due, then warning, then danger once it is late. */
  tone: "neutral" | "warning" | "danger";
  text: string;
  /** For screen readers and tooltips. */
  description: string;
};

function elapsedText(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h`;
  const days = Math.floor(ms / DAY);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * How long an enquiry has waited, against the two business day reply the contact pages promise.
 * The clock runs while the enquiry is new: it warns once less than a day is left and turns to
 * danger past the due time. Once someone is working it, or the client has to answer, the time is
 * shown without a warning. A closed or converted enquiry has no clock.
 */
export function enquiryWaiting(
  enquiry: { status: EnquiryStatus; receivedAt: string; replyDueAt: string },
  now: Date,
): EnquiryWaiting | null {
  if (enquiry.status === "closed" || enquiry.status === "converted") return null;
  const waited = Math.max(0, now.getTime() - new Date(enquiry.receivedAt).getTime());
  const text = elapsedText(waited);
  if (enquiry.status !== "new") {
    return { tone: "neutral", text, description: `Waiting ${text}` };
  }
  const due = new Date(enquiry.replyDueAt).getTime();
  if (now.getTime() > due) {
    return {
      tone: "danger",
      text: "Over 2 days",
      description: `Reply was due within 2 business days; waiting ${text}`,
    };
  }
  if (now.getTime() >= due - DAY) {
    return { tone: "warning", text, description: `Waiting ${text}; reply due within a day` };
  }
  return { tone: "neutral", text, description: `Waiting ${text}` };
}

/* ---------- sidebar count ---------- */

/**
 * The Enquiries count in the sidebar: new enquiries waiting for this person, as the two lists they
 * work from show them, and how many of those are already past their reply time.
 */
export function enquiriesNavCount(
  items: readonly { status: EnquiryStatus; replyDueAt: string }[],
  now: Date,
): { waiting: number; late: number } {
  const waiting = items.filter((item) => item.status === "new");
  const late = waiting.filter((item) => new Date(item.replyDueAt).getTime() < now.getTime());
  return { waiting: waiting.length, late: late.length };
}
