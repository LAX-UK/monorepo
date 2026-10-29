import type { Database } from "@auction/db";
import { buyerAgentAuthorisation } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { IMemberBuyerAgentAuthorisationRevoker } from "../interfaces/buyer-agent-authorisation.repository.js";

/** Revokes a member's active authorisations inside the caller's transaction (no own connection). */
export class DrizzleMemberBuyerAgentAuthorisationRevoker
  implements IMemberBuyerAgentAuthorisationRevoker
{
  revokeAllForMember(
    tx: Database,
    input: { legalEntityId: string; userId: string; reason: string; revokedAt: Date },
  ): Promise<{ id: string; saleId: string | null }[]> {
    return tx
      .update(buyerAgentAuthorisation)
      .set({ status: "revoked", revokedAt: input.revokedAt, revokedReason: input.reason })
      .where(
        and(
          eq(buyerAgentAuthorisation.legalEntityId, input.legalEntityId),
          eq(buyerAgentAuthorisation.userId, input.userId),
          eq(buyerAgentAuthorisation.status, "active"),
        ),
      )
      .returning({ id: buyerAgentAuthorisation.id, saleId: buyerAgentAuthorisation.saleId });
  }
}
