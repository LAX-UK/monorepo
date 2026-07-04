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
