import {
  type SaleSetupLotRowFormValues,
  emptySaleSetupLotRow,
} from "@/lib/admin/sale-setup/lot-row-schema";
import type { Lot } from "@auction/types";
import { toDatetimeFormString } from "@auction/ui/lib/datetime";

export function draftLotRow(source: "new" | "existing"): SaleSetupLotRowFormValues {
  return { ...emptySaleSetupLotRow(crypto.randomUUID()), source };
}

/** The row for a saved lot, its times written as wall-clock times in the sale's `timeZone`. */
export function lotToRow(lot: Lot, timeZone: string): SaleSetupLotRowFormValues {
  return {
    clientRowId: lot.id,
    source: "new",
    lotId: lot.id,
    title: lot.title,
    sellerLegalEntityId: lot.sellerLegalEntityId ?? "",
    categoryIds:
      lot.categoryIds && lot.categoryIds.length > 0
        ? lot.categoryIds
        : lot.categoryId
          ? [lot.categoryId]
          : [],
    auctionType: lot.auctionType,
    startingPrice: lot.startingPrice,
    artistId: lot.artistId ?? null,
    startTime: toDatetimeFormString(lot.startTime, timeZone),
    endTime: toDatetimeFormString(lot.endTime, timeZone),
  };
}

export function saleLotRowsHaveUnsaved(rows: SaleSetupLotRowFormValues[]): boolean {
  return rows.some((r) => !r.lotId);
}

export function saleLotRowsCountSaved(rows: SaleSetupLotRowFormValues[]): number {
  return rows.filter((r) => r.lotId).length;
}
