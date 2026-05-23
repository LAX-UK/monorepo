import "server-only";

import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import type { LegalEntitySummary } from "@auction/types";

export type SellerWorkspaceContext = {
  /** Personal (`individual`) entity used for seller lots, payouts, and connect. */
  personalEntity: LegalEntitySummary | null;
  /** User has an org selected in the header while viewing seller routes. */
  orgActingSelected: boolean;
  /** Seller entity id for lot/payout API calls — null when profile is unavailable. */
  sellerEntityId: string | null;
  /** Personal entity bootstrap failed on the API. */
  bootstrapFailed: boolean;
};

/** Seller routes always scope data to the personal profile, not org acting context. */
export async function resolveSellerWorkspaceContext(
  userRole?: string | null,
  userStaffRole?: string | null,
): Promise<SellerWorkspaceContext> {
  const { acting, memberships, bootstrapFailed } = await resolveActingContext(
    userRole,
    userStaffRole,
  );
  const personalEntity = memberships.find((m) => m.kind === "individual") ?? null;
  const orgActingSelected = Boolean(acting && acting.kind !== "individual");
  return {
    personalEntity,
    orgActingSelected,
    sellerEntityId: personalEntity?.id ?? null,
    bootstrapFailed,
  };
}
