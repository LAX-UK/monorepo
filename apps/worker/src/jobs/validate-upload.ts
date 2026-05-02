import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db";
import { and, eq, lt } from "drizzle-orm";
import type pino from "pino";
import type { UploadStorage } from "../lib/upload-storage.js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function validateUploadJob(args: {
  db: Database;
  storage: UploadStorage;
  uploadId: string;
  log: pino.Logger;
}): Promise<void> {
  const [row] = await args.db
    .select()
    .from(uploadObject)
    .where(eq(uploadObject.id, args.uploadId))
    .limit(1);
  if (!row || row.status !== "uploaded") return;

  const head = await args.storage.headObject(row.key);
  if (!head) {
    await rejectUpload(args.db, row.id, "missing");
    return;
  }
  if (head.byteSize > row.declaredByteSize) {
    await rejectUpload(args.db, row.id, "oversize", head);
    return;
  }
  if (!ALLOWED_TYPES.has(row.declaredContentType)) {
    await rejectUpload(args.db, row.id, "unsupported_content_type", head);
    return;
  }

  const firstBytes = await args.storage.getObjectBytes(row.key, 64);
  const sniffed = firstBytes ? sniffImageContentType(firstBytes) : null;
  if (sniffed !== row.declaredContentType) {
    await rejectUpload(args.db, row.id, "content_type_mismatch", head);
    return;
  }

  await args.db
    .update(uploadObject)
    .set({
      status: "active",
      actualContentType: head.contentType,
      actualByteSize: head.byteSize,
      validatedAt: new Date(),
      rejectionReason: null,
    })
    .where(eq(uploadObject.id, row.id));
  args.log.info({ uploadId: row.id, key: row.key }, "upload validated");
}

export async function gcPendingUploads(args: {
  db: Database;
  storage: UploadStorage;
  log: pino.Logger;
  now?: Date;
}): Promise<number> {
  const now = args.now ?? new Date();
  const rows = await args.db
    .select({ id: uploadObject.id, key: uploadObject.key })
    .from(uploadObject)
    .where(and(eq(uploadObject.status, "pending"), lt(uploadObject.expiresAt, now)))
    .limit(100);
  for (const row of rows) {
    await args.storage.deleteObject(row.key);
    await args.db.delete(uploadObject).where(eq(uploadObject.id, row.id));
  }
  if (rows.length > 0) {
    args.log.info({ count: rows.length }, "garbage collected stale pending uploads");
  }
  return rows.length;
}

async function rejectUpload(
  db: Database,
  uploadId: string,
  reason: string,
  head?: { contentType: string; byteSize: number },
) {
  await db
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

function sniffImageContentType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
