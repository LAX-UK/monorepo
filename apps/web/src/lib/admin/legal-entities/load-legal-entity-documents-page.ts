import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";

export type LegalEntityDocumentsPageModel = Pick<
  Awaited<ReturnType<typeof loadAdminLegalEntityDetail>>,
  "entity" | "documents"
>;

/** Data/composition boundary for `/admin/legal-entities/[id]/documents`. */
export async function loadAdminLegalEntityDocumentsPage(
  entityId: string,
): Promise<LegalEntityDocumentsPageModel> {
  const bundle = await loadAdminLegalEntityDetail(entityId);
  return { entity: bundle.entity, documents: bundle.documents };
}
