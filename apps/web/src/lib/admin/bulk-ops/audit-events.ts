import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";
import { actionSuccess } from "@/lib/forms/form-result";

export function getAuditEventBulkOperations(): BulkOperation[] {
  return [
    {
      id: "copy-ids",
      label: "Copy event IDs",
      run: async (ids) => {
        if (ids.length === 0) return actionSuccess();
        await navigator.clipboard.writeText(ids.join("\n"));
        return actionSuccess();
      },
    },
  ];
}
