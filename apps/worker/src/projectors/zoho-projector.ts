import { assertDomainEventConsumerContract, listDomainEventTypesForConsumer } from "@auction/types";
import { resolveZohoDeliveryMode } from "../integrations/zoho/zoho-crm-config.js";
import {
  recordDeliveryOldestPendingAgeSeconds,
  recordDeliveryOutcome,
  recordZohoCrmApiCreditsRemaining,
} from "../lib/delivery-metrics.js";
import { claimAndRunDomainEventDeliveriesWithBudget } from "./lib/domain-event-delivery-runner.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { redactDomainEventPayload } from "./lib/redact-pii.js";

export const ZOHO_PROJECTOR = "zoho";
const ZOHO_CONSUMER = "zoho";

const ZOHO_CATALOG_EVENT_TYPES = listDomainEventTypesForConsumer("zoho");

async function deliverZohoEvent(
  ctx: ProjectorRunContext,
  event: {
    id: number;
    eventType: string;
    aggregateId: string;
    payload: unknown;
    schemaVersion?: number;
  },
): Promise<
  | { ok: true; providerReference?: string | null }
  | { skipped: true; reason: string; providerReference?: string | null }
  | { ok: false; error: unknown }
> {
  if (!ctx.env) throw new Error("zoho_projector_missing_env");
  if (!ctx.crmSyncService) throw new Error("zoho_projector_missing_crm_sync_service");

  assertDomainEventConsumerContract(event);

  const mode = resolveZohoDeliveryMode(ctx.env, event.eventType);
  if (mode === "off" || mode === "disabled_type") {
    return {
      skipped: true,
      reason: mode === "off" ? "sync_mode_off" : "event_type_disabled",
    };
  }

  if (mode === "dry_run") {
    ctx.log.info(
      {
        eventId: event.id,
        eventType: event.eventType,
        payload: redactDomainEventPayload(event.eventType, event.payload),
      },
      "zoho_crm_dry_run",
    );
    return { skipped: true, reason: "dry_run" };
  }

  const result = await ctx.crmSyncService.syncEvent(event);
  switch (result.outcome) {
    case "success":
      recordDeliveryOutcome("zoho", "success");
      return { ok: true, providerReference: result.providerReference };
    case "skipped":
      recordDeliveryOutcome("zoho", "skipped");
      return { skipped: true, reason: result.reason };
    case "retry":
      return { ok: false, error: result.error };
    case "fatal":
      return { ok: false, error: result.error };
    default:
      return { skipped: true, reason: "unknown_outcome" };
  }
}

export async function processZohoProjector(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.env || ctx.env.ZOHO_CRM_SYNC_MODE === "off") return;
  if (!ctx.deliveryRepo) throw new Error("zoho_projector_missing_delivery_repo");

  const deliveryRepo = ctx.deliveryRepo;
  const batchLimit = ctx.env.ZOHO_CRM_CURSOR_BATCH_SIZE;

  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const events = await ctx.domainEventReader.listLockedForProjector(
      ZOHO_PROJECTOR,
      batchLimit,
      tx,
      {
        eventTypes: ZOHO_CATALOG_EVENT_TYPES,
      },
    );
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

  await claimAndRunDomainEventDeliveriesWithBudget({
    consumer: ZOHO_CONSUMER,
    batchSize: 1,
    leaseMs: 60_000,
    timeBudgetMs: ctx.env.ZOHO_CRM_TICK_TIME_BUDGET_MS,
    repo: deliveryRepo,
    metricsConsumer: ZOHO_CONSUMER,
    deliverOne: async (delivery) => {
      const event = await ctx.domainEventReader.getById(delivery.eventId);
      if (!event) {
        throw new Error(`domain_event_missing:${delivery.eventId}`);
      }
      return deliverZohoEvent(ctx, event);
    },
  });

  const oldestPendingAt = await deliveryRepo.oldestPendingAt({ consumer: ZOHO_CONSUMER });
  recordDeliveryOldestPendingAgeSeconds(ZOHO_CONSUMER, oldestPendingAt);
  if (ctx.crmSyncService) {
    recordZohoCrmApiCreditsRemaining(ctx.crmSyncService.getGatewayMetrics().apiCreditsRemaining);
  }
}

export function createZohoProjector(): Projector {
  return {
    name: ZOHO_PROJECTOR,
    isEnabled(ctx) {
      return (ctx.env?.ZOHO_CRM_SYNC_MODE ?? "off") !== "off";
    },
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(ZOHO_PROJECTOR);
      await processZohoProjector(ctx);
    },
  };
}
