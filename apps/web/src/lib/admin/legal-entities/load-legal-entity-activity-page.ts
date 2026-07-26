import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";

export type LegalEntityActivityPageModel = Pick<
  Awaited<ReturnType<typeof loadAdminLegalEntityDetail>>,
  "entity" | "activityEvents" | "canViewActivity"
>;

/** Data/composition boundary for `/admin/legal-entities/[id]/activity`. */
export async function loadAdminLegalEntityActivityPage(
  entityId: string,
): Promise<LegalEntityActivityPageModel> {
  const bundle = await loadAdminLegalEntityDetail(entityId);
  return {
    entity: bundle.entity,
    activityEvents: bundle.activityEvents,
    canViewActivity: bundle.canViewActivity,
  };
}
