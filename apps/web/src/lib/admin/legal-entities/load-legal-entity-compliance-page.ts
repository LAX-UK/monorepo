import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { LEGAL_ENTITY_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

export type LegalEntityCompliancePageModel = Pick<
  Awaited<ReturnType<typeof loadAdminLegalEntityDetail>>,
  "entity"
> & {
  /** Whether the signed-in person may lift a restriction. */
  canLiftRestriction: boolean;
};

/** Data/composition boundary for `/admin/legal-entities/[id]/compliance`. */
export async function loadAdminLegalEntityCompliancePage(
  entityId: string,
): Promise<LegalEntityCompliancePageModel> {
  const [bundle, user] = await Promise.all([
    loadAdminLegalEntityDetail(entityId),
    getServerSessionUser().catch(() => null),
  ]);
  return {
    entity: bundle.entity,
    canLiftRestriction:
      user != null &&
      userHasAccessTo(user.role as UserRole, user.staffRoles, LEGAL_ENTITY_WRITE_ACCESS),
  };
}
