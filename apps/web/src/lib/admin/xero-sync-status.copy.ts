export type XeroSyncStatus = "pending_sync" | "synced" | "error";

/** Every Xero sync status as staff read it. A new status fails to compile until it is here. */
export const XERO_SYNC_STATUS_LABELS: Record<XeroSyncStatus, string> = {
  pending_sync: "Pending sync",
  synced: "Synced",
  error: "Sync error",
};
