import type { ExportEntityType, ExportFormat, ExportPhase, ExportStatus } from "@auction/exports";

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

export type CreateExportRequest = {
  entityType: ExportEntityType;
  format?: ExportFormat;
  filters?: Record<string, unknown>;
  forceAsync?: boolean;
  idempotencyKey?: string;
};

export type CreateExportResponse =
  | { mode: "sync"; blob: Blob; filename: string }
  | { mode: "async" | "existing"; job: ExportJobView };
