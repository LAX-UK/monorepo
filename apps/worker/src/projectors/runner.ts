import { domainEvent, projectorState } from "@auction/db";
import type { IEmailService } from "@auction/email";
import { eq, gt, sql } from "drizzle-orm";
import type pino from "pino";
import { processAdminImpersonationNotify } from "./admin-impersonation-notify.js";
import { AML_MATCH_REVIEW_PROJECTOR, processAmlMatchReview } from "./aml-match-review.js";
import { processClearArtistBlocks } from "./clear-artist-blocks.js";
import { processLegalEntityProvisioning } from "./legal-entity-provisioning.js";
import { redactDomainEventPayload } from "./lib/redact-pii.js";
import { processLotVoidedAntiShillingAdminNotify } from "./lot-voided-anti-shilling-admin-notify.js";
import { NOTIFICATION_FANOUT_PROJECTOR, processNotificationFanout } from "./notification-fanout.js";
import { processPaymentRefundNotify } from "./payment-refund-notify.js";
import { processPayoutTransferFailedNotify } from "./payout-transfer-failed-notify.js";
import {
  SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR,
  processSourceOfFundsReviewResolution,
} from "./source-of-funds-review-resolution.js";
import {
  SOURCE_OF_FUNDS_REVIEW_PROJECTOR,
  processSourceOfFundsReview,
} from "./source-of-funds-review.js";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;
type ProjectorEventRow = {
  id: number;
  event_type: string;
  payload: unknown;
};

function rowsFromExecuteResult(result: unknown): ProjectorEventRow[] {
  if (Array.isArray(result)) return result as ProjectorEventRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: ProjectorEventRow[] }).rows ?? [];
  }
  return [];
}

/** Domain events that should (re)sync a user into the marketing-contacts ESP. */
const MARKETING_CONTACT_EVENT_REASONS: Record<string, string | undefined> = {
  "user.registered": "registered",
  "user.email_verified": "email_verified",
  "user.deletion_requested": "deletion_requested",
  "kyc.verified": "kyc_verified",
};

