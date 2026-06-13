import type { ExportEntityType, ExportFormat } from "@auction/exports";

export type DataExportJobPayload = {
  exportId: string;
  userId: string;
  entityType: ExportEntityType;
  format: ExportFormat;
  filters: Record<string, unknown>;
};

export type QrCodeScanJobPayload = {
  qrCodeId: string;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  requestId?: string | null;
};

export const LEGAL_ENTITY_ARCHIVE_JOB_NAME = "cascade" as const;

export type LegalEntityArchiveJobName = typeof LEGAL_ENTITY_ARCHIVE_JOB_NAME;

export type LegalEntityArchiveJobData = {
  legalEntityId: string;
};
