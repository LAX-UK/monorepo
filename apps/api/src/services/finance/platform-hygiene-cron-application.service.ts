import type { HygieneCronService } from "../cron/hygiene-cron.service.js";
import type { IPlatformHygieneCronApplicationService } from "../interfaces/platform-cron-routes/platform-hygiene-cron.js";

export class PlatformHygieneCronApplicationService
  implements IPlatformHygieneCronApplicationService
{
  constructor(private readonly hygieneCronService: HygieneCronService) {}

  sendStaleSubmissionDraftReminders(staleDays: number) {
    return this.hygieneCronService.sendStaleSubmissionDraftReminders(staleDays);
  }

  probeSentry(sentryDsn: string | undefined) {
    return this.hygieneCronService.probeSentry(sentryDsn);
  }

  reconcileAmlWatchlist(providerSessionId: string) {
    return this.hygieneCronService.reconcileAmlWatchlist(providerSessionId);
  }

  cleanupDisplayPairings() {
    return this.hygieneCronService.cleanupDisplayPairings();
  }
}
