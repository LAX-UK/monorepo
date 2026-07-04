import type { EntityDocumentPersistedRow } from "@auction/persistence/interfaces";
import type { DocumentEntityKind, EntityDocument } from "@auction/types";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";

export type { EntityDocumentPersistedRow } from "@auction/persistence/interfaces";

export async function presentEntityDocumentsBatch(
  entityKind: DocumentEntityKind,
  rows: readonly EntityDocumentPersistedRow[],
  storage: IObjectStorage,
  media: MediaUrlResolver | undefined,
): Promise<EntityDocument[]> {
  if (rows.length === 0) return [];
  const bases = rows.map((r) => storage.getPublicUrl(r.key));
  const urls = media ? await media.resolveMany(bases) : bases;
  return rows.map((r, i) => ({
    id: r.id,
    entityKind,
    entityId: r.entityId,
    kind: r.kind,
    label: r.label,
    uploadObjectId: r.uploadObjectId,
    downloadUrl: urls[i] ?? bases[i] ?? "",
    fileName: null,
    byteSize: r.actualByteSize,
    contentType: r.actualContentType,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
  }));
}
