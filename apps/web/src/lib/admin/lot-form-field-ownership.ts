import { getCatalogueStepFieldKeys } from "@/lib/admin/lot-catalogue";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { LotAuctionType } from "@auction/types";

export const LOT_FORM_IDENTITY_FIELDS = [
  "title",
  "description",
  "auctionType",
] as const satisfies readonly (keyof AdminLotFormValues)[];

export const LOT_FORM_SALE_SELLER_FIELDS = [
  "sellerLegalEntityId",
  "saleId",
  "lotNumber",
] as const satisfies readonly (keyof AdminLotFormValues)[];

export const LOT_FORM_STEP_LABELS = ["Identity", "Sale & seller", "Catalogue"] as const;

export type LotFormEditTabValue = "overview" | "sale" | "catalogue";

export const LOT_FORM_EDIT_TAB_LABELS: Record<LotFormEditTabValue, string> = {
  overview: "Overview",
  sale: "Sale & seller",
  catalogue: "Catalogue",
};

export function buildLotStepFields(
  auctionType: LotAuctionType,
  opts?: { includeArtist?: boolean },
): (keyof AdminLotFormValues)[][] {
  return [
    [...LOT_FORM_IDENTITY_FIELDS],
    [...LOT_FORM_SALE_SELLER_FIELDS],
    getCatalogueStepFieldKeys(auctionType, opts),
  ];
}

export function buildLotEditTabFields(
  auctionType: LotAuctionType,
  opts?: { includeArtist?: boolean },
): Record<LotFormEditTabValue, readonly string[]> {
  return {
    overview: LOT_FORM_IDENTITY_FIELDS,
    sale: LOT_FORM_SALE_SELLER_FIELDS,
    catalogue: getCatalogueStepFieldKeys(auctionType, opts),
  };
}

export function resolveLotFormEditTabForField(fieldHead: string): LotFormEditTabValue | null {
  if ((LOT_FORM_IDENTITY_FIELDS as readonly string[]).includes(fieldHead)) return "overview";
  if ((LOT_FORM_SALE_SELLER_FIELDS as readonly string[]).includes(fieldHead)) return "sale";
  return "catalogue";
}

export function lotFormStepLabel(stepIndex: number): string {
  return LOT_FORM_STEP_LABELS[stepIndex] ?? "this step";
}

export function lotFormTabLabel(tabValue: string): string {
  return LOT_FORM_EDIT_TAB_LABELS[tabValue as LotFormEditTabValue] ?? tabValue;
}

export function lotFormValidationBanner(count: number, locationLabel?: string): string {
  if (count <= 1) {
    return locationLabel
      ? `Fix the highlighted field on ${locationLabel} before saving.`
      : "Fix the highlighted field before saving.";
  }
  return locationLabel
    ? `Fix ${count} highlighted fields on ${locationLabel} before saving.`
    : `Fix ${count} highlighted fields before saving.`;
}
