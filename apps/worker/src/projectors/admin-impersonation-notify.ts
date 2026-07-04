import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const PROJECTOR_NAME = "admin_impersonation_notify";

type StartedPayload = {
  impersonating_user_id: string;
  target_legal_entity_id: string;
  target_legal_entity_display_name: string;
  session_id: string;
  expires_at: string;
};

export async function processAdminImpersonationNotify(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
}): Promise<void> {
  const { ctx, log, emailService, supportContactEmail } = options;
  const { projectorStateRepo, domainEventReader, adminImpersonationNotifyReader } = ctx;

  const cursor = await projectorStateRepo.getCursor(PROJECTOR_NAME);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["admin.impersonation_started"],
    limit: 50,
  });

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
      const adminDisplayName = await adminImpersonationNotifyReader.getAdminDisplayName(
        payload.impersonating_user_id,
      );
      const members = await adminImpersonationNotifyReader.listEntityOwnerAdmins(
        payload.target_legal_entity_id,
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
    await projectorStateRepo.advanceCursor(PROJECTOR_NAME, maxId);
  }
}
