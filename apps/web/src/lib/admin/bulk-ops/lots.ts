import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { adminBulkLotsResultAction } from "@/lib/actions/admin";

export function getLotBulkOperations(canManageAuction: boolean): BulkOperation[] {
  const ops: BulkOperation[] = [
    {
      id: "publish",
      label: "Publish",
      run: (ids) => adminBulkLotsResultAction({ ids, op: "publish" }),
    },
  ];
  if (canManageAuction) {
    ops.push({
      id: "cancel",
      label: "Cancel",
      destructive: true,
      confirm: "Cancel the selected lots? This changes their auction status.",
      run: (ids) => adminBulkLotsResultAction({ ids, op: "cancel" }),
    });
  }
  return ops;
}
