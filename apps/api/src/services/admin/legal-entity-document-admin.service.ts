import type { ILegalEntityDocumentAdminRepository } from "@auction/persistence/interfaces";
import type { ReviewLegalEntityDocumentInput } from "@auction/validators";
import type { IObjectStorage } from "../interfaces/object-storage.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";

export type AdminLegalEntityDocumentDto = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  uploadedAt: Date;
  uploadedByUserId: string;
  downloadUrl: string;
  contentType: string | null;
  byteSize: number | null;
};

export class LegalEntityDocumentAdminService {
  constructor(
    private readonly documents: ILegalEntityDocumentAdminRepository,
    private readonly storage: IObjectStorage,
    private readonly media: MediaUrlResolver | undefined,
  ) {}

  async listDocuments(entityId: string): Promise<AdminLegalEntityDocumentDto[] | null> {
    const kind = await this.documents.findEntityKind(entityId);
    if (!kind) return null;

    const rows = await this.documents.listDocumentRows(entityId);
    const bases = rows.map((r) => this.storage.getPublicUrl(r.key));
    const urls = this.media ? await this.media.resolveMany(bases) : bases;

    return rows.map((r, i) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      reviewStatus: r.reviewStatus,
      reviewNotes: r.reviewNotes,
      reviewedAt: r.reviewedAt,
      uploadedAt: r.uploadedAt,
      uploadedByUserId: r.uploadedByUserId,
      downloadUrl: urls[i] ?? bases[i] ?? "",
      contentType: r.actualContentType,
      byteSize: r.actualByteSize,
    }));
  }

  async reviewDocument(
    entityId: string,
    documentId: string,
    reviewerUserId: string,
    input: ReviewLegalEntityDocumentInput,
  ): Promise<
    { ok: true } | { ok: false; code: "not_found" | "document_not_found" | "forbidden_kind" }
  > {
    const kind = await this.documents.findEntityKind(entityId);
    if (!kind || kind !== "organisation") {
      return { ok: false, code: "not_found" };
    }

    const exists = await this.documents.documentExists(entityId, documentId);
    if (!exists) return { ok: false, code: "document_not_found" };

    await this.documents.reviewDocument(documentId, reviewerUserId, input);
    return { ok: true };
  }
}
