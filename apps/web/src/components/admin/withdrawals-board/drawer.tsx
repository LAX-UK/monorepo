"use client";

import { AdminJsonDisclosure } from "@/components/admin/admin-json-disclosure";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { WithdrawalApproveButton } from "@/components/admin/withdrawal-approve-button";
import type { LotWithdrawalRequestTask } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import Link from "next/link";

function humanizeKind(kind: string): string {
  return kind.replaceAll("_", " ");
}

export function WithdrawalDrawerContent({ task }: { task: LotWithdrawalRequestTask }) {
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Request type</dt>
          <dd className="font-medium">{humanizeKind(task.kind)}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Status</dt>
          <dd>{task.status.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Lot</dt>
          <dd>
            {task.targetLotId ? (
              <Link
                href={`/admin/lots/${task.targetLotId}`}
                className="font-medium text-link hover:underline"
              >
                View lot
              </Link>
            ) : (
              <span className="text-on-surface-variant">No lot linked</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Submitted</dt>
          <dd>{formatDateTime(task.createdAt)}</dd>
        </div>
      </dl>

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Request ID", value: task.id },
          { label: "Lot ID", value: task.targetLotId },
        ]}
      />

      <AdminJsonDisclosure label="Request payload" value={task.payload} />

      {task.targetLotId ? <WithdrawalApproveButton lotId={task.targetLotId} /> : null}
    </div>
  );
}
