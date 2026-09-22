import { isArtworkEligibleForEnquiry } from "../artwork-enquiry-policy.js";
import type { ArtworkInterestIntent } from "../artwork-interest-intent.js";
import { isArtworkEligibleForNotifyMeSubscription } from "../artwork-notify-me-policy.js";
import type { ArtworkInterestWriter } from "../ports/artwork-interest.writer.js";

export type RegisterArtworkInterestHandlerResult =
  | "registered"
  | "already_subscribed"
  | "artwork_not_found"
  | "not_subscribable";

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
    identitySubjectId: string;
    intent: ArtworkInterestIntent;
  }): Promise<RegisterArtworkInterestHandlerResult> => {
    const context = await writer.loadInterestContext(input.artworkSlug);
    if (!context) {
      return "artwork_not_found";
    }
    if (!isEligibleForIntent(input.intent, context)) {
      return "not_subscribable";
    }
    const result = await writer.registerInterest({
      artworkId: context.artworkId,
      artworkSlug: context.artworkSlug,
      identitySubjectId: input.identitySubjectId,
      intent: input.intent,
    });
    if (result === "not_found") {
      return "artwork_not_found";
    }
    return result;
  };
}
