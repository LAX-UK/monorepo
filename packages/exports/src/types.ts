export const EXPORT_FORMATS = ["csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_ENTITY_TYPES = [
  "lots",
  "sales",
  "submissions",
  "clients",
  "payments",
  "domain-events",
  "payouts",
  "analytics",
] as const;

/** In-flight exports older than this are not deduped and may be marked failed by purge job. */
export const DEFAULT_EXPORT_STALE_PROCESSING_MS = 1_800_000;
export type ExportEntityType = (typeof EXPORT_ENTITY_TYPES)[number];

export const EXPORT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

export const EXPORT_PHASES = ["counting", "fetching", "writing", "uploading"] as const;
export type ExportPhase = (typeof EXPORT_PHASES)[number];

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
