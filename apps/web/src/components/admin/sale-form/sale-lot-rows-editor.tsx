"use client";

import { saleInheritsLotTiming } from "@/lib/admin/sale-lot-window-sync";
import {
  deliveryModeExplanation,
  lotsStepFirstLotPrompt,
  scheduleLotConflictBanner,
  scheduleLotConflictInheritedTimingBanner,
} from "@/lib/admin/sale-setup";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { Plus } from "lucide-react";
import { SaleLotRowItem } from "./sale-lot-row-item";
import { saleLotRowsCountSaved, saleLotRowsHaveUnsaved } from "./sale-lot-rows-editor-helpers";
import {
  type SaleLotRowsEditorProps,
  useSaleLotRowsEditorState,
} from "./use-sale-lot-rows-editor-state";

export { saleLotRowsCountSaved, saleLotRowsHaveUnsaved };

export function SaleLotRowsEditor({
  saleId,
  sale,
  lots,
  categories,
  artists,
  englishOnlyAuctionsLocked,
  readOnly = false,
  onLotsChange,
  onUnsavedChange,
}: SaleLotRowsEditorProps) {
  const {
    rows,
    ctx,
    showFirstLotChoice,
    showAddLotActions,
    unsavedCount,
    lotWindowConflicts,
    syncPending,
    syncConfirmOpen,
    setSyncConfirmOpen,
    syncConfirmBody,
    syncConfirmTitle,
    runSyncLotsToWindow,
    addNewLotRow,
    addExistingLotRow,
    removeRow,
    saveRow,
  } = useSaleLotRowsEditorState({
    sale,
    lots,
    englishOnlyAuctionsLocked,
    readOnly,
    onLotsChange,
    onUnsavedChange,
  });

  const inheritsLotTiming = saleInheritsLotTiming(sale);

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>{deliveryModeExplanation(sale.deliveryMode)}</AlertDescription>
      </Alert>

      {lotWindowConflicts.length > 0 && !readOnly ? (
        <Alert
          className={
            inheritsLotTiming
              ? "border-outline-variant/40 bg-surface-container-low/40"
              : "border-warning/40 bg-warning/5"
          }
        >
          <AlertDescription className="space-y-3 font-body text-sm text-on-surface-variant">
            <p>
              {inheritsLotTiming
                ? scheduleLotConflictInheritedTimingBanner(lotWindowConflicts.length)
                : scheduleLotConflictBanner(lotWindowConflicts.length)}
            </p>
            {!inheritsLotTiming ? (
              <LoadingButton
                type="button"
                size="sm"
                variant="secondary"
                loading={syncPending}
                onClick={() => setSyncConfirmOpen(true)}
              >
                {syncConfirmTitle}
              </LoadingButton>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {showFirstLotChoice ? (
        <div className="rounded-xl border border-dashed border-border-hairline bg-surface-container-low/40 p-6">
          <p className="font-headline text-base text-on-surface">{lotsStepFirstLotPrompt()}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={addNewLotRow} className="gap-2">
              <Plus className="size-4" aria-hidden />
              Create new lot
            </Button>
            <Button type="button" variant="outline" onClick={addExistingLotRow} className="gap-2">
              <Plus className="size-4" aria-hidden />
              Add existing lot
            </Button>
          </div>
        </div>
      ) : null}

      {readOnly && lots.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No lots yet.</p>
      ) : null}

      {rows.map((row, index) => (
        <SaleLotRowItem
          key={row.clientRowId}
          row={row}
          rowIndex={index}
          ctx={ctx}
          categories={categories}
          artists={artists}
          englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
          readOnly={readOnly}
          saleId={saleId}
          onSaved={(lotId, values, meta) => saveRow(row.clientRowId, lotId, values, meta)}
          onRemove={() => removeRow(row.clientRowId)}
          onDetached={onLotsChange}
          onScheduleUpdated={onLotsChange}
        />
      ))}

      {showAddLotActions ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addNewLotRow} className="gap-2">
            <Plus className="size-4" aria-hidden />
            Create new lot
          </Button>
          <Button type="button" variant="outline" onClick={addExistingLotRow} className="gap-2">
            <Plus className="size-4" aria-hidden />
            Add existing lot
          </Button>
        </div>
      ) : null}

      {unsavedCount > 0 ? (
        <Alert variant="destructive">
          <AlertDescription role="alert">
            Save {unsavedCount} unsaved lot{unsavedCount === 1 ? "" : "s"} before continuing.
          </AlertDescription>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={syncConfirmOpen}
        onOpenChange={setSyncConfirmOpen}
        title={syncConfirmTitle}
        body={syncConfirmBody}
        confirmLabel="Adjust times"
        tone="warning"
        loading={syncPending}
        onConfirm={runSyncLotsToWindow}
      />
    </div>
  );
}
