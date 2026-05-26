import { buildLotPublishReadiness, buildSalePublishReadiness } from "@/lib/admin/catalog-readiness";
import type { Lot, Sale } from "@auction/types";

/** Sale setup wizard step ids (URL ?step=). */
export const SALE_SETUP_STEP_IDS = [
  "identity",
  "schedule",
  "documents",
  "lots",
  "catalog-prep",
  "review",
] as const;

export type SaleSetupStepId = (typeof SALE_SETUP_STEP_IDS)[number];

export type SaleSetupStepSpec = {
  id: SaleSetupStepId;
  label: string;
  index: number;
};

export const SALE_SETUP_STEPS: readonly SaleSetupStepSpec[] = SALE_SETUP_STEP_IDS.map(
  (id, index) => ({
    id,
    label: stepLabel(id),
    index,
  }),
);

function stepLabel(id: SaleSetupStepId): string {
  switch (id) {
    case "identity":
      return "Identity";
    case "schedule":
      return "Schedule";
    case "documents":
      return "Documents";
    case "lots":
      return "Lots";
    case "catalog-prep":
      return "Catalog prep";
    case "review":
      return "Review";
  }
}

export function saleSetupStepIndex(stepId: string | null | undefined): number {
  if (!stepId) return 0;
  const idx = SALE_SETUP_STEP_IDS.indexOf(stepId as SaleSetupStepId);
  return idx >= 0 ? idx : 0;
}

export function saleSetupStepId(index: number): SaleSetupStepId {
  const clamped = Math.max(0, Math.min(index, SALE_SETUP_STEP_IDS.length - 1));
  return SALE_SETUP_STEP_IDS[clamped] ?? "identity";
}

export function saleSetupHref(saleId: string | null, stepId: SaleSetupStepId): string {
  if (!saleId) {
    return stepId === "identity" ? "/admin/sales/new" : `/admin/sales/new?step=${stepId}`;
  }
  return `/admin/sales/${saleId}/setup?step=${stepId}`;
}

type ResolveInput = {
  sale: Sale | null;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ReadonlyMap<string, boolean>;
};

/** First incomplete wizard step for resume navigation. */
export function resolveFirstIncompleteStep(input: ResolveInput): SaleSetupStepId {
  if (!input.sale) return "identity";

  if (input.sale.status !== "draft") return "review";

  const saleId = input.sale.id;
  const saleReadiness = buildSalePublishReadiness(
    saleId,
    input.sale,
    input.lots.length,
    input.pendingRegistrationCount ?? null,
  );
  if (!input.sale.title?.trim()) return "identity";
  if (!saleReadiness.items.find((i) => i.id === "schedule")?.ok) return "schedule";

  if (input.lots.length === 0) return "lots";

  for (const lot of input.lots) {
    const connectRequired = input.connectRequiredByLotId?.get(lot.id) ?? false;
    const lotReady = buildLotPublishReadiness(lot.id, lot, connectRequired);
    if (lotReady.percent < 100) return "catalog-prep";
  }

  if (saleReadiness.percent < 100) return "review";

  return "review";
}

/** Sale form field groups per setup step (steps 1–3 only). */
export const SALE_SETUP_SALE_STEP_FIELDS = {
  identity: ["title", "description", "coverImages", "categoryId"],
  schedule: [
    "deliveryMode",
    "startTime",
    "endTime",
    "previewStartTime",
    "streamUrl",
    "locationName",
    "locationPostcode",
    "buyerPremiumRate",
    "buyerPremiumTiers",
  ],
  documents: ["terms"],
} as const;
