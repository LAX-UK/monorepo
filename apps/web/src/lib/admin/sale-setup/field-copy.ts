import type { SaleDeliveryMode } from "@auction/types";
import type { SaleSetupStepId } from "./sale-setup-step-ids";

export { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";

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
        body: "Create a new lot or attach one from inventory. You’ll add photos and catalog text in the next step.",
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

export function lotsStepFirstLotPrompt(): string {
  return "How would you like to add your first lot?";
}

export function attachLotReviewPrompt(): string {
  return "Review this lot before attaching it to the sale.";
}

export function attachLotScheduleConflictBanner(): string {
  return "This lot's schedule doesn't fit the sale window. Adjust the times below or sync them to the sale window before attaching.";
}

export function attachLotChangeLotLabel(): string {
  return "Change lot";
}

export function attachExistingLotPanelBody(isOnsite: boolean): string {
  return isOnsite
    ? "Search draft inventory. Attached lots inherit the sale schedule."
    : "Search draft inventory. Review the lot and adjust its schedule to fit this sale before attaching.";
}

export function deliveryModeExplanation(mode: SaleDeliveryMode): string {
  if (mode === "online") {
    return "Bidders bid remotely. Each lot can close within the sale window.";
  }
  if (mode === "hybrid") {
    return "Bidders can bid online and in the saleroom. All lots share this sale’s opening and closing times.";
  }
  return "Live event at a venue. All lots share this sale’s opening and closing times.";
}

export function deliveryModeLabel(mode: SaleDeliveryMode): string {
  switch (mode) {
    case "online":
      return "Online (interactive bidding)";
    case "hybrid":
      return "Hybrid (in-room + live online bidding)";
    case "onsite":
      return "Onsite (read-only marketing)";
  }
}

export function saleSavedMessage(nextStep: SaleSetupStepId): string {
  switch (nextStep) {
    case "documents":
      return "Sale saved. Add terms and PDF attachments next.";
    case "lots":
      return "Sale saved. Add your lots next.";
    case "review":
      return "Sale saved as draft.";
    default:
      return "Sale saved.";
  }
}

export function reviewSaveDraftHint(): string {
  return "Not ready to go live? Save as draft and finish photos, descriptions, or schedule details later.";
}

export function reviewPublishBlockedHint(): string {
  return "Complete the items below to publish.";
}

export function saveDraftSuccessMessage(): string {
  return "Sale saved as draft. You can continue setup anytime.";
}

export function catalogPrepReviewNotice(): string {
  return "You can save as draft on the next step and finish catalog details later.";
}

export function lotSavedMessage(title: string): string {
  return `"${title.trim() || "Lot"}" saved to this sale.`;
}

export function draftSaleLotPublishBanner(): string {
  return "Lots in a draft sale are published together when you publish the sale.";
}

/** Shared title for Connect-blocked publish surfaces (banner + readiness). */
export function connectPublishBlockedTitle(): string {
  return READINESS_LABELS.connect ?? "Seller must finish payout setup";
}

export function catalogueStaffReadOnlyMessage(): string {
  return "Sale schedule and identity are managed by auction ops. You can add lots, photos, and catalog descriptions in the steps below.";
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
  sale_window: "Lot schedule fits the sale window",
};

export function scheduleLotConflictBanner(count: number): string {
  const noun = count === 1 ? "lot needs" : "lots need";
  return `${count} ${noun} schedule updates — the new sale window conflicts with existing lot times. Save will fail until you update them on the Lots step (or use Sync lot times).`;
}

export function scheduleLotConflictPersistBlocked(titles: readonly string[]): string {
  const shown = titles.slice(0, 3);
  const suffix = titles.length > 3 ? ` and ${titles.length - 3} more` : "";
  return `Update lot schedules before saving: ${shown.join(", ")}${suffix}. Go to the Lots step or use Sync lot times.`;
}

export function syncLotsToSaleWindowLabel(count: number): string {
  return count === 1 ? "Sync lot to sale window" : `Sync ${count} lots to sale window`;
}

export function scheduleOutOfSyncBadge(): string {
  return "Schedule out of sync";
}

export function updateLotScheduleLabel(): string {
  return "Update lot schedule";
}

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
