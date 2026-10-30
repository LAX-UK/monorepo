import type { LegalEntityStatus } from "@auction/types";
import type { ConsignmentChecklist } from "./consignment-checklist.js";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  entityCapabilitiesOf,
} from "./entity-capabilities.js";
import {
  type HomeSubject,
  type NeedsYouFacts,
  type NeedsYouKind,
  type NeedsYouTask,
  needsYouKindsFor,
  needsYouTasks,
} from "./needs-you.js";
import {
  type DashboardFigures,
  type OrganisationDashboardModel,
  buildOrganisationDashboard,
} from "./organisation-dashboard.js";
import {
  type OrganisationAction,
  type OrganisationStatePolicy,
  organisationStateAllows,
  organisationStatePolicy,
} from "./organisation-state-policy.js";
import type { UnsoldChoiceState } from "./unsold-lot-choice.js";

export type { HomeSubject };

/**
 * Everything Home needs to know, already loaded. Lists a role may not see can be left empty:
 * the model only reads what the role's capabilities allow.
 */
export type OrganisationHomeFacts = {
  actor: EntityActor;
  organisation: { status: LegalEntityStatus; payoutsReady: boolean };
  /** The organisation's consignments with their checklists (phase of selling). */
  consignments: ReadonlyArray<HomeSubject & { checklist: ConsignmentChecklist }>;
  /** Submissions a specialist sent back, with the specialist's note. */
  changesRequested: ReadonlyArray<HomeSubject & { note: string | null }>;
  /**
   * Consigned lots that ended without selling (`lotEndedUnsold`, read for the account), with what
   * has been chosen for each.
   */
  unsoldLots: ReadonlyArray<HomeSubject & UnsoldLotState>;
  /** The organisation's won lots that are not paid yet (for a buyer agent, their own wins). */
  purchasesAwaitingPayment: readonly HomeSubject[];
  /** The person's own identity check. */
  viewerIdentity: "verified" | "checking" | "required";
  /** Sales a buyer agent is authorised for and has not registered in yet. */
  salesToRegister: ReadonlyArray<HomeSubject & { startsAt: Date; bidLimit: string | null }>;
};

/** An unsold lot as the unsold task reads it: whether anyone has chosen yet. */
export type UnsoldLotState = { choice: UnsoldChoiceState };

/**
 * The kinds Home draws today. Home reads the one "Needs you" table (`needs-you.ts`); the kinds
 * added there since (outbid, delivery, collection, invitations, authorisations) reach Home through
 * the workspace's Needs you endpoint.
 */
const HOME_TASK_KINDS = [
  "documents",
  "agreement",
  "changes",
  "payouts",
  "unsold",
  "pay",
  "won_awaiting_payment",
  "identity",
  "register",
] as const satisfies readonly NeedsYouKind[];

export type HomeTaskKind = (typeof HOME_TASK_KINDS)[number];
/** One thing on "Needs you". Each has one button; it disappears when done. */
export type HomeTask = Extract<NeedsYouTask, { kind: HomeTaskKind }>;

const isHomeKind = (kind: NeedsYouKind): kind is HomeTaskKind =>
  (HOME_TASK_KINDS as readonly NeedsYouKind[]).includes(kind);
const isHomeTask = (task: NeedsYouTask): task is HomeTask => isHomeKind(task.kind);

/** Unsold lots nobody has chosen for yet; a made choice clears the task. */
function lotsAwaitingChoice(facts: Pick<OrganisationHomeFacts, "unsoldLots">): HomeSubject[] {
  return facts.unsoldLots
    .filter((lot) => lot.choice === "none")
    .map(({ id, title }) => ({ id, title }));
}

/** Home's facts in the table's terms. */
function asNeedsYouFacts(facts: OrganisationHomeFacts): NeedsYouFacts {
  return {
    actor: facts.actor,
    organisation: facts.organisation,
    now: new Date(),
    viewerIdentity: facts.viewerIdentity,
    sourceOfFundsRequested: false,
    agreementsToAccept: facts.consignments
      .filter(({ checklist }) =>
        checklist.applies
          ? checklist.items.some((item) => item.id === "agreement" && item.state === "action")
          : false,
      )
      .map(({ id, title }) => ({ id, title })),
    changesRequested: facts.changesRequested,
    unsoldLots: lotsAwaitingChoice(facts).map((lot) => ({ ...lot, endedAt: null })),
    purchases: facts.purchasesAwaitingPayment.map((purchase) => ({
      ...purchase,
      paymentStatus: null,
      fulfilment: null,
      shippingQuote: null,
    })),
    salesToRegister: facts.salesToRegister,
    outbidLots: [],
    expiredInvitations: [],
    endingAuthorisations: [],
  };
}

/** Which "Needs you" kinds a role can ever see; Home hides the section for the others. */
export function homeTaskKindsFor(actor: EntityActor): HomeTaskKind[] {
  return needsYouKindsFor(actor).filter(isHomeKind);
}

/** The tasks this member can complete now, in the table's order. */
export function homeTasks(facts: OrganisationHomeFacts): HomeTask[] {
  return needsYouTasks(asNeedsYouFacts(facts)).filter(isHomeTask);
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
export type OrganisationHomeModel = {
  /** `null` when the role has nothing it could ever be asked to do (the section is hidden). */
  tasks: HomeTask[] | null;
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
export function buildOrganisationHome(
  facts: OrganisationHomeFacts,
  activity: readonly HomeActivityEvent[],
  figures: DashboardFigures | null = null,
): OrganisationHomeModel {
  const askable = homeTaskKindsFor(facts.actor).length > 0;
  const state = organisationStatePolicy(
    facts.organisation.status,
    entityCapabilitiesOf(facts.actor),
    { payoutsReady: facts.organisation.payoutsReady },
  );
  const dashboard = figures
    ? buildOrganisationDashboard(facts.actor, figures, (action) => state.actions[action])
    : null;
  return {
    tasks: askable ? homeTasks(facts) : null,
    state,
    notices: homeNotices(facts),
    shortcuts: dashboard?.firstRun ? [] : homeShortcuts(facts.actor, facts.organisation.status),
    activity: homeActivity(activity, facts.actor),
    activityArchive: homeActivityArchive(facts.actor),
    dashboard,
  };
}
