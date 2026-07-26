import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";

export type LegalEntityStripePageModel = Pick<
  Awaited<ReturnType<typeof loadAdminLegalEntityDetail>>,
  "entity"
>;

/** Data/composition boundary for `/admin/legal-entities/[id]/stripe`. */
export async function loadAdminLegalEntityStripePage(
  entityId: string,
): Promise<LegalEntityStripePageModel> {
  const bundle = await loadAdminLegalEntityDetail(entityId);
  return { entity: bundle.entity };
}
