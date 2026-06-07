import { submissionMarketingDetailsFromSubmission } from "@auction/domain";
import type { CreateLotInput, ItemSubmission } from "@auction/types";

const WEEK_MS = 7 * 86_400_000;

/** Maps an accepted submission into a draft catalog lot (admin adjusts schedule before publish). */
export function submissionToCreateLotInput(submission: ItemSubmission): CreateLotInput {
  const now = Date.now();
  const startTime = new Date(now + WEEK_MS);
  const endTime = new Date(now + 2 * WEEK_MS);
  const startingPrice = submission.askingPrice?.trim() ? submission.askingPrice : "1.00";
  const marketingDetails = submissionMarketingDetailsFromSubmission({
    ...(submission.provenance?.length ? { provenance: submission.provenance } : {}),
    ...(submission.exhibitions?.length ? { exhibitions: submission.exhibitions } : {}),
    ...(submission.conditionSelfReport?.trim()
      ? { conditionSelfReport: submission.conditionSelfReport }
      : {}),
  });

  const descriptionParts = [
    submission.description?.trim(),
    submission.yearOfWork?.trim() ? `Year: ${submission.yearOfWork.trim()}` : null,
    submission.edition?.trim() ? `Edition: ${submission.edition.trim()}` : null,
    submission.isSigned
      ? `Signed${submission.signatureNote?.trim() ? `: ${submission.signatureNote.trim()}` : ""}`
      : null,
  ].filter(Boolean);

  return {
    title: submission.title,
    sellerLegalEntityId: submission.legalEntityId,
    description: descriptionParts.length ? descriptionParts.join("\n\n") : undefined,
    medium: submission.medium ?? undefined,
    dimensions: submission.dimensions ?? undefined,
    images: submission.images.length ? submission.images : undefined,
    categoryIds: submission.categoryIds ?? [submission.categoryId],
    auctionType: "english",
    startingPrice,
    reservePrice: submission.reservePrice?.trim() ? submission.reservePrice : undefined,
    startTime,
    endTime,
    ...(Object.keys(marketingDetails).length > 0 ? { marketingDetails } : {}),
  };
}
