import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { NIL, runRolledBack } from "../container/worker-role-contract.test-helpers.js";
import type { WorkerDb } from "../workers/types.js";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

const workerUrl = process.env.DATABASE_URL_WORKER;
const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;

/**
 * Account erasure runs as `worker_app`. A rule that changes a table the role may not change fails
 * the whole erasure with `permission denied`, so every rule is run here as that role, on a
 * rolled-back transaction, against a person who does not exist. PostgreSQL checks privileges
 * before it looks for rows, so a denial shows even when nothing matches. Skipped everywhere the
 * role is not set up.
 */
describe.skipIf(!workerUrl)("account erasure rules as worker_app", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const db = createDb(workerUrl!) as unknown as WorkerDb;
  const scope = {
    subjectIds: [NIL],
    personalLegalEntityIds: [NIL],
    pseudonym: "Deleted user 7F3A",
  };

  it.each(BID_ANONYMISATION_RULES.map((rule) => [rule.table, rule] as const))(
    "may run the %s rule",
    async (_table, rule) => {
      const outcome = await runRolledBack(db, (tx) => rule.apply(tx as never, scope));
      expect(outcome.denied).toBeNull();
    },
  );
});

/** The rules say which tables they change; the role must hold UPDATE (a column counts) on each. */
describe.skipIf(!ownerUrl || !workerUrl)(
  "account erasure scrubs and the worker's UPDATE grants",
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated above
    const owner = createDb(ownerUrl!);
    const scrubbed = BID_ANONYMISATION_RULES.filter((rule) => rule.treatment === "scrub")
      .map((rule) => rule.table)
      // The mail queue rule also scrubs the provider's reports.
      .concat("email_event");

    it.each(scrubbed)("lets worker_app update %s", async (table) => {
      const result = await owner.execute<{ allowed: boolean }>(sql`
        select (has_table_privilege('worker_app', ${table}, 'UPDATE')
          or has_any_column_privilege('worker_app', ${table}, 'UPDATE')) as allowed`);
      expect(result.rows[0]?.allowed).toBe(true);
    });
  },
);
