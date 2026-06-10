import type { Database } from "@auction/db";
import { legalEntity, legalEntityDocument, uploadObject } from "@auction/db/schema";
import type { ReviewLegalEntityDocumentInput } from "@auction/validators";
import { and, eq } from "drizzle-orm";
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
    private readonly db: Database,
    private readonly storage: IObjectStorage,
    private readonly media: MediaUrlResolver | undefined,
  ) {}

  async listDocuments(entityId: string): Promise<AdminLegalEntityDocumentDto[] | null> {
    const [entity] = await this.db
      .select({ id: legalEntity.id })
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    if (!entity) return null;

    const rows = await this.db
      .select({
        id: legalEntityDocument.id,
        kind: legalEntityDocument.kind,
        label: legalEntityDocument.label,
        reviewStatus: legalEntityDocument.reviewStatus,
        reviewNotes: legalEntityDocument.reviewNotes,
        reviewedAt: legalEntityDocument.reviewedAt,
        uploadedAt: legalEntityDocument.uploadedAt,
        uploadedByUserId: legalEntityDocument.uploadedByUserId,
        key: uploadObject.key,
        actualContentType: uploadObject.actualContentType,
        actualByteSize: uploadObject.actualByteSize,
      })
      .from(legalEntityDocument)
      .innerJoin(uploadObject, eq(uploadObject.id, legalEntityDocument.uploadObjectId))
      .where(eq(legalEntityDocument.legalEntityId, entityId));

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
    const [entity] = await this.db
      .select({ id: legalEntity.id, kind: legalEntity.kind })
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    if (!entity || entity.kind !== "organisation") {
      return { ok: false, code: "not_found" };
    }

    const [doc] = await this.db
      .select({ id: legalEntityDocument.id })
      .from(legalEntityDocument)
      .where(
        and(
          eq(legalEntityDocument.id, documentId),
          eq(legalEntityDocument.legalEntityId, entityId),
        ),
      )
      .limit(1);
    if (!doc) return { ok: false, code: "document_not_found" };

    await this.db
      .update(legalEntityDocument)
      .set({
        reviewStatus: input.reviewStatus,
        reviewNotes: input.reviewNotes?.trim() ? input.reviewNotes.trim() : null,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      })
      .where(eq(legalEntityDocument.id, documentId));

    return { ok: true };
  }
}
