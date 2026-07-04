import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const PROJECTOR_NAME = "lot_voided_anti_shilling_admin_notify";

type VoidedPayload = {
  reason?: string;
  lotId?: string;
};

export async function processLotVoidedAntiShillingAdminNotify(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  emailService: IEmailService;
  supportContactEmail: string;
  webOrigin: string;
}): Promise<void> {
  const { ctx, log, emailService, supportContactEmail, webOrigin } = options;
  const {
    projectorStateRepo,
    domainEventReader,
    lotNotifyReader,
    staffOpsRecipientReader,
    adminEmailAddress,
  } = ctx;

  const cursor = await projectorStateRepo.getCursor(PROJECTOR_NAME);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["lot.voided"],
    limit: 50,
  });

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
      const lotTitle = (await lotNotifyReader.getLotTitle(lotId)) ?? "Lot";

      const staffOps = await staffOpsRecipientReader.listRecipients();
      if (staffOps.length > 0) {
        for (const s of staffOps) {
          await emailService.enqueue({
            template: "lot-voided-anti-shilling-admin",
            to: s.email,
            userId: s.id,
            vars: {
              lotTitle,
              lotId,
              adminLotUrl: `${base}/admin/lots/${lotId}`,
              supportContactEmail,
            },
            category: "transactional",
            idempotencyKey: `lot-voided-anti-shilling-admin:${lotId}:ops:${s.id}`,
          });
        }
      } else if (adminEmailAddress) {
        await emailService.enqueue({
          template: "lot-voided-anti-shilling-admin",
          to: adminEmailAddress,
          recipientResolution: "snapshot",
          vars: {
            lotTitle,
            lotId,
            adminLotUrl: `${base}/admin/lots/${lotId}`,
            supportContactEmail,
          },
          category: "transactional",
          idempotencyKey: `lot-voided-anti-shilling-admin:${lotId}:admin`,
        });
      }
      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id, lotId }, "lot_voided_anti_shilling_admin_notify_failed");
      return;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(PROJECTOR_NAME, maxId);
  }
}
