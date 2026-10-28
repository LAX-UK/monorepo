import "server-only";

import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { type EntityActor, type EntityCapability, entityActorCan } from "@auction/domain";
import type { LegalEntitySummary } from "@auction/types";
import { redirect } from "next/navigation";

export type SellerWorkspaceContext = {
  /** Personal (`individual`) entity: the person's own seller profile. */
  personalEntity: LegalEntitySummary | null;
  /** The person is selling as an organisation rather than as themselves. */
  sellingAsOrganisation: boolean;
  /** Entity whose submissions, lots, payouts and payout setup the seller pages show. */
  sellerEntityId: string | null;
  /** The signed-in person's standing with that entity, for the capability matrix. */
  actor: EntityActor | null;
  /** Personal entity bootstrap failed on the API. */
  bootstrapFailed: boolean;
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
  userStaffRole?: string | null,
): Promise<SellerWorkspaceContext> {
  const { acting, memberships, bootstrapFailed } = await resolveActingContext(
    userRole,
    userStaffRole,
  );
  const personalEntity = memberships.find((m) => m.kind === "individual") ?? null;
  const sellingAsOrganisation = acting?.kind === "organisation";
  const sellerEntity = sellingAsOrganisation ? acting : personalEntity;
  return {
    personalEntity,
    sellingAsOrganisation,
    sellerEntityId: sellerEntity?.id ?? null,
    actor: sellingAsOrganisation
      ? { role: acting.role, isImpersonation: acting.isImpersonation }
      : null,
    bootstrapFailed,
    memberships,
  };
}

/** A person always holds every capability on their own profile; organisations follow the matrix. */
export function sellerCan(ctx: SellerWorkspaceContext, capability: EntityCapability): boolean {
  return ctx.actor === null || entityActorCan(ctx.actor, capability);
}

/** Sends a member whose role lacks `capability` back to the Selling overview. */
export function requireSellerCapability(
  ctx: SellerWorkspaceContext,
  capability: EntityCapability,
): void {
  if (!sellerCan(ctx, capability)) redirect("/selling");
}
