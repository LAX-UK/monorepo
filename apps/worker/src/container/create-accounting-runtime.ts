import { randomUUID } from "node:crypto";
import type { createDb } from "@auction/db";
import { createBooksAccountingAdapters } from "@auction/finance-runtime";
import {
  DrizzleBidAccountingFactsReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { AccountingProjection } from "../finance/accounting/accounting-projection.service.js";
import type { AccountingRuntime } from "../finance/accounting/accounting-runtime.js";
import { AccountingSender } from "../finance/accounting/accounting-sender.service.js";
import { DrizzleProjectorCursorStart } from "../repositories/drizzle-projector-cursor-start.js";

/**
 * Builds the accounting projector and sender for Books. Without Books organisation settings
 * nothing is built, so neither runs and nothing new touches the database. With them, both still
 * do nothing until the accounting switch aims a product at Books, and then only in rehearsal: the
 * adapters come from `createBooksAccountingAdapters`, which builds the dry run alone.
 */
export function createAccountingRuntime(deps: {
  env: Pick<WorkerEnv, "ZOHO_BOOKS_ORG_CONFIG">;
  db: ReturnType<typeof createDb>;
  log: Logger;
}): AccountingRuntime | undefined {
  const adapters = createBooksAccountingAdapters(deps.env);
  if (!adapters) return undefined;
  const repos = createAccountingRepositories(deps.db, { now: () => new Date() });
  deps.log.info({ modes: Object.keys(adapters.byMode) }, "accounting_runtime_built");
  return {
    projection: new AccountingProjection({
      facts: new DrizzleBidAccountingFactsReader(deps.db),
      settings: repos.settingReader,
      registry: repos.registry,
    }),
    sender: new AccountingSender({
      workQueue: repos.workQueue,
      dueWork: repos.dueWork,
      transitions: repos.transitions,
      settings: repos.settingReader,
      portsByMode: adapters.byMode,
      transientErrorPrefixes: adapters.transientErrorPrefixes,
      newLeaseToken: randomUUID,
      log: deps.log,
    }),
    cursorStart: new DrizzleProjectorCursorStart(deps.db),
  };
}
