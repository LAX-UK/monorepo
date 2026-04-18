import type { CreateLotInput, ItemSubmission } from "@auction/types";

const WEEK_MS = 7 * 86_400_000;

/** Maps an approved submission into a draft catalog lot (admin adjusts schedule before publish). */
export function submissionToCreateLotInput(submission: ItemSubmission): CreateLotInput {
  const now = Date.now();
  const startTime = new Date(now + WEEK_MS);
  const endTime = new Date(now + 2 * WEEK_MS);
  const startingPrice = submission.askingPrice?.trim() ? submission.askingPrice : "1.00";
  return {
    title: submission.title,
    description: submission.description ?? undefined,
    medium: submission.medium ?? undefined,
    dimensions: submission.dimensions ?? undefined,
    images: submission.images.length ? submission.images : undefined,
    categoryId: submission.categoryId,
    auctionType: "english",
    startingPrice,
    reservePrice: submission.reservePrice?.trim() ? submission.reservePrice : undefined,
    startTime,
    endTime,
  };
}
