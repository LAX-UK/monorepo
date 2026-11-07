import type pino from "pino";
import {
  type CampaignsContactKind,
  type CampaignsSkipReason,
  type CampaignsSuppressionEvent,
  mapCampaignsContact,
} from "../integrations/zoho/campaigns/campaigns-suppression-event.js";
import type { ZohoCampaignsContactSource } from "../integrations/zoho/campaigns/zoho-campaigns-contact-source.js";
import type { IZohoCampaignsSuppressionRepository } from "../interfaces/zoho-campaigns-suppression.repository.js";

export type ZohoCampaignsSuppressionSyncMode = "off" | "dry_run" | "live";

export type ZohoCampaignsSuppressionSyncSummary = {
  mode: ZohoCampaignsSuppressionSyncMode;
  /** Rows read from Zoho. */
  read: number;
  /** Events past the watermark that were (or in dry run would be) recorded. */
  due: number;
  /** Entries that changed the table; repeats and narrower reports do not count. */
  applied: number;
  skipped: Partial<Record<CampaignsSkipReason, number>>;
};

const PAGE_SIZE = 200;
/** A safety stop against a list that never ends; 100,000 contacts per list. */
const MAX_PAGES = 500;
const KINDS: readonly CampaignsContactKind[] = ["unsubscribed", "bounced"];

/**
 * Copies Zoho Campaigns unsubscribes and hard bounces into LAX's suppression list. Read-only
 * towards Zoho. Off does nothing, not even a read. The watermark moves only after every event
 * has been handled, and an event on the watermark is read again, which the upsert absorbs.
 */
export class ZohoCampaignsSuppressionSyncService {
  constructor(
    private readonly deps: {
      mode: ZohoCampaignsSuppressionSyncMode;
      source: ZohoCampaignsContactSource;
      repo: IZohoCampaignsSuppressionRepository;
      log: pino.Logger;
      now?: () => Date;
    },
  ) {}

  async run(): Promise<ZohoCampaignsSuppressionSyncSummary> {
    const { mode, source, repo, log } = this.deps;
    const summary: ZohoCampaignsSuppressionSyncSummary = {
      mode,
      read: 0,
      due: 0,
      applied: 0,
      skipped: {},
    };
    if (mode === "off") return summary;

    const now = (this.deps.now ?? (() => new Date()))();
    const since = await repo.getWatermark(mode);
    let newest: Date | null = null;

    for (const kind of KINDS) {
      for (let page = 0; page < MAX_PAGES; page++) {
        const rows = await source.listContacts(kind, {
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        for (const row of rows) {
          summary.read++;
          const mapped = mapCampaignsContact(kind, row);
          if (!mapped.ok) {
            summary.skipped[mapped.skip] = (summary.skipped[mapped.skip] ?? 0) + 1;
            continue;
          }
          const event = mapped.event;
          if (!isDue(event, since)) continue;
          summary.due++;
          if (event.occurredAt && (!newest || event.occurredAt > newest)) newest = event.occurredAt;
          if (mode === "live" && (await repo.suppress(event.emailHash, event.reason))) {
            summary.applied++;
          }
        }
        if (rows.length < PAGE_SIZE) break;
      }
    }

    if (newest) await repo.advanceWatermark(mode, newest, now);
    log.info({ ...summary }, "zoho campaigns suppression sync finished");
    return summary;
  }
}

/** A row with no readable time is always handled, since an upsert of a repeat changes nothing. */
function isDue(event: CampaignsSuppressionEvent, since: Date | null): boolean {
  if (!since || !event.occurredAt) return true;
  return event.occurredAt >= since;
}
