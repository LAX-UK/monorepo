import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  IUploadPersistenceRepository,
  InsertPendingUploadInput,
  UploadObjectRow,
} from "../interfaces/upload-persistence.repository.js";

function mapRow(row: typeof uploadObject.$inferSelect): UploadObjectRow {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
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
        ownerUserId: input.ownerUserId,
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

  async markUploaded(uploadId: string, uploadedAt: Date): Promise<void> {
    await this.db
      .update(uploadObject)
      .set({ status: "uploaded", uploadedAt })
      .where(eq(uploadObject.id, uploadId));
  }
}
