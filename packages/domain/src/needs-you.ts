import type { LegalEntityStatus } from "@auction/types";
import { accountBidScope } from "./account-buying-scope.js";
import { roleBidsThroughAuthorisation } from "./bid-authority.js";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  entityCapabilitiesOf,
} from "./entity-capabilities.js";
import { roleNeedsPersonalIdentity } from "./member-role-guide.js";
import { type OrganisationSetupState, organisationSetupState } from "./organisation-setup.js";
import {
  type OrganisationAction,
  type OrganisationStatePolicy,
  organisationStatePolicy,
} from "./organisation-state-policy.js";
import {
  type PurchaseNextStep,
  type PurchaseNextStepFacts,
  purchaseNextStep,
} from "./purchase-next-step.js";

/**
 * "Needs you": every module publishes what it needs from a member to this one table. Home's list,
 * the sidebar counts, Consignments' Needs you view and the Notifications Needs action view all
 * read it, so they can never disagree. Each kind says who may do it, where it is done, how it
 * ranks and which notifications announce it.
 */

/** A thing a task is about. */
export type HomeSubject = { id: string; title: string };

/** One thing on "Needs you". Each has one next step; it disappears when done. */
export type NeedsYouTask =
  /** Lots the account is no longer leading while they are still open. */
  | { kind: "outbid"; lots: Array<HomeSubject & { endsAt: Date }> }
  | { kind: "pay"; purchases: HomeSubject[] }
  /** A buyer agent's wins that finance pays; the agent is only told. */
  | { kind: "won_awaiting_payment"; purchases: HomeSubject[] }
  /** Unsold lots whose choice is due soon or overdue, with the earliest date. */
  | { kind: "unsold_due"; lots: HomeSubject[]; dueBy: Date }
  | { kind: "agreement"; consignment: HomeSubject }
  | { kind: "changes"; submission: HomeSubject; note: string | null }
  | { kind: "unsold"; lots: HomeSubject[] }
  | { kind: "choose_delivery"; purchases: HomeSubject[] }
  | { kind: "quote_ready"; purchases: HomeSubject[] }
  | { kind: "book_collection"; purchases: HomeSubject[] }
  | { kind: "register"; sale: HomeSubject; startsAt: Date; bidLimit: string | null }
  | { kind: "authorisation_ending"; authorisations: EndingAuthorisation[] }
  | { kind: "invitations_expired"; invitations: ExpiredInvitation[] }
  | { kind: "documents" }
  | { kind: "identity" }
  | { kind: "source_of_funds" }
  | { kind: "payouts" };

export type NeedsYouKind = NeedsYouTask["kind"];

export type EndingAuthorisation = { id: string; memberName: string; endsAt: Date };
export type ExpiredInvitation = { id: string; email: string; expiredAt: Date };

/**
 * Everything the table reads, already loaded and already narrowed to what the member may see
 * (a buyer agent's own bids and wins, a consignor's own submissions).
 */
export type NeedsYouFacts = {
  actor: EntityActor;
  organisation: { status: LegalEntityStatus; payoutsReady: boolean };
  now: Date;
  /** The member's own identity check. */
  viewerIdentity: "verified" | "checking" | "required";
  /** Whether LAX asked the member for source of funds documents. */
  sourceOfFundsRequested: boolean;
  /** Open consignments whose specialist's terms wait to be accepted. */
  agreementsToAccept: readonly HomeSubject[];
  /** Submissions a specialist sent back, with the note. */
  changesRequested: ReadonlyArray<HomeSubject & { note: string | null }>;
  /**
   * Consigned lots that ended unsold with nothing chosen yet, each with the date its choice is
   * due: the stored date, set from {@link unsoldChoiceDueBy} when the outcome was first shown.
   */
  unsoldLots: ReadonlyArray<HomeSubject & { dueBy: Date | null }>;
  /** Won lots that are not finished, with what their payment and delivery records say. */
  purchases: ReadonlyArray<HomeSubject & PurchaseNextStepFacts>;
  /** Sales a buyer agent is authorised for and has not registered in. */
  salesToRegister: ReadonlyArray<HomeSubject & { startsAt: Date; bidLimit: string | null }>;
  /** Open lots where the account has bid and is not leading. */
  outbidLots: ReadonlyArray<HomeSubject & { endsAt: Date }>;
  /** Invitations that lapsed recently and were not sent again. */
  expiredInvitations: readonly ExpiredInvitation[];
  /** Buyer-agent authorisations that end soon. */
  endingAuthorisations: readonly EndingAuthorisation[];
};

