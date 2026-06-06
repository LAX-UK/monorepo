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
