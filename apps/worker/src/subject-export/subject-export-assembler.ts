import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SUBJECT_EXPORT_MAX_ARCHIVE_BYTES,
  SUBJECT_EXPORT_PRODUCTS,
  SUBJECT_EXPORT_PRODUCT_INFO,
  type SubjectExportProduct,
} from "@auction/identity-contracts";
import { ArchiveBudget } from "./archive-budget.js";
import type { SubjectExportArchiveStore } from "./archive-store.js";
import { controllerNamesFor } from "./controller-names.js";
import {
  type IFreeSpaceProbe,
  NodeFreeSpaceProbe,
  SubjectExportDeferredError,
  decidePreflight,
} from "./export-disk-guard.js";
import { HttpExportFileMaterialiser } from "./export-file-materialiser.js";
import { ExportStaging } from "./export-staging.js";
import { decideFailure } from "./failure-policy.js";
import type { SubjectExportProgressPort } from "./identity-export-client.js";
import { type CollectedProduct, collectProduct } from "./product-collector.js";
import type { ProductExportSource } from "./product-export-source.js";
import {
  MANIFEST_FILE_NAME,
  README_FILE_NAME,
  SUMMARY_FILE_NAME,
  renderReadme,
} from "./readme.renderer.js";
import { readRecipient } from "./recipient.js";
import {
  asSubjectExportError,
  permanentError,
  transientError,
  withProduct,
} from "./subject-export.errors.js";
import { renderSummary } from "./summary.renderer.js";
import { type ArchivedPart, ZipFileWriter } from "./zip-file-writer.js";

/** The longest one attempt may run. */
export const ATTEMPT_TIMEOUT_MS = 30 * 60_000;

export type AssembleRequest = { exportId: string; subjectId: string };

export type AssembleAttempt = {
  /** This attempt, counting from 1. */
  number: number;
  maxAttempts: number;
  /** When the job was queued, which starts the 72-hour retry window. */
  queuedAt: Date;
};

/**
 * The request ended without a copy and Identity has been told. The queue must not retry it; it
 * lands in the failed jobs list for staff.
 */
export class SubjectExportTerminalError extends Error {
  constructor(
    readonly code: string,
    readonly outcome: "failed" | "delayed",
  ) {
    super(code);
    this.name = "SubjectExportTerminalError";
  }
}

export type AssemblerLog = {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
};

export type SubjectExportAssemblerDeps = {
  sources: Readonly<Record<SubjectExportProduct, ProductExportSource>>;
  progress: SubjectExportProgressPort;
  store: SubjectExportArchiveStore;
  log: AssemblerLog;
  /** Builds the uploaded-file fetcher; tests pass one with a fake network. */
  createFiles?: (staging: ExportStaging, budget: ArchiveBudget) => HttpExportFileMaterialiser;
  /** The size cap for one copy; tests use a small one. */
  createBudget?: () => ArchiveBudget;
  tempRoot?: string;
  /** Reads free space on the temp disk; tests pass a fake. */
  freeSpace?: IFreeSpaceProbe;
  now?: () => Date;
  attemptTimeoutMs?: number;
};

const pad = (value: Date) => value.toISOString().slice(0, 10);

/**
 * Builds one person's copy: every product is collected to local disk, then zipped, uploaded, and
 * reported ready. All or nothing: a product that fails stops the attempt before anything is
 * uploaded, so a partial copy never ships. The temp directory goes in a `finally`.
 *
 * Each attempt starts from the beginning, which keeps the job idempotent: progress reports apply
 * once, and an upload to the same key replaces itself.
 */
export class SubjectExportAssembler {
  private readonly now: () => Date;