/** Days a consignor has to choose what happens to an unsold lot, from the end of its sale. */
export const UNSOLD_CHOICE_WINDOW_DAYS = 14;
/** An unsold choice moves up with the money and time tasks once it is due within this. */
export const UNSOLD_DUE_SOON_DAYS = 3;

/** A lapsed invitation stays on Needs you this long, unless it is sent again first. */
export const EXPIRED_INVITATION_SHOWN_DAYS = 30;
/** An authorisation ending within this is flagged, so it can be renewed before bidding stops. */
export const AUTHORISATION_ENDING_SOON_DAYS = 7;

const DAY_MS = 86_400_000;

/** The window each dated fact is read over, from `now`. */
export function needsYouWindows(now: Date) {
  return {
    invitationsExpiredSince: new Date(now.getTime() - EXPIRED_INVITATION_SHOWN_DAYS * DAY_MS),
    authorisationsEndingBy: new Date(now.getTime() + AUTHORISATION_ENDING_SOON_DAYS * DAY_MS),
  };
}

/** The date an unsold lot's choice is due. */
export function unsoldChoiceDueBy(endedAt: Date): Date {
  return new Date(endedAt.getTime() + UNSOLD_CHOICE_WINDOW_DAYS * DAY_MS);
}

/** The sidebar item a task is counted on; `null` for the member's own checks. */
export type NeedsYouSection = "bids" | "purchases" | "consignments" | "team" | "organisation";

/** Where a task's one button leads; the web turns a page into an address. */
export type NeedsYouLink =
  | { page: "lot"; id: string }
  | { page: "bids" }
  | { page: "purchase"; id: string }
  | { page: "purchases" }
  | { page: "consignment"; id: string }
  | { page: "consignments"; view: "unsold" }
  | { page: "sale"; id: string }
  | { page: "team"; view: "invitations" | "who_can_bid" }
  | { page: "bid_settings" }
  | { page: "organisation"; view: "documents" | "payouts" }
  | { page: "verify_identity" }
  | { page: "source_of_funds" };

type TaskOf<K extends NeedsYouKind> = Extract<NeedsYouTask, { kind: K }>;

type Spec<K extends NeedsYouKind> = {
  kind: K;
  section: NeedsYouSection | null;
  /** Who may complete it, from the capability table. */
  allowed: (actor: EntityActor) => boolean;
  /** What the organisation's own state must allow for the task to be offered. */
  requires?: OrganisationAction;
  /** Notification types that tell the member about this task (the inbox's Needs action). */
  announcedBy?: readonly string[];
  collect: (facts: NeedsYouFacts, state: OrganisationStatePolicy) => TaskOf<K>[];
  /** How many things the task stands for, for the sidebar counts. */
  items: (task: TaskOf<K>) => number;
  link: (task: TaskOf<K>, actor: EntityActor) => NeedsYouLink;
};

const capability = (name: EntityCapability) => (actor: EntityActor) => entityActorCan(actor, name);
const one = () => 1;
const acting = (actor: EntityActor) => !actor.isImpersonation;

/** One record opens itself; several open their list. */
function purchaseLink(purchases: readonly HomeSubject[]): NeedsYouLink {
  const [only] = purchases;
  return purchases.length === 1 && only ? { page: "purchase", id: only.id } : { page: "purchases" };
}

function purchasesAt(facts: NeedsYouFacts, step: PurchaseNextStep): HomeSubject[] {
  return facts.purchases
    .filter((purchase) => purchaseNextStep(purchase) === step)
    .map(({ id, title }) => ({ id, title }));
}

