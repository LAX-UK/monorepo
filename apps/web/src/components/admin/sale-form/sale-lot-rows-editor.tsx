"use client";

import { saleInheritsLotTiming } from "@/lib/admin/sale-lot-window-sync";
import {
  deliveryModeExplanation,
  lotsStepFirstLotPrompt,
  scheduleLotConflictBanner,
  scheduleLotConflictInheritedTimingBanner,
} from "@/lib/admin/sale-setup";
import {
  ConfirmActionDialog,
  EmptyState,
  FormActions,
  Notice,
  StaffButton,
} from "@auction/staff-ui";
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

  const addButtons = (primary: boolean) => (
    <FormActions className="justify-start">
      <StaffButton
        type="button"
        variant={primary ? "primary" : "secondary"}
        icon={<Plus aria-hidden />}
        onClick={addNewLotRow}
      >
        Create new lot
      </StaffButton>
      <StaffButton
        type="button"
        variant="secondary"
        icon={<Plus aria-hidden />}
        onClick={addExistingLotRow}
      >
        Add existing lot
      </StaffButton>
    </FormActions>
  );

  return (
    <>
      <Notice tone="info" title="How lot times work in this sale">
        {deliveryModeExplanation(sale.deliveryMode)}
      </Notice>
      {lotWindowConflicts.length > 0 && !readOnly ? (
        <Notice
          tone={inheritsLotTiming ? "info" : "warning"}
          title={
            inheritsLotTiming
              ? scheduleLotConflictInheritedTimingBanner(lotWindowConflicts.length)
              : scheduleLotConflictBanner(lotWindowConflicts.length)
          }
          actions={
            !inheritsLotTiming ? (
              <StaffButton
                type="button"
                size="sm"
                variant="secondary"
                loading={syncPending}
                onClick={() => setSyncConfirmOpen(true)}
              >
                {syncConfirmTitle}
              </StaffButton>
            ) : null
          }
        />
      ) : null}
      {showFirstLotChoice ? (
        <EmptyState title={lotsStepFirstLotPrompt()} action={addButtons(true)} />
      ) : null}
      {readOnly && lots.length === 0 ? <EmptyState title="No lots in this sale yet" /> : null}
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
      {showAddLotActions ? addButtons(false) : null}
      {unsavedCount > 0 ? (
        <Notice tone="danger" alert title="Some lots are not saved">
          Save {unsavedCount} unsaved {unsavedCount === 1 ? "lot" : "lots"} before continuing.
        </Notice>
      ) : null}
      <ConfirmActionDialog
        open={syncConfirmOpen}
        onOpenChange={(open) => {
          if (!syncPending) setSyncConfirmOpen(open);
        }}
        title={syncConfirmTitle}
        description={syncConfirmBody}
        confirmLabel="Adjust times"
        loading={syncPending}
        onConfirm={runSyncLotsToWindow}
      />
    </>
  );
}
