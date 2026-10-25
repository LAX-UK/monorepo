import type { WizardStepSpec } from "@/components/admin/admin-form-wizard/step-indicator";

const LOT_SETUP_STEP_IDS = ["identity", "sale-seller", "catalogue", "review"] as const;
export type LotSetupStepId = (typeof LOT_SETUP_STEP_IDS)[number];

const SETUP_STEP_LABELS: Record<LotSetupStepId, string> = {
  identity: "Lot identity",
  "sale-seller": "Sale and seller",
  catalogue: "Catalogue",
  review: "Review",
};

const STEP_SUB_ITEMS: Partial<Record<LotSetupStepId, readonly string[]>> = {
  identity: ["Title", "Description", "Lot type"],
  "sale-seller": ["Seller", "Sale", "Lot number"],
  catalogue: ["Pricing", "Schedule", "Details", "Photos"],
};

function buildStepSpec(id: LotSetupStepId, label: string): WizardStepSpec {
  const subItems = STEP_SUB_ITEMS[id];
  return {
    id,
    label,
    // The review step says what it is for; the others list what they hold.
    ...(subItems ? { subItems } : { description: "Check your answers, then create the draft." }),
  };
}

/** Display steps for lot create wizard (4 steps). */
export function buildLotSetupStepperSteps(): WizardStepSpec[] {
  return LOT_SETUP_STEP_IDS.map((id) => buildStepSpec(id, SETUP_STEP_LABELS[id]));
}

/** Display steps for lot edit wizard (4 steps). */
export function buildLotEditStepperSteps(): WizardStepSpec[] {
  return LOT_SETUP_STEP_IDS.map((id) => buildStepSpec(id, SETUP_STEP_LABELS[id]));
}

export function buildLotSetupStepperViewModel(mode: "create" | "edit"): WizardStepSpec[] {
  return mode === "create" ? buildLotSetupStepperSteps() : buildLotEditStepperSteps();
}
