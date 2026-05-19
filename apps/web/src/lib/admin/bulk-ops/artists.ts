import type { BulkOperation } from "@/components/admin/bulk-actions-toolbar";

export function getArtistBulkOperations(): BulkOperation[] {
  return [
    {
      id: "copy-ids",
      label: "Copy IDs",
      run: async (ids) => {
        if (ids.length === 0) return { ok: true as const };
        await navigator.clipboard.writeText(ids.join("\n"));
        return { ok: true as const };
      },
    },
  ];
}
