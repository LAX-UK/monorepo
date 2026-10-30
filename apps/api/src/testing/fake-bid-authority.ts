import { BidAuthorityService, type IBidAuthority } from "@auction/bidding-runtime";
import type { BuyerAgentAuthorisationRow } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";

/**
 * The real bid authority over in-memory readers: the member holds `role` (or is not a member
 * when `null`) and holds `grants` as active buyer-agent authorisations (no total unless given).
 */
export function fakeBidAuthority(
  role: LegalEntityMemberRole | null,
  grants: (Omit<BuyerAgentAuthorisationRow, "totalLimit"> & { totalLimit?: string | null })[] = [],
): IBidAuthority {
  return new BidAuthorityService(
    { findActiveMemberRole: async () => role },
    {
      findActiveAuthorisations: async () =>
        grants.map((g) => ({ ...g, totalLimit: g.totalLimit ?? null })),
    },
  );
}
