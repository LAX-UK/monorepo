import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db";
import { and, eq, lt } from "drizzle-orm";
import type pino from "pino";
import type { IMalwareScanner } from "../lib/malware-scanner.js";
import type { UploadStorage } from "../lib/upload-storage.js";
import { pickValidator } from "./content-type-validators.js";

const MALWARE_SCAN_KINDS = new Set(["source_of_funds_document"]);

export async function validateUploadJob(args: {
  db: Database;
  storage: UploadStorage;
  uploadId: string;
  log: pino.Logger;
  malwareScanner?: IMalwareScanner | undefined;
}): Promise<{ validated: boolean; key?: string }> {
  const [row] = await args.db
    .select()
    .from(uploadObject)
    .where(eq(uploadObject.id, args.uploadId))
    .limit(1);
  if (!row || row.status !== "uploaded") return { validated: false };

  const head = await args.storage.headObject(row.key);
  if (!head) {
    await rejectUpload(args.db, row.id, "missing");
    return { validated: false };
  }
  if (head.byteSize > row.declaredByteSize) {
    await rejectUpload(args.db, row.id, "oversize", head);
    return { validated: false };
  }

  const validator = pickValidator(row.declaredContentType);
  if (!validator) {
    await rejectUpload(args.db, row.id, "unsupported_content_type", head);
    return { validated: false };
  }

  const firstBytes = await args.storage.getObjectBytes(row.key, 64);
  const magic = firstBytes ?? Buffer.alloc(0);
  if (!validator.matches(magic)) {
    await rejectUpload(args.db, row.id, "content_type_mismatch", head);
    return { validated: false };
  }

  if (MALWARE_SCAN_KINDS.has(row.kind) && args.malwareScanner) {
    const scan = await args.malwareScanner.scan({
      key: row.key,
      byteSize: head.byteSize,
    });
    if (!scan.clean) {
      await rejectUpload(args.db, row.id, scan.reason ?? "malware", head);
      args.log.warn({ uploadId: row.id, reason: scan.reason }, "upload_malware_rejected");
      return { validated: false };
    }
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
  return { validated: true, key: row.key };
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
