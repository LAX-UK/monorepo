import { XERO_SYNC_STATUS_LABELS, type XeroSyncStatus } from "./xero-sync-status.copy";

export type { XeroSyncStatus };

/** Staff-facing labels for Xero invoice sync status on payments. */
export function xeroSyncStatusLabel(status: XeroSyncStatus | string | null | undefined): string {
  if (!status) return "—";
  const known = XERO_SYNC_STATUS_LABELS[status as XeroSyncStatus];
  if (known) return known;
  const words = status.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
