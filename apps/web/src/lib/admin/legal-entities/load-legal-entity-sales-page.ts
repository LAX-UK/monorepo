import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";

export type LegalEntitySalesPageModel = {
  entityId: string;
  displayName: string;
};

/** Data/composition boundary for `/admin/legal-entities/[id]/sales`. */
export async function loadAdminLegalEntitySalesPage(
  entityId: string,
): Promise<LegalEntitySalesPageModel> {
  const bundle = await loadAdminLegalEntityDetail(entityId);
  return { entityId, displayName: bundle.entity.displayName };
}
