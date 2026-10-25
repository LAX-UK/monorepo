"use client";

import { notifyOrphanDraftSales } from "@/lib/admin/bulk-ops/orphan-draft-sale-notify";
import type { BulkOperation, BulkOperationRunOptions } from "@/lib/admin/bulk-ops/types";
import { handleBulkActionResult } from "@/lib/admin/catalog-bulk-result-handler";
import { notify } from "@/lib/ui/notify";
import { ConfirmActionDialog, StaffButton } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * A list's bulk operations as buttons in the staff bulk-action bar. Each operation keeps its own
 * safeguard through the kit confirm: a plain confirmation, a reason kept in the audit log, or the
 * typed phrase for destructive ones. Results report through the usual toasts, and partial
 * failures keep the failed rows selected.
 */
export function StaffBulkOperations({
  operations,
  selectedIds,
  onClear,
  noun,
}: {
  operations: readonly BulkOperation[];
  selectedIds: string[];
  onClear: () => void;
  noun: { one: string; other: string };
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pending, setPending] = useState<BulkOperation | null>(null);
  const count = selectedIds.length;
  const label = `${count} ${count === 1 ? noun.one : noun.other}`;

  const execute = (operation: BulkOperation, options?: BulkOperationRunOptions) => {
    startTransition(async () => {
      const result = await operation.run(selectedIds, options);
      const handled = handleBulkActionResult({
        operationLabel: operation.label,
        result,
        onPartialClear: onClear,
        refresh: () => router.refresh(),
      });
      if (handled.variant === "error") notify.error(handled.message);
      else if (handled.variant === "warning") notify.warning(handled.message);
      else notify.success(handled.message);
      if (result.ok) notifyOrphanDraftSales(router, result.data);
      if (handled.shouldClear) onClear();
      if (handled.shouldRefresh) router.refresh();
      setPending(null);
    });
  };

  const start = (operation: BulkOperation) => {
    if (operation.typedConfirm || operation.reasonPrompt || operation.confirm) {
      setPending(operation);
    } else {
      execute(operation);
    }
  };

  const ordered = [...operations].sort((a, b) => Number(a.destructive) - Number(b.destructive));
  const op = pending;
  const phrase = op?.typedConfirm?.confirmationPhrase(count);

  return (
    <>
      {ordered.map((operation) => (
        <StaffButton
          key={operation.id}
          size="sm"
          variant="ghost"
          loading={busy && op?.id === operation.id}
          className={operation.destructive ? "text-staff-danger" : undefined}
          onClick={() => start(operation)}
        >
          {operation.label}
        </StaffButton>
      ))}
      {op ? (
        <ConfirmActionDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null);
          }}
          title={op.typedConfirm?.title ?? op.reasonPrompt?.title ?? `${op.label} ${label}?`}
          description={
            op.typedConfirm?.description ?? op.reasonPrompt?.description ?? op.confirm ?? ""
          }
          confirmLabel={op.typedConfirm?.actionLabel ?? op.reasonPrompt?.actionLabel ?? op.label}
          tone={op.destructive ? "danger" : "default"}
          loading={busy}
          {...(op.reasonPrompt
            ? {
                reason: {
                  label: op.reasonPrompt.fieldLabel,
                  placeholder: op.reasonPrompt.placeholder,
                  ...(op.reasonPrompt.minLength ? { minLength: op.reasonPrompt.minLength } : {}),
                },
              }
            : {})}
          {...(phrase !== undefined ? { typedConfirmation: phrase } : {})}
          onConfirm={({ reason }) => {
            if (phrase !== undefined) execute(op, { confirmationPhrase: phrase });
            else if (op.reasonPrompt) execute(op, { reason });
            else execute(op);
          }}
        />
      ) : null}
    </>
  );
}
