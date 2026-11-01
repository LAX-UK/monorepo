import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
import { type EntityCapability, rolesWithCapability } from "./entity-capabilities.js";

/** What a member can do for an organisation, as far as the organisation's own state allows. */
export const ORGANISATION_ACTIONS = [
  "bid",
  "register",
  "submit",
  "accept_agreement",
  /** Choose what happens to a consigned lot that did not sell: a selling decision. */
  "choose_unsold",
  "pay",
  "read_history",
  "invite",
  "accept_invitation",
  "set_up_payouts",
  /** Send or replace the documents LAX checks; open only while LAX is waiting for them. */
  "send_documents",
  /**
   * Write to a specialist about a consignment. Closed with trading (restricted, not approved,
   * archived): the thread stays readable and LAX is reached through the contact page.
   */
  "message_specialist",
] as const;
export type OrganisationAction = (typeof ORGANISATION_ACTIONS)[number];

export type OrganisationBannerKind = "info" | "attention" | "blocked";

/** Stable keys; the words live in the web presenter. */
export type OrganisationBannerKey =
  | "documents_requested"
  | "documents_under_review"
  | "payouts_not_set_up"
  | "restricted"
  | "not_approved"
  | "archived";

export type OrganisationHomeFirstRunKey =
  | "documents_requested"
  | "documents_under_review"
  | "payouts_not_set_up"
  | "ready"
  | "restricted"
  | "closed";

export type OrganisationBidReasonKey =
  | "documents_requested"
  | "documents_under_review"
  | "restricted"
  | "not_approved"
  | "archived";

/** Whether the viewer can do something about a banner, or is only told. */
export type OrganisationBannerAudience = "act" | "told";

export type OrganisationBanner = {
  kind: OrganisationBannerKind;
  key: OrganisationBannerKey;
  audience: OrganisationBannerAudience;
};

export type OrganisationStatePolicy = {
  status: LegalEntityStatus;
  actions: Readonly<Record<OrganisationAction, boolean>>;
  /** `null` when this viewer has nothing to be told. */
  banner: OrganisationBanner | null;
  homeFirstRunKey: OrganisationHomeFirstRunKey;
  /** Why the bid panel is closed, or `null` while bidding is open. */
  bidPanelReasonKey: OrganisationBidReasonKey | null;
};

type BannerSpec = {
  kind: OrganisationBannerKind;
  key: OrganisationBannerKey;
  /** Holding any of these means the viewer can act on it; empty means nobody can. */
  actWith: readonly EntityCapability[];
  /** Who is told when they cannot act; `null` means everyone in the organisation. */
  toldWith: readonly EntityCapability[] | null;
};

type StateSpec = {
  allowed: readonly OrganisationAction[];
  banner: BannerSpec | null;
  homeFirstRunKey: OrganisationHomeFirstRunKey;
  bidPanelReasonKey: OrganisationBidReasonKey | null;
};

const READ_ONLY: readonly OrganisationAction[] = ["read_history"];

const DOCUMENTS_REQUESTED: StateSpec = {
  allowed: ["read_history", "invite", "accept_invitation", "send_documents", "message_specialist"],
  banner: {
    kind: "attention",
    key: "documents_requested",
    actWith: ["entity.documents.manage"],
    toldWith: null,
  },
  homeFirstRunKey: "documents_requested",
  bidPanelReasonKey: "documents_requested",
};

const UNDER_REVIEW: StateSpec = {
  allowed: ["read_history", "invite", "accept_invitation", "message_specialist"],
  banner: { kind: "info", key: "documents_under_review", actWith: [], toldWith: null },
  homeFirstRunKey: "documents_under_review",
  bidPanelReasonKey: "documents_under_review",
};

const PAYOUTS_PENDING_BANNER: BannerSpec = {
  kind: "attention",
  key: "payouts_not_set_up",
  actWith: ["entity.connect.operate"],
  toldWith: ["entity.consignments.read"],
};

/**
 * One row per status. A new status fails to compile until it has a row, so no screen or
 * endpoint can forget it. A restricted organisation keeps its history and can pay what it
 * already owes, but cannot trade or grow; a rejected or archived one can only be read.
 */
const STATE_SPECS: Readonly<Record<LegalEntityStatus, StateSpec>> = {
  lead: DOCUMENTS_REQUESTED,
  docs_requested: DOCUMENTS_REQUESTED,
  docs_received: UNDER_REVIEW,
  under_review: UNDER_REVIEW,
  connect_pending: {
    allowed: [
      "bid",
      "register",
      "pay",
      "read_history",
      "invite",
      "accept_invitation",
      "set_up_payouts",
      "message_specialist",
    ],
    banner: PAYOUTS_PENDING_BANNER,
    homeFirstRunKey: "payouts_not_set_up",
    bidPanelReasonKey: null,
  },
  approved: {
    // Documents are closed once checked; LAX reopens them by asking for more.
    allowed: ORGANISATION_ACTIONS.filter((action) => action !== "send_documents"),
    banner: null,
    homeFirstRunKey: "ready",
    bidPanelReasonKey: null,
  },
  restricted: {
    allowed: ["pay", "read_history"],
    banner: { kind: "blocked", key: "restricted", actWith: [], toldWith: null },
    homeFirstRunKey: "restricted",
    bidPanelReasonKey: "restricted",
  },
  rejected: {
    allowed: READ_ONLY,
    banner: { kind: "blocked", key: "not_approved", actWith: [], toldWith: null },
    homeFirstRunKey: "closed",
    bidPanelReasonKey: "not_approved",
  },
  archived: {
    allowed: READ_ONLY,
    banner: { kind: "blocked", key: "archived", actWith: [], toldWith: null },
    homeFirstRunKey: "closed",
    bidPanelReasonKey: "archived",
  },
};

