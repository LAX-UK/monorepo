import type { SaleSetupLotRowFormValues } from "@/lib/admin/sale-setup/lot-row-schema";
import type { Lot } from "@auction/types";

export function initialSaleLotRows<T extends Lot>(
  lots: T[],
  lotToRow: (lot: T) => SaleSetupLotRowFormValues,
): SaleSetupLotRowFormValues[] {
  if (lots.length > 0) return lots.map(lotToRow);
  return [];
}

export function countUnsavedSaleLotRows(rows: SaleSetupLotRowFormValues[]): number {
  return rows.filter((r) => !r.lotId).length;
}

export function saleLotRowsEditorFlags(input: {
  readOnly: boolean;
  lotsCount: number;
  rowsCount: number;
}) {
  const showFirstLotChoice = !input.readOnly && input.lotsCount === 0 && input.rowsCount === 0;
  const showAddLotActions = !input.readOnly && !showFirstLotChoice;
  return { showFirstLotChoice, showAddLotActions };
}

export function appendSaleLotRow(
  rows: SaleSetupLotRowFormValues[],
  row: SaleSetupLotRowFormValues,
): SaleSetupLotRowFormValues[] {
  return [...rows, row];
}

export function removeSaleLotRowByClientId(
  rows: SaleSetupLotRowFormValues[],
  clientRowId: string,
): SaleSetupLotRowFormValues[] {
  return rows.filter((r) => r.clientRowId !== clientRowId);
}

export function saveSaleLotRow(
  rows: SaleSetupLotRowFormValues[],
  clientRowId: string,
  saved: SaleSetupLotRowFormValues,
): SaleSetupLotRowFormValues[] {
  return rows.map((r) => (r.clientRowId === clientRowId ? saved : r));
}

export function syncConfirmBodyForConflicts(conflictCount: number): string {
  return conflictCount === 1
    ? "Adjust this lot's open/close times to fit the sale window?"
    : `Adjust ${conflictCount} lots' open/close times to fit the sale window?`;
}
