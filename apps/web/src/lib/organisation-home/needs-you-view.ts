import { CLIENT_ROUTES, organisationHref, teamHref } from "@/lib/navigation/client-routes";
import { formatDateInline, formatDateTimeShort, formatMoney } from "@/lib/ui/format";
import type { NeedsYouTaskWithLink } from "@/lib/workspace/needs-you-read";
import {
  type HomeSubject,
  type NeedsYouLink,
  type NeedsYouSection,
  type NeedsYouTask,
  needsYouCounts,
} from "@auction/domain";
import { lotPath, salePath } from "@auction/types";

/** What a row is about, drawn as its icon: the module that asks. */
export type NeedsYouTopic = "bid" | "purchase" | "delivery" | "consignment" | "team" | "account";

/** When a task is due, as a badge beside its button. */
export type NeedsYouDue = {
  text: string;
  /** `danger` once the date has passed, `warning` while it is close. */
  tone: "warning" | "danger";
  dateTime: string;
};

/** One "Needs you" row as it reads: what to do, about what and for whom, when, and one button. */
export type NeedsYouRowView = {
  key: string;
  topic: NeedsYouTopic;
  title: string;
  detail: string;
  due: NeedsYouDue | null;
  action: { label: string; href: string };
  /** The sidebar item the row is counted on and how many things it stands for. */
  section: NeedsYouSection | null;
  items: number;
};

type Ctx = { organisationName: string; now: Date };

const quoted = (subject: HomeSubject) => `“${subject.title}”`;

/** "“Harbour at dawn”", "“Harbour at dawn” and 2 more". */
function listOf(subjects: readonly HomeSubject[]): string {
  const [first] = subjects;
  if (!first) return "";
  return subjects.length === 1 ? quoted(first) : `${quoted(first)} and ${subjects.length - 1} more`;
}

/** The task's subject named in its title when there is one, or how many there are. */
function oneOrMany(subjects: readonly HomeSubject[], one: string, many: (n: number) => string) {
  const [only] = subjects;
  return subjects.length === 1 && only ? `${one} ${quoted(only)}` : many(subjects.length);
}

/** A date badge: amber while it is ahead, red once it has passed. */
function due(at: Date, text: string, now: Date): NeedsYouDue {
  const passed = at.getTime() <= now.getTime();
  return {
    text: passed ? "Overdue" : text,
    tone: passed ? "danger" : "warning",
    dateTime: at.toISOString(),
  };
}

/** Where a task's button leads: the reader names the page, the web knows its address. */
export function needsYouHref(task: NeedsYouTaskWithLink): string {
  const link: NeedsYouLink = task.link;
  switch (link.page) {
    case "lot": {
      const lot = task.kind === "outbid" ? task.lots.find((l) => l.id === link.id) : undefined;
      return lot ? lotPath(lot) : CLIENT_ROUTES.bids;
    }
    case "bids":
      return CLIENT_ROUTES.bids;
    case "purchase":
      // Paying for one purchase opens its checkout; the purchase page itself comes later.
      return task.kind === "pay" ? `${CLIENT_ROUTES.checkout}/${link.id}` : CLIENT_ROUTES.purchases;
    case "purchases":
      return CLIENT_ROUTES.purchases;
    case "consignment":
      return task.kind === "agreement"
        ? `${CLIENT_ROUTES.consignments}/${link.id}#agreement`
        : `${CLIENT_ROUTES.consignments}/${link.id}`;
    case "consignments":
      return `${CLIENT_ROUTES.consignments}?tab=${link.view}`;
    case "sale":
      return task.kind === "register" ? salePath(task.sale) : CLIENT_ROUTES.bids;
    case "team":
      return `${teamHref()}#${link.view === "invitations" ? "invitations" : "who-can-bid"}`;
    case "bid_settings":
      return `${CLIENT_ROUTES.settings}/bidding`;
    case "organisation":
      return organisationHref(link.view);
    case "verify_identity":
      return CLIENT_ROUTES.verifyIdentity;
    case "source_of_funds":
      return CLIENT_ROUTES.sourceOfFunds;
  }
}

