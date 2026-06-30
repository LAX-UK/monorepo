"use client";

import {
  findLotsOutsideSaleWindow,
  proposeLotTimesWithinWindow,
} from "@/lib/admin/sale-lot-window-sync";
import { syncLotsToSaleWindowLabel } from "@/lib/admin/sale-setup/field-copy";
import { humanizeSetupError } from "@/lib/admin/sale-setup/humanize-setup-error";
import {
  type SaleSetupLotRowContext,
  type SaleSetupLotRowFormValues,
  mergeSavedLotRow,
  mergeWizardRowsWithServerLots,
} from "@/lib/admin/sale-setup/lot-row-schema";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, CategoryNode, Lot, Sale } from "@auction/types";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { draftLotRow, lotToRow } from "./sale-lot-rows-editor-helpers";
import {
  appendSaleLotRow,
  countUnsavedSaleLotRows,
  initialSaleLotRows,
  removeSaleLotRowByClientId,
  saleLotRowsEditorFlags,
  syncConfirmBodyForConflicts,
} from "./sale-lot-rows-editor-state.logic";

export type SaleLotRowsEditorProps = {
  saleId: string;
  sale: Pick<Sale, "deliveryMode" | "startTime" | "endTime">;
  lots: Lot[];
  categories: CategoryNode[];
  artists: ArtistProfile[];
  englishOnlyAuctionsLocked: boolean;
  readOnly?: boolean;
  onLotsChange: () => void;
  onUnsavedChange?: ((unsaved: boolean) => void) | undefined;
};

type UseSaleLotRowsEditorStateParams = {
  sale: Pick<Sale, "deliveryMode" | "startTime" | "endTime">;
  lots: Lot[];
  englishOnlyAuctionsLocked: boolean;
  readOnly?: boolean;
  onLotsChange: () => void;
  onUnsavedChange?: ((unsaved: boolean) => void) | undefined;
};

export function useSaleLotRowsEditorState({
  sale,
  lots,
  englishOnlyAuctionsLocked,
  readOnly = false,
  onLotsChange,
  onUnsavedChange,
}: UseSaleLotRowsEditorStateParams) {
  const [rows, setRows] = useState<SaleSetupLotRowFormValues[]>(() =>
    initialSaleLotRows(lots, lotToRow),
  );

  const { showFirstLotChoice, showAddLotActions } = saleLotRowsEditorFlags({
    readOnly,
    lotsCount: lots.length,
    rowsCount: rows.length,
  });
  const unsavedCount = countUnsavedSaleLotRows(rows);

  useEffect(() => {
    onUnsavedChange?.(unsavedCount > 0);
  }, [onUnsavedChange, unsavedCount]);

  useEffect(() => {
    setRows((prev) => mergeWizardRowsWithServerLots(prev, lots, lotToRow));
  }, [lots]);

  const ctx: SaleSetupLotRowContext = useMemo(
    () => ({
      saleStartTime: sale.startTime,
      saleEndTime: sale.endTime,
      deliveryMode: sale.deliveryMode,
      englishOnlyAuctionsLocked,
    }),
    [englishOnlyAuctionsLocked, sale.deliveryMode, sale.endTime, sale.startTime],
  );

  const lotWindowConflicts = useMemo(
    () =>
      findLotsOutsideSaleWindow(lots, {
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
        endTime: sale.endTime,
      }),
    [lots, sale.deliveryMode, sale.endTime, sale.startTime],
  );

  const [syncPending, startSyncTransition] = useTransition();
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const syncConfirmBody = syncConfirmBodyForConflicts(lotWindowConflicts.length);

  const runSyncLotsToWindow = useCallback(() => {
    if (lotWindowConflicts.length === 0) return;
    startSyncTransition(async () => {
      const window = {
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
        endTime: sale.endTime,
      };
      for (const conflict of lotWindowConflicts) {
        const proposed = proposeLotTimesWithinWindow(conflict.lot, window);
        const { adminUpdateLotResultAction } = await import("@/lib/actions/admin");
        const r = await adminUpdateLotResultAction(conflict.lot.id, proposed);
        if (!r.ok) {
          notify.error(
            humanizeSetupError({
              message: actionFailureNotifyMessage(r.error, {
                status: r.status,
                errorCode: r.errorCode,
                meta: r.meta,
              }),
              errorCode: r.errorCode,
            }),
          );
          return;
        }
      }
      notify.success("Lot schedules updated");
      setSyncConfirmOpen(false);
      onLotsChange();
    });
  }, [lotWindowConflicts, onLotsChange, sale.deliveryMode, sale.endTime, sale.startTime]);

  const addNewLotRow = useCallback(() => {
    setRows((prev) => appendSaleLotRow(prev, draftLotRow("new")));
  }, []);

  const addExistingLotRow = useCallback(() => {
    setRows((prev) => appendSaleLotRow(prev, draftLotRow("existing")));
  }, []);

  const removeRow = useCallback((clientRowId: string) => {
    setRows((prev) => removeSaleLotRowByClientId(prev, clientRowId));
  }, []);

  const saveRow = useCallback(
    (
      clientRowId: string,
      lotId: string,
      values: SaleSetupLotRowFormValues,
      meta?: { title?: string },
    ) => {
      setRows((prev) =>
        prev.map((r) =>
          r.clientRowId === clientRowId ? mergeSavedLotRow(values, lotId, meta) : r,
        ),
      );
      onLotsChange();
    },
    [onLotsChange],
  );

  return {
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
    syncConfirmTitle: syncLotsToSaleWindowLabel(lotWindowConflicts.length),
    runSyncLotsToWindow,
    addNewLotRow,
    addExistingLotRow,
    removeRow,
    saveRow,
  };
}
