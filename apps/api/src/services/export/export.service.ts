import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { type ExportEntityType, type ExportFormat, exportFilename } from "@auction/exports";
import { AuthzError } from "@auction/exports/providers";
import { DATA_EXPORT_QUEUE_NAME } from "@auction/queues";
import type { CreateExportBody, ExportPreviewBody } from "@auction/validators";
import type { Queue } from "bullmq";
import type { ExportProvider } from "../../exports/types.js";
import type { IExportJobRepository } from "../../repositories/interfaces/export-job.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ExportFileStorage } from "./export-file-storage.js";
import { ExportJobViewMapper } from "./export-job-view.mapper.js";
import type { IExportProgressStore } from "./export-progress.store.js";
import { ExportRateLimitPolicy } from "./export-rate-limit.policy.js";
import {
  type ExportAuthContext,
  type ExportJobView,
  type ExportServiceConfig,
  filtersHash,
  isReusableExport,
} from "./export-types.js";
import { SyncExportRunner } from "./sync-export.runner.js";

export type { ExportJobView, ExportServiceConfig } from "./export-types.js";

export class ExportService {
  private readonly rateLimitPolicy: ExportRateLimitPolicy;
  private readonly jobViewMapper: ExportJobViewMapper;
  private readonly syncRunner: SyncExportRunner;

  constructor(
    private readonly db: Database,
    private readonly repo: IExportJobRepository,
    private readonly progressStore: IExportProgressStore,
    private readonly fileStorage: ExportFileStorage,
    private readonly dataExportQueue: Queue,
    private readonly providers: Map<ExportEntityType, ExportProvider>,
    private readonly config: ExportServiceConfig,
    private readonly domainEventPublisher?: DomainEventPublisher,
  ) {
    this.rateLimitPolicy = new ExportRateLimitPolicy(repo, config.staleProcessingMs);
    this.jobViewMapper = new ExportJobViewMapper(progressStore, providers);
    this.syncRunner = new SyncExportRunner(repo);
  }

  private provider(entityType: ExportEntityType): ExportProvider {
    const p = this.providers.get(entityType);
    if (!p) throw new AuthzError(`Unsupported export entity: ${entityType}`, 400);
    return p;
  }

  private authContext(
    userId: string,
    userRole: string,
    userStaffRole?: string | null,
  ): ExportAuthContext {
    return { userId, userRole, userStaffRole: userStaffRole ?? null };
  }

  async assertRateLimits(userId: string): Promise<void> {
    return this.rateLimitPolicy.assertWithinLimits(userId);
  }

  async createExport(input: {
    userId: string;
    userRole: string;
    userStaffRole?: string | null;
    body: CreateExportBody;
  }): Promise<
    | {
        mode: "sync";
        stream: ReturnType<SyncExportRunner["createCsvStream"]>;
        filename: string;
        contentType: string;
      }
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
    const existingRow = await this.repo.findLatestByUserAndHash(userId, hash);
    if (existingRow && isReusableExport(existingRow, this.config.staleProcessingMs)) {
      return { mode: "existing", job: await this.jobViewMapper.toJobView(existingRow) };
    }

    const totalRows = await provider.estimateCount(ctx, filters);
    const useAsync = body.forceAsync === true || totalRows > this.config.syncMaxRows;

    if (!useAsync) {
      const exportId = randomUUID();
      const now = new Date();
      await this.repo.insert({
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

      const stream = this.syncRunner.createCsvStream({
        provider,
        ctx,
        filters,
        exportId,
        totalRows,
        onFailed: (id, message) => this.markFailed(id, message),
      });
      return {
        mode: "sync",
        stream,
        filename: exportFilename(body.entityType, body.format),
        contentType: "text/csv; charset=utf-8",
      };
    }

    const exportId = randomUUID();
    const now = new Date();
    await this.repo.insert({
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

    const row = await this.repo.findById(exportId);
    if (!row) throw new Error("export_row_missing");
    return { mode: "async", job: await this.jobViewMapper.toJobView(row) };
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
    const row = await this.repo.findByIdForUser(exportId, userId);
    if (!row) return null;
    return this.jobViewMapper.toJobView(row);
  }

  async listExports(userId: string): Promise<ExportJobView[]> {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const rows = await this.repo.listRecentForUser(userId, since);
    return Promise.all(rows.map((r) => this.jobViewMapper.toJobListView(r)));
  }

  async cancelExport(userId: string, exportId: string): Promise<ExportJobView | null> {
    const row = await this.repo.findByIdForUser(exportId, userId);
    if (!row) return null;
    if (row.status !== "pending" && row.status !== "processing") {
      return this.jobViewMapper.toJobView(row);
    }

    await this.repo.markCancelled(exportId);
    const job = await this.dataExportQueue.getJob(exportId);
    if (job) await job.remove();
    await this.setProgress(exportId, { status: "cancelled", progress: 0 });

    const updated = await this.repo.findById(exportId);
    return updated ? this.jobViewMapper.toJobView(updated) : null;
  }

  async getDownloadUrl(
    userId: string,
    exportId: string,
  ): Promise<{ url: string; filename: string } | null> {
    const row = await this.repo.findByIdForUser(exportId, userId);
    if (!row || row.status !== "completed" || !row.s3Key) return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

    return this.fileStorage.createDownloadUrl({
      s3Key: row.s3Key,
      entityType: row.entityType as ExportEntityType,
      format: row.format as ExportFormat,
    });
  }

  async setProgress(
    exportId: string,
    snapshot: {
      status: import("@auction/exports").ExportStatus;
      phase?: import("@auction/exports").ExportPhase;
      progress: number;
      processedRows?: number;
      totalRows?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    await this.progressStore.set(exportId, snapshot);
    const patch: Parameters<IExportJobRepository["updateProgress"]>[1] = {
      status: snapshot.status,
      phase: snapshot.phase ?? null,
      progress: snapshot.progress,
      errorMessage: snapshot.errorMessage ?? null,
      ...(snapshot.status === "completed" ? { completedAt: new Date() } : {}),
    };
    if (snapshot.processedRows !== undefined) patch.processedRows = snapshot.processedRows;
    if (snapshot.totalRows !== undefined) patch.totalRows = snapshot.totalRows;
    await this.repo.updateProgress(exportId, patch);
  }

  async markCompleted(
    exportId: string,
    s3Key: string,
    fileSizeBytes: number,
    processedRows: number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.repo.markCompleted({ exportId, s3Key, fileSizeBytes, processedRows, expiresAt });
    await this.setProgress(exportId, {
      status: "completed",
      progress: 100,
      processedRows,
    });
  }

  async markFailed(exportId: string, message: string): Promise<void> {
    await this.repo.markFailed(exportId, message);
    await this.setProgress(exportId, { status: "failed", progress: 0, errorMessage: message });
  }

  async isCancelled(exportId: string): Promise<boolean> {
    const status = await this.repo.getStatus(exportId);
    return status === "cancelled";
  }

  getProvider(entityType: ExportEntityType): ExportProvider {
    return this.provider(entityType);
  }

  objectKey(exportId: string, format: ExportFormat): string {
    return this.fileStorage.objectKey(exportId, format);
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
}

export { DATA_EXPORT_QUEUE_NAME };
