import { probeSentryConnectivity } from "@auction/observability";
import type { AmlService } from "../aml/aml.service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-apis.js";

export class HygieneCronService {
  constructor(
    private readonly itemSubmissionAdminApi: IItemSubmissionAdminApi,
    private readonly amlService: AmlService,
    private readonly displayPairingService: IDisplayPairingService,
  ) {}

  async sendStaleSubmissionDraftReminders(staleDays: number) {
    return this.itemSubmissionAdminApi.sendStaleDraftReminders({ staleDays });
  }

  async probeSentry(sentryDsn: string | undefined) {
    if (!sentryDsn) {
      return { ok: false as const, error: "sentry_not_configured" };
    }
    const eventId = await probeSentryConnectivity();
    return { ok: true as const, eventId };
  }

  async reconcileAmlWatchlist(providerSessionId: string) {
    return this.amlService.ingestFromFetch(providerSessionId);
  }

  async cleanupDisplayPairings() {
    return this.displayPairingService.cleanupStalePairings();
  }
}
