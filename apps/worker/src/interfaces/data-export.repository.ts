export type DataExportJobRow = {
  id: string;
  userId: string;
  userRole: string;
  userStaffRole: string | null;
  entityType: string;
  format: string;
  filters: unknown;
  filtersHash: string;
  status: string;
  phase: string | null;
  progress: number;
  totalRows: number | null;
  processedRows: number | null;
  s3Key: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

export type DataExportProgressSnapshot = {
  status: string;
  phase?: string;
  progress: number;
  processedRows?: number;
  totalRows?: number;
  errorMessage?: string;
};

export interface IDataExportJobRepository {
  findById(exportId: string): Promise<DataExportJobRow | null>;
  getStatus(exportId: string): Promise<string | null>;
  updateProgress(exportId: string, snapshot: DataExportProgressSnapshot): Promise<void>;
  markCompleted(
    exportId: string,
    input: {
      processedRows: number;
      s3Key: string;
      fileSizeBytes: number;
      expiresAt: Date;
    },
  ): Promise<void>;
  findStuckProcessing(staleCutoff: Date, limit: number): Promise<DataExportJobRow[]>;
  markTimedOut(exportId: string): Promise<void>;
  findExpired(now: Date, limit: number): Promise<DataExportJobRow[]>;
  findOlderThan(retentionCutoff: Date, limit: number): Promise<DataExportJobRow[]>;
  deleteById(exportId: string): Promise<void>;
}
