import {
  type SaleSetupLotRowFormValues,
  emptySaleSetupLotRow,
} from "@/lib/admin/sale-setup/lot-row-schema";
import type { Lot } from "@auction/types";
import { toDatetimeFormString } from "@auction/ui/lib/datetime";

export function draftLotRow(source: "new" | "existing"): SaleSetupLotRowFormValues {
  return { ...emptySaleSetupLotRow(crypto.randomUUID()), source };
}

export function lotToRow(lot: Lot): SaleSetupLotRowFormValues {
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
    startTime: toDatetimeFormString(lot.startTime),
    endTime: toDatetimeFormString(lot.endTime),
  };
}

export function saleLotRowsHaveUnsaved(rows: SaleSetupLotRowFormValues[]): boolean {
  return rows.some((r) => !r.lotId);
}

export function saleLotRowsCountSaved(rows: SaleSetupLotRowFormValues[]): number {
  return rows.filter((r) => r.lotId).length;
}
