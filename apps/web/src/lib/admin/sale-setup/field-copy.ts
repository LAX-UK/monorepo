import type { SaleSetupStepId } from "./steps";

export type FieldTier = "required" | "before_publish" | "optional";

/** Suffix for form labels by tier. */
export function fieldTierSuffix(tier: FieldTier): string {
  switch (tier) {
    case "required":
      return "";
    case "before_publish":
      return " — needed before going live";
    case "optional":
      return " (optional)";
  }
}

export function stepIntro(stepId: SaleSetupStepId): { title: string; body: string } {
  switch (stepId) {
    case "identity":
      return {
        title: "Tell bidders what this sale is about",
        body: "Add a title and optional cover image. You can refine details before going live.",
      };
    case "schedule":
      return {
        title: "When and how this sale runs",
        body: "Choose online or onsite delivery, then set opening and closing times.",
      };
    case "documents":
      return {
        title: "Terms and attachments",
        body: "Add sale terms bidders see on the public sale page. PDF attachments are stored on this sale for staff download.",
      };
    case "lots":
      return {
        title: "Add lots to this sale",
        body: "Enter the basics for each lot. You’ll add photos and catalog text in the next step.",
      };
    case "catalog-prep":
      return {
        title: "Finish your catalog",
        body: "Add photos and descriptions so bidders can browse each lot.",
      };
    case "review":
      return {
        title: "Review and go live",
        body: "Check everything below, then publish the sale when you’re ready.",
      };
  }
}

export function deliveryModeExplanation(mode: "online" | "onsite"): string {
  return mode === "online"
    ? "Bidders bid remotely. Each lot can close within the sale window."
    : "Live event at a venue. All lots share this sale’s opening and closing times.";
}

export function saleSavedMessage(nextStep: SaleSetupStepId): string {
  switch (nextStep) {
    case "documents":
      return "Sale saved. Add terms and PDF attachments next.";
    case "lots":
      return "Sale saved. Add your lots next.";
    default:
      return "Sale saved.";
  }
}

export function lotSavedMessage(title: string): string {
  return `"${title.trim() || "Lot"}" saved to this sale.`;
}

export function draftSaleLotPublishBanner(): string {
  return "Lots in a draft sale are published together when you publish the sale.";
}

export function catalogueStaffReadOnlyMessage(): string {
  return "An auction manager needs to set up the sale and add lots first. You can finish catalog copy and images once lots exist.";
}

export function publishBlockedCatalogueRoleMessage(): string {
  return "Ask an auction manager to publish when the catalog is ready.";
}

/** Plain-language readiness labels (override technical catalog-readiness labels). */
export const READINESS_LABELS: Record<string, string> = {
  lots: "Add at least one lot",
  schedule: "Set a valid sale schedule",
  registrations: "Review bidder registrations",
  venue: "Add venue details for this onsite sale",
  images: "Add a photo",
  description: "Write a catalog description",
  seller: "Choose a seller",
  artist: "Approve artist profile or choose another artist",
  sale: "Assign lot to a sale",
  connect: "Seller must finish payout setup",
  sale_start_future: "Opening time must be in the future",
};

export function readinessLabel(id: string, context?: { lotTitle?: string; artistName?: string }) {
  const base = READINESS_LABELS[id] ?? id;
  if (id === "images" && context?.lotTitle) {
    return `Add a photo for ${context.lotTitle}`;
  }
  if (id === "description" && context?.lotTitle) {
    return `Write a catalog description for ${context.lotTitle}`;
  }
  if (id === "artist" && context?.artistName) {
    return `Approve artist profile for ${context.artistName}`;
  }
  return base;
}
