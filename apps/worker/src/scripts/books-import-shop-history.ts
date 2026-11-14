#!/usr/bin/env tsx
/**
 * Queues past Shop invoices (keeping their LAX-INV- numbers) and their contacts for the Books
 * target the Shop switch names. Rehearsal only; see docs/runbooks/zoho-books-cutover.md.
 */
import { createDb } from "@auction/db";
import { createBooksAccountingAdapters } from "@auction/finance-runtime";
import {
  DrizzleShopAccountingFactsReader,
  createAccountingRepositories,
} from "@auction/persistence/repositories";
import { loadWorkerEnv } from "../env.js";
import { ShopHistoryImport } from "../finance/accounting/shop-history-import.service.js";
import { DrizzleBooksHistoryReader } from "../repositories/drizzle-books-history.reader.js";
import { parseImportArgs } from "./books-cutover-args.js";

async function main(): Promise<void> {
  const input = parseImportArgs(process.argv.slice(2), process.env);
  const env = loadWorkerEnv();
  // The same gate as the worker: without Books organisation settings nothing is queued.
  if (!createBooksAccountingAdapters(env)) throw new Error("books_not_configured");
  const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
  const repos = createAccountingRepositories(db, { now: () => new Date() });
  const report = await new ShopHistoryImport({
    history: new DrizzleBooksHistoryReader(db),
    shopFacts: new DrizzleShopAccountingFactsReader(db),
    settings: repos.settingReader,
    registry: repos.registry,
    lookup: repos.lookup,
    now: () => new Date(),
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
