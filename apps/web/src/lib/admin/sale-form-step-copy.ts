import { catalogFormValidationBanner } from "@/lib/admin/catalog-form-step-copy";

export type SaleFormStepId = "identity" | "schedule" | "documents" | "review";

const SALE_FORM_STEP_LABELS: Record<SaleFormStepId, string> = {
  identity: "Identity",
  schedule: "Schedule",
  documents: "Documents",
  review: "Review",
};

export function saleFormStepLabel(stepIndex: number): string {
  const ids: SaleFormStepId[] = ["identity", "schedule", "documents", "review"];
  const id = ids[stepIndex];
  return id ? SALE_FORM_STEP_LABELS[id] : "this step";
}

export function saleFormValidationBanner(count: number, locationLabel?: string): string {
  return catalogFormValidationBanner(count, locationLabel);
}

export function saleFormStepIntro(
  stepId: SaleFormStepId,
  mode: "create" | "edit" = "create",
): {
  title: string;
  body: string;
  nextHint?: string;
} {
  switch (stepId) {
    case "identity":
      return {
        title: "Tell bidders what this sale is about",
        body: "Add a title, description, cover image, and category. You can refine details before going live.",
        nextHint: "Set when and how the sale runs",
      };
    case "schedule":
      return {
        title: "When and how this sale runs",
        body: "Choose online or onsite delivery, then set opening and closing times and buyer premium.",
        nextHint: "Attach terms and documents",
      };
    case "documents":
      return {
        title: "Terms and attachments",
        body: "Add sale terms bidders see on the public sale page and any PDF attachments for staff.",
        nextHint:
          mode === "edit" ? "Review your changes" : "Review everything before creating the draft",
      };
    case "review":
      return mode === "edit"
        ? {
            title: "Review your changes",
            body: "Check the summary below. You can jump back to any section, then save when ready.",
          }
        : {
            title: "Review your draft sale",
            body: "Check the summary below. You can jump back to any section, then create the draft when ready.",
          };
  }
}
