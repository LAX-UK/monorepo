import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { Database } from "@auction/db";
import { dataExport } from "@auction/db/schema";
import {
  type ExportEntityType,
  type ExportFormat,
  type ExportPhase,
  type ExportStatus,
  exportFilename,
  formatCsvHeader,
  formatCsvRow,
} from "@auction/exports";
import { DATA_EXPORT_QUEUE_NAME } from "@auction/queues";
import type { ExportPreviewBody } from "@auction/validators";
import type { CreateExportBody } from "@auction/validators";
import type { Queue } from "bullmq";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { ExportProvider } from "../../exports/types.js";
import { AuthzError } from "../../lib/errors.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IObjectStorage } from "../interfaces/object-storage.js";

const EXPORT_PROGRESS_TTL_SEC = 3600;
const EXPORT_DOWNLOAD_TTL_SEC = 86400;
const MAX_CONCURRENT_EXPORTS = 5;
const MAX_DAILY_EXPORTS = 20;

export type ExportServiceConfig = {
  syncMaxRows: number;
  staleProcessingMs: number;
};

export type ExportJobView = {
  id: string;
  entityType: ExportEntityType;
  format: ExportFormat;
  status: ExportStatus;
  phase?: ExportPhase;
  progress: number;
  processedRows?: number;
  totalRows?: number;
  estimatedSecondsRemaining?: number;
  filename?: string;
  filterSummary?: string;
  downloadUrl?: string;
  expiresAt?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
};

function filtersHash(entityType: string, format: string, filters: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify({ entityType, format, filters })).digest("hex");
}

function exportObjectKey(exportId: string, format: ExportFormat): string {
  return `exports/${exportId}.${format}`;
}

function progressKey(exportId: string): string {
  return `export:progress:${exportId}`;
}

function utcDayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Reuse an existing export row only when in-flight or async file is still downloadable. */
function isReusableExport(row: typeof dataExport.$inferSelect, staleProcessingMs: number): boolean {
  if (row.status === "pending" || row.status === "processing") {
    return row.createdAt.getTime() > Date.now() - staleProcessingMs;
  }
  if (
    row.status === "completed" &&
    row.s3Key &&
    row.expiresAt &&
    row.expiresAt.getTime() > Date.now()
  ) {
    return true;
  }
  return false;
}

export class ExportService {
  constructor(
    private readonly db: Database,
    private readonly redis: Redis,
    private readonly objectStorage: IObjectStorage,
    private readonly dataExportQueue: Queue,
    private readonly providers: Map<ExportEntityType, ExportProvider>,
    private readonly config: ExportServiceConfig,
    private readonly domainEventPublisher?: DomainEventPublisher,
  ) {}

  private provider(entityType: ExportEntityType): ExportProvider {
    const p = this.providers.get(entityType);
    if (!p) throw new AuthzError(`Unsupported export entity: ${entityType}`, 400);
    return p;
  }

  private authContext(userId: string, userRole: string, userStaffRole?: string | null) {
    return { userId, userRole, userStaffRole: userStaffRole ?? null };
  }

  async assertRateLimits(userId: string): Promise<void> {
    const staleCutoff = new Date(Date.now() - this.config.staleProcessingMs);
    const active = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(dataExport)
      .where(
        and(
          eq(dataExport.userId, userId),
          inArray(dataExport.status, ["pending", "processing"]),
          gte(dataExport.createdAt, staleCutoff),
        ),
      );
    if ((active[0]?.n ?? 0) >= MAX_CONCURRENT_EXPORTS) {
      throw new AuthzError("Too many exports running — try again in a few minutes", 429);
    }

    const dayStart = utcDayStart();
    const daily = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(dataExport)
      .where(and(eq(dataExport.userId, userId), gte(dataExport.createdAt, dayStart)));
    if ((daily[0]?.n ?? 0) >= MAX_DAILY_EXPORTS) {
      throw new AuthzError("Daily export limit reached (20/day). Try again tomorrow.", 429);
    }
  }