/** Who can act on each banner, from the specs above, so the words never name the wrong roles. */
const BANNER_ACTORS: Readonly<Record<OrganisationBannerKey, readonly EntityCapability[]>> = (() => {
  const specs = [PAYOUTS_PENDING_BANNER, ...Object.values(STATE_SPECS).map((spec) => spec.banner)];
  const actors = {} as Record<OrganisationBannerKey, readonly EntityCapability[]>;
  for (const spec of specs) if (spec) actors[spec.key] = spec.actWith;
  return actors;
})();

/**
 * The roles that can act on a banner (send the documents, set up payouts), in the capability
 * table's order; empty when nobody in the organisation can, as while LAX checks its documents.
 */
export function organisationBannerActors(
  key: OrganisationBannerKey,
): readonly LegalEntityMemberRole[] {
  const roles = new Set(
    BANNER_ACTORS[key].flatMap((capability) => rolesWithCapability(capability)),
  );
  return [...roles];
}

function bannerFor(
  spec: BannerSpec | null,
  capabilities: ReadonlySet<EntityCapability>,
): OrganisationBanner | null {
  if (!spec) return null;
  const holds = (names: readonly EntityCapability[]) =>
    names.some((name) => capabilities.has(name));
  if (holds(spec.actWith)) return { kind: spec.kind, key: spec.key, audience: "act" };
  if (spec.toldWith && !holds(spec.toldWith)) return null;
  return { kind: spec.kind, key: spec.key, audience: "told" };
}

function actionsOf(allowed: readonly OrganisationAction[]): Record<OrganisationAction, boolean> {
  const set = new Set(allowed);
  return Object.fromEntries(
    ORGANISATION_ACTIONS.map((action) => [action, set.has(action)]),
  ) as Record<OrganisationAction, boolean>;
}

/**
 * What an organisation in `status` allows and tells, for a viewer holding `capabilities`. The
 * single source for the banner, the Home first-run message, the bid panel reason and every
 * server check on bidding, registering, submitting, paying and joining. An approved
 * organisation whose payouts are not ready (`payoutsReady: false`) is told like one still
 * setting them up.
 */
export function organisationStatePolicy(
  status: LegalEntityStatus,
  capabilities: ReadonlySet<EntityCapability>,
  options: { payoutsReady?: boolean } = {},
): OrganisationStatePolicy {
  const spec = STATE_SPECS[status];
  const payoutsPending = status === "approved" && options.payoutsReady === false;
  return {
    status,
    actions: actionsOf(spec.allowed),
    banner: bannerFor(payoutsPending ? PAYOUTS_PENDING_BANNER : spec.banner, capabilities),
    homeFirstRunKey: payoutsPending ? "payouts_not_set_up" : spec.homeFirstRunKey,
    bidPanelReasonKey: spec.bidPanelReasonKey,
  };
}

/**
 * Refusal for choosing what happens to an unsold lot while the organisation's state closes
 * selling (restricted, unchecked or closed). LAX decides with the organisation instead.
 */
export const ORGANISATION_UNSOLD_CHOICE_PAUSED = {
  code: "organisation_unsold_choice_paused",
  message:
    "Choices for works that did not sell are paused for this organisation. Contact us to decide what happens to them.",
} as const;

/** The refusal for choosing an unsold outcome in `status`, or `null` while choices are open. */
export function organisationUnsoldChoiceRefusal(
  status: LegalEntityStatus,
): { code: string; message: string } | null {
  return organisationStateAllows(status, "choose_unsold")
    ? null
    : ORGANISATION_UNSOLD_CHOICE_PAUSED;
}

/** Refusal for joining an organisation that has been closed. */
export const ORGANISATION_CLOSED_TO_MEMBERS = {
  code: "organisation_closed_to_members",
  message: "This organisation is closed and isn't taking new members.",
} as const;

/** Refusal for joining an organisation that is restricted. */
export const ORGANISATION_RESTRICTED_MEMBERS = {
  code: "organisation_restricted_members",
  message: "This organisation can't add members right now.",
} as const;

const MEMBER_REFUSALS = [ORGANISATION_CLOSED_TO_MEMBERS, ORGANISATION_RESTRICTED_MEMBERS] as const;

/** The refusal (code and client message) for a code from the member refusals, if it is one. */
export function organisationMembersRefusal(code: string): { code: string; message: string } | null {
  return MEMBER_REFUSALS.find((refusal) => refusal.code === code) ?? null;
}

/** The refusal for joining an organisation in `status`, or `null` when it takes members. */
export function organisationJoinRefusal(
  status: LegalEntityStatus,
): { code: string; message: string } | null {
  if (organisationStateAllows(status, "accept_invitation")) return null;
  return status === "restricted" ? ORGANISATION_RESTRICTED_MEMBERS : ORGANISATION_CLOSED_TO_MEMBERS;
}

/**
 * The refusal for inviting someone to an organisation in `status`, or `null` while it may
 * invite. The same refusals as joining, so the sender and the person invited read one reason.
 */
export function organisationInviteRefusal(
  status: LegalEntityStatus,
): { code: string; message: string } | null {
  if (organisationStateAllows(status, "invite")) return null;
  return status === "restricted" ? ORGANISATION_RESTRICTED_MEMBERS : ORGANISATION_CLOSED_TO_MEMBERS;
}

const NO_CAPABILITIES: ReadonlySet<EntityCapability> = new Set();

/** Whether the organisation's state allows `action`, whoever asks. */
export function organisationStateAllows(
  status: LegalEntityStatus,
  action: OrganisationAction,
): boolean {
  return organisationStatePolicy(status, NO_CAPABILITIES).actions[action];
}
