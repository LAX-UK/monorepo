import { assertDomainEventConsumerContract } from "@auction/types";
import { classifyZohoError } from "../integrations/zoho/retry-classification.js";
import { zohoCrmUpsert } from "../integrations/zoho/zoho-crm-client.js";
import {
  shouldLogZohoDryRun,
  shouldPerformZohoHttp,
} from "../integrations/zoho/zoho-crm-config.js";
import { mapDomainEventToZohoUpsert } from "../integrations/zoho/zoho-event-mapper.js";
import { recordDeliveryOutcome } from "../lib/delivery-metrics.js";
import { claimAndRunDomainEventDeliveries } from "./lib/domain-event-delivery-runner.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { redactDomainEventPayload } from "./lib/redact-pii.js";

export const ZOHO_PROJECTOR = "zoho";
const ZOHO_CONSUMER = "zoho";

const ZOHO_CONTRACT_EVENT_TYPES = new Set([
  "user.registered",
  "user.email_verified",
  "user.linked_external",
  "bid.lot_won",
  "bid.first_for_user",
  "bid.outbid",
  "lot.ended",
  "payment.captured",
]);

async function deliverZohoEvent(
  ctx: ProjectorRunContext,
  event: {
    id: number;
    eventType: string;
    aggregateId: string;
    payload: unknown;
    schemaVersion?: number;
  },
): Promise<void> {
  if (!ctx.env) throw new Error("zoho_projector_missing_env");
  if (ZOHO_CONTRACT_EVENT_TYPES.has(event.eventType)) {
    assertDomainEventConsumerContract(event);
  }
  const upsert = mapDomainEventToZohoUpsert(event);
  if (!upsert) {
    ctx.log.debug({ eventId: event.id, eventType: event.eventType }, "zoho_skip_unmapped_event");
    return;
  }

  if (shouldLogZohoDryRun(ctx.env, event.eventType)) {
    ctx.log.info(
      {
        eventId: event.id,
        eventType: event.eventType,
        module: upsert.module,
        externalId: upsert.externalId,
        payload: redactDomainEventPayload(event.eventType, event.payload),
      },
      "zoho_crm_dry_run_upsert",
    );
  }

  if (!shouldPerformZohoHttp(ctx.env, event.eventType)) {
    return;
  }

  try {
    const result = await zohoCrmUpsert(ctx.env, upsert);
    recordDeliveryOutcome("zoho", "success");
    ctx.log.info(
      { eventId: event.id, zohoRecordId: result.zohoRecordId, module: result.module },
      "zoho_crm_upsert_ok",
    );
  } catch (err) {
    recordDeliveryOutcome("zoho", classifyZohoError(err) === "retryable" ? "retry" : "dead_letter");
    throw err;
  }
}

export async function processZohoProjector(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.env || ctx.env.ZOHO_CRM_SYNC_MODE === "off") return;
  if (!ctx.deliveryRepo) throw new Error("zoho_projector_missing_delivery_repo");
  const deliveryRepo = ctx.deliveryRepo;

  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const events = await ctx.domainEventReader.listLockedForProjector(ZOHO_PROJECTOR, 100, tx);
    for (const event of events) {
      await deliveryRepo.ensurePending({
        consumer: ZOHO_CONSUMER,
        eventId: event.id,
        idempotencyKey: `${ZOHO_CONSUMER}:${event.id}`,
      });
    }
    const maxId = Math.max(0, ...events.map((event) => event.id));
    if (maxId > 0) {
      await ctx.projectorStateRepo.advanceCursorLiteralName(ZOHO_PROJECTOR, maxId, tx);
    }
  });

  await claimAndRunDomainEventDeliveries({
    consumer: ZOHO_CONSUMER,
    batchSize: 25,
    leaseMs: 60_000,
    repo: deliveryRepo,
    deliverOne: async (delivery) => {
      const event = await ctx.domainEventReader.getById(delivery.eventId);
      if (!event) {
        throw new Error(`domain_event_missing:${delivery.eventId}`);
      }
      await deliverZohoEvent(ctx, event);
      return undefined;
    },
  });
}

export function createZohoProjector(): Projector {
  return {
    name: ZOHO_PROJECTOR,
    isEnabled(ctx) {
      return ctx.env?.ZOHO_CRM_SYNC_MODE !== "off";
    },
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(ZOHO_PROJECTOR);
      await processZohoProjector(ctx);
    },
  };
}
