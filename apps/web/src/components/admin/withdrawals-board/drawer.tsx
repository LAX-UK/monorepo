"use client";

import { WithdrawalApproveButton } from "@/components/admin/withdrawal-approve-button";
import type { LotWithdrawalRequestTask } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import Link from "next/link";

export function WithdrawalDrawerContent({ task }: { task: LotWithdrawalRequestTask }) {
  return (
    <div className="space-y-4">
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {task.kind.replaceAll("_", " ")}
      </p>
      {task.targetLotId ? (
        <Link
          href={`/admin/lots/${task.targetLotId}`}
          className="font-medium text-primary hover:underline"
        >
          Lot {task.targetLotId} ↗
        </Link>
      ) : (
        <p className="text-sm text-on-surface-variant">No lot ID</p>
      )}
      <p className="text-xs text-on-surface-variant">Submitted {formatDateTime(task.createdAt)}</p>
      {Object.keys(task.payload).length > 0 ? (
        <pre className="overflow-auto rounded bg-surface-container-high p-2 font-mono text-xs">
          {JSON.stringify(task.payload, null, 2)}
        </pre>
      ) : null}
      {task.targetLotId ? <WithdrawalApproveButton lotId={task.targetLotId} /> : null}
    </div>
  );
}
