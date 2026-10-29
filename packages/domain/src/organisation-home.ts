import type { LegalEntityStatus } from "@auction/types";
import { roleBidsThroughAuthorisation } from "./bid-authority.js";
import type { ConsignmentChecklist } from "./consignment-checklist.js";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  entityCapabilitiesOf,
} from "./entity-capabilities.js";
import { roleNeedsPersonalIdentity } from "./member-role-guide.js";
import {
  type DashboardFigures,
  type OrganisationDashboardModel,
  buildOrganisationDashboard,
} from "./organisation-dashboard.js";
import { type OrganisationSetupState, organisationSetupState } from "./organisation-setup.js";
import {
  type OrganisationAction,
  type OrganisationStatePolicy,
  organisationStatePolicy,
} from "./organisation-state-policy.js";
import type { UnsoldChoiceState } from "./unsold-lot-choice.js";

/** A thing on Home that a task or an activity line is about. */
export type HomeSubject = { id: string; title: string };

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
  /** Something is sold or on its way to sale, so payouts are needed. */
  hasWorkAwaitingPayout: boolean;
};

/** An unsold lot as the unsold task reads it: whether anyone has chosen yet. */
export type UnsoldLotState = { choice: UnsoldChoiceState };

/** One thing on "Needs you". Each has one button; it disappears when done. */
export type HomeTask =
  | { kind: "documents" }
  | { kind: "agreement"; consignment: HomeSubject }
  | { kind: "changes"; submission: HomeSubject; note: string | null }
  | { kind: "payouts" }
  | { kind: "unsold"; lots: HomeSubject[] }
  | { kind: "pay"; purchases: HomeSubject[] }
  | { kind: "won_awaiting_payment"; purchases: HomeSubject[] }
  | { kind: "identity" }
  | { kind: "register"; sale: HomeSubject; startsAt: Date; bidLimit: string | null };

export type HomeTaskKind = HomeTask["kind"];

type TaskSpec = {
  kind: HomeTaskKind;
  /** Who may complete it, from the capability table. */
  allowed: (actor: EntityActor) => boolean;
  /** What the organisation's own state must allow for the task to be offered. */
  requires?: OrganisationAction;
  collect: (facts: OrganisationHomeFacts) => HomeTask[];
};

function capability(name: EntityCapability) {
  return (actor: EntityActor) => entityActorCan(actor, name);
}

const DOCUMENT_STATES: ReadonlySet<OrganisationSetupState> = new Set(["documents_requested"]);

/** Unsold lots nobody has chosen for yet; a made choice clears the task. */
function lotsAwaitingChoice(facts: Pick<OrganisationHomeFacts, "unsoldLots">): HomeSubject[] {
  return facts.unsoldLots
    .filter((lot) => lot.choice === "none")
    .map(({ id, title }) => ({ id, title }));
}

/** "Needs you", in order: what blocks the organisation first, then each piece of work. */
const TASK_SPECS: readonly TaskSpec[] = [
  {
    kind: "documents",
    allowed: capability("entity.members.manage"),
    collect: (facts) => {
      const state = organisationSetupState(facts.organisation);
      return state && DOCUMENT_STATES.has(state) ? [{ kind: "documents" }] : [];
    },
  },
  {
    kind: "identity",
    allowed: (actor) => roleNeedsPersonalIdentity(actor.role) && !actor.isImpersonation,
    collect: (facts) => (facts.viewerIdentity === "required" ? [{ kind: "identity" }] : []),
  },
  {
    kind: "agreement",
    requires: "accept_agreement",
    allowed: capability("entity.consignments.accept_agreement"),
    collect: (facts) =>
      facts.consignments
        .filter(({ checklist }) =>
          checklist.applies
            ? checklist.items.some((item) => item.id === "agreement" && item.state === "action")
            : false,
        )
        .map(({ id, title }) => ({ kind: "agreement", consignment: { id, title } })),
  },
  {
    kind: "changes",
    requires: "submit",
    allowed: capability("entity.submissions.create"),
    collect: (facts) =>
      facts.changesRequested.map(({ id, title, note }) => ({
        kind: "changes",
        submission: { id, title },
        note,
      })),
  },
  {
    kind: "payouts",
    requires: "set_up_payouts",
    allowed: capability("entity.connect.operate"),
    collect: (facts) =>
      !facts.organisation.payoutsReady && facts.hasWorkAwaitingPayout ? [{ kind: "payouts" }] : [],
  },
  {
    kind: "unsold",
    allowed: capability("entity.consignments.after_sale"),
    collect: (facts) => {
      const lots = lotsAwaitingChoice(facts);
      return lots.length > 0 ? [{ kind: "unsold", lots }] : [];
    },
  },
  {
    kind: "pay",
    requires: "pay",
    allowed: capability("entity.finance.write"),
    collect: (facts) =>
      facts.purchasesAwaitingPayment.length > 0
        ? [{ kind: "pay", purchases: [...facts.purchasesAwaitingPayment] }]
        : [],
  },
  {
    // A buyer agent wins for the organisation; finance pays, so the agent is only told.
    kind: "won_awaiting_payment",
    allowed: (actor) =>
      roleBidsThroughAuthorisation(actor.role) && !entityActorCan(actor, "entity.finance.write"),
    collect: (facts) =>
      facts.purchasesAwaitingPayment.length > 0
        ? [{ kind: "won_awaiting_payment", purchases: [...facts.purchasesAwaitingPayment] }]
        : [],
  },
  {
    kind: "register",
    requires: "register",
    allowed: (actor) => roleBidsThroughAuthorisation(actor.role) && !actor.isImpersonation,
    collect: (facts) =>
      facts.salesToRegister.map(({ id, title, startsAt, bidLimit }) => ({
        kind: "register",
        sale: { id, title },
        startsAt,
        bidLimit,
      })),
  },
];

/** Which "Needs you" kinds a role can ever see; Home hides the section for the others. */
export function homeTaskKindsFor(actor: EntityActor): HomeTaskKind[] {
  return TASK_SPECS.filter((spec) => spec.allowed(actor)).map((spec) => spec.kind);
}

/** The tasks this member can complete now, in order. */
export function homeTasks(facts: OrganisationHomeFacts): HomeTask[] {
  const state = organisationStatePolicy(
    facts.organisation.status,
    entityCapabilitiesOf(facts.actor),
  );
  return TASK_SPECS.filter(
    (spec) => spec.allowed(facts.actor) && (!spec.requires || state.actions[spec.requires]),
  ).flatMap((spec) => spec.collect(facts));
}

/** Something to know that is not the member's to do. */
export type HomeNotice = { kind: "unsold_waiting"; lots: HomeSubject[] };

/**
 * A consignor sees that a lot is waiting for an administrator's choice, as information; the
 * people who can choose get the task instead.
 */
export function homeNotices(facts: OrganisationHomeFacts): HomeNotice[] {
  const follows = entityActorCan({ role: facts.actor.role }, "entity.consignments.read");
  const chooses = entityActorCan({ role: facts.actor.role }, "entity.consignments.after_sale");
  if (!follows || chooses) return [];
  const lots = lotsAwaitingChoice(facts);
  return lots.length > 0 ? [{ kind: "unsold_waiting", lots }] : [];
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
