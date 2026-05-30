export type LotFormStepId = "identity" | "sale-seller" | "catalogue" | "review";

export function lotFormStepIntro(stepId: LotFormStepId): {
  title: string;
  body: string;
  nextHint?: string;
} {
  switch (stepId) {
    case "identity":
      return {
        title: "What is this lot?",
        body: "Give the lot a working title, category, and auction format. You can refine catalogue copy later.",
        nextHint: "Assign a sale and seller",
      };
    case "sale-seller":
      return {
        title: "Where does this lot live?",
        body: "Optionally attach the lot to a sale, set its lot number, and choose the seller legal entity.",
        nextHint: "Add pricing, photos, and catalogue details",
      };
    case "catalogue":
      return {
        title: "Catalogue the lot for bidders",
        body: "Add estimates, schedule, images, and descriptions so staff and bidders know what they're buying.",
        nextHint: "Review everything before creating the draft",
      };
    case "review":
      return {
        title: "Review your draft lot",
        body: "Check the summary below. You can jump back to any section, then create the draft when ready.",
      };
  }
}
