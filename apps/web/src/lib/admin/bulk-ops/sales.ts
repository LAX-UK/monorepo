import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import {
  adminCancelSaleResultAction,
  adminPublishSaleResultAction,
} from "@/lib/actions/admin-sales";
import { actionFailure, actionSuccess } from "@/lib/forms/form-result";

async function runSequential(
  ids: string[],
  op: (id: string) => Promise<{ ok: boolean }>,
  label: string,
) {
  const failures: string[] = [];
  for (const id of ids) {
    const result = await op(id);
    if (!result.ok) failures.push(id);
  }
  if (failures.length > 0) {
    return actionFailure(
      `${label} failed for ${failures.length} of ${ids.length} sale(s). Refresh and retry.`,
    );
  }
  return actionSuccess();
}

export function getSaleBulkOperations(): BulkOperation[] {
  return [
    {
      id: "copy-ids",
      label: "Copy IDs",
      run: async (ids) => {
        if (ids.length === 0) return actionSuccess();
        await navigator.clipboard.writeText(ids.join("\n"));
        return actionSuccess();
      },
    },
    {
      id: "publish",
      label: "Publish",
      confirm: "Publish all selected draft sales?",
      run: (ids) => runSequential(ids, (id) => adminPublishSaleResultAction(id), "Publish"),
    },
    {
      id: "cancel",
      label: "Cancel",
      destructive: true,
      confirm: "Cancel selected sales? Live or scheduled sales will be cancelled.",
      run: (ids) => runSequential(ids, (id) => adminCancelSaleResultAction(id), "Cancel"),
    },
  ];
}
