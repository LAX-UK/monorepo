import { CLIENT_ROUTES, organisationHref } from "@/lib/navigation/client-routes";
import {
  type OrganisationBannerView,
  oneOfRoles,
  organisationBannerView,
} from "@/lib/presenters/organisation-state/organisation-state-copy";
import { formatDate, formatMoney, formatRelativeTime } from "@/lib/ui/format";
import {
  type HomeActivityArchive,
  type HomeActivityEvent,
  type HomeActivityKind,
  type HomeNotice,
  type HomeShortcut,
  type HomeSubject,
  type HomeTask,
  type OrganisationHomeModel,
  rolesWithCapability,
} from "@auction/domain";
import { type MyBuyerAgentAuthorisation, salePath } from "@auction/types";
import {
  type OrganisationDashboardView,
  organisationDashboardView,
} from "./organisation-dashboard-view";

/** One "Needs you" row as it reads, with its single button. */
export type HomeTaskView = {
  key: string;
  title: string;
  detail: string;
  action: { label: string; href: string };
};

/** Something to know that is not this member's to do, as one quiet line. */
export type HomeNoticeView = { key: string; text: string; href: string | null };

export type HomeLinkView = { id: string; label: string; href: string };

export type HomeActivityView = {
  key: string;
  text: string;
  /** Where to review it, for lines that lead somewhere. */
  href: string | null;
  when: string;
  at: string;
};

/** The one-time welcome card after accepting an invitation. */
export type WelcomeCardView = {
  organisationId: string;
  headline: string;
  abilities: string[];
  identityStep: boolean;
};

export type OrganisationHomeView = {
  needsYou: HomeTaskView[] | null;
  /** The organisation's state, when this member has something to be told. */
  banner: OrganisationBannerView | null;
  notices: HomeNoticeView[];
  shortcuts: HomeLinkView[];
  activity: HomeActivityView[];
  seeAllHref: string | null;
  /** The business figures after the tasks; `null` when they could not be loaded. */
  dashboard: OrganisationDashboardView | null;
};

type Ctx = { organisationName: string };

function quoted(subject: HomeSubject): string {
  return `"${subject.title}"`;
}

function listOf(subjects: readonly HomeSubject[]): string {
  const [first] = subjects;
  if (!first) return "";
  if (subjects.length === 1) return quoted(first);
  return `${quoted(first)} and ${subjects.length - 1} more`;
}

type TaskViewBuilder<K extends HomeTask["kind"]> = (
  task: Extract<HomeTask, { kind: K }>,
  ctx: Ctx,
) => Omit<HomeTaskView, "key">;

/** Words and the button for every kind of task; one entry per kind. */
const TASK_VIEWS: { [K in HomeTask["kind"]]: TaskViewBuilder<K> } = {
  documents: () => ({
    title: "Send the documents we asked for",
    detail: "We check them before the organisation can bid or sell.",
    action: { label: "Open documents", href: organisationHref("documents") },
  }),
  identity: (_task, ctx) => ({
    title: "Verify your identity",
    detail: `Needed before you can act for ${ctx.organisationName}. It takes about 3 minutes.`,
    action: { label: "Verify", href: CLIENT_ROUTES.verifyIdentity },
  }),
  agreement: (task) => ({
    title: "Accept the consignment agreement",
    detail: `${quoted(task.consignment)} · the specialist's estimate and terms`,
    action: {
      label: "Review and accept",
      href: `${CLIENT_ROUTES.consignments}/${task.consignment.id}#agreement`,
    },
  }),
  changes: (task) => ({
    title: "Make the changes the specialist asked for",
    detail: task.note
      ? `${quoted(task.submission)} · "${task.note}"`
      : `${quoted(task.submission)} · see the specialist's note`,
    action: {
      label: "Edit and resubmit",
      href: `${CLIENT_ROUTES.consignments}/${task.submission.id}`,
    },
  }),
  payouts: () => ({
    title: "Set up payouts",
    detail: "Needed before the organisation's lots can go live in a sale.",
    action: { label: "Set up", href: organisationHref("payouts") },
  }),
  unsold: (task) => ({
    title: "Choose what happens next",
    detail: `${listOf(task.lots)} did not sell`,
    action: { label: "Choose", href: `${CLIENT_ROUTES.consignments}?tab=unsold` },
  }),
  pay: (task) => ({
    title: task.purchases.length === 1 ? "Pay for a purchase" : "Pay for purchases",
    detail: `${listOf(task.purchases)} won and awaiting payment`,
    action: { label: "Pay", href: CLIENT_ROUTES.purchases },
  }),
  won_awaiting_payment: (task, ctx) => ({
    title: task.purchases.length === 1 ? "A win is awaiting payment" : "Wins awaiting payment",
    detail: `${listOf(task.purchases)} · ${ctx.organisationName}'s finance team has been told`,
    action: { label: "View", href: CLIENT_ROUTES.purchases },
  }),
  register: (task) => ({
    title: `Register for ${task.sale.title}, ${formatDate(task.startsAt)}`,
    detail: task.bidLimit
      ? `You're authorised to bid up to ${formatMoney(task.bidLimit)}`
      : "You're authorised to bid with no limit",
    action: { label: "Register", href: salePath({ id: task.sale.id, title: task.sale.title }) },
  }),
};

