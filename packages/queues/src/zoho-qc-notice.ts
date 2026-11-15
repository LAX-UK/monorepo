import { createHash } from "node:crypto";

/**
 * Notices from Zoho that a printing or framing job's quality check record changed. The API stores
 * each as an inbound webhook event under this source; the worker reads the record itself, so the
 * notice only says which record, and when it changed.
 */
export const ZOHO_QC_WEBHOOK_SOURCE = "zoho_qc" as const;

/** The Zoho modules whose records carry a job's quality check status. */
export const ZOHO_QC_MODULES = ["Framing_Jobs"] as const;
export type ZohoQcModule = (typeof ZOHO_QC_MODULES)[number];

export type ZohoQcNoticeRouting = {
  module: ZohoQcModule;
  recordId: string;
  /** Zoho's modified time for the change, ISO 8601, when the workflow sent it. */
  modifiedTime?: string;
};

const MINUTE_MS = 60_000;

/**
 * The key a notice is stored (and queued) under: the same record at the same modified time is one
 * notice, so Zoho retrying a delivery stores it once. Without a modified time, notices for a
 * record in the same minute count as one; the worker reads the record as it is then.
 */
export function zohoQcNoticeEventKey(routing: ZohoQcNoticeRouting, receivedAt: Date): string {
  const when =
    routing.modifiedTime ?? `received-${Math.floor(receivedAt.getTime() / MINUTE_MS) * MINUTE_MS}`;
  const digest = createHash("sha256")
    .update(`${routing.module}|${routing.recordId}|${when}`)
    .digest("hex");
  return `zoho-qc-${digest.slice(0, 40)}`;
}
