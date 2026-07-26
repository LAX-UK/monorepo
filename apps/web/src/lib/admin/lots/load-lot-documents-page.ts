import "server-only";

import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";

export type LotDocumentsPageModel = {
  lotId: string;
  documents: Awaited<ReturnType<typeof getServerLotDocuments>>;
};

/** Data/composition boundary for `/admin/lots/[id]/documents`. */
export async function loadAdminLotDocumentsPage(lotId: string): Promise<LotDocumentsPageModel> {
  await loadAdminLotDetail(lotId);
  const documents = await getServerLotDocuments(lotId).catch(() => []);

  return { lotId, documents };
}
