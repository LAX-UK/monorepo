import type { LegalEntityMemberRole } from "@auction/types";

/**
 * What a member may do for an organisation, decided by role. This is the single place that
 * maps roles to organisation-scoped abilities; routes and services ask for a capability and
 * never compare roles themselves, so adding a role or moving an ability is one edit here.
 *
 * Roles that are absent from a capability are denied (deny by default).
 */
type CapabilityRule = {
  /** Writes are never available to an impersonating platform admin. */
  access: "read" | "write";
  roles: readonly LegalEntityMemberRole[];
  /** Capabilities that a platform admin acting for the organisation must never hold, even to read. */
  denyImpersonation?: true;
};

const ENTITY_CAPABILITY_RULES = {
  /** See the member list: colleagues' names, emails and roles. */
  "entity.members.read": { access: "read", roles: ["owner", "admin"] },
  /** Invite, change roles of and remove members. */
  "entity.members.manage": { access: "write", roles: ["owner", "admin"] },
  /**
   * Grant, change or remove the owner role, and transfer ownership. Owners run the organisation,
   * so only another owner may make or unmake one.
   */
  "entity.ownership.manage": { access: "write", roles: ["owner"] },
  /** See the organisation's registered details and the documents sent for its checks. */
  "entity.profile.read": { access: "read", roles: ["owner", "admin"] },
  /** Send the documents LAX asks for to check the organisation, and replace one it cannot accept. */
  "entity.documents.manage": { access: "write", roles: ["owner", "admin"] },
  /** See the organisation's two-step verification policy and which members have it on. */
  "entity.security.read": {
    access: "read",
    roles: ["owner", "admin"],
    denyImpersonation: true,
  },
  /** Change the organisation's two-step verification policy. */
  "entity.security.manage": { access: "write", roles: ["owner"], denyImpersonation: true },
  /** Buyer-side money: the organisation's wins and payments. */
  "entity.finance.read": { access: "read", roles: ["owner", "admin", "finance"] },
  /** Capture, refund and otherwise move the organisation's money. */
  "entity.finance.write": { access: "write", roles: ["owner", "admin", "finance"] },
  /**
   * Seller-side money: payouts and their statements. A payout settles many lots into one
   * transfer for the whole organisation and records no consignor, so it cannot be narrowed to
   * "your own consignments"; consignors therefore see sales, not payouts.
   */
  "entity.payouts.read": { access: "read", roles: ["owner", "admin", "finance"] },
  /** Create the Stripe Connect account and its onboarding link. */
  "entity.connect.manage": { access: "write", roles: ["owner", "admin"] },
  /** Open the Connect management surfaces, sync status and the Stripe dashboard. */
  "entity.connect.operate": { access: "write", roles: ["owner", "admin", "finance"] },
  /** See the organisation's consignments and the sales that came from them. */
  "entity.consignments.read": {
    access: "read",
    roles: ["owner", "admin", "finance", "consignor", "viewer"],
  },
  /**
   * Hand a new item to LAX on the organisation's behalf. Finance and viewers can follow
   * consignments but not start them; a person's own profile always has an owner's rights.
   */
  "entity.submissions.create": { access: "write", roles: ["owner", "admin", "consignor"] },
  /**
   * Change any of the organisation's submissions, whoever sent them: edit, send, and attach or
   * remove documents. Members who may only start submissions change just the ones they sent.
   */
  "entity.submissions.manage": { access: "write", roles: ["owner", "admin"] },
  /**
   * Accept the consignment agreement (the specialist's estimate and the seller conditions) for
   * the organisation. It binds the organisation, so only the people who run it may accept.
   */
  "entity.consignments.accept_agreement": { access: "write", roles: ["owner", "admin"] },
  /** Ask for a consigned lot to be withdrawn from sale. */
  "entity.consignments.withdraw": { access: "write", roles: ["owner", "admin"] },
  /**
   * Choose what happens to a lot that did not sell (relist, private sale or collection). It
   * changes the organisation's terms of sale, so only the people who run it choose; consignors
   * see the choice and who can make it.
   */
  "entity.consignments.after_sale": { access: "write", roles: ["owner", "admin"] },
  /**
   * Place bids, auto-bids, absentee and telephone bids, or check in at the saleroom, for the
   * organisation. Finance, consignors and viewers bid only in their own name.
   */
  "entity.bid.place": { access: "write", roles: ["owner", "admin", "buyer_agent"] },
  /**
   * Bid for the organisation without a buyer-agent authorisation. Members who can place bids
   * but lack this need an active authorisation (sale scope, bid limit, valid window).
   */
  "entity.bid.place_without_authorisation": { access: "write", roles: ["owner", "admin"] },
  /** See which buyer agents may bid for the organisation, with their limits. */
  "entity.buyer_agents.read": { access: "read", roles: ["owner", "admin"] },
  /** Authorise buyer agents to bid for the organisation, and revoke those authorisations. */
  "entity.buyer_agents.manage": { access: "write", roles: ["owner", "admin"] },
  /**
   * Set or remove the organisation's bidding limit, which applies to everyone who bids for it.
   * Everyone who bids for the organisation can see the limit (`entity.bid.place`).
   */
  "entity.bidding_limits.manage": { access: "write", roles: ["owner", "admin"] },
  /**
   * Change the details printed on the organisation's invoices: the billing email, the invoice
   * address and a PO reference. Finance teams keep these; anyone who sees the money reads them.
   */
  "entity.invoice_details.manage": { access: "write", roles: ["owner", "admin", "finance"] },
  /**
   * Read the organisation's activity: who joined, left or was removed, role changes,
   * authorisations, agreements, unsold choices, payouts and bank changes.
   */
  "entity.activity.read": { access: "read", roles: ["owner", "admin"] },
  /** See the works the organisation owns, without any prices. */
  "entity.holdings.read": {
    access: "read",
    roles: ["owner", "admin", "finance", "viewer", "buyer_agent"],
  },
} as const satisfies Record<string, CapabilityRule>;

