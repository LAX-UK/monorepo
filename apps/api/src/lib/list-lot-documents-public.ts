import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot, lotDocument, uploadObject } from "@auction/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { IMediaUrlResolver } from "../services/interfaces/media-url-resolver.js";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";

export type LotDocumentPublicDto = {
  id: string;
  kind: string;
  label: string | null;
  downloadUrl: string;
};

/** Published-lot attachments (contracts, certificates, etc.). Omits drafts and non-active uploads. */
export async function listLotDocumentsPublic(
  db: Database,
  storage: IObjectStorage,
  resolver: IMediaUrlResolver | undefined,
  lotId: string,
): Promise<LotDocumentPublicDto[]> {
  const [lotRow] = await db
    .select({ status: lot.status })
    .from(lot)
    .where(and(eq(lot.id, lotId), lotNotDeleted()))
    .limit(1);
  if (!lotRow || lotRow.status === "draft") return [];

  const rows = await db
    .select({
      id: lotDocument.id,
      kind: lotDocument.kind,
      label: lotDocument.label,
      key: uploadObject.key,
    })
    .from(lotDocument)
    .innerJoin(uploadObject, eq(lotDocument.uploadObjectId, uploadObject.id))
    .where(
      and(
        eq(lotDocument.lotId, lotId),
        eq(uploadObject.status, "active"),
        isNull(lotDocument.deletedAt),
      ),
    )
    .orderBy(asc(lotDocument.createdAt));

  const out: LotDocumentPublicDto[] = [];
  for (const r of rows) {
    const baseUrl = storage.getPublicUrl(r.key);
    const downloadUrl = resolver ? ((await resolver.resolve(baseUrl)) ?? baseUrl) : baseUrl;
    out.push({ id: r.id, kind: r.kind, label: r.label, downloadUrl });
  }
  return out;
}
