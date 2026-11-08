import { alertSubscriptionConfirmedPayloadSchemaV1 } from "@auction/types";
import type pino from "pino";
import type { IZohoCampaignsOptOutLiftRepository } from "../interfaces/zoho-campaigns-suppression.repository.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR = "zoho_campaigns_opt_out_lift";
const EVENT_TYPE = "alert.subscription.confirmed";

/**
 * A person confirmed an alert subscription on LAX Shop or lax.art, so an old Zoho Campaigns
 * marketing opt-out no longer holds. shop_app cannot touch the suppression list; the lift is done
 * here, through the one function that records it and removes only that kind of entry. An event
 * that does not parse is dropped with a log line: retrying it cannot make it valid.
 */
export async function applyOptOutLiftEvent(
  repo: IZohoCampaignsOptOutLiftRepository,
  row: { id: number; payload: unknown },
  log: pino.Logger,
): Promise<void> {
  const parsed = alertSubscriptionConfirmedPayloadSchemaV1.safeParse(row.payload);
  if (!parsed.success) {
    log.error({ eventId: row.id }, "zoho_campaigns_opt_out_lift_invalid_payload");
    return;
  }
  await repo.liftOptOut(parsed.data.emailHash, new Date(parsed.data.confirmedAt));
}

export async function processZohoCampaignsOptOutLift(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const { projectorStateRepo, domainEventReader, zohoCampaignsOptOutLiftRepo } = ctx;

  const cursor = await projectorStateRepo.getCursor(ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR);
  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [EVENT_TYPE],
    limit: 100,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      await applyOptOutLiftEvent(zohoCampaignsOptOutLiftRepo, row, log);
      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id }, "zoho_campaigns_opt_out_lift_failed");
      break;
    }
  }
  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR, maxId);
  }
}
