import type { Database } from "@auction/db";
import { legalEntity, legalEntityDocument, uploadObject } from "@auction/db/schema";
import type { ReviewLegalEntityDocumentInput } from "@auction/validators";
import { and, eq } from "drizzle-orm";
import type {
  ILegalEntityDocumentAdminRepository,
  LegalEntityDocumentAdminRow,
} from "../interfaces/legal-entity-document-admin.repository.js";

export class DrizzleLegalEntityDocumentAdminRepository
  implements ILegalEntityDocumentAdminRepository
{
  constructor(private readonly db: Database) {}

  async findEntityKind(entityId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ kind: legalEntity.kind })
      .from(legalEntity)
      .where(eq(legalEntity.id, entityId))
      .limit(1);
    return row?.kind ?? null;
  }

  async listDocumentRows(entityId: string): Promise<LegalEntityDocumentAdminRow[]> {
    return this.db
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
  }

  async reviewDocument(
    documentId: string,
    reviewerUserId: string,
    input: ReviewLegalEntityDocumentInput,
  ): Promise<void> {
    await this.db
      .update(legalEntityDocument)
      .set({
        reviewStatus: input.reviewStatus,
        reviewNotes: input.reviewNotes?.trim() ? input.reviewNotes.trim() : null,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      })
      .where(eq(legalEntityDocument.id, documentId));
  }

  async documentExists(entityId: string, documentId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: legalEntityDocument.id })
      .from(legalEntityDocument)
      .where(
        and(
          eq(legalEntityDocument.id, documentId),
          eq(legalEntityDocument.legalEntityId, entityId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
