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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Textarea } from "@auction/ui/components/textarea";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

export type BulkTypedConfirmConfig = {
  title: string;
  description: string;
  actionLabel: string;
  confirmationPhrase: (selectedCount: number) => string;
};

export type BulkReasonPromptConfig = {
  title: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  actionLabel: string;
  minLength?: number;
};

export type BulkOperationRunOptions = {
  confirmationPhrase?: string;
  reason?: string;
};

export type BulkOperation = {
  id: string;
  label: string;
  confirm?: string;
  typedConfirm?: BulkTypedConfirmConfig;
  reasonPrompt?: BulkReasonPromptConfig;
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
  const [reasonPromptOp, setReasonPromptOp] = useState<BulkOperation | null>(null);
  const [reasonValue, setReasonValue] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const reasonFieldId = useId();
  const router = useRouter();

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

  if (selectedIds.length === 0) return null;

  const execute = (operation: BulkOperation, options?: BulkOperationRunOptions) => {
    startTransition(() => {
      void (async () => {
        const result = await operation.run(selectedIds, options);
        const refresh = () => {
          router.refresh();
        };
        const handled = handleBulkActionResult({
          operationLabel: operation.label,
          result,
          onPartialClear: onClear,
          refresh,
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
        if (handled.shouldRefresh) refresh();
      })();
    });
  };

  const run = (operation: BulkOperation) => {
    setMoreOpen(false);
    if (operation.typedConfirm) {
      setTypedConfirmOp(operation);
      return;
    }
    if (operation.reasonPrompt) {
      setReasonValue("");
      setReasonPromptOp(operation);
      return;
    }
    if (operation.confirm) {
      setConfirmOp(operation);
      return;
    }
    execute(operation);
  };

  const reasonMinLength = reasonPromptOp?.reasonPrompt?.minLength ?? 1;
  const reasonValid = reasonValue.trim().length >= reasonMinLength;

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
      {reasonPromptOp?.reasonPrompt ? (
        <Dialog
          open={reasonPromptOp !== null}
          onOpenChange={(open) => {
            if (!open) setReasonPromptOp(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{reasonPromptOp.reasonPrompt.title}</DialogTitle>
            </DialogHeader>
            <p className="font-body text-sm text-on-surface-variant">
              {reasonPromptOp.reasonPrompt.description}
            </p>
            <label htmlFor={reasonFieldId} className="flex flex-col gap-1.5">
              <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                {reasonPromptOp.reasonPrompt.fieldLabel}
              </span>
              <Textarea
                id={reasonFieldId}
                rows={4}
                value={reasonValue}
                onChange={(e) => setReasonValue(e.target.value)}
                placeholder={reasonPromptOp.reasonPrompt.placeholder}
                disabled={pending}
              />
            </label>
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setReasonPromptOp(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending || !reasonValid}
                onClick={() => {
                  const op = reasonPromptOp;
                  if (!op) return;
                  setReasonPromptOp(null);
                  execute(op, { reason: reasonValue.trim() });
                }}
              >
                {pending ? "Working…" : reasonPromptOp.reasonPrompt.actionLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
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
