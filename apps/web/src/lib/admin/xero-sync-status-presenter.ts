/** Staff-facing labels for Xero invoice sync status on payments. */
export function xeroSyncStatusLabel(
  status: "pending_sync" | "synced" | "error" | string | null | undefined,
): string {
  switch (status) {
    case "pending_sync":
      return "Pending sync";
    case "synced":
      return "Synced";
    case "error":
      return "Sync error";
    default:
      return status ? status.replaceAll("_", " ") : "—";
  }
}
