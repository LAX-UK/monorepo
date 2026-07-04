import type { Database } from "@auction/db";
import { dataExport } from "@auction/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { ExportJobInsert, IExportJobRepository } from "../interfaces/export-job.repository.js";
import type { ExportPhase, ExportStatus } from "../lib/export-types.js";

export class DrizzleExportJobRepository implements IExportJobRepository {
  constructor(private readonly db: Database) {}

  async countActiveSince(userId: string, staleCutoff: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(dataExport)
      .where(
        and(
          eq(dataExport.userId, userId),
          inArray(dataExport.status, ["pending", "processing"]),
          gte(dataExport.createdAt, staleCutoff),
        ),
      );
    return row?.n ?? 0;
  }

  async countSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(dataExport)
      .where(and(eq(dataExport.userId, userId), gte(dataExport.createdAt, since)));
    return row?.n ?? 0;
  }

  async findLatestByUserAndHash(userId: string, filtersHash: string) {
    const [row] = await this.db
      .select()
      .from(dataExport)
      .where(and(eq(dataExport.userId, userId), eq(dataExport.filtersHash, filtersHash)))
      .orderBy(desc(dataExport.createdAt))
      .limit(1);
    return row ?? null;
  }

  async findById(exportId: string) {
    const [row] = await this.db.select().from(dataExport).where(eq(dataExport.id, exportId));
    return row ?? null;
  }

  async findByIdForUser(exportId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(dataExport)
      .where(and(eq(dataExport.id, exportId), eq(dataExport.userId, userId)));
    return row ?? null;
  }

  async listRecentForUser(userId: string, since: Date, limit = 50) {
    return this.db
      .select()
      .from(dataExport)
      .where(and(eq(dataExport.userId, userId), gte(dataExport.createdAt, since)))
      .orderBy(desc(dataExport.createdAt))
      .limit(limit);
  }

  async insert(row: ExportJobInsert): Promise<void> {
    await this.db.insert(dataExport).values(row);
  }

  async updateProgress(
    exportId: string,
    patch: {
      processedRows?: number;
      progress?: number;
      status?: ExportStatus;
      phase?: ExportPhase | null;
      errorMessage?: string | null;
      completedAt?: Date;
      totalRows?: number;
    },
  ) {
    await this.db.update(dataExport).set(patch).where(eq(dataExport.id, exportId));
  }

  async markCompleted(input: {
    exportId: string;
    processedRows: number;
    s3Key: string;
    fileSizeBytes: number;
    expiresAt: Date;
  }) {
    await this.db
      .update(dataExport)
      .set({
        status: "completed",
        phase: null,
        progress: 100,
        processedRows: input.processedRows,
        s3Key: input.s3Key,
        fileSizeBytes: input.fileSizeBytes,
        expiresAt: input.expiresAt,
        completedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(dataExport.id, input.exportId));
  }

  async markFailed(exportId: string, message: string): Promise<void> {
    await this.db
      .update(dataExport)
      .set({ status: "failed", errorMessage: message, phase: null })
      .where(eq(dataExport.id, exportId));
  }

  async markCancelled(exportId: string): Promise<void> {
    await this.db
      .update(dataExport)
      .set({ status: "cancelled", cancelledAt: new Date(), progress: 0 })
      .where(eq(dataExport.id, exportId));
  }

  async getStatus(exportId: string): Promise<ExportStatus | null> {
    const [row] = await this.db
      .select({ status: dataExport.status })
      .from(dataExport)
      .where(eq(dataExport.id, exportId));
    return (row?.status as ExportStatus | undefined) ?? null;
  }
}
