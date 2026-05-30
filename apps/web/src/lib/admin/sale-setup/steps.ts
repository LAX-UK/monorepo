import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import type { Lot, Sale } from "@auction/types";
import { resolveFirstBlockingSetupStep } from "./readiness";

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
  connectRequiredByLotId?: ConnectRequiredByLotId;
};

/** First incomplete wizard step for resume navigation. */
export function resolveFirstIncompleteStep(input: ResolveInput): SaleSetupStepId {
  return resolveFirstBlockingSetupStep(input);
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

/** Sale form field groups per wizard step (identity → documents). */
export const SALE_FORM_WIZARD_STEP_FIELDS = [
  [...SALE_SETUP_SALE_STEP_FIELDS.identity],
  [...SALE_SETUP_SALE_STEP_FIELDS.schedule],
  [...SALE_SETUP_SALE_STEP_FIELDS.documents],
] as const;

export function saleSetupResumeHref(saleId: string, input: ResolveInput): string {
  return saleSetupHref(saleId, resolveFirstIncompleteStep(input));
}
