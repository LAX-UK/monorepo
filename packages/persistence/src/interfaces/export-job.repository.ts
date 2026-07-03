import type { ExportEntityType, ExportFormat, ExportPhase, ExportStatus } from "@auction/exports";
import type { ExportJobRow } from "../lib/export-job.types.js";

export type ExportJobInsert = {
  id: string;
  userId: string;
  userRole: string;
  userStaffRole: string | null;
  entityType: ExportEntityType;
  format: ExportFormat;
  filters: Record<string, unknown>;
  filtersHash: string;
  status: ExportStatus;
  phase: ExportPhase | null;
  progress: number;
  totalRows: number;
  processedRows: number;
  createdAt: Date;
};

export interface IExportJobRepository {
  countActiveSince(userId: string, staleCutoff: Date): Promise<number>;
  countSince(userId: string, since: Date): Promise<number>;
  findLatestByUserAndHash(userId: string, filtersHash: string): Promise<ExportJobRow | null>;
  findById(exportId: string): Promise<ExportJobRow | null>;
  findByIdForUser(exportId: string, userId: string): Promise<ExportJobRow | null>;
  listRecentForUser(userId: string, since: Date, limit?: number): Promise<ExportJobRow[]>;
  insert(row: ExportJobInsert): Promise<void>;
  updateProgress(
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
  ): Promise<void>;
  markCompleted(input: {
    exportId: string;
    processedRows: number;
    s3Key: string;
    fileSizeBytes: number;
    expiresAt: Date;
  }): Promise<void>;
  markFailed(exportId: string, message: string): Promise<void>;
  markCancelled(exportId: string): Promise<void>;
  getStatus(exportId: string): Promise<ExportStatus | null>;
}
