import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { SubjectExportFileRef, SubjectExportProduct } from "@auction/identity-contracts";
import type { ArchiveBudget } from "./archive-budget.js";
import type { ExportStaging } from "./export-staging.js";
import { type ExportedFile, omittedFile } from "./exported-file.js";
import { permanentError, transientError } from "./subject-export.errors.js";

export type FileContext = {
  product: SubjectExportProduct;
  categoryId: string;
  recordId: string;
};

/** Brings the files a person uploaded into the copy, or says plainly that one is not in it. */
export interface ExportFileMaterialiser {
  materialise(
    context: FileContext,
    ref: SubjectExportFileRef,
    signal: AbortSignal,
  ): Promise<ExportedFile>;
}

class OverBudget extends Error {}

/** Counts bytes through a stream and stops it once it passes the room left. */
function limit(maxBytes: number, onBytes: (total: number) => void): Transform {
  let total = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) return callback(new OverBudget());
      onBytes(total);
      callback(null, chunk);
    },
  });
}

/** Keeps letters, digits and a few safe marks; the name is for people, the record id keeps it unique. */
export function safeZipName(recordId: string, fileName: string): string {
  const clean = (text: string) => text.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "");
  const name = clean(fileName) || "file";
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name).slice(0, 80);
  const extension = dot > 0 ? name.slice(dot).slice(0, 12) : "";
  return `${clean(recordId).slice(0, 40) || "record"}-${stem}${extension}`;
}

export type ExportFileMaterialiserConfig = {
  staging: ExportStaging;
  budget: ArchiveBudget;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
};

const DEFAULT_FILE_TIMEOUT_MS = 10 * 60_000;

/**
 * Downloads each signed link to local disk, hashing as it goes, and keeps the file when it fits
 * in the copy. A file the product no longer has (404 or 410) is listed as unavailable; a link
 * that fails for any other reason is retried later with a fresh one, because shipping without it
 * would be a partial copy that looks complete.
 */
export class HttpExportFileMaterialiser implements ExportFileMaterialiser {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  /** Files left out of the copy, for the summary. */
  readonly omitted: ExportedFile[] = [];

  constructor(private readonly config: ExportFileMaterialiserConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.requestTimeoutMs ?? DEFAULT_FILE_TIMEOUT_MS;
  }

  async materialise(
    context: FileContext,
    ref: SubjectExportFileRef,
    signal: AbortSignal,
  ): Promise<ExportedFile> {
    const { staging, budget } = this.config;
    const { product } = context;
    if (!/^https?:\/\//i.test(ref.url)) throw permanentError("invalid_file_link", product);
    // A size the product declared lets a file that cannot fit be skipped without fetching it.
    if (ref.byteSize !== null && !budget.fitsFile(ref.byteSize))
      return this.leaveOut(ref, "size_cap");

    let response: Response;
    try {
      response = await this.fetchImpl(ref.url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]),
      });
    } catch (error) {
      throw transientError("file_unreachable", product, error);
    }
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel().catch(() => undefined);
      return this.leaveOut(ref, "unavailable");
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      throw transientError(`file_http_${response.status}`, product);
    }

    const diskPath = staging.newDiskPath();
    const hash = createHash("sha256");
    let bytes = 0;
    try {
      await pipeline(
        Readable.fromWeb(response.body as never),
        limit(budget.roomForFileBytes, (total) => {
          bytes = total;
        }),
        new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            hash.update(chunk);
            callback(null, chunk);
          },
        }),
        createWriteStream(diskPath),
        { signal },
      );
    } catch (error) {
      await rm(diskPath, { force: true });
      if (error instanceof OverBudget) return this.leaveOut(ref, "size_cap");
      throw transientError("file_download_failed", product, error);
    }

    if (!budget.admitFile(bytes)) {
      await rm(diskPath, { force: true });
      return this.leaveOut(ref, "size_cap");
    }
    const zipPath = staging.claimZipPath(
      `${product}/files/${context.categoryId}/${safeZipName(context.recordId, ref.fileName)}`,
    );
    staging.add({ zipPath, diskPath, bytes, compress: false });
    return {
      included: true,
      path: zipPath,
      fileName: ref.fileName,
      contentType: ref.contentType,
      byteSize: bytes,
      sha256: hash.digest("hex"),
    };
  }

  private leaveOut(ref: SubjectExportFileRef, reason: "size_cap" | "unavailable"): ExportedFile {
    const file = omittedFile(ref, reason);
    this.omitted.push(file);
    return file;
  }
}
