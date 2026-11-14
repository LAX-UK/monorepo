#!/usr/bin/env tsx
/**
 * Projects again one product's domain events in a window under the current switch, so documents
 * LAX should have sent while Books was off or dry run are queued for the sender. Rehearsal only;
 * see docs/runbooks/zoho-books-cutover.md.
 */
import { createDb } from "@auction/db";
import { createBooksAccountingAdapters } from "@auction/finance-runtime";
import {
  DrizzleBidAccountingFactsReader,
  DrizzleShopAccountingFactsReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import pino from "pino";
import { loadWorkerEnv } from "../env.js";
import { createAccountingAlertSink } from "../finance/accounting/accounting-alerts.js";
import { AccountingProjection } from "../finance/accounting/accounting-projection.service.js";
import { BooksBackfill } from "../finance/accounting/books-backfill.service.js";
import { DrizzleBooksHistoryReader } from "../repositories/drizzle-books-history.reader.js";
import { parseBackfillArgs } from "./books-cutover-args.js";

async function main(): Promise<void> {
  const input = parseBackfillArgs(process.argv.slice(2));
  const env = loadWorkerEnv();
  if (!createBooksAccountingAdapters(env)) throw new Error("books_not_configured");
  const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
  const repos = createAccountingRepositories(db, { now: () => new Date() });
  // Built exactly as the worker builds it (create-accounting-runtime), so the guards are the same.
  const projection = new AccountingProjection({
    facts: new DrizzleBidAccountingFactsReader(db),
    shopFacts: new DrizzleShopAccountingFactsReader(db),
    settings: repos.settingReader,
    registry: repos.registry,
    books: { lookup: repos.lookup, creditNotes: repos.creditNotes, transitions: repos.transitions },
    alerts: createAccountingAlertSink(pino({ name: "books-backfill" })),
  });
  const report = await new BooksBackfill({
    history: new DrizzleBooksHistoryReader(db),
    projection,
    settings: repos.settingReader,
  }).run(input);
  console.log(JSON.stringify(report));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