/** A purchases task for each step, when there is anything at that step. */
function purchaseTask<K extends "pay" | "choose_delivery" | "quote_ready" | "book_collection">(
  kind: K,
): Spec<K>["collect"] {
  return (facts) => {
    const purchases = purchasesAt(facts, kind);
    return purchases.length > 0 ? [{ kind, purchases } as TaskOf<K>] : [];
  };
}

function unsoldSplit(facts: NeedsYouFacts) {
  const soon = facts.now.getTime() + UNSOLD_DUE_SOON_DAYS * DAY_MS;
  const due: Array<HomeSubject & { dueBy: Date }> = [];
  const later: HomeSubject[] = [];
  for (const { id, title, dueBy } of facts.unsoldLots) {
    if (dueBy && dueBy.getTime() <= soon) due.push({ id, title, dueBy });
    else later.push({ id, title });
  }
  return { due, later };
}

const DOCUMENT_STATES: ReadonlySet<OrganisationSetupState> = new Set(["documents_requested"]);

/**
 * The table, in order: money and time first (outbid, pay, unsold due), then binding steps (the
 * agreement), then the rest of the work, then setup. A new kind is a new row; nothing that reads
 * the table changes.
 */
const SPECS: { readonly [K in NeedsYouKind]: Spec<K> } = {
  outbid: {
    kind: "outbid",
    section: "bids",
    allowed: (actor) => accountBidScope(actor) !== null && acting(actor),
    requires: "bid",
    announcedBy: ["outbid"],
    collect: (facts) =>
      facts.outbidLots.length > 0
        ? [
            {
              kind: "outbid",
              lots: [...facts.outbidLots].sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime()),
            },
          ]
        : [],
    items: (task) => task.lots.length,
    link: (task) => {
      const [only] = task.lots;
      return task.lots.length === 1 && only ? { page: "lot", id: only.id } : { page: "bids" };
    },
  },
  pay: {
    kind: "pay",
    section: "purchases",
    allowed: capability("entity.finance.write"),
    requires: "pay",
    announcedBy: ["payment_due"],
    collect: purchaseTask("pay"),
    items: (task) => task.purchases.length,
    link: (task) => purchaseLink(task.purchases),
  },
  won_awaiting_payment: {
    kind: "won_awaiting_payment",
    section: "purchases",
    allowed: (actor) =>
      roleBidsThroughAuthorisation(actor.role) && !entityActorCan(actor, "entity.finance.write"),
    collect: (facts) => {
      const purchases = purchasesAt(facts, "pay");
      return purchases.length > 0 ? [{ kind: "won_awaiting_payment", purchases }] : [];
    },
    items: (task) => task.purchases.length,
    link: (task) => purchaseLink(task.purchases),
  },
  unsold_due: {
    kind: "unsold_due",
    section: "consignments",
    allowed: capability("entity.consignments.after_sale"),
    requires: "choose_unsold",
    collect: (facts) => {
      const { due } = unsoldSplit(facts);
      if (due.length === 0) return [];
      const dueBy = new Date(Math.min(...due.map((lot) => lot.dueBy.getTime())));
      return [{ kind: "unsold_due", lots: due.map(({ id, title }) => ({ id, title })), dueBy }];
    },
    items: (task) => task.lots.length,
    link: () => ({ page: "consignments", view: "unsold" }),
  },
  agreement: {
    kind: "agreement",
    section: "consignments",
    allowed: capability("entity.consignments.accept_agreement"),
    requires: "accept_agreement",
    announcedBy: ["consignment_agreement_reminder"],
    collect: (facts) =>
      facts.agreementsToAccept.map(({ id, title }) => ({
        kind: "agreement",
        consignment: { id, title },
      })),
    items: one,
    link: (task) => ({ page: "consignment", id: task.consignment.id }),
  },
  changes: {
    kind: "changes",
    section: "consignments",
    allowed: capability("entity.submissions.create"),
    requires: "submit",
    announcedBy: ["submission_changes_requested"],
    collect: (facts) =>
      facts.changesRequested.map(({ id, title, note }) => ({
        kind: "changes",
        submission: { id, title },
        note,
      })),
    items: one,
    link: (task) => ({ page: "consignment", id: task.submission.id }),
  },
  unsold: {
    kind: "unsold",
    section: "consignments",
    allowed: capability("entity.consignments.after_sale"),
    requires: "choose_unsold",
    collect: (facts) => {
      const { later } = unsoldSplit(facts);
      return later.length > 0 ? [{ kind: "unsold", lots: later }] : [];
    },
    items: (task) => task.lots.length,
    link: () => ({ page: "consignments", view: "unsold" }),
  },
  choose_delivery: {
    kind: "choose_delivery",
    section: "purchases",
    allowed: capability("entity.finance.write"),
    collect: purchaseTask("choose_delivery"),
    items: (task) => task.purchases.length,
    link: (task) => purchaseLink(task.purchases),
  },
  quote_ready: {
    kind: "quote_ready",
    section: "purchases",
    allowed: capability("entity.finance.write"),
    collect: purchaseTask("quote_ready"),
    items: (task) => task.purchases.length,
    link: (task) => purchaseLink(task.purchases),
  },
  book_collection: {
    kind: "book_collection",
    section: "purchases",
    allowed: capability("entity.finance.write"),
    collect: purchaseTask("book_collection"),
    items: (task) => task.purchases.length,
    link: (task) => purchaseLink(task.purchases),
  },
  register: {
    kind: "register",
    section: "bids",
    allowed: (actor) => roleBidsThroughAuthorisation(actor.role) && acting(actor),
    requires: "register",
    collect: (facts) =>
      facts.salesToRegister.map(({ id, title, startsAt, bidLimit }) => ({
        kind: "register",
        sale: { id, title },
        startsAt,
        bidLimit,
      })),
    items: one,
    link: (task) => ({ page: "sale", id: task.sale.id }),
  },
  authorisation_ending: {
    kind: "authorisation_ending",
    section: "team",
    // The people who renew authorisations, and the agent whose authorisation it is.
    allowed: (actor) =>
      entityActorCan(actor, "entity.buyer_agents.manage") ||
      (roleBidsThroughAuthorisation(actor.role) && acting(actor)),
    collect: (facts) =>
      facts.endingAuthorisations.length > 0
        ? [
            {
              kind: "authorisation_ending",
              authorisations: [...facts.endingAuthorisations].sort(
                (a, b) => a.endsAt.getTime() - b.endsAt.getTime(),
              ),
            },
          ]
        : [],
    items: (task) => task.authorisations.length,
    link: (_task, actor) =>
      entityActorCan(actor, "entity.buyer_agents.manage")
        ? { page: "team", view: "who_can_bid" }
        : { page: "bid_settings" },
  },
  invitations_expired: {
    kind: "invitations_expired",
    section: "team",
    allowed: capability("entity.members.manage"),
    requires: "invite",
    collect: (facts) =>
      facts.expiredInvitations.length > 0
        ? [{ kind: "invitations_expired", invitations: [...facts.expiredInvitations] }]
        : [],
    items: (task) => task.invitations.length,
    link: () => ({ page: "team", view: "invitations" }),
  },
  documents: {
    kind: "documents",
    section: "organisation",
    allowed: capability("entity.members.manage"),
    collect: (facts) => {
      const state = organisationSetupState(facts.organisation);
      return state && DOCUMENT_STATES.has(state) ? [{ kind: "documents" }] : [];
    },
    items: one,
    link: () => ({ page: "organisation", view: "documents" }),
  },
  identity: {
    kind: "identity",
    section: null,
    allowed: (actor) => roleNeedsPersonalIdentity(actor.role) && acting(actor),
    announcedBy: ["kyc_resubmission_required"],
    collect: (facts) => (facts.viewerIdentity === "required" ? [{ kind: "identity" }] : []),
    items: one,
    link: () => ({ page: "verify_identity" }),
  },
  source_of_funds: {
    kind: "source_of_funds",
    section: null,
    allowed: acting,
    announcedBy: ["source_of_funds_documents_requested"],
    collect: (facts) => (facts.sourceOfFundsRequested ? [{ kind: "source_of_funds" }] : []),
    items: one,
    link: () => ({ page: "source_of_funds" }),
  },
  payouts: {
    kind: "payouts",
    section: "organisation",
    allowed: capability("entity.connect.operate"),
    requires: "set_up_payouts",
    // The organisation's state decides, so the task, the banner and the sidebar badge agree.
    collect: (_facts, state) =>
      state.banner?.key === "payouts_not_set_up" && state.banner.audience === "act"
        ? [{ kind: "payouts" }]
        : [],
    items: one,
    link: () => ({ page: "organisation", view: "payouts" }),
  },
};

