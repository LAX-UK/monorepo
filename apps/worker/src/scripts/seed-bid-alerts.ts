import { createDb } from "@auction/db";
import { BidAlertSeed } from "@auction/persistence/repositories";
import { BID_ALERT_MATCHING_PROJECTOR } from "../projectors/bid-alert-matching.js";

/**
 * First-run seed for Bid alerts. Marks every sale already published as announced and starts the
 * matcher at the newest event, so switching alerts on announces nothing old. Safe to run twice.
 */
async function main() {
  const url = process.env.DATABASE_URL_WORKER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_WORKER or DATABASE_URL is required");
  const result = await new BidAlertSeed(createDb(url)).run(
    BID_ALERT_MATCHING_PROJECTOR,
    new Date(),
  );
  console.info(
    result.alreadySeeded
      ? "Bid alerts were already seeded. Nothing changed."
      : `Bid alerts seeded: ${result.alreadyAnnounced} published sales marked announced, matcher starts after event ${result.cursor}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
