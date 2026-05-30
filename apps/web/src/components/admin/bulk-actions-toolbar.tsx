"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { notifyOrphanDraftSales } from "@/lib/admin/bulk-ops/orphan-draft-sale-notify";
import { handleBulkActionResult } from "@/lib/admin/catalog-bulk-result-handler";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type BulkTypedConfirmConfig = {
  title: string;
  description: string;
  actionLabel: string;
  confirmationPhrase: (selectedCount: number) => string;
};

export type BulkOperationRunOptions = {
  confirmationPhrase?: string;
};

export type BulkOperation = {
  id: string;
  label: string;
  confirm?: string;
  typedConfirm?: BulkTypedConfirmConfig;
  destructive?: boolean;
  run: (ids: string[], options?: BulkOperationRunOptions) => Promise<ActionResult<unknown>>;
};

type Props = {
  selectedIds: string[];
  operations: BulkOperation[];
  onClear: () => void;
  /** Shown above actions when bulk publish may fail (connect / draft-sale lots). */
  preflightWarning?: string | null;
  pageRowCount?: number;
  onSelectAllOnPage?: () => void;
};

export function BulkActionsToolbar({
  selectedIds,
  operations,
  onClear,
  preflightWarning = null,
  pageRowCount = 0,
  onSelectAllOnPage,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmOp, setConfirmOp] = useState<BulkOperation | null>(null);
  const [typedConfirmOp, setTypedConfirmOp] = useState<BulkOperation | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const router = useRouter();
  if (selectedIds.length === 0) return null;

  const execute = (operation: BulkOperation, options?: BulkOperationRunOptions) => {
    startTransition(() => {
      void (async () => {
        const result = await operation.run(selectedIds, options);
        const handled = handleBulkActionResult({
          operationLabel: operation.label,
          result,
          onPartialClear: onClear,
          refresh: () => router.refresh(),
        });
        if (handled.variant === "error") {
          notify.error(handled.message);
        } else {
          if (handled.variant === "warning") {
            notify.warning(handled.message);
          } else {
            notify.success(handled.message);
          }
          if (result.ok) {
            notifyOrphanDraftSales(router, result.data);
          }
        }
        if (handled.shouldClear) onClear();
        if (handled.shouldRefresh) router.refresh();
      })();
    });
  };

  const orderedOperations = useMemo(
    () =>
      [...operations].sort((a, b) => {
        if (a.destructive === b.destructive) return 0;
        return a.destructive ? 1 : -1;
      }),
    [operations],
  );

  const primaryOps = useMemo(
    () => orderedOperations.filter((op) => !op.destructive),
    [orderedOperations],
  );
  const destructiveOps = useMemo(
    () => orderedOperations.filter((op) => op.destructive),
    [orderedOperations],
  );

  const run = (operation: BulkOperation) => {
    setMoreOpen(false);
    if (operation.typedConfirm) {
      setTypedConfirmOp(operation);
      return;
    }
    if (operation.confirm) {
      setConfirmOp(operation);
      return;
    }
    execute(operation);
  };

  const renderOpButton = (
    operation: BulkOperation,
    variant: "default" | "secondary" | "destructive",
  ) => (
    <Button
      key={operation.id}
      type="button"
      variant={variant}
      disabled={pending}
      onClick={() => run(operation)}
      className="min-h-10"
    >
      {operation.label}
    </Button>
  );

  return (
    <>
      <div
        className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 space-y-2 rounded-xl border border-border-hairline bg-surface-container-lowest/95 p-3 shadow-2xl backdrop-blur-sm lg:static lg:rounded-lg lg:shadow-sm"
        aria-busy={pending}
      >
        <p className="sr-only" aria-live="polite">
          {pending ? `Working on ${selectedIds.length} selected items…` : ""}
        </p>
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
            {onSelectAllOnPage && pageRowCount > 0 && selectedIds.length < pageRowCount ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={onSelectAllOnPage}
                className="min-h-10"
              >
                Select all on page ({pageRowCount})
              </Button>
            ) : null}
            {primaryOps.map((operation, index) =>
              renderOpButton(operation, index === 0 ? "default" : "secondary"),
            )}
            {destructiveOps.length > 0 ? (
              <>
                <div className="hidden flex-wrap gap-2 lg:flex">
                  {destructiveOps.map((operation) => renderOpButton(operation, "destructive"))}
                </div>
                <div className="lg:hidden">
                  <BottomSheet open={moreOpen} onOpenChange={setMoreOpen}>
                    <BottomSheetTrigger asChild>
                      <Button type="button" variant="outline" className="min-h-10 gap-1">
                        <MoreHorizontal className="size-4" aria-hidden />
                        More
                      </Button>
                    </BottomSheetTrigger>
                    <BottomSheetContent>
                      <BottomSheetHeader>
                        <BottomSheetTitle>More actions</BottomSheetTitle>
                      </BottomSheetHeader>
                      <div className="flex flex-col gap-2 p-4">
                        {destructiveOps.map((operation) => (
                          <Button
                            key={operation.id}
                            type="button"
                            variant="destructive"
                            disabled={pending}
                            className="min-h-11 w-full"
                            onClick={() => run(operation)}
                          >
                            {operation.label}
                          </Button>
                        ))}
                      </div>
                    </BottomSheetContent>
                  </BottomSheet>
                </div>
              </>
            ) : null}
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
      {typedConfirmOp?.typedConfirm ? (
        <TypedConfirmationDialog
          open={typedConfirmOp !== null}
          onOpenChange={(open) => {
            if (!open) setTypedConfirmOp(null);
          }}
          title={typedConfirmOp.typedConfirm.title}
          description={typedConfirmOp.typedConfirm.description}
          actionLabel={typedConfirmOp.typedConfirm.actionLabel}
          confirmationPhrase={typedConfirmOp.typedConfirm.confirmationPhrase(selectedIds.length)}
          severity="danger"
          relatedEntities={{ count: selectedIds.length, label: "selected item" }}
          onConfirm={async () => {
            const op = typedConfirmOp;
            if (!op?.typedConfirm) return;
            const phrase = op.typedConfirm.confirmationPhrase(selectedIds.length);
            setTypedConfirmOp(null);
            execute(op, { confirmationPhrase: phrase });
          }}
        />
      ) : null}
    </>
  );
}
