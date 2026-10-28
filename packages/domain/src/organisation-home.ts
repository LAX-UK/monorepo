import type { LegalEntityStatus } from "@auction/types";
import { roleBidsThroughAuthorisation } from "./bid-authority.js";
import type { ConsignmentChecklist } from "./consignment-checklist.js";
import { type EntityActor, type EntityCapability, entityActorCan } from "./entity-capabilities.js";
import { roleNeedsPersonalIdentity } from "./member-role-guide.js";
import { type OrganisationSetupState, organisationSetupState } from "./organisation-setup.js";

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
  /** Lots that ended without selling, waiting for the seller's choice. */
  unsoldLots: readonly HomeSubject[];
  /** The organisation's won lots that are not paid yet (for a buyer agent, their own wins). */
  purchasesAwaitingPayment: readonly HomeSubject[];
  /** The person's own identity check. */
  viewerIdentity: "verified" | "checking" | "required";
  /** Sales a buyer agent is authorised for and has not registered in yet. */
  salesToRegister: ReadonlyArray<HomeSubject & { startsAt: Date; bidLimit: string | null }>;
  /** Auto-bid maximums and absentee bids former members left standing. */
  formerMemberOpenBids: number;
  /** Something is sold or on its way to sale, so payouts are needed. */
  hasWorkAwaitingPayout: boolean;
};

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
  | { kind: "register"; sale: HomeSubject; startsAt: Date; bidLimit: string | null }
  | { kind: "former_member_bids"; count: number };

export type HomeTaskKind = HomeTask["kind"];

type TaskSpec = {
  kind: HomeTaskKind;
  /** Who may complete it, from the capability table. */
  allowed: (actor: EntityActor) => boolean;
  collect: (facts: OrganisationHomeFacts) => HomeTask[];
};

function capability(name: EntityCapability) {
  return (actor: EntityActor) => entityActorCan(actor, name);
}

const DOCUMENT_STATES: ReadonlySet<OrganisationSetupState> = new Set(["documents_requested"]);

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
    allowed: capability("entity.connect.operate"),
    collect: (facts) =>
      !facts.organisation.payoutsReady && facts.hasWorkAwaitingPayout ? [{ kind: "payouts" }] : [],
  },
  {
    kind: "unsold",
    allowed: capability("entity.submissions.create"),
    collect: (facts) =>
      facts.unsoldLots.length > 0 ? [{ kind: "unsold", lots: [...facts.unsoldLots] }] : [],
  },
  {
    kind: "pay",
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
    allowed: (actor) => roleBidsThroughAuthorisation(actor.role) && !actor.isImpersonation,
    collect: (facts) =>
      facts.salesToRegister.map(({ id, title, startsAt, bidLimit }) => ({
        kind: "register",
        sale: { id, title },
        startsAt,
        bidLimit,
      })),
  },
  {
    kind: "former_member_bids",
    allowed: capability("entity.member_bids.cancel"),
    collect: (facts) =>
      facts.formerMemberOpenBids > 0
        ? [{ kind: "former_member_bids", count: facts.formerMemberOpenBids }]
        : [],
  },
];

/** Which "Needs you" kinds a role can ever see; Home hides the section for the others. */
export function homeTaskKindsFor(actor: EntityActor): HomeTaskKind[] {
  return TASK_SPECS.filter((spec) => spec.allowed(actor)).map((spec) => spec.kind);
}

/** The tasks this member can complete now, in order. */
export function homeTasks(facts: OrganisationHomeFacts): HomeTask[] {
  return TASK_SPECS.filter((spec) => spec.allowed(facts.actor)).flatMap((spec) =>
    spec.collect(facts),
  );
}

/** A shortcut on Home: a page the role uses often. */
export type HomeShortcut =
  | "sell"
  | "invite"
  | "statements"
  | "purchases_to_pay"
  | "consignments"
  | "works"
  | "upcoming_sales"
  | "bids";

type ShortcutSpec = { shortcut: HomeShortcut; applies: (actor: EntityActor) => boolean };

const can = (actor: EntityActor, name: EntityCapability) => entityActorCan(actor, name);
/** Reading capabilities (writes are hidden from an impersonating admin). */
const canRead = (actor: EntityActor, name: EntityCapability) =>
  entityActorCan({ role: actor.role }, name);

/** Shortcuts in order; the first four that apply are shown. */
const SHORTCUT_SPECS: readonly ShortcutSpec[] = [
  { shortcut: "sell", applies: (a) => can(a, "entity.submissions.create") },
  { shortcut: "invite", applies: (a) => can(a, "entity.members.manage") },
  { shortcut: "statements", applies: (a) => canRead(a, "entity.payouts.read") },
  {
    // Finance pays; the people who run the organisation find purchases in "Needs you".
    shortcut: "purchases_to_pay",
    applies: (a) => can(a, "entity.finance.write") && !canRead(a, "entity.members.manage"),
  },
  {
    // People who follow consignments without settling them.
    shortcut: "consignments",
    applies: (a) => canRead(a, "entity.consignments.read") && !canRead(a, "entity.payouts.read"),
  },
  {
    shortcut: "works",
    applies: (a) =>
      canRead(a, "entity.holdings.read") &&
      canRead(a, "entity.consignments.read") &&
      !canRead(a, "entity.submissions.create") &&
      !canRead(a, "entity.payouts.read"),
  },
  { shortcut: "upcoming_sales", applies: (a) => roleBidsThroughAuthorisation(a.role) },
  { shortcut: "bids", applies: (a) => roleBidsThroughAuthorisation(a.role) },
];

const MAX_SHORTCUTS = 4;

/** Two to four shortcuts for the role. */
export function homeShortcuts(actor: EntityActor): HomeShortcut[] {
  return SHORTCUT_SPECS.filter((spec) => spec.applies(actor))
    .map((spec) => spec.shortcut)
    .slice(0, MAX_SHORTCUTS);
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
  | "member_joined";

export type HomeActivityEvent = {
  kind: HomeActivityKind;
  at: Date;
  subject: HomeSubject;
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
  setup: OrganisationSetupState | null;
  shortcuts: HomeShortcut[];
  activity: HomeActivityEvent[];
  activityArchive: HomeActivityArchive | null;
};

export function buildOrganisationHome(
  facts: OrganisationHomeFacts,
  activity: readonly HomeActivityEvent[],
): OrganisationHomeModel {
  const askable = homeTaskKindsFor(facts.actor).length > 0;
  return {
    tasks: askable ? homeTasks(facts) : null,
    setup: organisationSetupState(facts.organisation),
    shortcuts: homeShortcuts(facts.actor),
    activity: homeActivity(activity, facts.actor),
    activityArchive: homeActivityArchive(facts.actor),
  };
}
