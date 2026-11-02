import type { LegalEntityStatus } from "@auction/types";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  entityCapabilitiesOf,
} from "./entity-capabilities.js";
import type { HomeSubject, NeedsYouKind, NeedsYouTask } from "./needs-you.js";
import {
  type DashboardFigures,
  type OrganisationDashboardModel,
  buildOrganisationDashboard,
} from "./organisation-dashboard.js";
import { organisationSetupState } from "./organisation-setup.js";
import {
  type OrganisationAction,
  type OrganisationStatePolicy,
  organisationStateAllows,
  organisationStatePolicy,
} from "./organisation-state-policy.js";
import type { UnsoldChoiceState } from "./unsold-lot-choice.js";

export type { HomeSubject };

/**
 * Everything Home needs to know besides "Needs you", already loaded. Lists a role may not see can
 * be left empty: the model only reads what the role's capabilities allow.
 */
export type OrganisationHomeFacts = {
  actor: EntityActor;
  organisation: { status: LegalEntityStatus; payoutsReady: boolean };
  /**
   * Consigned lots that ended without selling (`lotEndedUnsold`, read for the account), with what
   * has been chosen for each. Home tells the people who cannot choose about them.
   */
  unsoldLots: ReadonlyArray<HomeSubject & UnsoldLotState>;
  /** Whether anyone besides the first owner has joined or been invited (the team step). */
  teamInvited: boolean;
};

/** An unsold lot as the unsold notice reads it: whether anyone has chosen yet. */
export type UnsoldLotState = { choice: UnsoldChoiceState };

/**
 * What the one Needs-you reader (`needs-you.ts`, served by `GET /legal-entities/needs-you`) said
 * for this member: the kinds the role can ever be asked for, and the tasks waiting now, ranked.
 * Home never works out a task itself, so it always agrees with the sidebar counts.
 */
export type NeedsYouRead<T extends NeedsYouTask = NeedsYouTask> = {
  kinds: readonly NeedsYouKind[];
  tasks: readonly T[];
};

/** Unsold lots nobody has chosen for yet; a made choice clears the notice. */
function lotsAwaitingChoice(facts: Pick<OrganisationHomeFacts, "unsoldLots">): HomeSubject[] {
  return facts.unsoldLots
    .filter((lot) => lot.choice === "none")
    .map(({ id, title }) => ({ id, title }));
}

/** One of a new organisation's first steps. */
export type FirstStepId = "documents" | "payouts" | "invite";

/**
 * - `done`: finished;
 * - `waiting`: with LAX (documents being checked);
 * - `next`: the step to take now;
 * - `later`: still to come.
 */
export type FirstStepState = "done" | "waiting" | "next" | "later";

export type FirstStep = { id: FirstStepId; state: FirstStepState };

/** The Needs-you kinds the first steps stand for: Home shows them as steps, not twice. */
export const FIRST_STEP_TASK_KINDS = [
  "documents",
  "payouts",
] as const satisfies readonly NeedsYouKind[];

/**
 * The tasks a list shows for a member: everything the reader asks, except the setup tasks the
 * first steps stand for. Those are asked of the people who run the organisation, and Home shows
 * them as steps, so no list repeats them. Home, the menu's counts and Notifications all read the
 * reader through this, so they cannot disagree while setup is open.
 */
export function visibleNeedsYouTasks<T extends NeedsYouTask>(
  tasks: readonly T[],
  actor: EntityActor,
): T[] {
  const stepKinds = new Set<NeedsYouKind>(FIRST_STEP_TASK_KINDS);
  const stepsShown =
    canRead(actor, SHORTCUTS_AUDIENCE) && tasks.some((task) => stepKinds.has(task.kind));
  return stepsShown ? tasks.filter((task) => !stepKinds.has(task.kind)) : [...tasks];
}

/**
 * A new organisation's first steps, for the people who run it: documents, payouts, then the team.
 * Setup is a first step, never a banner. A setup step is `next` only when the reader asks for it,
 * so the step and the sidebar count agree; the team step is `next` once nothing before it is.
 * `null` for anyone who does not run the organisation.
 */
