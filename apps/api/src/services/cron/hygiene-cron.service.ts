import type { Database } from "@auction/db";
import { verification } from "@auction/db/schema";
import { probeSentryConnectivity } from "@auction/observability";
import { inArray, lt } from "drizzle-orm";
import type { AmlService } from "../aml/aml.service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-service.js";

export class HygieneCronService {
  constructor(
    private readonly authDb: Database,
    private readonly itemSubmissionAdminApi: IItemSubmissionAdminApi,
    private readonly amlService: AmlService,
    private readonly displayPairingService: IDisplayPairingService,
  ) {}

  async purgeExpiredVerifications() {
    const now = new Date();
    const batchSize = 500;
    const deleted = await this.authDb
      .delete(verification)
      .where(
        inArray(
          verification.id,
          this.authDb
            .select({ id: verification.id })
            .from(verification)
            .where(lt(verification.expiresAt, now))
            .limit(batchSize),
        ),
      )
      .returning({ id: verification.id });
    return { deleted: deleted.length, capped: deleted.length === batchSize };
  }

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