export type EntityCapability = keyof typeof ENTITY_CAPABILITY_RULES;

export type EntityActor = {
  role: LegalEntityMemberRole;
  /** True when a platform admin is acting for an organisation they are not a member of. */
  isImpersonation?: boolean | undefined;
};

function ruleFor(capability: EntityCapability): CapabilityRule {
  return ENTITY_CAPABILITY_RULES[capability];
}

/** Whether a member holding `role` has `capability`. */
export function entityRoleCan(role: LegalEntityMemberRole, capability: EntityCapability): boolean {
  return ruleFor(capability).roles.includes(role);
}

/**
 * Whether an actor has `capability`. An impersonating platform admin is read-only and can
 * never see or change security settings, whatever role the synthetic membership carries.
 */
export function entityActorCan(actor: EntityActor, capability: EntityCapability): boolean {
  const rule = ruleFor(capability);
  if (actor.isImpersonation && (rule.access === "write" || rule.denyImpersonation)) return false;
  return rule.roles.includes(actor.role);
}

/** Every capability the actor holds, so a rule can ask "who can act" without naming roles. */
export function entityCapabilitiesOf(actor: EntityActor): ReadonlySet<EntityCapability> {
  const all = Object.keys(ENTITY_CAPABILITY_RULES) as EntityCapability[];
  return new Set(all.filter((capability) => entityActorCan(actor, capability)));
}

/** The roles that hold `capability`, in the table's order, to say who can do something. */
export function rolesWithCapability(
  capability: EntityCapability,
): readonly LegalEntityMemberRole[] {
  return ruleFor(capability).roles;
}

/** Whether `name` is one of the organisation's capabilities (for values that arrive as text). */
export function isEntityCapability(name: string): name is EntityCapability {
  return Object.hasOwn(ENTITY_CAPABILITY_RULES, name);
}
