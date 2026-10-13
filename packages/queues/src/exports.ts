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
  country?: string | null;
  region?: string | null;
  city?: string | null;
};

export const LEGAL_ENTITY_ARCHIVE_JOB_NAME = "cascade" as const;

export type LegalEntityArchiveJobName = typeof LEGAL_ENTITY_ARCHIVE_JOB_NAME;

export type LegalEntityArchiveJobData = {
  legalEntityId: string;
};

export const ATG_SYNC_JOB_NAMES = {
  pushSale: "atg.push-sale",
  publishSale: "atg.publish-sale",
  closeSale: "atg.close-sale",
  deleteLot: "atg.delete-lot",
  tick: "atg.tick",
} as const;

export type AtgSyncJob =
  | { name: typeof ATG_SYNC_JOB_NAMES.pushSale; data: { saleId: string } }
  | { name: typeof ATG_SYNC_JOB_NAMES.publishSale; data: { saleId: string } }
  | { name: typeof ATG_SYNC_JOB_NAMES.closeSale; data: { saleId: string } }
  | { name: typeof ATG_SYNC_JOB_NAMES.deleteLot; data: { lotId: string } }
  | { name: typeof ATG_SYNC_JOB_NAMES.tick; data: Record<string, never> };

export type AtgSyncJobName = AtgSyncJob["name"];

/**
 * One in-flight job per target: a second click while queued is a no-op. BullMQ rejects custom
 * ids containing `:`, so the separator is `__`.
 */
export function atgSyncJobId(job: Exclude<AtgSyncJob, { name: "atg.tick" }>): string {
  const target = "saleId" in job.data ? job.data.saleId : job.data.lotId;
  return `${job.name}__${target}`;
}