/** Every kind in rank order: the table's own order. */
export const NEEDS_YOU_KINDS = Object.keys(SPECS) as NeedsYouKind[];

function specOf<K extends NeedsYouKind>(kind: K): Spec<K> {
  return SPECS[kind] as Spec<K>;
}

/** Which kinds a role can ever be asked to do; the section is hidden for a role with none. */
export function needsYouKindsFor(actor: EntityActor): NeedsYouKind[] {
  return NEEDS_YOU_KINDS.filter((kind) => specOf(kind).allowed(actor));
}

/** The tasks this member can complete now, in rank order. */
export function needsYouTasks(facts: NeedsYouFacts): NeedsYouTask[] {
  const state = organisationStatePolicy(
    facts.organisation.status,
    entityCapabilitiesOf(facts.actor),
    { payoutsReady: facts.organisation.payoutsReady },
  );
  return NEEDS_YOU_KINDS.flatMap((kind) => {
    const spec = specOf(kind) as Spec<NeedsYouKind>;
    if (!spec.allowed(facts.actor)) return [];
    if (spec.requires && !state.actions[spec.requires]) return [];
    return spec.collect(facts, state);
  });
}

/** Where a task's button leads. */
export function needsYouLink(task: NeedsYouTask, actor: EntityActor): NeedsYouLink {
  return (specOf(task.kind) as Spec<NeedsYouKind>).link(task, actor);
}

