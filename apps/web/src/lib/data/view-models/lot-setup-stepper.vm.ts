import type { WizardStepSpec } from "@/components/admin/admin-form-wizard/step-indicator";
import { lotFormStepIntro } from "@/lib/admin/lot-form-step-copy";

const LOT_SETUP_STEP_IDS = ["identity", "sale-seller", "catalogue", "review"] as const;
export type LotSetupStepId = (typeof LOT_SETUP_STEP_IDS)[number];

const SETUP_STEP_LABELS: Record<LotSetupStepId, string> = {
  identity: "Lot identity",
  "sale-seller": "Sale & seller",
  catalogue: "Catalogue",
  review: "Review",
};

const STEP_SUB_ITEMS: Partial<Record<LotSetupStepId, readonly string[]>> = {
  identity: ["Title", "Artist", "Category"],
  "sale-seller": ["Sale assignment", "Seller entity"],
  catalogue: ["Description", "Images", "Estimates"],
};

function buildStepSpec(id: LotSetupStepId, label: string, description: string): WizardStepSpec {
  const subItems = STEP_SUB_ITEMS[id];
  return {
    id,
    label,
    description,
    ...(subItems ? { subItems } : {}),
  };
}

/** Display steps for lot create wizard (4 steps). */
export function buildLotSetupStepperSteps(): WizardStepSpec[] {
  return LOT_SETUP_STEP_IDS.map((id) =>
    buildStepSpec(id, SETUP_STEP_LABELS[id], lotFormStepIntro(id).body),
  );
}

/** Display steps for lot edit wizard (4 steps). */
export function buildLotEditStepperSteps(): WizardStepSpec[] {
  return LOT_SETUP_STEP_IDS.map((id) =>
    buildStepSpec(id, SETUP_STEP_LABELS[id], lotFormStepIntro(id).body),
  );
}

export function buildLotSetupStepperViewModel(mode: "create" | "edit"): WizardStepSpec[] {
  return mode === "create" ? buildLotSetupStepperSteps() : buildLotEditStepperSteps();
}
