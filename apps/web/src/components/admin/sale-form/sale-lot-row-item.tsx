"use client";

import { AttachExistingLotReview } from "@/components/admin/attach-existing-lot-review";
import type { SaleSetupLotRowContext, SaleSetupLotRowFormValues } from "@/lib/admin/sale-setup";
import { FormActions, StaffButton } from "@auction/staff-ui";
import type { ArtistProfile, CategoryNode } from "@auction/types";
import { Trash2 } from "lucide-react";
import { AttachedLotRow } from "./lot-row/attached-lot-row";
import { EditableLotRowForm } from "./lot-row/editable-lot-row-form";
import { useSaleLotRowForm } from "./use-sale-lot-row-form";

export function SaleLotRowItem({
  row,
  rowIndex,
  ctx,
  categories,
  artists,
  englishOnlyAuctionsLocked,
  readOnly,
  saleId,
  onSaved,
  onRemove,
  onDetached,
  onScheduleUpdated,
}: {
  row: SaleSetupLotRowFormValues;
  rowIndex: number;
  ctx: SaleSetupLotRowContext;
  categories: CategoryNode[];
  artists: ArtistProfile[];
  englishOnlyAuctionsLocked: boolean;
  readOnly: boolean;
  saleId: string;
  onSaved: (lotId: string, values: SaleSetupLotRowFormValues, meta?: { title?: string }) => void;
  onRemove: () => void;
  onDetached?: () => void;
  onScheduleUpdated?: () => void;
}) {
  const {
    pending,
    detachConfirmOpen,
    setDetachConfirmOpen,
    form,
    isDirty,
    isSaved,
    isExisting,
    inheritsTiming,
    sellerDisplayName,
    runDetach,
    auctionTypeOptions,
    save,
    scheduleOutOfSync,
    updateSchedule,
    failedSaves,
  } = useSaleLotRowForm({
    row,
    ctx,
    englishOnlyAuctionsLocked,
    saleId,
    onSaved,
    onRemove,
    onDetached,
    onScheduleUpdated,
  });

  if (isExisting && isSaved) {
    return (
      <AttachedLotRow
        row={row}
        rowIndex={rowIndex}
        readOnly={readOnly}
        pending={pending}
        detachConfirmOpen={detachConfirmOpen}
        onDetachConfirmOpenChange={setDetachConfirmOpen}
        onDetach={runDetach}
      />
    );
  }

  if (isExisting && !isSaved && !readOnly) {
    return (
      <AttachExistingLotReview
        saleId={saleId}
        saleWindow={{
          deliveryMode: ctx.deliveryMode,
          startTime: ctx.saleStartTime,
          endTime: ctx.saleEndTime,
        }}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
        attachVia="wizard"
        categories={categories}
        artists={artists}
        onAttached={(lotId, title) => {
          onSaved(lotId, { ...row, title }, { title });
        }}
        headerSlot={
          <FormActions>
            <StaffButton
              type="button"
              size="sm"
              variant="ghost"
              icon={<Trash2 aria-hidden />}
              onClick={onRemove}
            >
              Remove lot {rowIndex + 1}
            </StaffButton>
          </FormActions>
        }
      />
    );
  }

  return (
    <EditableLotRowForm
      row={row}
      rowIndex={rowIndex}
      ctx={ctx}
      categories={categories}
      artists={artists}
      englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
      readOnly={readOnly}
      form={form}
      isDirty={isDirty}
      isSaved={isSaved}
      inheritsTiming={inheritsTiming}
      sellerDisplayName={sellerDisplayName}
      pending={pending}
      auctionTypeOptions={auctionTypeOptions}
      scheduleOutOfSync={scheduleOutOfSync}
      failedSaves={failedSaves}
      onRemove={onRemove}
      onSave={save}
      onUpdateSchedule={updateSchedule}
    />
  );
}
