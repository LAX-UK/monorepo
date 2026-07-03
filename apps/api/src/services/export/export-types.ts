import { createHash } from "node:crypto";
import type { ExportEntityType, ExportFormat, ExportPhase, ExportStatus } from "@auction/exports";
import type { ExportJobRow } from "@auction/persistence";

export type { ExportJobRow } from "@auction/persistence";

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

export type ExportProgressSnapshot = {
  status: ExportStatus;
  phase?: ExportPhase;
  progress: number;
  processedRows?: number;
  totalRows?: number;
  errorMessage?: string;
};

export type ExportAuthContext = {
  userId: string;
  userRole: string;
  userStaffRole: string | null;
};

export function filtersHash(
  entityType: string,
  format: string,
  filters: Record<string, unknown>,
): string {
  return createHash("sha256").update(JSON.stringify({ entityType, format, filters })).digest("hex");
}

export function exportObjectKey(exportId: string, format: ExportFormat): string {
  return `exports/${exportId}.${format}`;
}

export function progressKey(exportId: string): string {
  return `export:progress:${exportId}`;
}

export function utcDayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function isReusableExport(row: ExportJobRow, staleProcessingMs: number): boolean {
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
