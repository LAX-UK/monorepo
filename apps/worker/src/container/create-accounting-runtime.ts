import { randomUUID } from "node:crypto";
import type { TargetMode } from "@auction/accounting-domain";
import type { createDb } from "@auction/db";
import type { IEmailService } from "@auction/email";
import { UnappliedMoneyRecorder, createBooksAccountingAdapters } from "@auction/finance-runtime";
import {
  DrizzleBidAccountingFactsReader,
  DrizzleShopAccountingFactsReader,
  DrizzleTransactionRunner,
  DrizzleUnappliedMoneyReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { createAccountingAlertSink } from "../finance/accounting/accounting-alerts.js";
import { ACCOUNTING_CRON_MONITORS } from "../finance/accounting/accounting-alerts.js";
import { AccountingInvoiceCopy } from "../finance/accounting/accounting-invoice-copy.service.js";
import { AccountingProjection } from "../finance/accounting/accounting-projection.service.js";
import { AccountingRemainder } from "../finance/accounting/accounting-remainder.service.js";
import type { AccountingRuntime } from "../finance/accounting/accounting-runtime.js";
import { AccountingSender } from "../finance/accounting/accounting-sender.service.js";
import { AccountingStatusCheck } from "../finance/accounting/accounting-status-check.service.js";
import { AccountingWatch } from "../finance/accounting/accounting-watch.service.js";
import { shopStorefrontBase } from "../finance/accounting/shop-invoice-email.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import { throttledCronMonitor } from "../lib/sentry-cron.js";
import { DrizzleProjectorCursorStart } from "../repositories/drizzle-projector-cursor-start.js";

/** The sender runs every couple of seconds; its cron monitor hears from it every 5 minutes. */
const SENDER_CHECK_IN_EVERY_MS = 5 * 60_000;

/**
 * Builds the accounting projector and sender for Books. Without Books organisation settings
 * nothing is built, so neither runs and nothing new touches the database. With them, both still
 * do nothing until the accounting switch aims a product at Books, and then only in rehearsal: the
 * adapters come from `createBooksAccountingAdapters`, which builds the dry run alone.
 */
export function createAccountingRuntime(deps: {
  env: Pick<WorkerEnv, "ZOHO_BOOKS_ORG_CONFIG" | "WEB_ORIGIN" | "SHOP_STOREFRONT_URL">;
  db: ReturnType<typeof createDb>;
  log: Logger;
  sentryMonitorSlugs?: Record<string, string>;
  /** Document storage, where LAX keeps its copy of each issued invoice's PDF. */
  storage: { putObject(key: string, body: Buffer, contentType: string): Promise<unknown> };
  /** The email outbox; only an invoice Books issued for real is ever emailed. */
  email: Pick<IEmailService, "enqueue">;
  /** Where the status check's finance tasks are written (domain events, with their alert). */
  domainEventSink: IWorkerDomainEventSink;
}): AccountingRuntime | undefined {
  const adapters = createBooksAccountingAdapters(deps.env);
  if (!adapters) return undefined;
  const repos = createAccountingRepositories(deps.db, { now: () => new Date() });
  // One sink for every accounting alert: logged, and sent to Sentry where the alert rules page.
  const alerts = createAccountingAlertSink(deps.log);
  deps.log.info({ modes: Object.keys(adapters.byMode) }, "accounting_runtime_built");
  const shopFacts = new DrizzleShopAccountingFactsReader(deps.db);
  try {
    shopStorefrontBase(deps.env.SHOP_STOREFRONT_URL);
  } catch (error) {
    // Said at start-up too: the Shop may not be live yet, but its emails will wait until this is set.
    deps.log.warn(
      { reason: error instanceof Error ? error.message : "unknown" },
      "accounting_shop_storefront_url_unusable",
    );
  }
  // A payment recorded in Books by hand becomes a finance task; nothing here can apply money.
  const financeTasks = new UnappliedMoneyRecorder(
    new DrizzleUnappliedMoneyReader(deps.db),
    deps.domainEventSink,
  );
  const statusCheck = new AccountingStatusCheck({
    store: repos.booksStatus,
    statusesByMode: Object.fromEntries(
      Object.entries(adapters.byMode).map(([mode, ports]) => [mode, ports.statuses]),
    ),
    organisationIds: adapters.organisationIds,
    tasks: { open: (tx, money) => financeTasks.record(tx, money, null) },
    transactions: new DrizzleTransactionRunner(deps.db),
    log: deps.log,
    now: () => new Date(),
  });
  return {
    statusCheck,
    projection: new AccountingProjection({
      facts: new DrizzleBidAccountingFactsReader(deps.db),
      shopFacts,
      settings: repos.settingReader,
      registry: repos.registry,
    }),
    sender: new AccountingSender({
      workQueue: repos.workQueue,
      dueWork: repos.dueWork,
      transitions: repos.transitions,
      settings: repos.settingReader,
      portsByMode: adapters.byMode,
      destinations: adapters.destinations,
      transientErrorPrefixes: adapters.transientErrorPrefixes,
      newLeaseToken: randomUUID,
      log: deps.log,
    }),
    invoiceCopy: new AccountingInvoiceCopy({
      copies: repos.copies,
      settings: repos.settingReader,
      pdfsByMode: Object.fromEntries(
        Object.entries(adapters.byMode).map(([mode, ports]) => [mode, ports.pdfs]),
      ),
      storage: deps.storage,
      emailFacts: repos.invoiceEmailFacts,
      shopEmailFacts: shopFacts,
      email: deps.email,
      webBaseUrl: deps.env.WEB_ORIGIN,
      shopStorefrontUrl: deps.env.SHOP_STOREFRONT_URL,
      now: () => new Date(),
      log: deps.log,
      alerts,
    }),
    remainder: new AccountingRemainder({
      remainders: repos.remainders,
      settings: repos.settingReader,
      portsByMode: Object.fromEntries(
        Object.entries(adapters.byMode).map(([mode, ports]) => [mode, ports.remainders]),
      ),
      log: deps.log,
    }),
    cursorStart: new DrizzleProjectorCursorStart(deps.db),
    watch: new AccountingWatch({
      attention: repos.attention,
      settings: repos.settingReader,
      senderModes: Object.keys(adapters.byMode) as TargetMode[],
      alerts,
      now: () => new Date(),
      statusRuns: {
        lastFinishedRunAt: () => repos.booksStatus.lastFinishedRunAt(),
        firstStartedRunAt: () => repos.booksStatus.firstStartedRunAt(),
        expectedSince: new Date(),
      },
    }),
    senderCheckIn: throttledCronMonitor(
      ACCOUNTING_CRON_MONITORS.sender,
      deps.sentryMonitorSlugs ?? {},
      SENDER_CHECK_IN_EVERY_MS,
    ),
  };
}
