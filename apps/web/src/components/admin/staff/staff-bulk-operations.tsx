"use client";

import { notifyOrphanDraftSales } from "@/lib/admin/bulk-ops/orphan-draft-sale-notify";
import type { BulkOperation, BulkOperationRunOptions } from "@/lib/admin/bulk-ops/types";
import { handleBulkActionResult } from "@/lib/admin/catalog-bulk-result-handler";
import { notify } from "@/lib/ui/notify";
import { ConfirmActionDialog, Field, StaffButton, TextArea, TextInput } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Pending =
  | { kind: "confirm"; operation: BulkOperation }
  | { kind: "typed"; operation: BulkOperation }
  | { kind: "reason"; operation: BulkOperation }
  | null;

/**
 * A list's bulk operations as buttons in the staff bulk-action bar. Each operation keeps its own
 * safeguard: a confirmation, a typed phrase for destructive ones, or a reason. Results report
 * through the usual toasts, and partial failures keep the failed rows selected.
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
  const [pending, setPending] = useState<Pending>(null);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
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
    setTyped("");
    setReason("");
    if (operation.typedConfirm) setPending({ kind: "typed", operation });
    else if (operation.reasonPrompt) setPending({ kind: "reason", operation });
    else if (operation.confirm) setPending({ kind: "confirm", operation });
    else execute(operation);
  };

  const ordered = [...operations].sort((a, b) => Number(a.destructive) - Number(b.destructive));
  const op = pending?.operation;
  const phrase = op?.typedConfirm?.confirmationPhrase(count) ?? "";
  const minReason = op?.reasonPrompt?.minLength ?? 1;

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
            if (!open) setPending(null);
          }}
          title={op.typedConfirm?.title ?? op.reasonPrompt?.title ?? `${op.label} ${label}?`}
          description={
            op.typedConfirm?.description ?? op.reasonPrompt?.description ?? op.confirm ?? ""
          }
          confirmLabel={op.typedConfirm?.actionLabel ?? op.reasonPrompt?.actionLabel ?? op.label}
          tone={op.destructive ? "danger" : "default"}
          loading={busy}
          onConfirm={() => {
            if (pending?.kind === "typed") {
              if (typed.trim() !== phrase) return;
              execute(op, { confirmationPhrase: typed.trim() });
            } else if (pending?.kind === "reason") {
              if (reason.trim().length < minReason) return;
              execute(op, { reason: reason.trim() });
            } else {
              execute(op);
            }
          }}
        >
          {pending?.kind === "typed" ? (
            <Field
              label={`Type “${phrase}” to confirm`}
              error={typed && typed.trim() !== phrase ? "The text does not match yet." : null}
            >
              <TextInput
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoFocus
              />
            </Field>
          ) : null}
          {pending?.kind === "reason" && op.reasonPrompt ? (
            <Field label={op.reasonPrompt.fieldLabel}>
              <TextArea
                value={reason}
                placeholder={op.reasonPrompt.placeholder}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          ) : null}
        </ConfirmActionDialog>
      ) : null}
    </>
  );
}