export function organisationFirstSteps(
  facts: OrganisationHomeFacts,
  needsYou: NeedsYouRead | null,
): FirstStep[] | null {
  if (!canRead(facts.actor, SHORTCUTS_AUDIENCE)) return null;
  const asked = new Set<NeedsYouKind>((needsYou?.tasks ?? []).map((task) => task.kind));
  const setup = organisationSetupState(facts.organisation);
  const documents: FirstStepState =
    setup === "documents_requested"
      ? asked.has("documents")
        ? "next"
        : "later"
      : setup === "documents_under_review"
        ? "waiting"
        : "done";
  // The reader decides whether payouts are asked for, from the organisation's own state.
  const payouts: FirstStepState = asked.has("payouts")
    ? "next"
    : setup === "payouts_not_set_up" ||
        setup === "documents_requested" ||
        setup === "documents_under_review"
      ? "later"
      : "done";
  const setupOpen = documents === "next" || payouts === "next";
  const invite: FirstStepState = facts.teamInvited
    ? "done"
    : !setupOpen && can(facts.actor, "entity.members.manage")
      ? "next"
      : "later";
  return [
    { id: "documents", state: documents },
    { id: "payouts", state: payouts },
    { id: "invite", state: invite },
  ];
}

/** Something to know that is not the member's to do. */
export type HomeNotice =
  /** A lot waits for an owner's or admin's choice. */
  | { kind: "unsold_waiting"; lots: HomeSubject[] }
  /** The organisation's state pauses choices, so LAX decides with it. */
  | { kind: "unsold_paused"; lots: HomeSubject[] };

/**
 * Unsold lots as information, never as a task:
 * - a consignor (who follows but does not choose) sees that the lots wait for an owner or admin;
 * - while the organisation's state pauses choices, the people who would choose are told to
 *   contact us instead of being given a task. Nobody else is told an owner will choose, since
 *   no one in the organisation can.
 */
export function homeNotices(facts: OrganisationHomeFacts): HomeNotice[] {
  const lots = lotsAwaitingChoice(facts);
  if (lots.length === 0) return [];
  const follows = entityActorCan({ role: facts.actor.role }, "entity.consignments.read");
  const chooses = entityActorCan({ role: facts.actor.role }, "entity.consignments.after_sale");
  const open = organisationStateAllows(facts.organisation.status, "choose_unsold");
  if (!open) return chooses ? [{ kind: "unsold_paused", lots }] : [];
  return follows && !chooses ? [{ kind: "unsold_waiting", lots }] : [];
}

/** A shortcut on Home: a page the people who run the organisation use often. */
export type HomeShortcut = "sell" | "invite" | "statements";

type ShortcutSpec = {
  shortcut: HomeShortcut;
  applies: (actor: EntityActor) => boolean;
  /** What the organisation's own state must allow for the shortcut to be offered. */
  requires?: OrganisationAction;
};

const can = (actor: EntityActor, name: EntityCapability) => entityActorCan(actor, name);
/** Reading capabilities (writes are hidden from an impersonating admin). */
const canRead = (actor: EntityActor, name: EntityCapability) =>
  entityActorCan({ role: actor.role }, name);

/**
 * Shortcuts belong to the people who run the organisation. Every other role reaches its pages
 * from the figures on Home, each of which links to the page behind it.
 */
const SHORTCUTS_AUDIENCE: EntityCapability = "entity.members.manage";

/** Shortcuts in order; writes are hidden from an impersonating admin. */
const SHORTCUT_SPECS: readonly ShortcutSpec[] = [
  { shortcut: "sell", applies: (a) => can(a, "entity.submissions.create"), requires: "submit" },
  { shortcut: "invite", applies: (a) => can(a, "entity.members.manage"), requires: "invite" },
  { shortcut: "statements", applies: (a) => canRead(a, "entity.payouts.read") },
];

/** The role's shortcuts: Sell a work, Invite someone and Statements for owners and admins. */
export function homeShortcuts(actor: EntityActor, status: LegalEntityStatus): HomeShortcut[] {
  if (!canRead(actor, SHORTCUTS_AUDIENCE)) return [];
  const state = organisationStatePolicy(status, entityCapabilitiesOf(actor));
  return SHORTCUT_SPECS.filter(
    (spec) => spec.applies(actor) && (!spec.requires || state.actions[spec.requires]),
  ).map((spec) => spec.shortcut);
}

/** Something that happened in the organisation, for "Recent activity". */
export type HomeActivityKind =
  | "submission_sent"
  | "changes_requested"
  | "submission_accepted"
  | "lot_sold"
  | "lot_unsold"
  | "purchase_won"
  | "payout_sent"
  | "member_joined"
  | "member_bids_stopped";

export type HomeActivityEvent = {
  kind: HomeActivityKind;
  at: Date;
  subject: HomeSubject;
  /** How many things the line covers (the lots whose automatic bids stopped). */
  count?: number;
};

