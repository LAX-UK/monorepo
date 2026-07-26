import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";

export type LegalEntityCompliancePageModel = Pick<
  Awaited<ReturnType<typeof loadAdminLegalEntityDetail>>,
  "entity"
>;

/** Data/composition boundary for `/admin/legal-entities/[id]/compliance`. */
export async function loadAdminLegalEntityCompliancePage(
  entityId: string,
): Promise<LegalEntityCompliancePageModel> {
  const bundle = await loadAdminLegalEntityDetail(entityId);
  return { entity: bundle.entity };
}
