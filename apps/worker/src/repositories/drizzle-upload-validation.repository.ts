import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db/schema";
import { and, eq, lt } from "drizzle-orm";
import type {
  IUploadValidationRepository,
  ObjectHead,
  UploadValidationRow,
} from "../interfaces/upload-validation.repository.js";

function mapRow(row: typeof uploadObject.$inferSelect): UploadValidationRow {
  return {
    id: row.id,
    key: row.key,
    status: row.status,
    kind: row.kind,
    declaredContentType: row.declaredContentType,
    declaredByteSize: row.declaredByteSize,
  };
}

export class DrizzleUploadValidationRepository implements IUploadValidationRepository {
  constructor(private readonly db: Database) {}

  async findUploadedById(uploadId: string): Promise<UploadValidationRow | null> {
    const [row] = await this.db
      .select()
      .from(uploadObject)
      .where(eq(uploadObject.id, uploadId))
      .limit(1);
    if (!row || row.status !== "uploaded") return null;
    return mapRow(row);
  }

  async rejectUpload(uploadId: string, reason: string, head?: ObjectHead): Promise<void> {
    await this.db
      .update(uploadObject)
      .set({
        status: "rejected",
        rejectionReason: reason,
        actualContentType: head?.contentType,
        actualByteSize: head?.byteSize,
        validatedAt: new Date(),
      })
      .where(eq(uploadObject.id, uploadId));
  }

  async activateUpload(uploadId: string, head: ObjectHead): Promise<void> {
    await this.db
      .update(uploadObject)
      .set({
        status: "active",
        actualContentType: head.contentType,
        actualByteSize: head.byteSize,
        validatedAt: new Date(),
        rejectionReason: null,
      })
      .where(eq(uploadObject.id, uploadId));
  }

  async findExpiredPending(now: Date): Promise<Array<{ id: string; key: string }>> {
    return this.db
      .select({ id: uploadObject.id, key: uploadObject.key })
      .from(uploadObject)
      .where(and(eq(uploadObject.status, "pending"), lt(uploadObject.expiresAt, now)))
      .limit(100);
  }

  async deleteById(uploadId: string): Promise<void> {
    await this.db.delete(uploadObject).where(eq(uploadObject.id, uploadId));
  }
}
