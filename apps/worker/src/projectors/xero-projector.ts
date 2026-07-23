import { assertDomainEventConsumerContract } from "@auction/types";
import {
  buildLegacyXeroCommandFromEvent,
  buildXeroCommandFromEvent,
  diffXeroShadowCommand,
} from "../integrations/xero/xero-command-projector.js";
import {
  XeroLiveExecutorError,
  executeXeroLiveCommand,
} from "../integrations/xero/xero-live-executor.js";
import {
  eventTypeToXeroOperation,
  isXeroOperationLive,
  parseXeroLiveOperations,
} from "../integrations/xero/xero-projector-config.js";
import { recordDeliveryOutcome } from "../lib/delivery-metrics.js";
import { classifyDeliveryError } from "../lib/delivery-retry.js";
import { claimAndRunDomainEventDeliveries } from "./lib/domain-event-delivery-runner.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";

export const XERO_PROJECTOR = "xero";
const XERO_CONSUMER = "xero";

const XERO_EVENT_TYPES = [
  "payment.captured",
  "payment.refunded",
  "lot.ended",
  "payout.paid",
  "payout.settlement_created",
] as const;

export async function processXeroProjector(ctx: ProjectorRunContext): Promise<void> {
  const mode = ctx.env?.XERO_PROJECTOR_MODE ?? "off";
  if (mode === "off") return;
  if (!ctx.deliveryRepo) throw new Error("xero_projector_missing_delivery_repo");
  const deliveryRepo = ctx.deliveryRepo;
  const liveOps = parseXeroLiveOperations(ctx.env?.XERO_PROJECTOR_LIVE_OPERATIONS);

  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const events = await ctx.domainEventReader.listLockedForProjector(XERO_PROJECTOR, 100, tx);
    for (const event of events) {
      if (!XERO_EVENT_TYPES.includes(event.eventType as (typeof XERO_EVENT_TYPES)[number])) {
        continue;
      }
      const command = buildXeroCommandFromEvent(event);
      if (!command) continue;
      await deliveryRepo.ensurePending({
        consumer: XERO_CONSUMER,
        eventId: event.id,
        idempotencyKey: command.idempotencyKey,
      });
    }
    const maxId = Math.max(0, ...events.map((event) => event.id));
    if (maxId > 0) {
      await ctx.projectorStateRepo.advanceCursorLiteralName(XERO_PROJECTOR, maxId, tx);
    }
  });

  await claimAndRunDomainEventDeliveries({
    consumer: XERO_CONSUMER,
    batchSize: 25,
    leaseMs: 60_000,
    repo: deliveryRepo,
    deliverOne: async (delivery) => {
      const event = await ctx.domainEventReader.getById(delivery.eventId);
      if (!event) {
        throw new Error(`domain_event_missing:${delivery.eventId}`);
      }

      if (XERO_EVENT_TYPES.includes(event.eventType as (typeof XERO_EVENT_TYPES)[number])) {
        assertDomainEventConsumerContract(event);
      }

      const command = buildXeroCommandFromEvent(event);
      if (!command) return undefined;

      const operation = eventTypeToXeroOperation(event.eventType);
      if (!operation) return undefined;

      if (mode === "shadow") {
        const legacy = buildLegacyXeroCommandFromEvent(event);
        const shadowDiff = diffXeroShadowCommand(command, legacy);
        ctx.log.info(
          { eventId: event.id, command, legacy, shadowDiff },
          "xero_projector_shadow_command",
        );
        recordDeliveryOutcome("xero", "success");
        return undefined;
      }

      if (!isXeroOperationLive(mode, operation, liveOps)) {
        ctx.log.info({ eventId: event.id, command }, "xero_projector_canary_skip_live");
        recordDeliveryOutcome("xero", "success");
        return undefined;
      }

      const ports = ctx.xeroLiveExecutorPorts;
      if (!ports) {
        throw new XeroLiveExecutorError("xero_live_executor_ports_missing", false);
      }

      try {
        await executeXeroLiveCommand(ports, command, ctx.log);
        recordDeliveryOutcome("xero", "success");
        return undefined;
      } catch (err) {
        const retryable =
          err instanceof XeroLiveExecutorError
            ? err.retryable
            : classifyDeliveryError(err) === "retryable";
        recordDeliveryOutcome("xero", retryable ? "retry" : "dead_letter");
        throw err;
      }
    },
  });
}

export function createXeroProjector(): Projector {
  return {
    name: XERO_PROJECTOR,
    isEnabled(ctx) {
      return ctx.env?.XERO_PROJECTOR_MODE !== "off";
    },
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(XERO_PROJECTOR);
      await processXeroProjector(ctx);
    },
  };
}
