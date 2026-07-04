import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finished } from "node:stream/promises";
import { type ExportFormat, formatCsvHeader, formatCsvRow } from "@auction/exports";
import {
  type IExportProviderDeps,
  createExportProviders,
  exportAuthContextFromRow,
} from "@auction/exports/providers";
import type { DataExportJobPayload } from "@auction/queues";
import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { IDataExportJobRepository } from "../interfaces/data-export.repository.js";
import type { UploadStorage } from "../lib/upload-storage.js";

const EXPORT_PROGRESS_TTL_SEC = 3600;

function progressKey(exportId: string): string {
  return `export:progress:${exportId}`;
}

async function setProgress(
  dataExportRepo: IDataExportJobRepository,
  redis: Redis,
  exportId: string,
  snapshot: {
    status: string;
    phase?: string;
    progress: number;
    processedRows?: number;
    totalRows?: number;
    errorMessage?: string;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    status: snapshot.status,
    progress: snapshot.progress,
  };
  if (snapshot.phase) payload.phase = snapshot.phase;
  if (snapshot.processedRows != null) payload.processedRows = snapshot.processedRows;
  if (snapshot.totalRows != null) payload.totalRows = snapshot.totalRows;
  if (snapshot.errorMessage) payload.errorMessage = snapshot.errorMessage;

  await redis.set(progressKey(exportId), JSON.stringify(payload), "EX", EXPORT_PROGRESS_TTL_SEC);
  await dataExportRepo.updateProgress(exportId, snapshot);
}

function objectKey(exportId: string, format: ExportFormat): string {
  return `exports/${exportId}.${format}`;
}

export type DataExportJobContext = {
  dataExportRepo: IDataExportJobRepository;
  redis: Redis;
  storage: UploadStorage;
  providerDeps: IExportProviderDeps;
  log: { info: (o: unknown, msg?: string) => void; error: (o: unknown, msg?: string) => void };
};

export async function dataExportJob(
  ctx: DataExportJobContext,
  job: Job<DataExportJobPayload>,
): Promise<void> {
  const { exportId, entityType, format } = job.data;
  const providers = createExportProviders(ctx.providerDeps);
  const provider = providers.get(entityType);
  if (!provider) throw new Error(`unknown_export_entity:${entityType}`);

  const row = await ctx.dataExportRepo.findById(exportId);
  if (!row || row.status === "cancelled") return;

  const authCtx = exportAuthContextFromRow(row);
  const filterRecord = row.filters as Record<string, unknown>;

  try {
    await provider.authorize(authCtx, filterRecord);

    await setProgress(ctx.dataExportRepo, ctx.redis, exportId, {
      status: "processing",
      phase: "fetching",
      progress: 5,
      processedRows: 0,
      ...(row.totalRows != null ? { totalRows: row.totalRows } : {}),
    });

    const columns = provider.columns(authCtx, filterRecord);
    const tmpPath = join(tmpdir(), `export-${exportId}.csv`);
    const writeStream = createWriteStream(tmpPath, { encoding: "utf8" });
    writeStream.write(formatCsvHeader(columns));

    let processedRows = 0;
    const totalRows = row.totalRows ?? 0;

    for await (const exportRow of provider.streamRows(authCtx, filterRecord)) {
      const currentStatus = await ctx.dataExportRepo.getStatus(exportId);
      if (currentStatus === "cancelled") {
        writeStream.end();
        await finished(writeStream).catch(() => undefined);
        await unlink(tmpPath).catch(() => undefined);
        return;
      }

      writeStream.write(formatCsvRow(columns, exportRow));
      processedRows += 1;
      if (processedRows % 500 === 0) {
        const progress =
          totalRows > 0 ? Math.min(95, Math.round((processedRows / totalRows) * 90) + 5) : 50;
        await setProgress(ctx.dataExportRepo, ctx.redis, exportId, {
          status: "processing",
          phase: "writing",
          progress,
          processedRows,
          ...(totalRows > 0 ? { totalRows } : {}),
        });
      }
    }

    writeStream.end();
    await finished(writeStream);

    await setProgress(ctx.dataExportRepo, ctx.redis, exportId, {
      status: "processing",
      phase: "uploading",
      progress: 96,
      processedRows,
      totalRows: totalRows > 0 ? totalRows : processedRows,
    });

    const key = objectKey(exportId, format);
    const uploaded = await ctx.storage.putObjectFromFile(key, tmpPath, "text/csv; charset=utf-8");
    await unlink(tmpPath).catch(() => undefined);

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await ctx.dataExportRepo.markCompleted(exportId, {
      processedRows,
      s3Key: key,
      fileSizeBytes: uploaded.byteLength,
      expiresAt,
    });
    await setProgress(ctx.dataExportRepo, ctx.redis, exportId, {
      status: "completed",
      progress: 100,
      processedRows,
    });

    ctx.log.info({ exportId, processedRows, entityType }, "data_export_completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    await setProgress(ctx.dataExportRepo, ctx.redis, exportId, {
      status: "failed",
      progress: 0,
      errorMessage: message,
    });
    throw err;
  }
}
