import type { SubscriptionConfirmedHook } from "@auction/alerts";
import { emailHash } from "@auction/email";
import type { IEmailSuppressionRepository } from "@auction/persistence/interfaces";
import type { AppLogger } from "../lib/logger.js";

/**
 * The "subscription became confirmed" step for Bid, shared by the confirm link and by a signed-in
 * account switching alerts on: the person is asking for mail, so an old Zoho Campaigns opt-out no
 * longer holds. The lift is recorded at the time they asked, so the daily sync does not bring the
 * same opt-out back.
 */
export function liftOptOutOnConfirm(
  suppressions: Pick<IEmailSuppressionRepository, "liftMarketingOptOut">,
  log: Pick<AppLogger, "warn">,
): SubscriptionConfirmedHook {
  return async ({ subscriberId, email, at }) => {
    try {
      await suppressions.liftMarketingOptOut(emailHash(email), at);
    } catch (err) {
      // Never the address: the subscriber id is enough to find the retry.
      log.warn(
        { subscriberId, err: err instanceof Error ? err.message : String(err) },
        "bid alert confirm: Campaigns opt-out lift failed",
      );
      throw err;
    }
  };
}
