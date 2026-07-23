import { adminBulkLotsResultAction } from "@/lib/actions/admin";
import type { BulkOperation } from "@/lib/admin/bulk-ops/types";
import { bulkLotDeleteConfirmationPhrase } from "@auction/validators";

export function getLotBulkOperations(canManageAuction: boolean): BulkOperation[] {
  const ops: BulkOperation[] = [
    {
      id: "publish",
      label: "Publish",
      run: (ids) => adminBulkLotsResultAction({ ids, op: "publish" }),
    },
  ];
  if (canManageAuction) {
    ops.push(
      {
        id: "cancel",
        label: "Cancel",
        destructive: true,
        confirm: "Cancel the selected lots? This changes their auction status.",
        run: (ids) => adminBulkLotsResultAction({ ids, op: "cancel" }),
      },
      {
        id: "delete-drafts",
        label: "Delete drafts",
        destructive: true,
        typedConfirm: {
          title: "Delete selected draft lots?",
          description:
            "Lots are removed from the catalogue. Data is retained for audit. Ineligible lots in the selection will be skipped.",
          actionLabel: "Delete lots",
          confirmationPhrase: bulkLotDeleteConfirmationPhrase,
        },
        run: (ids, opts) =>
          adminBulkLotsResultAction({
            ids,
            op: "soft_delete",
            confirmationPhrase: opts?.confirmationPhrase ?? "",
          }),
      },
    );
  }
  return ops;
}
