import type { Database } from "@auction/db";
import { marketingEnquiryAttachment, uploadObject } from "@auction/db/schema";
import { ENQUIRY_UPLOAD_KINDS } from "@auction/domain";
import { and, count, eq, gt, inArray, notExists } from "drizzle-orm";
import type {
  IUploadPersistenceRepository,
  InsertPendingUploadInput,
  UploadObjectRow,
  UploadOwner,
} from "../interfaces/upload-persistence.repository.js";

function mapRow(row: typeof uploadObject.$inferSelect): UploadObjectRow {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    enquiryDraftId: row.enquiryDraftId,
    kind: row.kind,
    key: row.key,
    declaredContentType: row.declaredContentType,
    declaredByteSize: row.declaredByteSize,
    status: row.status,
    rejectionReason: row.rejectionReason ?? null,
  };
}

export class DrizzleUploadPersistenceRepository implements IUploadPersistenceRepository {
  constructor(private readonly db: Database) {}

  async insertPending(input: InsertPendingUploadInput): Promise<{ id: string } | null> {
    const [row] = await this.db
      .insert(uploadObject)
      .values({
        ownerUserId: input.ownerUserId ?? null,
        enquiryDraftId: input.enquiryDraftId ?? null,
        kind: input.kind,
        key: input.key,
        declaredContentType: input.declaredContentType,
        declaredByteSize: input.declaredByteSize,
        expiresAt: input.expiresAt,
      })
      .returning({ id: uploadObject.id });
    return row ?? null;
  }

  async findById(uploadId: string): Promise<UploadObjectRow | null> {
    const [row] = await this.db
      .select()
      .from(uploadObject)
      .where(eq(uploadObject.id, uploadId))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findByIdForOwner(uploadId: string, ownerUserId: string): Promise<UploadObjectRow | null> {
    const [row] = await this.db
      .select()
      .from(uploadObject)
      .where(and(eq(uploadObject.id, uploadId), eq(uploadObject.ownerUserId, ownerUserId)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findByIdForDraft(
    uploadId: string,
    enquiryDraftId: string,
  ): Promise<UploadObjectRow | null> {
    const [row] = await this.db
      .select()
      .from(uploadObject)
      .where(and(eq(uploadObject.id, uploadId), eq(uploadObject.enquiryDraftId, enquiryDraftId)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async countUnsentEnquiryUploads(owner: UploadOwner, now: Date): Promise<number> {
    const ownedBy =
      owner.enquiryDraftId !== undefined
        ? eq(uploadObject.enquiryDraftId, owner.enquiryDraftId)
        : eq(uploadObject.ownerUserId, owner.ownerUserId);
    const [row] = await this.db
      .select({ total: count() })
      .from(uploadObject)
      .where(
        and(
          ownedBy,
          inArray(uploadObject.kind, [...ENQUIRY_UPLOAD_KINDS]),
          gt(uploadObject.expiresAt, now),
          notExists(
            this.db
              .select({ one: marketingEnquiryAttachment.id })
              .from(marketingEnquiryAttachment)
              .where(eq(marketingEnquiryAttachment.uploadObjectId, uploadObject.id)),
          ),
        ),
      );
    return row?.total ?? 0;
  }

  async markUploaded(uploadId: string, uploadedAt: Date): Promise<void> {
    await this.db
      .update(uploadObject)
      .set({ status: "uploaded", uploadedAt })
      .where(eq(uploadObject.id, uploadId));
  }
}
