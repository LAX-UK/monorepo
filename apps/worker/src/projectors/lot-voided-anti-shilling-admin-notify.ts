import { domainEvent, lot, projectorState } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { and, eq, gt } from "drizzle-orm";
import type pino from "pino";

const PROJECTOR_NAME = "lot_voided_anti_shilling_admin_notify";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type VoidedPayload = {
  reason?: string;
  lotId?: string;
};

export async function processLotVoidedAntiShillingAdminNotify(options: {
  db: Db;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
  adminEmailAddress: string;
  webOrigin: string;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail, adminEmailAddress, webOrigin } = options;

  await db
    .insert(projectorState)
    .values({ projectorName: PROJECTOR_NAME, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, PROJECTOR_NAME))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "lot.voided")))
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  const base = webOrigin.replace(/\/$/, "");

  for (const row of rows) {
    const payload = row.payload as VoidedPayload;
    if (payload?.reason !== "no_valid_winner" && payload?.reason !== "anti_shilling_at_close") {
      maxId = row.id;
      continue;
    }

    const lotId = row.aggregateId;
    try {
      const [lotRow] = await db
        .select({ title: lot.title })
        .from(lot)
        .where(eq(lot.id, lotId))
        .limit(1);
      const lotTitle = lotRow?.title ?? "Lot";

      await emailService.enqueue({
        template: "lot-voided-anti-shilling-admin",
        to: adminEmailAddress,
        vars: {
          lotTitle,
          lotId,
          adminLotUrl: `${base}/admin/lots/${lotId}`,
          supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `lot-voided-anti-shilling-admin:${lotId}`,
      });
      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id, lotId }, "lot_voided_anti_shilling_admin_notify_failed");
      return;
    }
  }

  if (maxId > cursor) {
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, PROJECTOR_NAME));
  }
}
