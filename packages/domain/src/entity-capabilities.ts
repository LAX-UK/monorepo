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
  /** Invite, change roles of and remove members. */
  "entity.members.manage": { access: "write", roles: ["owner", "admin"] },
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
  /** Ask for a consigned lot to be withdrawn from sale. */
  "entity.consignments.withdraw": { access: "write", roles: ["owner", "admin"] },
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
