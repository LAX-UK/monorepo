import type {
  IWebhookEventRepository,
  WebhookEventDrainRow,
} from "@auction/persistence/interfaces";
import { ZOHO_ARTWORK_WEBHOOK_SOURCE } from "@auction/queues";
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
  /** Reads the Zoho Product a notice names and brings it into the artwork register. */
  processZohoArtworkNotice?: (input: { productId: string; eventKey: string }) => Promise<void>;
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

async function dispatchZohoArtworkNotice(
  deps: ProcessInboundWebhookDeps,
  row: WebhookEventDrainRow,
  stored: WebhookEventStoredPayload,
): Promise<void> {
  const productId = stored.routing.productId;
  if (typeof productId !== "string" || productId === "") {
    throw new Error("zoho artwork notice missing productId routing");
  }
  if (!deps.processZohoArtworkNotice) {
    throw new Error("zoho artwork processor not configured");
  }
  await deps.processZohoArtworkNotice({ productId, eventKey: row.eventKey });
}

type WebhookSourceHandler = (
  deps: ProcessInboundWebhookDeps,
  row: WebhookEventDrainRow,
  stored: WebhookEventStoredPayload,
) => Promise<void>;

/** One handler per inbound webhook source; a source with none is logged and marked processed. */
const SOURCE_HANDLERS: Readonly<Record<string, WebhookSourceHandler>> = {
  xero: dispatchXeroInvoiceWebhook,
  [ZOHO_ARTWORK_WEBHOOK_SOURCE]: dispatchZohoArtworkNotice,
};

async function dispatchWebhookRow(
  deps: ProcessInboundWebhookDeps,
  row: WebhookEventDrainRow,
): Promise<void> {
  const stored = parseStoredPayload(row.payload);
  if (!stored) {
    throw new Error("invalid webhook_event payload shape");
  }

  const handler = SOURCE_HANDLERS[row.source];
  if (handler) {
    await handler(deps, row, stored);
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
