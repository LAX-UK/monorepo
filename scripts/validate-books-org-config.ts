import { readFileSync } from "node:fs";
import process from "node:process";
import { createBooksAccountingAdapters } from "../packages/finance-runtime/src/books/create-books-accounting-adapters.ts";

/**
 * Checks a candidate ZOHO_BOOKS_ORG_CONFIG the way the worker does at start-up (valid JSON,
 * `parseOrgConfigs`, and agreement with the organisations named in code), so a bad value is found
 * before it is stored as the GitHub secret and applied. An invalid value stops the whole worker.
 *
 *   pnpm books:validate-org-config < candidate.json
 *   pnpm books:validate-org-config candidate.json
 *   ZOHO_BOOKS_ORG_CONFIG='{...}' pnpm books:validate-org-config
 *
 * Prints only the entities found, never the value. Exit 0 valid, 1 invalid.
 */
const arg = process.argv[2];
const raw = arg
  ? readFileSync(arg, "utf8")
  : process.env.ZOHO_BOOKS_ORG_CONFIG !== undefined
    ? process.env.ZOHO_BOOKS_ORG_CONFIG
    : readFileSync(0, "utf8");

if (!raw.trim()) {
  console.error("Empty value: accounting would not run. Nothing to validate.");
  process.exit(1);
}
try {
  const adapters = createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: raw });
  const entities = Object.keys(adapters?.organisationIds ?? {});
  console.log(`ZOHO_BOOKS_ORG_CONFIG is valid. Entities: ${entities.join(", ")}`);
} catch (err) {
  console.error(`ZOHO_BOOKS_ORG_CONFIG is INVALID: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
