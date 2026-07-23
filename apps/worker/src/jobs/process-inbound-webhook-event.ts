import type {
  IExternalAccountRepository,
  ITransactionRunner,
  IUserRepository,
  IWebhookEventRepository,
  WebhookEventDrainRow,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import type { LinkExternalAccountWorkerService } from "../services/link-external-account.service.js";
import type { WebhookEventStoredPayload } from "./webhook-event-payload.js";

export type ProcessInboundWebhookDeps = {
  env: WorkerEnv;
  log: Logger;
  webhookEvents: IWebhookEventRepository;
  externalAccounts: IExternalAccountRepository;
  users: IUserRepository;
  transactionRunner: ITransactionRunner;
  linkExternalAccount: LinkExternalAccountWorkerService;
  syncXeroInvoiceWebhook?: (input: {
    tenantId: string;
    resourceId: string;
    eventKey: string;
  }) => Promise<void>;
};

const SHOPIFY_LINK_TOPICS = new Set(["customers/create", "customers/update"]);
const WORDPRESS_LINK_EVENTS = new Set(["user.linked", "lax.user.linked"]);

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

async function dispatchShopifyLink(
  deps: ProcessInboundWebhookDeps,
  stored: WebhookEventStoredPayload,
): Promise<void> {
  const topic = stored.routing.topic ?? "";
  if (!SHOPIFY_LINK_TOPICS.has(topic)) return;

  const externalId = stored.body.id;
  if (externalId == null) {
    throw new Error("shopify customer webhook missing id");
  }
  const externalIdStr = String(externalId);
  const existing = await deps.externalAccounts.findByProviderExternalId("shopify", externalIdStr);
  if (existing) return;

  const email = typeof stored.body.email === "string" ? stored.body.email : null;
  const userId = email ? await deps.users.findVerifiedIdByEmail(email) : null;
  if (!userId) {
    throw new Error("no verified user to link for shopify customer");
  }

  await deps.transactionRunner.runInTransaction(async (tx) => {
    await deps.linkExternalAccount.linkInTransaction(tx, {
      userId,
      provider: "shopify",
      externalId: externalIdStr,
      email,
    });
  });
}

async function dispatchWordPressLink(
  deps: ProcessInboundWebhookDeps,
  stored: WebhookEventStoredPayload,
): Promise<void> {
  const eventName = stored.routing.eventName ?? "";
  if (!WORDPRESS_LINK_EVENTS.has(eventName)) return;

  const externalId = stored.body.externalId ?? stored.body.userId ?? stored.body.id;
  const userId = stored.body.laxUserId ?? stored.body.platformUserId;
  if (externalId == null || userId == null || typeof userId !== "string") {
    throw new Error("wordpress link webhook missing externalId/userId");
  }

  const externalIdStr = String(externalId);
  const existing = await deps.externalAccounts.findByProviderExternalId("wordpress", externalIdStr);
  if (existing) return;

  const email = typeof stored.body.email === "string" ? stored.body.email : null;
  await deps.transactionRunner.runInTransaction(async (tx) => {
    await deps.linkExternalAccount.linkInTransaction(tx, {
      userId,
      provider: "wordpress",
      externalId: externalIdStr,
      email,
    });
  });
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

  if (row.source === "shopify") {
    await dispatchShopifyLink(deps, stored);
    return;
  }
  if (row.source === "wordpress") {
    await dispatchWordPressLink(deps, stored);
    return;
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
