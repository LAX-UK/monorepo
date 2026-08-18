import type {
  IWebhookEventRepository,
  WebhookEventDrainRow,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import type { WebhookEventStoredPayload } from "./webhook-event-payload.js";

export type ProcessInboundWebhookDeps = {
  env: WorkerEnv;
  log: Logger;
  webhookEvents: IWebhookEventRepository;
  syncXeroInvoiceWebhook?: (input: {
    tenantId: string;
    resourceId: string;
    eventKey: string;
  }) => Promise<void>;
};

function parseStoredPayload(payload: unknown): WebhookEventStoredPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (!record.body || typeof record.body !== "object") return null;
  const routing =
    record.routing && typeof record.routing === "object"
      ? (record.routing as WebhookEventStoredPayload["routing"])
      : {};
  return {
    body: record.body as Record<string, unknown>,
    routing,
  };
}

async function dispatchXeroInvoiceWebhook(
  deps: ProcessInboundWebhookDeps,
  row: WebhookEventDrainRow,
  stored: WebhookEventStoredPayload,
): Promise<void> {
  const tenantId = stored.routing.tenantId;
  const resourceId = stored.routing.resourceId;
  if (typeof tenantId !== "string" || typeof resourceId !== "string") {
    throw new Error("xero webhook missing tenantId/resourceId routing");
  }
  if (String(stored.routing.eventCategory ?? "INVOICE").toUpperCase() !== "INVOICE") {
    return;
  }
  if (!deps.syncXeroInvoiceWebhook) {
    throw new Error("xero webhook processor not configured");
  }
  await deps.syncXeroInvoiceWebhook({
    tenantId,
    resourceId,
    eventKey: row.eventKey,
  });
}

async function dispatchWebhookRow(
  deps: ProcessInboundWebhookDeps,
  row: WebhookEventDrainRow,
): Promise<void> {
  const stored = parseStoredPayload(row.payload);
  if (!stored) {
    throw new Error("invalid webhook_event payload shape");
  }

  if (row.source === "xero") {
    await dispatchXeroInvoiceWebhook(deps, row, stored);
    return;
  }

  deps.log.info({ source: row.source, eventKey: row.eventKey }, "webhook source has no processor");
}

export async function processInboundWebhookEvent(
  deps: ProcessInboundWebhookDeps,
  eventKey: string,
  leaseMs = 120_000,
): Promise<void> {
  if (!deps.env.WEBHOOK_EVENTS_PROCESS) {
    deps.log.debug({ eventKey }, "WEBHOOK_EVENTS_PROCESS disabled; skipping");
    return;
  }

  await deps.webhookEvents.recoverStaleClaims();
  const { claimed, row } = await deps.webhookEvents.tryClaimForProcessing(eventKey, leaseMs);
  if (!claimed || !row) {
    deps.log.debug({ eventKey }, "webhook event not claimable");
    return;
  }

  try {
    await dispatchWebhookRow(deps, row);
    await deps.webhookEvents.markProcessed(eventKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await deps.webhookEvents.markFailed(eventKey, message);
    throw err;
  }
}

export async function drainUnprocessedWebhookEvents(
  deps: ProcessInboundWebhookDeps,
  batchSize = 25,
): Promise<number> {
  if (!deps.env.WEBHOOK_EVENTS_PROCESS) return 0;

  await deps.webhookEvents.recoverStaleClaims();
  const rows = await deps.webhookEvents.listUnprocessedForDrain(batchSize);
  let processed = 0;
  for (const row of rows) {
    await processInboundWebhookEvent(deps, row.eventKey);
    processed++;
  }
  return processed;
}
