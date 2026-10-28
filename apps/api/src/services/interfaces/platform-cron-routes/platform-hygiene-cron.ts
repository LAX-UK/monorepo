import type { HygieneCronService } from "../../cron/hygiene-cron.service.js";

export interface IPlatformHygieneCronApplicationService {
  sendStaleSubmissionDraftReminders(
    staleDays: number,
  ): ReturnType<HygieneCronService["sendStaleSubmissionDraftReminders"]>;
  sendConsignmentAgreementReminders(): ReturnType<
    HygieneCronService["sendConsignmentAgreementReminders"]
  >;
  probeSentry(sentryDsn: string | undefined): ReturnType<HygieneCronService["probeSentry"]>;
  reconcileAmlWatchlist(
    providerSessionId: string,
  ): ReturnType<HygieneCronService["reconcileAmlWatchlist"]>;
  cleanupDisplayPairings(): ReturnType<HygieneCronService["cleanupDisplayPairings"]>;
}