function userIdFromEvent(payload: unknown, aggregateId: string): string | null {
  if (payload && typeof payload === "object") {
    const candidate = (payload as Record<string, unknown>).userId;
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return aggregateId.length > 0 ? aggregateId : null;
}

export function createProjectorRunner(options: {
  db: Db;
  log: pino.Logger;
  heartbeat: () => Promise<void>;
  /** when set, `payout.paid` events trigger Xero bill sync via API. */
  syncXeroPayoutBill?: (payoutId: string) => Promise<boolean>;
  /** transactional email outbox for impersonation notices. */
  emailService?: IEmailService;
  /** when set, registration/verification events enqueue a marketing-contacts ESP sync. */
  enqueueMarketingContactSync?: (data: {
    userId: string;
    reason: string;
    eventId: number;
  }) => Promise<void>;
  supportContactEmail?: string;
  /** URL to admin payouts dashboard for failed transfer notifications. */
  adminPayoutsUrl?: string;
  /** Platform admin email address for ops notifications. */
  adminEmailAddress?: string;
  /** Web origin for admin lot URLs in ops emails. */
  webOrigin?: string;
}) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function ensureCursor(projectorName: string) {
    await options.db
      .insert(projectorState)
      .values({ projectorName, lastProcessedEventId: 0 })
      .onConflictDoNothing();
  }

  async function processZoho() {
    await options.db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        select id, event_type, payload
        from ${domainEvent}
        where id > (select last_processed_event_id from ${projectorState} where projector_name = 'zoho')
        order by id
        limit 100
        for update skip locked
      `);
      const events = rowsFromExecuteResult(rows);
      for (const event of events) {
        options.log.info(
          {
            eventId: event.id,
            eventType: event.event_type,
            payload: redactDomainEventPayload(event.event_type, event.payload),
          },
          "projector observed event",
        );
      }
      const maxId = Math.max(0, ...events.map((event) => Number(event.id)));
      if (maxId > 0) {
        await tx
          .update(projectorState)
          .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
          .where(sql`${projectorState.projectorName} = 'zoho'`);
      }
    });
  }

  async function processMarketingContacts() {
    const enqueue = options.enqueueMarketingContactSync;
    if (!enqueue) return;
    const projectorName = "marketing_contacts";
    await ensureCursor(projectorName);
    await options.db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        select id, event_type, aggregate_id, payload
        from ${domainEvent}
        where id > (select last_processed_event_id from ${projectorState} where projector_name = ${projectorName})
        order by id
        limit 100
        for update skip locked
      `);
      const events = rowsFromExecuteResult(rows) as Array<
        ProjectorEventRow & { aggregate_id: string }
      >;
      for (const event of events) {
        const reason = MARKETING_CONTACT_EVENT_REASONS[event.event_type];
        if (!reason) continue;
        const userId = userIdFromEvent(event.payload, event.aggregate_id);
        if (!userId) {
          options.log.warn({ eventId: event.id }, "marketing_contact_sync_skipped_missing_user");
          continue;
        }
        // Enqueue inside the cursor transaction; the worker uses a stable jobId so a
        // retried tick (cursor not yet advanced) collapses to the same BullMQ job.
        await enqueue({ userId, reason, eventId: Number(event.id) });
      }
      const maxId = Math.max(0, ...events.map((event) => Number(event.id)));
      if (maxId > 0) {
        await tx
          .update(projectorState)
          .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
          .where(sql`${projectorState.projectorName} = ${projectorName}`);
      }
    });
  }

  async function processXero() {
    const [cursorRow] = await options.db
      .select({ last: projectorState.lastProcessedEventId })
      .from(projectorState)
      .where(eq(projectorState.projectorName, "xero"))
      .limit(1);
    const cursor = cursorRow?.last ?? 0;

    const rows = await options.db
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        aggregateId: domainEvent.aggregateId,
      })
      .from(domainEvent)
      .where(gt(domainEvent.id, cursor))
      .orderBy(domainEvent.id)
      .limit(100);

    if (rows.length === 0) {
      return;
    }

    let maxId = cursor;
    for (const row of rows) {
      maxId = row.id;
      if (row.eventType === "payout.paid" && options.syncXeroPayoutBill) {
        const ok = await options.syncXeroPayoutBill(row.aggregateId).catch((err: unknown) => {
          options.log.error({ err, payoutId: row.aggregateId }, "xero_payout_bill_sync_threw");
          return false;
        });
        if (!ok) {
          maxId = Math.max(cursor, row.id - 1);
          break;
        }
      }
    }

    if (maxId > cursor) {
      await options.db
        .update(projectorState)
        .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
        .where(eq(projectorState.projectorName, "xero"));
    }
  }

  async function processImpersonationEmails() {
    if (!options.emailService || !options.supportContactEmail) {
      return;
    }
    await ensureCursor("admin_impersonation_notify");
    await processAdminImpersonationNotify({
      db: options.db,
      log: options.log,
      emailService: options.emailService,
      supportContactEmail: options.supportContactEmail,
    });
  }

  async function processPayoutTransferFailedEmails() {
    if (!options.emailService || !options.supportContactEmail || !options.adminPayoutsUrl) {
      return;
    }
    await ensureCursor("payout_transfer_failed_notify");
    await processPayoutTransferFailedNotify({
      db: options.db,
      log: options.log,
      emailService: options.emailService,
      supportContactEmail: options.supportContactEmail,
      adminPayoutsUrl: options.adminPayoutsUrl,
    });
  }

  async function processPaymentRefundEmails() {
    if (!options.emailService || !options.supportContactEmail) {
      return;
    }
    await ensureCursor("payment_refund_notify");
    await processPaymentRefundNotify({
      db: options.db,
      log: options.log,
      emailService: options.emailService,
      supportContactEmail: options.supportContactEmail,
      adminEmailAddress: options.adminEmailAddress,
    });
  }

  async function processLotVoidedAntiShillingEmails() {
    if (!options.emailService || !options.supportContactEmail || !options.webOrigin) {
      return;
    }
    await ensureCursor("lot_voided_anti_shilling_admin_notify");
    await processLotVoidedAntiShillingAdminNotify({
      db: options.db,
      log: options.log,
      emailService: options.emailService,
      supportContactEmail: options.supportContactEmail,
      adminEmailAddress: options.adminEmailAddress,
      webOrigin: options.webOrigin,
    });
  }

  async function processNotificationFanoutEmails() {
    if (!options.emailService || !options.supportContactEmail || !options.adminPayoutsUrl) {
      return;
    }
    await ensureCursor(NOTIFICATION_FANOUT_PROJECTOR);
    await processNotificationFanout({
      db: options.db,
      log: options.log,
      emailService: options.emailService,
      supportContactEmail: options.supportContactEmail,
      adminPayoutsUrl: options.adminPayoutsUrl,
      adminEmailAddress: options.adminEmailAddress,
      webOrigin: options.webOrigin,
    });
  }

  async function tick() {
    await ensureCursor("zoho");
    await ensureCursor("xero");
    await processZoho();
    await processXero();
    await processMarketingContacts();
    await processImpersonationEmails();
    await processPayoutTransferFailedEmails();
    await processNotificationFanoutEmails();
    await processPaymentRefundEmails();
    await processLotVoidedAntiShillingEmails();
    await ensureCursor("clear_artist_blocks");
    await processClearArtistBlocks({ db: options.db, log: options.log });
    await processLegalEntityProvisioning({ db: options.db, log: options.log });
    await ensureCursor(AML_MATCH_REVIEW_PROJECTOR);
    await processAmlMatchReview({
      db: options.db,
      log: options.log,
      emailService: options.emailService,
      supportContactEmail: options.supportContactEmail,
      webOrigin: options.webOrigin,
      adminEmailAddress: options.adminEmailAddress,
    });
    await ensureCursor(SOURCE_OF_FUNDS_REVIEW_PROJECTOR);
    await processSourceOfFundsReview({
      db: options.db,
      log: options.log,
      emailService: options.emailService,
      supportContactEmail: options.supportContactEmail,
      webOrigin: options.webOrigin,
      adminEmailAddress: options.adminEmailAddress,
    });
    await ensureCursor(SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR);
    await processSourceOfFundsReviewResolution({
      db: options.db,
      log: options.log,
    });
    await options.heartbeat();
  }

  async function loop() {
    if (stopped) return;
    try {
      await tick();
    } catch (err) {
      options.log.error({ err }, "projector tick failed");
    }
    if (!stopped) timer = setTimeout(loop, 1500);
  }

  return {
    start() {
      void loop();
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
