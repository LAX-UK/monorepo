import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import type { Lot, Sale } from "@auction/types";
import { resolveFirstBlockingSetupStep } from "./readiness";
import { type SaleSetupStepId, saleSetupHref } from "./sale-setup-step-ids";

export type { SaleSetupStepId, SaleSetupStepSpec } from "./sale-setup-step-ids";
export {
  SALE_SETUP_STEP_IDS,
  SALE_SETUP_STEPS,
  saleSetupHref,
  saleSetupStepId,
  saleSetupStepIndex,
} from "./sale-setup-step-ids";

/** Sale form field groups per setup step (steps 1–3 only). */
export const SALE_SETUP_SALE_STEP_FIELDS = {
  identity: [
    "title",
    "description",
    "coverImages",
    "heroPresentation",
    "heroVideoUrl",
    "categoryId",
  ],
  schedule: [
    "deliveryMode",
    "requireSaleroomGoLiveBeforeOnlineBids",
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

export function saleSetupResumeHref(saleId: string, input: ResolveInput): string {
  return saleSetupHref(saleId, resolveFirstIncompleteStep(input));
}