  constructor(private readonly deps: SubjectExportAssemblerDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async run(request: AssembleRequest, attempt: AssembleAttempt): Promise<void> {
    const { log, progress } = this.deps;
    const signal = AbortSignal.timeout(this.deps.attemptTimeoutMs ?? ATTEMPT_TIMEOUT_MS);
    const tempRoot = this.deps.tempRoot ?? tmpdir();
    await this.preflight(request, tempRoot);
    const staging = await ExportStaging.create(await mkdtemp(join(tempRoot, "subject-export-")));
    try {
      await this.assemble(request, staging, signal);
      log.info({ exportId: request.exportId, attempt: attempt.number }, "subject export ready");
    } catch (caught) {
      const error = signal.aborted
        ? transientError("attempt_timeout", asSubjectExportError(caught).product, caught)
        : asSubjectExportError(caught);
      const decision = decideFailure({
        error,
        elapsedMs: this.now().getTime() - attempt.queuedAt.getTime(),
        attempt: attempt.number,
        maxAttempts: attempt.maxAttempts,
      });
      log.warn(
        {
          exportId: request.exportId,
          attempt: attempt.number,
          code: error.code,
          product: error.product,
          decision: decision.action,
        },
        "subject export attempt failed",
      );
      if (decision.action === "retry") throw error;
      if (decision.action === "delay") {
        await progress.report(request.exportId, {
          event: "delayed",
          product: decision.product,
          errorCode: error.code,
        });
        throw new SubjectExportTerminalError(error.code, "delayed");
      }
      await progress.report(request.exportId, { event: "failed", errorCode: error.code });
      throw new SubjectExportTerminalError(error.code, "failed");
    } finally {
      await staging.remove().catch((error: unknown) => {
        log.warn({ exportId: request.exportId, err: error }, "subject export temp cleanup failed");
      });
    }
  }

  /**
   * Puts the copy off, without spending an attempt, when the temp disk cannot hold a full-size
   * archive plus the margin. Concurrency is 1, so nothing else of ours is filling it meanwhile.
   */
  private async preflight(request: AssembleRequest, tempRoot: string): Promise<void> {
    const budget = this.deps.createBudget?.() ?? new ArchiveBudget();
    const probe = this.deps.freeSpace ?? new NodeFreeSpaceProbe();
    const decision = decidePreflight({
      freeBytes: await probe.freeBytes(tempRoot),
      archiveCapBytes: budget.capBytes,
    });
    if (decision.action === "proceed") return;
    this.deps.log.warn(
      {
        exportId: request.exportId,
        freeBytes: decision.freeBytes,
        requiredBytes: decision.requiredBytes,
      },
      "subject export deferred: temp disk low",
    );
    throw new SubjectExportDeferredError(decision.freeBytes, decision.requiredBytes);
  }

  private async assemble(
    request: AssembleRequest,
    staging: ExportStaging,
    signal: AbortSignal,
  ): Promise<void> {
    const { sources, progress, store } = this.deps;
    const generatedAt = this.now();
    const budget = this.deps.createBudget?.() ?? new ArchiveBudget();
    const files =
      this.deps.createFiles?.(staging, budget) ??
      new HttpExportFileMaterialiser({ staging, budget });

    const collected: CollectedProduct[] = [];
    for (const product of SUBJECT_EXPORT_PRODUCTS) {
      let result: CollectedProduct;
      try {
        result = await collectProduct({
          product,
          subjectId: request.subjectId,
          source: sources[product],
          staging,
          budget,
          files,
          generatedAt,
          signal,
        });
      } catch (error) {
        throw withProduct(asSubjectExportError(error), product);
      }
      await progress.report(request.exportId, {
        event: "product_collected",
        product,
        categories: result.categories.map((category) => ({
          id: category.definition.id,
          schemaVersion: category.schemaVersion,
          count: category.count,
        })),
      });
      collected.push(result);
    }

    const fileName = `lax-data-${pad(generatedAt)}.zip`;
    const archivePath = join(staging.directory, "archive.zip");
    const archive = await this.buildArchive({
      request,
      staging,
      collected,
      generatedAt,
      fileName,
      archivePath,
      omittedFileCount: files.omitted.length,
    });
    if (archive.bytes > SUBJECT_EXPORT_MAX_ARCHIVE_BYTES) throw permanentError("export_too_large");

    const objectKey = `subject-exports/${request.exportId}/${fileName}`;
    try {
      await store.uploadFile(objectKey, archivePath, "application/zip");
    } catch (error) {
      throw transientError("storage_upload_failed", undefined, error);
    }
    await progress.report(request.exportId, {
      event: "ready",
      objectKey,
      fileName,
      sizeBytes: archive.bytes,
      sha256: archive.sha256,
    });
  }

  private async buildArchive(input: {
    request: AssembleRequest;
    staging: ExportStaging;
    collected: readonly CollectedProduct[];
    generatedAt: Date;
    fileName: string;
    archivePath: string;
    omittedFileCount: number;
  }): Promise<{ bytes: number; sha256: string }> {
    const { staging, collected, generatedAt } = input;
    const zip = ZipFileWriter.open(
      input.archivePath,
      input.fileName.replace(/\.zip$/, ""),
      generatedAt,
    );
    try {
      const parts: ArchivedPart[] = [];
      // Read before the staged account files are consumed below.
      const recipient = await readRecipient(staging);
      const ordered = [...staging.entries].sort((a, b) => a.zipPath.localeCompare(b.zipPath));
      for (const entry of ordered) {
        parts.push(
          await zip.addFile(entry.zipPath, entry.diskPath, entry.compress, { consume: true }),
        );
      }
      parts.push(
        await zip.addBuffer(
          README_FILE_NAME,
          Buffer.from(renderReadme({ preparedAt: generatedAt, exportId: input.request.exportId })),
          true,
        ),
        await zip.addBuffer(
          SUMMARY_FILE_NAME,
          Buffer.from(
            renderSummary({
              preparedAt: generatedAt,
              recipient,
              products: collected,
              omittedFileCount: input.omittedFileCount,
            }),
          ),
          true,
        ),
      );
      const manifest = {
        exportId: input.request.exportId,
        createdAt: generatedAt.toISOString(),
        schemaVersion: 1,
        products: collected.map((entry) => ({
          product: entry.product,
          name: SUBJECT_EXPORT_PRODUCT_INFO[entry.product].name,
          controller: controllerNamesFor(entry.product),
          categories: entry.categories.map((category) => ({
            id: category.definition.id,
            schemaVersion: category.schemaVersion,
            records: category.count,
            file: category.zipPath,
          })),
        })),
        omittedFiles: input.omittedFileCount,
        files: parts.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
      };
      await zip.addBuffer(
        MANIFEST_FILE_NAME,
        Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
        true,
      );
      return await zip.finish();
    } catch (error) {
      zip.abort();
      throw error;
    }
  }
}