/** Who sees each kind of activity: members holding any of these capabilities. */
const ACTIVITY_AUDIENCE: Record<HomeActivityKind, readonly EntityCapability[]> = {
  submission_sent: ["entity.consignments.read"],
  changes_requested: ["entity.consignments.read"],
  submission_accepted: ["entity.consignments.read"],
  lot_sold: ["entity.consignments.read"],
  lot_unsold: ["entity.consignments.read"],
  purchase_won: ["entity.finance.read", "entity.bid.place"],
  payout_sent: ["entity.payouts.read"],
  member_joined: ["entity.members.manage"],
  member_bids_stopped: ["entity.members.manage"],
};

const ACTIVITY_LIMIT = 5;

/** The five newest things this role may see, newest first. */
export function homeActivity(
  events: readonly HomeActivityEvent[],
  actor: EntityActor,
): HomeActivityEvent[] {
  return events
    .filter((event) => ACTIVITY_AUDIENCE[event.kind].some((name) => canRead(actor, name)))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, ACTIVITY_LIMIT);
}

/** Where "See all" leads from Recent activity, first that applies. */
export type HomeActivityArchive = "consignments" | "purchases" | "bids";

const ARCHIVE_SPECS: readonly { archive: HomeActivityArchive; capability: EntityCapability }[] = [
  { archive: "consignments", capability: "entity.consignments.read" },
  { archive: "purchases", capability: "entity.finance.read" },
  { archive: "bids", capability: "entity.bid.place" },
];

export function homeActivityArchive(actor: EntityActor): HomeActivityArchive | null {
  return ARCHIVE_SPECS.find((spec) => canRead(actor, spec.capability))?.archive ?? null;
}

/** Home for one member, built from facts alone. */
export type OrganisationHomeModel<T extends NeedsYouTask = NeedsYouTask> = {
  /**
   * The reader's tasks, ranked; empty when nothing waits, `null` when the role can never be asked
   * for anything (the section is hidden) or when the reader could not be read (`needsYouFailed`).
   */
  tasks: T[] | null;
  /** The reader did not answer: Home says so and offers to try again, rather than "nothing". */
  needsYouFailed: boolean;
  /** A new organisation's first steps, while any is left; `null` otherwise. */
  firstSteps: FirstStep[] | null;
  /** What the organisation's state allows and tells this member (banner, first-run message). */
  state: OrganisationStatePolicy;
  /** Things to know that are not this member's to do. */
  notices: HomeNotice[];
  shortcuts: HomeShortcut[];
  activity: HomeActivityEvent[];
  activityArchive: HomeActivityArchive | null;
  /** The business figures after the tasks; `null` when they could not be loaded. */
  dashboard: OrganisationDashboardModel | null;
};

/**
 * Home for one member: tasks first, then the business figures, shortcuts and activity. A new
 * organisation's first steps replace the shortcuts, which would only repeat them.
 */
export function buildOrganisationHome<T extends NeedsYouTask>(
  facts: OrganisationHomeFacts,
  activity: readonly HomeActivityEvent[],
  figures: DashboardFigures | null,
  needsYou: NeedsYouRead<T> | null,
): OrganisationHomeModel<T> {
  const state = organisationStatePolicy(
    facts.organisation.status,
    entityCapabilitiesOf(facts.actor),
    { payoutsReady: facts.organisation.payoutsReady },
  );
  const dashboard = figures
    ? buildOrganisationDashboard(facts.actor, figures, (action) => state.actions[action])
    : null;
  return {
    ...homeTasksAndSteps(facts, needsYou, dashboard?.firstRun != null),
    state,
    notices: homeNotices(facts),
    shortcuts: dashboard?.firstRun ? [] : homeShortcuts(facts.actor, facts.organisation.status),
    activity: homeActivity(activity, facts.actor),
    activityArchive: homeActivityArchive(facts.actor),
    dashboard,
  };
}

/**
 * The reader's tasks and the first steps. The steps show while setup is open, or while a new
 * organisation has nothing yet (then the team step too); a long-standing organisation is never
 * nagged to invite anyone. The setup tasks the steps stand for are not listed twice.
 */
function homeTasksAndSteps<T extends NeedsYouTask>(
  facts: OrganisationHomeFacts,
  needsYou: NeedsYouRead<T> | null,
  nothingYet: boolean,
): Pick<OrganisationHomeModel<T>, "tasks" | "needsYouFailed" | "firstSteps"> {
  const steps = organisationFirstSteps(facts, needsYou);
  const setupOpen = steps?.some((step) => step.id !== "invite" && step.state !== "done") ?? false;
  const firstSteps =
    steps && (setupOpen || nothingYet) && steps.some((step) => step.state !== "done")
      ? steps
      : null;
  const askable = needsYou !== null && needsYou.kinds.length > 0;
  return {
    tasks: askable ? visibleNeedsYouTasks(needsYou.tasks, facts.actor) : null,
    needsYouFailed: needsYou === null,
    firstSteps,
  };
}
