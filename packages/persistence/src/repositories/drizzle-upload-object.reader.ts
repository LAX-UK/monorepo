import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IUploadObjectReader } from "../interfaces/upload-object.reader.js";

export class DrizzleUploadObjectReader implements IUploadObjectReader {
  constructor(private readonly db: Database) {}

  async getStatus(uploadObjectId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ status: uploadObject.status })
      .from(uploadObject)
      .where(eq(uploadObject.id, uploadObjectId))
      .limit(1);
    return row?.status ?? null;
  }
}
