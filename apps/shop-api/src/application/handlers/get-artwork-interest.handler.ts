import { isArtworkEligibleForEnquiry } from "../artwork-enquiry-policy.js";
import type { ArtworkInterestIntent } from "../artwork-interest-intent.js";
import { isArtworkEligibleForNotifyMeSubscription } from "../artwork-notify-me-policy.js";
import type { ArtworkInterestWriter } from "../ports/artwork-interest.writer.js";

export type GetArtworkInterestHandlerResult = { subscribed: boolean } | "artwork_not_found";

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

export function createGetArtworkInterestHandler(writer: ArtworkInterestWriter) {
  return async (input: {
    artworkSlug: string;
    identitySubjectId: string;
    intent: ArtworkInterestIntent;
  }): Promise<GetArtworkInterestHandlerResult> => {
    const context = await writer.loadInterestContext(input.artworkSlug);
    if (!context) {
      return "artwork_not_found";
    }
    if (!isEligibleForIntent(input.intent, context)) {
      return { subscribed: false };
    }
    return writer.getInterestStatus({
      artworkId: context.artworkId,
      identitySubjectId: input.identitySubjectId,
      intent: input.intent,
    });
  };
}
