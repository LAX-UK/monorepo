import "server-only";

import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  sellerSubmissionAccess,
} from "@auction/domain";
import type { LegalEntitySummary, StaffRoles } from "@auction/types";

export type SellerWorkspaceContext = {
  /** Personal (`individual`) entity: the person's own seller profile. */
  personalEntity: LegalEntitySummary | null;
  /** The person is selling as an organisation rather than as themselves. */
  sellingAsOrganisation: boolean;
  /** Entity whose submissions, lots, payouts and payout setup the seller pages show. */
  sellerEntityId: string | null;
  /** The signed-in person's standing with that entity, for the capability matrix. */
  actor: EntityActor | null;
  /** Every account the person belongs to, for choosing who sells a new work. */
  memberships: readonly LegalEntitySummary[];
};

/**
 * Seller pages follow the account chosen in the Selling mode picker: the person's own profile,
 * or an organisation they belong to. An organisation member sees only what their role allows
 * (see {@link sellerCan}).
 */
export async function resolveSellerWorkspaceContext(
  userRole?: string | null,
  userStaffRoles?: StaffRoles,
): Promise<SellerWorkspaceContext> {
  const { acting, memberships } = await resolveActingContext(userRole, userStaffRoles);
  const personalEntity = memberships.find((m) => m.kind === "individual") ?? null;
  const sellingAsOrganisation = acting.kind === "organisation";
  const sellerEntity = sellingAsOrganisation ? acting : personalEntity;
  return {
    personalEntity,
    sellingAsOrganisation,
    sellerEntityId: sellerEntity?.id ?? null,
    actor: sellingAsOrganisation
      ? { role: acting.role, isImpersonation: acting.isImpersonation }
      : null,
    memberships,
  };
}

/** A person always holds every capability on their own profile; organisations follow the matrix. */
export function sellerCan(ctx: SellerWorkspaceContext, capability: EntityCapability): boolean {
  return ctx.actor === null || entityActorCan(ctx.actor, capability);
}

/**
 * Whether "Sell a work" is offered: the role may hand in work, and the account's state lets it
 * prepare one (an organisation under review may draft; a restricted or closed one may not).
 */
export function sellerCanStartSubmission(ctx: SellerWorkspaceContext): boolean {
  if (!sellerCan(ctx, "entity.submissions.create")) return false;
  const account = sellingAccount(ctx);
  return account ? sellerSubmissionAccess(account).canDraft : false;
}

/** The account the seller pages act for, with its kind and status; `null` when there is none. */
export function sellingAccount(ctx: SellerWorkspaceContext): LegalEntitySummary | null {
  return ctx.memberships.find((membership) => membership.id === ctx.sellerEntityId) ?? null;
}
