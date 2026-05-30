import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import {
  adminCancelSaleResultAction,
  adminPublishSaleResultAction,
} from "@/lib/actions/admin-sales";
import { toSequentialBulkResult } from "@/lib/admin/catalog-bulk-result-handler";
import { actionFailure, actionSuccess } from "@/lib/forms/form-result";
import type { SaleStatus } from "@auction/types";

type SaleRowForPreflight = {
  saleId: string;
  status: SaleStatus;
};

/** Client-side hint before bulk cancel when selection includes live or scheduled sales. */
export function bulkCancelPreflightWarning(
  selectedIds: readonly string[],
  rows: readonly SaleRowForPreflight[],
): string | null {
  if (selectedIds.length === 0) return null;
  const selected = new Set(selectedIds);
  let liveish = 0;
  for (const row of rows) {
    if (!selected.has(row.saleId)) continue;
    if (row.status === "active" || row.status === "scheduled") liveish++;
  }
  if (liveish === 0) return null;
  return liveish === 1
    ? "1 selected sale is live or scheduled — approved registrations may need review after cancel."
    : `${liveish} selected sales are live or scheduled — approved registrations may need review after cancel.`;
}

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
  const bulk = toSequentialBulkResult(ids, failures);
  if (failures.length > 0) {
    return actionFailure(
      `${label} failed for ${failures.length} of ${ids.length} sale(s). Refresh and retry.`,
      undefined,
      undefined,
      undefined,
      { sequential: bulk },
    );
  }
  return actionSuccess(bulk);
}

export function getSaleBulkOperations(canManageSales: boolean): BulkOperation[] {
  const ops: BulkOperation[] = [
    {
      id: "copy-ids",
      label: "Copy IDs",
      run: async (ids) => {
        if (ids.length === 0) return actionSuccess();
        await navigator.clipboard.writeText(ids.join("\n"));
        return actionSuccess();
      },
    },
  ];
  if (canManageSales) {
    ops.push(
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
        confirm:
          "Cancel selected sales? Live or scheduled sales will be cancelled. Registrations may need review.",
        run: (ids) => runSequential(ids, (id) => adminCancelSaleResultAction(id), "Cancel"),
      },
    );
  }
  return ops;
}