export type NeedsYouCounts = Record<NeedsYouSection, number>;

/** The number on each sidebar item: how many things wait on that page. */
export function needsYouCounts(tasks: readonly NeedsYouTask[]): NeedsYouCounts {
  const counts: NeedsYouCounts = {
    bids: 0,
    purchases: 0,
    consignments: 0,
    team: 0,
    organisation: 0,
  };
  for (const task of tasks) {
    const spec = specOf(task.kind) as Spec<NeedsYouKind>;
    if (spec.section) counts[spec.section] += spec.items(task);
  }
  return counts;
}

/**
 * A task list split for the account switcher's dots. Tasks with a page in the account (`account`)
 * mark that organisation. Tasks about the person (their identity check, source of funds:
 * `person`) follow them into every account, so they would put the same dot on all of them; they
 * mark the person's own account instead, so they are never out of sight.
 */
export function needsYouTaskSplit(tasks: readonly NeedsYouTask[]): {
  account: number;
  person: number;
} {
  const account = tasks.filter((task) => specOf(task.kind).section !== null).length;
  return { account, person: tasks.length - account };
}

/** The task kind a notification type announces, if it asks for something. */
export function needsYouKindAnnouncedBy(notificationType: string): NeedsYouKind | null {
  return (
    NEEDS_YOU_KINDS.find((kind) => specOf(kind).announcedBy?.includes(notificationType)) ?? null
  );
}

/** Every notification type that announces a task: the inbox's "Needs action" reads these. */
export const NEEDS_YOU_NOTIFICATION_TYPES: readonly string[] = NEEDS_YOU_KINDS.flatMap(
  (kind) => specOf(kind).announcedBy ?? [],
);
