import type { Database } from "@auction/db";
import { dataExport } from "@auction/db/schema";
import { and, eq, inArray, lt } from "drizzle-orm";
import type {
  DataExportJobRow,
  DataExportProgressSnapshot,
  IDataExportJobRepository,
} from "../interfaces/data-export.repository.js";

function mapRow(row: typeof dataExport.$inferSelect): DataExportJobRow {
  return {
    id: row.id,
    userId: row.userId,
    userRole: row.userRole,
    userStaffRole: row.userStaffRole,
    entityType: row.entityType,
    format: row.format,
    filters: row.filters,
    filtersHash: row.filtersHash,
    status: row.status,
    phase: row.phase,
    progress: row.progress,
    totalRows: row.totalRows,
    processedRows: row.processedRows,
    s3Key: row.s3Key,
    fileSizeBytes: row.fileSizeBytes,
    errorMessage: row.errorMessage,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
  };
}

export class DrizzleDataExportJobRepository implements IDataExportJobRepository {
  constructor(private readonly db: Database) {}

  async findById(exportId: string): Promise<DataExportJobRow | null> {
    const [row] = await this.db.select().from(dataExport).where(eq(dataExport.id, exportId));
    return row ? mapRow(row) : null;
  }

  async getStatus(exportId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ status: dataExport.status })
      .from(dataExport)
      .where(eq(dataExport.id, exportId));
    return row?.status ?? null;
  }

  async updateProgress(exportId: string, snapshot: DataExportProgressSnapshot): Promise<void> {
    await this.db
      .update(dataExport)
      .set({
        status: snapshot.status,
        phase: snapshot.phase ?? null,
        progress: snapshot.progress,
        processedRows: snapshot.processedRows ?? null,
        totalRows: snapshot.totalRows ?? null,
        errorMessage: snapshot.errorMessage ?? null,
      })
      .where(eq(dataExport.id, exportId));
  }

  async markCompleted(
    exportId: string,
    input: {
      processedRows: number;
      s3Key: string;
      fileSizeBytes: number;
      expiresAt: Date;
    },
  ): Promise<void> {
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
      .where(eq(dataExport.id, exportId));
  }

  async findStuckProcessing(staleCutoff: Date, limit: number): Promise<DataExportJobRow[]> {
    const rows = await this.db
      .select()
      .from(dataExport)
      .where(
        and(
          inArray(dataExport.status, ["pending", "processing"]),
          lt(dataExport.createdAt, staleCutoff),
        ),
      )
      .limit(limit);
    return rows.map(mapRow);
  }

  async markTimedOut(exportId: string): Promise<void> {
    await this.db
      .update(dataExport)
      .set({
        status: "failed",
        errorMessage: "Export timed out",
        phase: null,
      })
      .where(eq(dataExport.id, exportId));
  }

  async findExpired(now: Date, limit: number): Promise<DataExportJobRow[]> {
    const rows = await this.db
      .select()
      .from(dataExport)
      .where(lt(dataExport.expiresAt, now))
      .limit(limit);
    return rows.map(mapRow);
  }

  async findOlderThan(retentionCutoff: Date, limit: number): Promise<DataExportJobRow[]> {
    const rows = await this.db
      .select()
      .from(dataExport)
      .where(lt(dataExport.createdAt, retentionCutoff))
      .limit(limit);
    return rows.map(mapRow);
  }

  async deleteById(exportId: string): Promise<void> {
    await this.db.delete(dataExport).where(eq(dataExport.id, exportId));
  }
}
