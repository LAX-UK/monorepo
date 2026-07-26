import type { WizardStepSpec } from "@/components/admin/admin-form-wizard/step-indicator";
import { saleFormStepIntro } from "@/lib/admin/sale-form-step-copy";
import { stepIntro } from "@/lib/admin/sale-setup/field-copy";
import {
  SALE_SETUP_STEP_IDS,
  type SaleSetupStepId,
} from "@/lib/admin/sale-setup/sale-setup-step-ids";

const SETUP_STEP_LABELS: Record<SaleSetupStepId, string> = {
  identity: "Sale Information",
  schedule: "Schedule",
  documents: "Documents",
  lots: "Lots",
  "catalog-prep": "Catalog",
  review: "Review",
};

const STEP_SUB_ITEMS: Partial<Record<SaleSetupStepId, readonly string[]>> = {
  identity: ["Details", "Media", "Discovery"],
  schedule: ["Auction format", "Schedule", "Commercial settings"],
  documents: ["Internal documents", "Public documents", "Terms of sale"],
  lots: ["Choose type", "Lot details", "Review lots"],
};

const EDIT_STEP_IDS = ["identity", "schedule", "documents", "review"] as const;

function buildStepSpec(
  id: SaleSetupStepId | (typeof EDIT_STEP_IDS)[number],
  label: string,
  description: string,
): WizardStepSpec {
  const subItems = STEP_SUB_ITEMS[id as SaleSetupStepId];
  return {
    id,
    label,
    description,
    ...(subItems ? { subItems } : {}),
  };
}

/** Display steps for sale setup/create wizard (6 steps). */
export function buildSaleSetupStepperSteps(): WizardStepSpec[] {
  return SALE_SETUP_STEP_IDS.map((id) =>
    buildStepSpec(id, SETUP_STEP_LABELS[id], stepIntro(id).body),
  );
}

/** Display steps for sale edit wizard (4 steps). */
export function buildSaleEditStepperSteps(): WizardStepSpec[] {
  return EDIT_STEP_IDS.map((id) => {
    const intro = saleFormStepIntro(id, "edit");
    const label = id === "identity" ? "Sale Information" : SETUP_STEP_LABELS[id as SaleSetupStepId];
    return buildStepSpec(id, label, intro.body);
  });
}
