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
  /** Events newer than the watermark: what is new since the last pass. A metric only. */
  due: number;
  /** Entries that changed the table; repeats and narrower reports do not count (live only). */
  applied: number;
  skipped: Partial<Record<CampaignsSkipReason, number>>;
};

const PAGE_SIZE = 200;
/** A safety stop against a list that never ends; 100,000 contacts per list. */
const MAX_PAGES = 500;
const KINDS: readonly CampaignsContactKind[] = ["unsubscribed", "bounced"];

/**
 * Copies Zoho Campaigns unsubscribes and hard bounces into LAX's suppression list. Read-only
 * towards Zoho. Off does nothing, not even a read. Every pass reads the whole lists anyway, and
 * the upsert is idempotent and only ever widens an entry, so every row is applied, however old:
 * an unsubscribe that reaches the list late is still recorded. The watermark is kept for the
 * summary only (how much is new since the last pass); it never decides what is recorded.
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
          if (isNewSince(event, since)) summary.due++;
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

/** A row with no readable time counts as new: it cannot be shown to be old. */
function isNewSince(event: CampaignsSuppressionEvent, since: Date | null): boolean {
  if (!since || !event.occurredAt) return true;
  return event.occurredAt >= since;
}
