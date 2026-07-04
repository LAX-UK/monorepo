import type {
  ExportEntityType,
  ExportFormat,
  ExportPhase,
  ExportStatus,
} from "@auction/persistence/lib";

export {
  EXPORT_ENTITY_TYPES,
  EXPORT_FORMATS,
  EXPORT_PHASES,
  EXPORT_STATUSES,
  type ExportEntityType,
  type ExportFormat,
  type ExportPhase,
  type ExportStatus,
} from "@auction/persistence/lib";

/** In-flight exports older than this are not deduped and may be marked failed by purge job. */
export const DEFAULT_EXPORT_STALE_PROCESSING_MS = 1_800_000;

export type ExportColumn = {
  key: string;
  header: string;
};

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

export type ExportJobPayload = {
  exportId: string;
  userId: string;
  entityType: ExportEntityType;
  format: ExportFormat;
  filters: Record<string, unknown>;
};

export type ExportProgressSnapshot = {
  status: ExportStatus;
  phase?: ExportPhase;
  progress: number;
  processedRows?: number;
  totalRows?: number;
  estimatedSecondsRemaining?: number;
  errorMessage?: string;
};