type Row = Omit<NeedsYouRowView, "key" | "action" | "section" | "items"> & { label: string };
type RowBuilder<K extends NeedsYouTask["kind"]> = (
  task: Extract<NeedsYouTaskWithLink, { kind: K }>,
  ctx: Ctx,
) => Row;

/** Words, topic, due date and button label for every kind the reader has; one entry per kind. */
const ROWS: { [K in NeedsYouTask["kind"]]: RowBuilder<K> } = {
  outbid: (task, { now }) => {
    const first = task.lots[0];
    return {
      topic: "bid",
      title: oneOrMany(task.lots, "Outbid on", (n) => `Outbid on ${n} lots`),
      detail:
        task.lots.length === 1
          ? "Someone else is leading. Bid again before the lot closes."
          : `${listOf(task.lots)} · someone else is leading on each`,
      due: first
        ? due(first.endsAt, `Closes ${formatDateTimeShort(first.endsAt, now)}`, now)
        : null,
      label: task.lots.length === 1 ? "Bid again" : "Review bids",
    };
  },
  pay: (task, ctx) => ({
    topic: "purchase",
    title: oneOrMany(task.purchases, "Pay for", (n) => `Pay for ${n} purchases`),
    detail:
      task.purchases.length === 1
        ? `Won for ${ctx.organisationName} and awaiting payment`
        : `${listOf(task.purchases)} · won for ${ctx.organisationName}`,
    due: null,
    label: "Pay",
  }),
  won_awaiting_payment: (task, ctx) => ({
    topic: "purchase",
    title: task.purchases.length === 1 ? "A win is awaiting payment" : "Wins awaiting payment",
    detail: `${listOf(task.purchases)} · ${ctx.organisationName}'s finance team has been told`,
    due: null,
    label: "View",
  }),
  unsold_due: (task, { now }) => ({
    topic: "consignment",
    title: oneOrMany(
      task.lots,
      "Choose what happens next for",
      (n) => `Choose what happens next for ${n} unsold works`,
    ),
    detail: `Did not sell · choose by ${formatDateInline(task.dueBy)}`,
    due: due(task.dueBy, `Choose by ${formatDateInline(task.dueBy)}`, now),
    label: "Choose",
  }),
  agreement: (task, ctx) => ({
    topic: "consignment",
    title: "Accept the consignment agreement",
    detail: `${quoted(task.consignment)} · the specialist's estimate and terms, for ${ctx.organisationName}`,
    due: null,
    label: "Review",
  }),
  changes: (task) => ({
    topic: "consignment",
    title: "Make the changes the specialist asked for",
    detail: task.note
      ? `${quoted(task.submission)} · “${task.note}”`
      : `${quoted(task.submission)} · see the specialist's note`,
    due: null,
    label: "Edit and resubmit",
  }),
  unsold: (task) => ({
    topic: "consignment",
    title: oneOrMany(
      task.lots,
      "Choose what happens next for",
      (n) => `Choose what happens next for ${n} unsold works`,
    ),
    detail:
      task.lots.length === 1
        ? "Did not sell · offer it again, lower the reserve or have it returned"
        : `${listOf(task.lots)} did not sell`,
    due: null,
    label: "Choose",
  }),
  choose_delivery: (task) => ({
    topic: "delivery",
    title: oneOrMany(
      task.purchases,
      "Choose delivery for",
      (n) => `Choose delivery for ${n} purchases`,
    ),
    detail: "Paid · choose a courier quote or collection from the saleroom",
    due: null,
    label: "Choose",
  }),
  quote_ready: (task) => ({
    topic: "delivery",
    title:
      task.purchases.length === 1 ? "Your delivery quote is ready" : "Delivery quotes are ready",
    detail: `${listOf(task.purchases)} · review the quote to book delivery`,
    due: null,
    label: "Review quote",
  }),
  book_collection: (task) => ({
    topic: "delivery",
    title: oneOrMany(
      task.purchases,
      "Book a time to collect",
      (n) => `Book a time to collect ${n} purchases`,
    ),
    detail: "Ready to collect from the saleroom",
    due: null,
    label: "Book",
  }),
  register: (task) => ({
    topic: "bid",
    title: `Register for ${task.sale.title}`,
    detail: task.bidLimit
      ? `Starts ${formatDateInline(task.startsAt)} · you may bid up to ${formatMoney(task.bidLimit)}`
      : `Starts ${formatDateInline(task.startsAt)} · you may bid with no limit`,
    due: null,
    label: "Register",
  }),
  authorisation_ending: (task, { now }) => {
    const [first] = task.authorisations;
    const own = task.link.page === "bid_settings";
    return {
      topic: "team",
      title: own
        ? "Your authorisation to bid ends soon"
        : task.authorisations.length === 1 && first
          ? `${first.memberName}'s authorisation to bid ends soon`
          : `${task.authorisations.length} authorisations to bid end soon`,
      detail: own
        ? "Ask an owner or admin to renew it to keep bidding"
        : "Renew it to keep their bidding open",
      due: first ? due(first.endsAt, `Ends ${formatDateInline(first.endsAt)}`, now) : null,
      label: own ? "View" : "Renew",
    };
  },
  invitations_expired: (task) => {
    const [first] = task.invitations;
    return {
      topic: "team",
      title:
        task.invitations.length === 1
          ? "An invitation expired"
          : `${task.invitations.length} invitations expired`,
      detail:
        task.invitations.length === 1 && first
          ? `${first.email} · expired ${formatDateInline(first.expiredAt)}`
          : `${first?.email ?? ""} and ${task.invitations.length - 1} more`,
      due: null,
      label: "Resend",
    };
  },
  documents: () => ({
    topic: "account",
    title: "Send the documents we asked for",
    detail: "We check them before the organisation can bid or sell",
    due: null,
    label: "Open documents",
  }),
  identity: (_task, ctx) => ({
    topic: "account",
    title: "Verify your identity",
    detail: `Needed before you can act for ${ctx.organisationName}. It takes about 3 minutes.`,
    due: null,
    label: "Verify",
  }),
  source_of_funds: () => ({
    topic: "account",
    title: "Send your source of funds documents",
    detail: "We asked where the money for your bids comes from",
    due: null,
    label: "Send documents",
  }),
  payouts: () => ({
    topic: "account",
    title: "Set up payouts",
    detail: "Add the bank account we pay sale proceeds into. About 5 minutes.",
    due: null,
    label: "Set up payouts",
  }),
};

/** A key that stays put while the list changes: the kind and what it is about. */
function rowKey(task: NeedsYouTask): string {
  switch (task.kind) {
    case "agreement":
      return `agreement:${task.consignment.id}`;
    case "changes":
      return `changes:${task.submission.id}`;
    case "register":
      return `register:${task.sale.id}`;
    default:
      return task.kind;
  }
}

/** The section a task is counted on and how many things it stands for, from the reader's table. */
export function needsYouTally(task: NeedsYouTask): {
  section: NeedsYouSection | null;
  items: number;
} {
  const counts = needsYouCounts([task]);
  const entry = (Object.entries(counts) as [NeedsYouSection, number][]).find(([, n]) => n > 0);
  return entry ? { section: entry[0], items: entry[1] } : { section: null, items: 1 };
}

export function needsYouRowView(task: NeedsYouTaskWithLink, ctx: Ctx): NeedsYouRowView {
  const build = ROWS[task.kind] as RowBuilder<typeof task.kind>;
  const { label, ...row } = build(task as never, ctx);
  return {
    key: rowKey(task),
    ...row,
    action: { label, href: needsYouHref(task) },
    ...needsYouTally(task),
  };
}
