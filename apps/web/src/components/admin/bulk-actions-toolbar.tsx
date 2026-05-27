"use client";

import {
  type BulkLotsActionResult,
  bulkLotsFailureMessage,
  bulkLotsHasConnectRequired,
  bulkLotsHasUseSalePublish,
  bulkLotsPartialSuccessMessage,
} from "@/lib/admin/bulk-ops/lot-bulk-result";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type BulkOperation = {
  id: string;
  label: string;
  confirm?: string;
  destructive?: boolean;
  run(ids: string[]): Promise<ActionResult<unknown>>;
};

function isBulkLotsResult(data: unknown): data is BulkLotsActionResult {
  if (!data || typeof data !== "object") return false;
  const row = data as Record<string, unknown>;
  return typeof row.attempted === "number" && typeof row.failed === "number";
}

type Props = {
  selectedIds: string[];
  operations: BulkOperation[];
  onClear: () => void;
  /** Shown above actions when bulk publish may fail (connect / draft-sale lots). */
  preflightWarning?: string | null;
};

export function BulkActionsToolbar({
  selectedIds,
  operations,
  onClear,
  preflightWarning = null,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmOp, setConfirmOp] = useState<BulkOperation | null>(null);
  const router = useRouter();
  if (selectedIds.length === 0) return null;

  const execute = (operation: BulkOperation) => {
    startTransition(() => {
      void (async () => {
        const result = await operation.run(selectedIds);
        if (!result.ok) {
          const bulkMeta = result.meta?.bulk;
          if (isBulkLotsResult(bulkMeta) && bulkLotsHasConnectRequired(bulkMeta)) {
            notify.error(bulkLotsFailureMessage(bulkMeta));
          } else if (isBulkLotsResult(bulkMeta) && bulkLotsHasUseSalePublish(bulkMeta)) {
            notify.error(bulkLotsFailureMessage(bulkMeta));
          } else {
            notify.error(result.error);
          }
          if (isBulkLotsResult(bulkMeta) && bulkMeta.succeeded > 0) {
            onClear();
            router.refresh();
          }
          return;
        }
        const bulk = isBulkLotsResult(result.data) ? result.data : null;
        if (bulk && bulk.failed > 0) {
          notify.warning(bulkLotsPartialSuccessMessage(operation.label, bulk));
        } else {
          notify.success(`${operation.label} complete`);
        }
        onClear();
        router.refresh();
      })();
    });
  };

  const run = (operation: BulkOperation) => {
    if (operation.confirm) {
      setConfirmOp(operation);
      return;
    }
    execute(operation);
  };

  return (
    <>
      <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 space-y-2 rounded-xl border border-border-hairline bg-surface-container-lowest/95 p-3 shadow-2xl backdrop-blur-sm lg:static lg:rounded-lg lg:shadow-sm">
        {preflightWarning ? (
          <Alert
            variant="default"
            className="border-outline-variant/40 bg-surface-container-high/40"
          >
            <AlertDescription className="text-pretty font-body text-xs text-on-surface-variant">
              {preflightWarning}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            {selectedIds.length} selected
          </p>
          <div className="flex flex-wrap gap-2">
            {operations.map((operation) => (
              <Button
                key={operation.id}
                type="button"
                variant={operation.destructive ? "destructive" : "secondary"}
                disabled={pending}
                onClick={() => run(operation)}
                className="min-h-10"
              >
                {operation.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={onClear}
              className="min-h-10"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOp !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmOp(null);
        }}
        title={confirmOp?.label ?? "Confirm"}
        body={confirmOp?.confirm ?? "Continue with this action?"}
        confirmLabel={confirmOp?.label ?? "Confirm"}
        tone={confirmOp?.destructive ? "danger" : "warning"}
        loading={pending}
        onConfirm={() => {
          if (!confirmOp) return;
          const op = confirmOp;
          setConfirmOp(null);
          execute(op);
        }}
      />
    </>
  );
}
