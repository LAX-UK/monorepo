import type { HygieneCronService } from "../../cron/hygiene-cron.service.js";

export interface IPlatformHygieneCronApplicationService {
  purgeExpiredVerifications(): ReturnType<HygieneCronService["purgeExpiredVerifications"]>;
  sendStaleSubmissionDraftReminders(
    staleDays: number,
  ): ReturnType<HygieneCronService["sendStaleSubmissionDraftReminders"]>;
  probeSentry(sentryDsn: string | undefined): ReturnType<HygieneCronService["probeSentry"]>;
  reconcileAmlWatchlist(
    providerSessionId: string,
  ): ReturnType<HygieneCronService["reconcileAmlWatchlist"]>;
  cleanupDisplayPairings(): ReturnType<HygieneCronService["cleanupDisplayPairings"]>;
}
