import { CLIENT_ROUTES, organisationHref, teamHref } from "@/lib/navigation/client-routes";
import {
  type OrganisationBannerView,
  type OrganisationStateLink,
  oneOfRoles,
  organisationBannerView,
  unsoldPausedContact,
} from "@/lib/presenters/organisation-state/organisation-state-copy";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/lib/ui/format";
import type { NeedsYouTaskWithLink } from "@/lib/workspace/needs-you-read";
import {
  type FirstStep,
  type FirstStepId,
  type FirstStepState,
  type HomeActivityArchive,
  type HomeActivityEvent,
  type HomeActivityKind,
  type HomeNotice,
  type HomeShortcut,
  type HomeSubject,
  type OrganisationBanner,
  type OrganisationBannerKey,
  type OrganisationHomeModel,
  rolesWithCapability,
} from "@auction/domain";
import type { MyBuyerAgentAuthorisation } from "@auction/types";
import { type NeedsYouRowView, needsYouRowView } from "./needs-you-view";
import {
  type OrganisationDashboardView,
  organisationDashboardView,
} from "./organisation-dashboard-view";

/** One of a new organisation's first steps as it reads. */
export type FirstStepView = {
  id: FirstStepId;
  state: FirstStepState;
  title: string;
  /** What the step is, or once done or with us, where it stands. */
  detail: string;
  /**
   * The step's button: the primary one on the step to take now; the team step can be taken any
   * time, so it keeps a secondary one. Setup steps wait their turn.
   */
  action: { label: string; href: string; primary: boolean } | null;
};

export type FirstStepsView = {
  steps: FirstStepView[];
  done: number;
};

/** Something to know that is not this member's to do, as one quiet line. */
export type HomeNoticeView = {
  key: string;
  text: string;
  /** Where the whole line leads, when it is about something to follow. */
  href: string | null;
  /** A way on after the line ("Contact us"), when the line itself leads nowhere. */
  action?: OrganisationStateLink;
};

export type HomeLinkView = { id: string; label: string; href: string };

export type HomeActivityView = {
  key: string;
  text: string;
  /** Where to review it, for lines that lead somewhere. */
  href: string | null;
  /** "2 hours ago". */
  when: string;
  /** The full date and time, shown on hover and read with the relative time. */
  fullDate: string;
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
  /** `null` when the role is never asked for anything, so the section is left out. */
  needsYou: NeedsYouRowView[] | null;
  /** The reader did not answer: Home offers to try again instead of saying "nothing". */
  needsYouFailed: boolean;
  firstSteps: FirstStepsView | null;
  /** The organisation's state, when this member has something to be told. */
  banner: OrganisationBannerView | null;
  notices: HomeNoticeView[];
  shortcuts: HomeLinkView[];
  activity: HomeActivityView[];
  seeAllHref: string | null;
  /** The business figures after the tasks; `null` when they could not be loaded. */
  dashboard: OrganisationDashboardView | null;
};

type Ctx = { organisationName: string; now: Date };

function quoted(subject: HomeSubject): string {
  return `“${subject.title}”`;
}

const FIRST_STEPS: Record<
  FirstStepId,
  { title: string; detail: string; action: { label: string; href: string } }
> = {
  documents: {
    title: "Send your organisation documents",
    detail: "We check them before the organisation can bid or sell.",
    action: { label: "Send documents", href: organisationHref("documents") },
  },
  payouts: {
    title: "Set up payouts",
    detail:
      "Add the bank account we pay sale proceeds into. Works go into a sale once this is done. About 5 minutes.",
    action: { label: "Set up payouts", href: organisationHref("payouts") },
  },
  invite: {
    title: "Invite your team",
    detail:
      "Give colleagues their own sign-in as admin, finance, buyer agent, consignor or viewer.",
    action: { label: "Invite a member", href: teamHref() },
  },
};

/** Where a step stands once it is not the member's to take. */
const STEP_STATUS: Partial<Record<FirstStepId, Partial<Record<FirstStepState, string>>>> = {
  documents: { done: "Checked and approved", waiting: "Sent. We're checking them." },
  payouts: { done: "Bank account added" },
  invite: { done: "Your team has been invited" },
};

function firstStepsView(steps: readonly FirstStep[]): FirstStepsView {
  return {
    done: steps.filter((step) => step.state === "done").length,
    steps: steps.map(({ id, state }) => {
      const copy = FIRST_STEPS[id];
      return {
        id,
        state,
        title: copy.title,
        detail: STEP_STATUS[id]?.[state] ?? copy.detail,
        action:
          state === "next"
            ? { ...copy.action, primary: true }
            : id === "invite" && state === "later"
              ? { ...copy.action, primary: false }
              : null,
      };
    }),
  };
}