  async createExport(input: {
    userId: string;
    userRole: string;
    userStaffRole?: string | null;
    body: CreateExportBody;
  }): Promise<
    | { mode: "sync"; stream: Readable; filename: string; contentType: string }
    | { mode: "async"; job: ExportJobView }
    | { mode: "existing"; job: ExportJobView }
  > {
    const { body, userId, userRole, userStaffRole } = input;
    const ctx = this.authContext(userId, userRole, userStaffRole);
    const provider = this.provider(body.entityType);
    const filters = body.filters as Record<string, unknown>;

    await provider.authorize(ctx, filters);
    await this.assertRateLimits(userId);

    const hash = filtersHash(body.entityType, body.format, filters);

    const existing = await this.db
      .select()
      .from(dataExport)
      .where(and(eq(dataExport.userId, userId), eq(dataExport.filtersHash, hash)))
      .orderBy(desc(dataExport.createdAt))
      .limit(1);
    const existingRow = existing[0];
    if (existingRow && isReusableExport(existingRow, this.config.staleProcessingMs)) {
      return { mode: "existing", job: await this.toJobView(existingRow) };
    }

    const totalRows = await provider.estimateCount(ctx, filters);
    const useAsync = body.forceAsync === true || totalRows > this.config.syncMaxRows;

    if (!useAsync) {
      const exportId = randomUUID();
      const now = new Date();
      await this.db.insert(dataExport).values({
        id: exportId,
        userId,
        userRole,
        userStaffRole: userStaffRole ?? null,
        entityType: body.entityType,
        format: body.format,
        filters,
        filtersHash: hash,
        status: "processing",
        phase: "writing",
        progress: 0,
        totalRows,
        processedRows: 0,
        createdAt: now,
      });
      await this.publishExportRequested({
        exportId,
        userId,
        entityType: body.entityType,
        format: body.format,
        filtersHash: hash,
        mode: "sync",
        totalRows,
      });

      const columns = provider.columns(ctx, filters);
      const stream = Readable.from(
        this.syncCsvGenerator(provider, ctx, filters, columns, exportId, totalRows),
      );
      return {
        mode: "sync",
        stream,
        filename: exportFilename(body.entityType, body.format),
        contentType: "text/csv; charset=utf-8",
      };
    }

    const exportId = randomUUID();
    const now = new Date();
    await this.db.insert(dataExport).values({
      id: exportId,
      userId,
      userRole,
      userStaffRole: userStaffRole ?? null,
      entityType: body.entityType,
      format: body.format,
      filters,
      filtersHash: hash,
      status: "pending",
      phase: "counting",
      progress: 0,
      totalRows,
      processedRows: 0,
      createdAt: now,
    });

    await this.dataExportQueue.add(
      "generate",
      {
        exportId,
        userId,
        entityType: body.entityType,
        format: body.format,
        filters,
      },
      { jobId: exportId },
    );
    await this.publishExportRequested({
      exportId,
      userId,
      entityType: body.entityType,
      format: body.format,
      filtersHash: hash,
      mode: "async",
      totalRows,
    });

    await this.setProgress(exportId, {
      status: "pending",
      phase: "counting",
      progress: 0,
      totalRows,
      processedRows: 0,
    });

    const [row] = await this.db.select().from(dataExport).where(eq(dataExport.id, exportId));
    if (!row) throw new Error("export_row_missing");
    return { mode: "async", job: await this.toJobView(row) };
  }

