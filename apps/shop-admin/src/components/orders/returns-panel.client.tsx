"use client";

import { ReceiveReturnDialog } from "@/components/orders/receive-return-dialog.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { markReturnInTransit } from "@/server/application/admin-operations-actions.server";
import {
  RETURN_ACTION_LABELS,
  RETURN_STEPS,
  type ReturnRowView,
} from "@/server/domain/order-returns.vm";
import {
  MappedStatusBadge,
  Section,
  StaffButton,
  StatusBadge,
  StepIndicator,
} from "@auction/staff-ui";
import { PackageCheck, Truck } from "@auction/staff-ui/icons";
import { useState } from "react";

/**
 * The prints coming back after a cancellation, each on its way: requested, in transit, received.
 * Stock changes only on receipt, when staff choose whether the print goes back on sale or is
 * withdrawn as damaged. A refund never decides that.
 */
export function ReturnsPanel({
  rows,
  canWrite,
}: {
  rows: readonly ReturnRowView[];
  /** Whether this person may move a return along. */
  canWrite: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <Section
      title="Returns"
      description="Prints coming back to the gallery after a cancellation"
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-staff-line-subtle">
        {rows.map((row) => (
          <ReturnRow key={row.returnId} row={row} canWrite={canWrite} />
        ))}
      </ul>
    </Section>
  );
}

function ReturnRow({ row, canWrite }: { row: ReturnRowView; canWrite: boolean }) {
  const action = useAdminAction();
  const [receiving, setReceiving] = useState(false);
  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-staff-sm font-medium text-staff-fg">{row.item}</p>
          <p className="text-staff-xs text-staff-muted">{row.context}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {row.outcome ? (
            <StatusBadge tone={row.outcome.tone}>{row.outcome.label}</StatusBadge>
          ) : row.step === null ? (
            <MappedStatusBadge status={row.status} present={() => row.statusLabel} />
          ) : null}
          {canWrite && row.action === "mark_in_transit" ? (
            <StaffButton
              size="sm"
              variant="secondary"
              requires="fulfilment.write"
              icon={<Truck aria-hidden />}
              loading={action.pending}
              aria-label={`${RETURN_ACTION_LABELS.mark_in_transit}: ${row.item}`}
              onClick={() =>
                action.run(
                  () =>
                    markReturnInTransit({
                      returnId: row.returnId,
                      idempotencyKey: action.idempotencyKey,
                    }),
                  "Return marked in transit",
                )
              }
            >
              {RETURN_ACTION_LABELS.mark_in_transit}
            </StaffButton>
          ) : null}
          {canWrite && row.action === "receive" ? (
            <StaffButton
              size="sm"
              variant="secondary"
              requires="fulfilment.write"
              icon={<PackageCheck aria-hidden />}
              aria-label={`${RETURN_ACTION_LABELS.receive.replace("…", "")}: ${row.item}`}
              onClick={() => setReceiving(true)}
            >
              {RETURN_ACTION_LABELS.receive}
            </StaffButton>
          ) : null}
        </div>
      </div>
      {row.step !== null ? (
        <StepIndicator
          steps={RETURN_STEPS}
          currentIndex={row.step}
          label={`Progress of the return of ${row.item}`}
        />
      ) : null}
      {action.error}
      {receiving ? (
        <ReceiveReturnDialog row={row} open={receiving} onOpenChange={setReceiving} />
      ) : null}
    </li>
  );
}
