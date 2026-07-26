import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";

export type LegalEntityOverviewPageModel = Awaited<ReturnType<typeof loadAdminLegalEntityDetail>>;

/** Data/composition boundary for `/admin/legal-entities/[id]`. */
export async function loadAdminLegalEntityOverviewPage(
  entityId: string,
): Promise<LegalEntityOverviewPageModel> {
  return loadAdminLegalEntityDetail(entityId);
}
