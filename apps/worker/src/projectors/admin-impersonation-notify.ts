import { domainEvent, legalEntityMember, projectorState, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { and, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type pino from "pino";

const PROJECTOR_NAME = "admin_impersonation_notify";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type StartedPayload = {
  impersonating_user_id: string;
  target_legal_entity_id: string;
  target_legal_entity_display_name: string;
  session_id: string;
  expires_at: string;
};

export async function processAdminImpersonationNotify(options: {
  db: Db;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
}): Promise<void> {
  const { db, log, emailService, supportContactEmail } = options;

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
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(
      and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "admin.impersonation_started")),
    )
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    const payload = row.payload as StartedPayload;
    if (
      !payload?.impersonating_user_id ||
      !payload.target_legal_entity_id ||
      !payload.target_legal_entity_display_name ||
      !payload.session_id
    ) {
      log.warn({ eventId: row.id }, "admin_impersonation_notify_skipped_malformed_payload");
      maxId = row.id;
      continue;
    }

    try {
      const [adminUser] = await db
        .select({ name: user.name, firstName: user.firstName })
        .from(user)
        .where(eq(user.id, payload.impersonating_user_id))
        .limit(1);
      const adminDisplayName =
        adminUser?.firstName?.trim() || adminUser?.name?.trim() || "LAX support";

      const members = await db
        .selectDistinct({
          email: user.email,
          userId: user.id,
          firstName: user.firstName,
        })
        .from(legalEntityMember)
        .innerJoin(user, eq(user.id, legalEntityMember.userId))
        .where(
          and(
            eq(legalEntityMember.legalEntityId, payload.target_legal_entity_id),
            isNull(legalEntityMember.removedAt),
            isNotNull(legalEntityMember.acceptedAt),
            or(
              inArray(legalEntityMember.role, ["owner", "admin"]),
              eq(legalEntityMember.isPrimaryAdmin, true),
            ),
          ),
        );

      const windowEnd = new Date(payload.expires_at);
      const windowEndDisplay = Number.isNaN(windowEnd.getTime())
        ? payload.expires_at
        : windowEnd.toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          });

      for (const m of members) {
        await emailService.enqueue({
          template: "admin-impersonation-notice",
          to: m.email,
          userId: m.userId,
          vars: {
            recipientFirstName: m.firstName,
            entityName: payload.target_legal_entity_display_name,
            adminDisplayName,
            windowEndDisplay,
            supportContactEmail,
          },
          category: "transactional",
          idempotencyKey: `admin-impersonation-notice:${payload.session_id}:${m.userId}`,
        });
      }
      maxId = row.id;
    } catch (err) {
      log.error(
        { err, eventId: row.id, sessionId: payload.session_id },
        "admin_impersonation_notify_failed",
      );
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
