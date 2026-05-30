import { buildLotPublishReadiness } from "@/lib/admin/catalog-readiness";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { Lot } from "@auction/types";

export type LotDetailReadinessInput = {
  lotId: string;
  auction: Lot;
  context: LotDetailContext;
  connectRequired?: boolean;
};

export function computeLotDetailReadiness(
  input: LotDetailReadinessInput,
): CatalogReadinessResult | null {
  if (input.auction.status !== "draft") return null;
  return buildLotPublishReadiness(input.lotId, input.auction, {
    ...(input.connectRequired ? { connectRequired: input.connectRequired } : {}),
    ...(input.context.sale ? { sale: input.context.sale } : {}),
  });
}

export function lotDetailReadinessDismissKey(lotId: string): string {
  return `lot-${lotId}-readiness`;
}
