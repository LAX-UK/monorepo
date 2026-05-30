import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { buildSaleSetupReadiness, saleSetupHref } from "@/lib/admin/sale-setup";
import type { Lot, Sale } from "@auction/types";

export type SaleDetailReadinessInput = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ConnectRequiredByLotId;
};

export function computeSaleDetailReadiness(
  input: SaleDetailReadinessInput,
): CatalogReadinessResult | null {
  if (input.sale.status !== "draft") return null;
  const pendingRegs =
    input.pendingRegistrationCount != null && input.pendingRegistrationCount > 0
      ? input.pendingRegistrationCount
      : null;
  return buildSaleSetupReadiness({
    saleId: input.saleId,
    sale: input.sale,
    lots: input.lots,
    pendingRegistrationCount: pendingRegs,
    ...(input.connectRequiredByLotId
      ? { connectRequiredByLotId: input.connectRequiredByLotId }
      : {}),
    setupStepHref: (step) => saleSetupHref(input.saleId, step),
  });
}

export function saleDetailReadinessDismissKey(saleId: string): string {
  return `sale-${saleId}-readiness`;
}

/** Whether a draft sale passes all required setup readiness checks. */
export function saleDetailCanPublish(readiness: CatalogReadinessResult | null): boolean {
  return readiness != null && readiness.percent === 100;
}
