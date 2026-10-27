import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";
import { getServerAdminBuyerAgentOverview } from "@/lib/data/http/buyer-agent-authorisations.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import type { BuyerAgentAuthorisationOverview, LegalEntity, UserRole } from "@auction/types";
import { userHasAccessTo } from "@auction/types";

export type LegalEntityBuyerAgentsPageModel = {
  entity: LegalEntity;
  overview: BuyerAgentAuthorisationOverview | null;
  /** Staff may authorise and revoke only with legal entity write access. */
  canManage: boolean;
};

/** Data/composition boundary for `/admin/legal-entities/[id]/buyer-agents`. */
export async function loadAdminLegalEntityBuyerAgentsPage(
  entityId: string,
): Promise<LegalEntityBuyerAgentsPageModel> {
  const [bundle, overview, user] = await Promise.all([
    loadAdminLegalEntityDetail(entityId),
    getServerAdminBuyerAgentOverview(entityId).catch(() => null),
    getServerSessionUser(),
  ]);
  const canManage = user
    ? userHasAccessTo(user.role as UserRole, user.staffRole ?? null, "legal_entity.write")
    : false;
  return { entity: bundle.entity, overview, canManage };
}