/**
 * Banners on Home are for blocking states only (restricted, documents needed). The rest read as a
 * quiet line, and setup the member does themself is a task or first step, not a banner.
 */
const BANNER_AS_NOTICE: ReadonlySet<OrganisationBannerKey> = new Set([
  "payouts_not_set_up",
  "documents_under_review",
]);

/** The task or first step that does what a banner asks, so Home offers the action only once. */
const BANNER_TASK: Partial<Record<OrganisationBannerKey, NeedsYouTaskWithLink["kind"]>> = {
  documents_requested: "documents",
  payouts_not_set_up: "payouts",
};

function askedFor(model: OrganisationHomeModel<NeedsYouTaskWithLink>, key: OrganisationBannerKey) {
  const kind = BANNER_TASK[key];
  if (!kind) return false;
  const inTasks = (model.tasks ?? []).some((t) => t.kind === kind);
  const inSteps = (model.firstSteps ?? []).some(
    (step) => step.id === kind && step.state === "next",
  );
  return inTasks || inSteps;
}

/** The banner on Home, or `null` when it reads as a notice or a task instead. */
function homeBannerView(
  model: OrganisationHomeModel<NeedsYouTaskWithLink>,
  banner: OrganisationBanner,
  ctx: Ctx,
): OrganisationBannerView | null {
  if (BANNER_AS_NOTICE.has(banner.key)) return null;
  const view = organisationBannerView(banner, ctx);
  return askedFor(model, banner.key) ? { ...view, action: null } : view;
}

/** A non-blocking state as a line, unless the member already has it as a task or step. */
function stateNotice(
  model: OrganisationHomeModel<NeedsYouTaskWithLink>,
  ctx: Ctx,
): HomeNoticeView | null {
  const banner = model.state.banner;
  if (!banner || !BANNER_AS_NOTICE.has(banner.key) || askedFor(model, banner.key)) return null;
  const view = organisationBannerView(banner, ctx);
  return {
    key: `state:${banner.key}`,
    text: `${view.title}. ${view.line}`,
    href: null,
    ...(view.action ? { action: view.action } : {}),
  };
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
  // Choices are paused by the organisation's state, so we decide with it.
  unsold_paused: ({ lots }) => {
    const [only] = lots;
    return {
      text:
        lots.length === 1 && only
          ? `${quoted(only)} did not sell.`
          : `${lots.length} works did not sell.`,
      href: null,
      action: {
        ...unsoldPausedContact(),
        label: `Contact us to decide what happens to ${lots.length === 1 ? "it" : "them"}`,
      },
    };
  },
};

function homeNoticeView(notice: HomeNotice): HomeNoticeView {
  const build = NOTICE_VIEWS[notice.kind] as NoticeViewBuilder<typeof notice.kind>;
  return { key: notice.kind, ...build(notice) };
}

const SHORTCUTS: Record<HomeShortcut, Omit<HomeLinkView, "id">> = {
  sell: { label: "Sell a work", href: CLIENT_ROUTES.sellingNew },
  invite: { label: "Invite a member", href: teamHref() },
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
  member_bids_stopped: `${teamHref()}#stopped-member-bids`,
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
    fullDate: formatDateTime(event.at),
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
export function organisationHomeView(
  model: OrganisationHomeModel<NeedsYouTaskWithLink>,
  ctx: Ctx,
): OrganisationHomeView {
  const state = stateNotice(model, ctx);
  return {
    needsYou: model.tasks ? model.tasks.map((task) => needsYouRowView(task, ctx)) : null,
    needsYouFailed: model.needsYouFailed,
    firstSteps: model.firstSteps ? firstStepsView(model.firstSteps) : null,
    banner: model.state.banner ? homeBannerView(model, model.state.banner, ctx) : null,
    notices: [...(state ? [state] : []), ...model.notices.map(homeNoticeView)],
    // "Sell a work" is the page's own action beside the title, so the list does not repeat it.
    shortcuts: model.shortcuts
      .filter((id) => id !== "sell")
      .map((id) => ({ id, ...SHORTCUTS[id] })),
    activity: model.activity.map(activityView),
    seeAllHref: model.activityArchive ? ARCHIVE_HREF[model.activityArchive] : null,
    dashboard: model.dashboard
      ? organisationDashboardView(model.dashboard, ctx, model.state.homeFirstRunKey)
      : null,
  };
}
