"use client";

import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
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

type Props = {
  selectedIds: string[];
  operations: BulkOperation[];
  onClear: () => void;
};

export function BulkActionsToolbar({ selectedIds, operations, onClear }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmOp, setConfirmOp] = useState<BulkOperation | null>(null);
  const router = useRouter();
  if (selectedIds.length === 0) return null;

  const execute = (operation: BulkOperation) => {
    startTransition(() => {
      void (async () => {
        const result = await operation.run(selectedIds);
        if (!result.ok) {
          notify.error(result.error);
          return;
        }
        notify.success(`${operation.label} complete`);
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
      <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 rounded-xl border border-border-hairline bg-surface-container-lowest/95 p-3 shadow-2xl backdrop-blur-sm lg:static lg:rounded-lg lg:shadow-sm">
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
