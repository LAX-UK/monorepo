import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  IUploadObjectDescriber,
  IUploadObjectReader,
  UploadObjectDescription,
} from "../interfaces/upload-object.reader.js";

export class DrizzleUploadObjectReader implements IUploadObjectReader, IUploadObjectDescriber {
  constructor(private readonly db: Database) {}

  async getStatus(uploadObjectId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ status: uploadObject.status })
      .from(uploadObject)
      .where(eq(uploadObject.id, uploadObjectId))
      .limit(1);
    return row?.status ?? null;
  }

  async findKey(uploadObjectId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ key: uploadObject.key })
      .from(uploadObject)
      .where(eq(uploadObject.id, uploadObjectId))
      .limit(1);
    return row?.key ?? null;
  }

  async describe(uploadObjectId: string): Promise<UploadObjectDescription | null> {
    const [row] = await this.db
      .select({
        status: uploadObject.status,
        kind: uploadObject.kind,
        ownerUserId: uploadObject.ownerUserId,
        declaredContentType: uploadObject.declaredContentType,
        declaredByteSize: uploadObject.declaredByteSize,
        actualContentType: uploadObject.actualContentType,
        actualByteSize: uploadObject.actualByteSize,
      })
      .from(uploadObject)
      .where(eq(uploadObject.id, uploadObjectId))
      .limit(1);
    if (!row) return null;
    return {
      status: row.status,
      kind: row.kind,
      ownerUserId: row.ownerUserId,
      contentType: row.actualContentType ?? row.declaredContentType,
      byteSize: row.actualByteSize ?? row.declaredByteSize,
    };
  }
}
