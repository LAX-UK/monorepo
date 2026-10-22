import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import {
  productionAssigneeName,
  productionHistorySummary,
} from "@/server/domain/production-queue.vm";
import type { AdminProductionTaskHistoryEntry } from "@auction/shop-contracts";

/** Every change to a task, oldest first, with who made it. */
export function ProductionHistory({ history }: { history: AdminProductionTaskHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-on-surface-variant">No changes have been recorded yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {history.map((entry) => (
        <li
          key={entry.id}
          className="rounded-lg border border-border-hairline bg-surface-container-lowest p-4"
        >
          <p className="text-sm text-on-surface">{productionHistorySummary(entry)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {productionAssigneeName(entry.actor)} ·{" "}
            <time dateTime={entry.at}>{formatAdminDetailDateTime(entry.at)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
