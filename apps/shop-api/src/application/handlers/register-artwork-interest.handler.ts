import { isArtworkEligibleForEnquiry } from "../artwork-enquiry-policy.js";
import type { ArtworkInterestIntent } from "../artwork-interest-intent.js";
import { isArtworkEligibleForNotifyMeSubscription } from "../artwork-notify-me-policy.js";
import type { EnquirySender } from "../enquiry-sender.js";
import type { ArtworkInterestWriter } from "../ports/artwork-interest.writer.js";

export type RegisterArtworkInterestHandlerResult =
  | { status: "registered" | "already_subscribed"; reference: string | null }
  | { status: "artwork_not_found" }
  | { status: "not_subscribable" };

function isEligibleForIntent(
  intent: ArtworkInterestIntent,
  context: {
    eligibleForEditionAllocation: boolean;
    printPricePence: number | null;
    editionsAvailable: number;
    saleState: "for_sale" | "price_on_application" | "sold";
  },
): boolean {
  if (intent === "enquiry") {
    return isArtworkEligibleForEnquiry({
      eligibleForEditionAllocation: context.eligibleForEditionAllocation,
      saleState: context.saleState,
    });
  }
  return isArtworkEligibleForNotifyMeSubscription({
    eligibleForEditionAllocation: context.eligibleForEditionAllocation,
    printPricePence: context.printPricePence,
    editionsAvailable: context.editionsAvailable,
    saleState: context.saleState,
  });
}

export function createRegisterArtworkInterestHandler(writer: ArtworkInterestWriter) {
  return async (input: {
    artworkSlug: string;
    sender: EnquirySender;
    intent: ArtworkInterestIntent;
    message?: string | undefined;
    contactPhone?: string | undefined;
  }): Promise<RegisterArtworkInterestHandlerResult> => {
    const context = await writer.loadInterestContext(input.artworkSlug);
    if (!context) {
      return { status: "artwork_not_found" };
    }
    if (!isEligibleForIntent(input.intent, context)) {
      return { status: "not_subscribable" };
    }
    const result = await writer.registerInterest({
      artworkId: context.artworkId,
      artworkSlug: context.artworkSlug,
      salesChannel: context.salesChannel,
      sender: input.sender,
      intent: input.intent,
      ...(input.intent === "enquiry" && input.message ? { message: input.message } : {}),
      ...(input.intent === "enquiry" && input.contactPhone
        ? { contactPhone: input.contactPhone }
        : {}),
    });
    if (result.status === "not_found") {
      return { status: "artwork_not_found" };
    }
    return result;
  };
}
