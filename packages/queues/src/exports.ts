import type { ExportEntityType, ExportFormat } from "@auction/exports";

export type DataExportJobPayload = {
  exportId: string;
  userId: string;
  entityType: ExportEntityType;
  format: ExportFormat;
  filters: Record<string, unknown>;
};

/** @deprecated Use DataExportJobPayload */
export type ExportJobPayload = DataExportJobPayload;
