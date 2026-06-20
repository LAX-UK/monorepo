import type { Sale, SaleDeliveryMode } from "@auction/types";
import {
  formatAntiSnipingClosingRuleParagraph,
  formatAntiSnipingRuleSentence,
} from "@auction/validators";

export type SaleTypePresentation = {
  key: SaleDeliveryMode;
  label: string;
  title: string;
  tagline: string;
  description: string;
  colorClass: string;
  iconName: "Laptop" | "MapPin";
  howToTakePart: Array<{
    stepKey: ParticipationStepKey;
    title: string;
    description: string;
    details?: string;
  }>;
};

export type ParticipationStepKey =
  | "register"
  | "maxBids"
  | "lotClose"
  | "attendLive"
  | "absenteeBid"
  | "phoneLine"
  | "stream"
  | "preview"
  | "paddle"
  | "absenteePhone"
  | "streamBroadcast";

/** Onsite timeline step titles (timeline-specific; not all appear in howToTakePart). */
export type OnsiteTimelineStepKey = "preview" | "paddle" | "absenteePhone" | "streamBroadcast";

const ONSITE_TIMELINE_TITLES: Record<OnsiteTimelineStepKey, string> = {
  preview: "Public Preview",
  paddle: "Secure a Paddle",
  absenteePhone: "Leave Absentee/Phone Bids",
  streamBroadcast: "Watch Live Broadcast",
};

const ANTI_SNIPE_RULE = formatAntiSnipingRuleSentence();

/** Short note for onsite lot pages: no web bidding. */
export function getOnsiteNoWebBiddingNote(): string {
  return "Bidding takes place in the saleroom, by telephone, or via absentee instructions submitted before the sale — not through the website.";
}

