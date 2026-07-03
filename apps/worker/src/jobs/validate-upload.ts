import type pino from "pino";
import type { IMalwareScanner } from "../lib/malware-scanner.js";
import type { UploadStorage } from "../lib/upload-storage.js";
import type { IUploadValidationRepository } from "../repositories/interfaces/upload-validation.repository.js";
import { pickValidator } from "./content-type-validators.js";

const MALWARE_SCAN_KINDS = new Set(["source_of_funds_document"]);

export async function validateUploadJob(args: {
  uploadValidationRepo: IUploadValidationRepository;
  storage: UploadStorage;
  uploadId: string;
  log: pino.Logger;
  malwareScanner?: IMalwareScanner | undefined;
}): Promise<{ validated: boolean; key?: string }> {
  const row = await args.uploadValidationRepo.findUploadedById(args.uploadId);
  if (!row) return { validated: false };

  const head = await args.storage.headObject(row.key);
  if (!head) {
    await args.uploadValidationRepo.rejectUpload(row.id, "missing");
    return { validated: false };
  }
  if (head.byteSize > row.declaredByteSize) {
    await args.uploadValidationRepo.rejectUpload(row.id, "oversize", head);
    return { validated: false };
  }

  const validator = pickValidator(row.declaredContentType);
  if (!validator) {
    await args.uploadValidationRepo.rejectUpload(row.id, "unsupported_content_type", head);
    return { validated: false };
  }

  const firstBytes = await args.storage.getObjectBytes(row.key, 64);
  const magic = firstBytes ?? Buffer.alloc(0);
  if (!validator.matches(magic)) {
    await args.uploadValidationRepo.rejectUpload(row.id, "content_type_mismatch", head);
    return { validated: false };
  }

  if (MALWARE_SCAN_KINDS.has(row.kind) && args.malwareScanner) {
    const scan = await args.malwareScanner.scan({
      key: row.key,
      byteSize: head.byteSize,
    });
    if (!scan.clean) {
      await args.uploadValidationRepo.rejectUpload(row.id, scan.reason ?? "malware", head);
      args.log.warn({ uploadId: row.id, reason: scan.reason }, "upload_malware_rejected");
      return { validated: false };
    }
  }

  await args.uploadValidationRepo.activateUpload(row.id, head);
  args.log.info({ uploadId: row.id, key: row.key }, "upload validated");
  return { validated: true, key: row.key };
}

export async function gcPendingUploads(args: {
  uploadValidationRepo: IUploadValidationRepository;
  storage: UploadStorage;
  log: pino.Logger;
  now?: Date;
}): Promise<number> {
  const now = args.now ?? new Date();
  const rows = await args.uploadValidationRepo.findExpiredPending(now);
  for (const row of rows) {
    await args.storage.deleteObject(row.key);
    await args.uploadValidationRepo.deleteById(row.id);
  }
  if (rows.length > 0) {
    args.log.info({ count: rows.length }, "garbage collected stale pending uploads");
  }
  return rows.length;
}
