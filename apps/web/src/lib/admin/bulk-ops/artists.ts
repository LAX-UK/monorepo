import type { BulkOperation } from "@/lib/admin/bulk-ops/types";

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