/** Online timeline / explainer step 3 body; optionally append catalogue end date. */
export function getOnlineCloseStepDescription(saleEndDate?: Date | string | null): string {
  const base = `Each lot closes on its own timer, often staggered in catalogue order. ${ANTI_SNIPE_RULE}`;
  if (!saleEndDate) return base;

  const end = saleEndDate instanceof Date ? saleEndDate : new Date(saleEndDate);
  if (Number.isNaN(end.getTime())) return base;

  const endLabel = end.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${base} The sale catalogue closes on ${endLabel}.`;
}

const PRESENTATION_STRATEGY: Record<SaleDeliveryMode, SaleTypePresentation> = {
  online: {
    key: "online",
    label: "Online",
    title: "Online Auction",
    tagline: "Bid online from anywhere",
    description: `This is a digital-only timed auction. Bidding takes place entirely online. Each lot has its own closing time, often staggered in catalogue order. Set a confidential maximum bid and the platform bids the minimum increment needed to keep you leading, when auto-bid is enabled for the lot. ${ANTI_SNIPE_RULE}`,
    colorClass:
      "bg-brand-50 text-brand-800 border-brand-200/50 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800/40",
    iconName: "Laptop",
    howToTakePart: [
      {
        stepKey: "register",
        title: "Register to Bid",
        description:
          "Sign in with an approved buyer profile. Buyer agents must register and be approved for each sale before bidding. Identity verification may also be required.",
      },
      {
        stepKey: "maxBids",
        title: "Place Max Bids",
        description:
          "Enter your maximum budget confidentially when auto-bid is enabled for the lot. The platform bids the minimum increment needed to keep you leading up to your limit.",
      },
      {
        stepKey: "lotClose",
        title: "Timed Lot Close",
        description: getOnlineCloseStepDescription(),
      },
    ],
  },
  onsite: {
    key: "onsite",
    label: "In-person",
    title: "In-person Auction",
    tagline: "Attend the physical saleroom",
    description: `This is a live saleroom event at the listed venue. ${getOnsiteNoWebBiddingNote()}`,
    colorClass:
      "bg-amber-50 text-amber-800 border-amber-200/50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40",
    iconName: "MapPin",
    howToTakePart: [
      {
        stepKey: "attendLive",
        title: "Attend & Bid Live",
        description:
          "Join us at the physical saleroom. Present your photo ID at the reception desk to register and receive your bidding paddle.",
      },
      {
        stepKey: "absenteeBid",
        title: "Submit Absentee Bid",
        description:
          "Submit a confidential maximum bid request before the sale. Our team executes approved instructions in the saleroom.",
      },
      {
        stepKey: "phoneLine",
        title: "Request a Phone Line",
        description:
          "Submit a telephone bidding request before your lot opens. A representative calls you during the live session.",
      },
      {
        stepKey: "stream",
        title: "Watch the Broadcast",
        description:
          "When a live stream is available, watch the saleroom session from your computer or mobile device.",
      },
    ],
  },
  hybrid: {
    key: "hybrid",
    label: "Hybrid",
    title: "Hybrid Auction",
    tagline: "Bid online or in the saleroom",
    description:
      "This sale supports online timed bidding and in-room participation. Register to bid on the website, or collect a paddle at reception and bid live in the saleroom. Telephone and absentee instructions are also available before lots open.",
    colorClass:
      "bg-violet-50 text-violet-900 border-violet-200/50 dark:bg-violet-950/30 dark:text-violet-200 dark:border-violet-900/40",
    iconName: "Laptop",
    howToTakePart: [
      {
        stepKey: "register",
        title: "Register to Bid",
        description:
          "Sign in with an approved buyer profile to bid online, or check in at reception for an in-room paddle.",
      },
      {
        stepKey: "maxBids",
        title: "Bid Online or In-Room",
        description:
          "Place bids on the website when lots are live, or bid through a clerk with your paddle number in the saleroom.",
      },
      {
        stepKey: "phoneLine",
        title: "Request a Phone Line",
        description:
          "Submit a telephone bidding request before your lot opens if you cannot attend in person.",
      },
      {
        stepKey: "stream",
        title: "Watch the Broadcast",
        description:
          "When a live stream is available, follow the saleroom session from your device while bidding online.",
      },
    ],
  },
};

/**
 * Returns the canonical presentation metadata for a given sale or delivery mode.
 * Supports passing a full Sale object, a partial Sale, or a raw SaleDeliveryMode string.
 */
export function getSaleTypePresentation(
  input: SaleDeliveryMode | Sale | Pick<Sale, "deliveryMode"> | undefined | null,
): SaleTypePresentation {
  if (!input) {
    return PRESENTATION_STRATEGY.onsite;
  }

  if (typeof input === "string") {
    return PRESENTATION_STRATEGY[input] ?? PRESENTATION_STRATEGY.onsite;
  }

  const mode = input.deliveryMode ?? "onsite";
  return PRESENTATION_STRATEGY[mode] ?? PRESENTATION_STRATEGY.onsite;
}

/** Canonical delivery-mode label (Online / In-person). */
export function getSaleDeliveryModeLabel(mode: SaleDeliveryMode): string {
  return getSaleTypePresentation(mode).label;
}

/** Short FAQ / policy paragraph for online timed web bidding. */
export function getOnlineBiddingSummary(): string {
  return getSaleTypePresentation("online").description;
}

/** FAQ answer for lot closing extensions on online timed sales. */
export function getOnlineClosingExtensionSummary(): string {
  return formatAntiSnipingClosingRuleParagraph();
}

/** Short FAQ / policy paragraph for in-person saleroom participation. */
export function getOnsiteParticipationSummary(): string {
  return getSaleTypePresentation("onsite").description;
}

/** Lookup canonical step copy by key from presentation metadata. */
export function getParticipationStepCopy(
  mode: SaleDeliveryMode,
  stepKey: ParticipationStepKey,
): { title: string; description: string } | null {
  const step = getSaleTypePresentation(mode).howToTakePart.find((s) => s.stepKey === stepKey);
  return step ? { title: step.title, description: step.description } : null;
}

/** Onsite participation timeline step title by key. */
export function getOnsiteTimelineStepTitleText(stepKey: OnsiteTimelineStepKey): string {
  return ONSITE_TIMELINE_TITLES[stepKey];
}