function taskKey(task: HomeTask): string {
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

export function homeTaskView(task: HomeTask, ctx: Ctx): HomeTaskView {
  const build = TASK_VIEWS[task.kind] as TaskViewBuilder<typeof task.kind>;
  return { key: taskKey(task), ...build(task as never, ctx) };
}

/** Who chooses for an unsold lot, from the capability table: "an owner or admin". */
const UNSOLD_CHOOSERS = oneOfRoles(rolesWithCapability("entity.consignments.after_sale"), "inside");

type NoticeViewBuilder<K extends HomeNotice["kind"]> = (
  notice: Extract<HomeNotice, { kind: K }>,
) => Omit<HomeNoticeView, "key">;

/** Words for every kind of notice; one entry per kind. */
const NOTICE_VIEWS: { [K in HomeNotice["kind"]]: NoticeViewBuilder<K> } = {
  unsold_waiting: ({ lots }) => {
    const [only] = lots;
    return {
      text:
        lots.length === 1 && only
          ? `Waiting for ${UNSOLD_CHOOSERS} to choose what happens to ${quoted(only)}, which did not sell`
          : `Waiting for ${UNSOLD_CHOOSERS} to choose what happens to ${lots.length} unsold works`,
      href: `${CLIENT_ROUTES.consignments}?tab=unsold`,
    };
  },
};

function homeNoticeView(notice: HomeNotice): HomeNoticeView {
  const build = NOTICE_VIEWS[notice.kind] as NoticeViewBuilder<typeof notice.kind>;
  return { key: notice.kind, ...build(notice) };
}

const SHORTCUTS: Record<HomeShortcut, Omit<HomeLinkView, "id">> = {
  sell: { label: "Sell a work", href: CLIENT_ROUTES.sellingNew },
  invite: { label: "Invite someone", href: organisationHref("members") },
  statements: { label: "Statements", href: CLIENT_ROUTES.payouts },
};

const ACTIVITY_TEXT: Record<HomeActivityKind, (event: HomeActivityEvent) => string> = {
  submission_sent: ({ subject: s }) => `${quoted(s)} was sent to our specialists`,
  changes_requested: ({ subject: s }) => `A specialist asked for changes to ${quoted(s)}`,
  submission_accepted: ({ subject: s }) => `${quoted(s)} was accepted for sale`,
  lot_sold: ({ subject: s }) => `${quoted(s)} sold`,
  lot_unsold: ({ subject: s }) => `${quoted(s)} did not sell`,
  purchase_won: ({ subject: s }) => `${quoted(s)} was won`,
  payout_sent: ({ subject: s }) => `Payout ${s.title} was sent`,
  member_joined: ({ subject: s }) => `${s.title} joined`,
  member_bids_stopped: ({ subject, count = 1 }) =>
    `${subject.title}'s automatic bids stopped when they left: ${count} ${count === 1 ? "lot" : "lots"}`,
};

/** Lines that lead somewhere to review; the rest are plain. */
const ACTIVITY_HREF: Partial<Record<HomeActivityKind, string>> = {
  member_bids_stopped: `${organisationHref("members")}#stopped-member-bids`,
};

const ARCHIVE_HREF: Record<HomeActivityArchive, string> = {
  consignments: CLIENT_ROUTES.consignments,
  purchases: CLIENT_ROUTES.purchases,
  bids: CLIENT_ROUTES.bids,
};

function activityView(event: HomeActivityEvent, index: number): HomeActivityView {
  return {
    key: `${event.kind}:${event.subject.id}:${index}`,
    text: ACTIVITY_TEXT[event.kind](event),
    href: ACTIVITY_HREF[event.kind] ?? null,
    when: formatRelativeTime(event.at),
    at: new Date(event.at).toISOString(),
  };
}

/** A buyer agent's standing authority for every sale, or `null` when it is sale by sale. */
export function buyerAgentAuthorityLine(
  authorisations: readonly MyBuyerAgentAuthorisation[],
): string | null {
  const everySale = authorisations.find((a) => a.sale === null);
  if (!everySale) return null;
  return everySale.bidLimit
    ? `You may bid for the organisation in every sale, up to ${formatMoney(everySale.bidLimit)}.`
    : "You may bid for the organisation in every sale, with no limit.";
}

/** Home's words and links, from the domain model. */
export function organisationHomeView(model: OrganisationHomeModel, ctx: Ctx): OrganisationHomeView {
  return {
    needsYou: model.tasks ? model.tasks.map((task) => homeTaskView(task, ctx)) : null,
    banner: model.state.banner ? organisationBannerView(model.state.banner, ctx) : null,
    notices: model.notices.map(homeNoticeView),
    shortcuts: model.shortcuts.map((id) => ({ id, ...SHORTCUTS[id] })),
    activity: model.activity.map(activityView),
    seeAllHref: model.activityArchive ? ARCHIVE_HREF[model.activityArchive] : null,
    dashboard: model.dashboard
      ? organisationDashboardView(model.dashboard, ctx, model.state.homeFirstRunKey)
      : null,
  };
}