  private async *syncCsvGenerator(
    provider: ExportProvider,
    ctx: ReturnType<ExportService["authContext"]>,
    filters: Record<string, unknown>,
    columns: ReturnType<ExportProvider["columns"]>,
    exportId: string,
    totalRows: number,
  ): AsyncGenerator<string> {
    try {
      yield formatCsvHeader(columns);
      let processedRows = 0;
      for await (const row of provider.streamRows(ctx, filters)) {
        yield formatCsvRow(columns, row);
        processedRows += 1;
        if (processedRows % 500 === 0 && totalRows > 0) {
          await this.db
            .update(dataExport)
            .set({
              processedRows,
              progress: Math.min(99, Math.round((processedRows / totalRows) * 100)),
            })
            .where(eq(dataExport.id, exportId));
        }
      }
      await this.db
        .update(dataExport)
        .set({
          status: "completed",
          phase: null,
          progress: 100,
          processedRows,
          completedAt: new Date(),
        })
        .where(eq(dataExport.id, exportId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      await this.markFailed(exportId, message);
      throw err;
    }
  }

  async previewExport(input: {
    userId: string;
    userRole: string;
    userStaffRole?: string | null;
    body: ExportPreviewBody;
  }): Promise<{ estimatedRows: number; syncMaxRows: number }> {
    const { body, userId, userRole, userStaffRole } = input;
    const ctx = this.authContext(userId, userRole, userStaffRole);
    const provider = this.provider(body.entityType);
    const filters = body.filters as Record<string, unknown>;
    await provider.authorize(ctx, filters);
    const estimatedRows = await provider.estimateCount(ctx, filters);
    return { estimatedRows, syncMaxRows: this.config.syncMaxRows };
  }

  async getExport(userId: string, exportId: string): Promise<ExportJobView | null> {
    const [row] = await this.db
      .select()
      .from(dataExport)
      .where(and(eq(dataExport.id, exportId), eq(dataExport.userId, userId)));
    if (!row) return null;
    return this.toJobView(row);
  }

  async listExports(userId: string): Promise<ExportJobView[]> {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const rows = await this.db
      .select()
      .from(dataExport)
      .where(and(eq(dataExport.userId, userId), gte(dataExport.createdAt, since)))
      .orderBy(desc(dataExport.createdAt))
      .limit(50);
    return Promise.all(rows.map((r) => this.toJobListView(r)));
  }

  async cancelExport(userId: string, exportId: string): Promise<ExportJobView | null> {
    const [row] = await this.db
      .select()
      .from(dataExport)
      .where(and(eq(dataExport.id, exportId), eq(dataExport.userId, userId)));
    if (!row) return null;
    if (row.status !== "pending" && row.status !== "processing") return this.toJobView(row);

    await this.db
      .update(dataExport)
      .set({ status: "cancelled", cancelledAt: new Date(), progress: 0 })
      .where(eq(dataExport.id, exportId));

    const job = await this.dataExportQueue.getJob(exportId);
    if (job) await job.remove();

    await this.setProgress(exportId, { status: "cancelled", progress: 0 });
    const [updated] = await this.db.select().from(dataExport).where(eq(dataExport.id, exportId));
    return updated ? this.toJobView(updated) : null;
  }

  async getDownloadUrl(
    userId: string,
    exportId: string,
  ): Promise<{ url: string; filename: string } | null> {
    const [row] = await this.db
      .select()
      .from(dataExport)
      .where(and(eq(dataExport.id, exportId), eq(dataExport.userId, userId)));
    if (!row || row.status !== "completed" || !row.s3Key) return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

    const { url } = await this.objectStorage.createPresignedGet({
      key: row.s3Key,
      expiresInSec: EXPORT_DOWNLOAD_TTL_SEC,
    });
    return {
      url,
      filename: exportFilename(row.entityType as ExportEntityType, row.format as ExportFormat),
    };
  }

  async setProgress(
    exportId: string,
    snapshot: {
      status: ExportStatus;
      phase?: ExportPhase;
      progress: number;
      processedRows?: number;
      totalRows?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    await this.redis.set(
      progressKey(exportId),
      JSON.stringify(snapshot),
      "EX",
      EXPORT_PROGRESS_TTL_SEC,
    );
    await this.db
      .update(dataExport)
      .set({
        status: snapshot.status,
        phase: snapshot.phase ?? null,
        progress: snapshot.progress,
        processedRows: snapshot.processedRows ?? null,
        totalRows: snapshot.totalRows ?? null,
        errorMessage: snapshot.errorMessage ?? null,
        ...(snapshot.status === "completed" ? { completedAt: new Date() } : {}),
      })
      .where(eq(dataExport.id, exportId));
  }

  async markCompleted(
    exportId: string,
    s3Key: string,
    fileSizeBytes: number,
    processedRows: number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.db
      .update(dataExport)
      .set({
        status: "completed",
        phase: null,
        progress: 100,
        processedRows,
        s3Key,
        fileSizeBytes,
        expiresAt,
        completedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(dataExport.id, exportId));
    await this.setProgress(exportId, {
      status: "completed",
      progress: 100,
      processedRows,
    });
  }

  async markFailed(exportId: string, message: string): Promise<void> {
    await this.db
      .update(dataExport)
      .set({ status: "failed", errorMessage: message, phase: null })
      .where(eq(dataExport.id, exportId));
    await this.setProgress(exportId, { status: "failed", progress: 0, errorMessage: message });
  }

  isCancelled(exportId: string): Promise<boolean> {
    return this.db
      .select({ status: dataExport.status })
      .from(dataExport)
      .where(eq(dataExport.id, exportId))
      .then(([row]) => row?.status === "cancelled");
  }

  getProvider(entityType: ExportEntityType): ExportProvider {
    return this.provider(entityType);
  }

  objectKey(exportId: string, format: ExportFormat): string {
    return exportObjectKey(exportId, format);
  }

  private async publishExportRequested(input: {
    exportId: string;
    userId: string;
    entityType: ExportEntityType;
    format: ExportFormat;
    filtersHash: string;
    mode: "sync" | "async";
    totalRows: number;
  }): Promise<void> {
    if (!this.domainEventPublisher) return;
    await this.domainEventPublisher.publish(this.db, {
      aggregateType: "data_export",
      aggregateId: input.exportId,
      eventType: "export.requested",
      payload: {
        entityType: input.entityType,
        format: input.format,
        filtersHash: input.filtersHash,
        mode: input.mode,
        totalRows: input.totalRows,
      },
      actorUserId: input.userId,
    });
  }

  private async toJobView(row: typeof dataExport.$inferSelect): Promise<ExportJobView> {
    const provider = this.providers.get(row.entityType as ExportEntityType);
    const filterSummary = provider
      ? provider.filterSummary(
          {
            userId: row.userId,
            userRole: row.userRole,
            userStaffRole: row.userStaffRole,
          },
          row.filters as Record<string, unknown>,
        )
      : undefined;
    return this.buildJobView(row, await this.readProgress(row.id), filterSummary);
  }

  private async toJobListView(row: typeof dataExport.$inferSelect): Promise<ExportJobView> {
    const isActive = row.status === "pending" || row.status === "processing";
    return this.buildJobView(row, isActive ? await this.readProgress(row.id) : {}, undefined);
  }

  private async readProgress(exportId: string): Promise<{
    phase?: ExportPhase;
    processedRows?: number;
    totalRows?: number;
  }> {
    const cached = await this.redis.get(progressKey(exportId));
    return cached
      ? (JSON.parse(cached) as {
          phase?: ExportPhase;
          processedRows?: number;
          totalRows?: number;
        })
      : {};
  }

  private buildJobView(
    row: typeof dataExport.$inferSelect,
    progress: { phase?: ExportPhase; processedRows?: number; totalRows?: number },
    filterSummary: string | undefined,
  ): ExportJobView {
    const view: ExportJobView = {
      id: row.id,
      entityType: row.entityType as ExportEntityType,
      format: row.format as ExportFormat,
      status: row.status as ExportStatus,
      progress: row.progress,
      filename: exportFilename(row.entityType, row.format as ExportFormat),
      createdAt: row.createdAt.toISOString(),
    };
    const processed = progress.processedRows ?? row.processedRows;
    const total = progress.totalRows ?? row.totalRows;
    const phase = progress.phase ?? row.phase;
    if (phase) view.phase = phase as ExportPhase;
    if (processed != null) view.processedRows = processed;
    if (total != null) view.totalRows = total;
    if (filterSummary) view.filterSummary = filterSummary;
    if (row.expiresAt) view.expiresAt = row.expiresAt.toISOString();
    if (row.errorMessage) view.errorMessage = row.errorMessage;
    if (row.completedAt) view.completedAt = row.completedAt.toISOString();
    return view;
  }
}

export { DATA_EXPORT_QUEUE_NAME };
