import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildPgConnectionConfig } from "../ssl.js";
import {
  type JournalMigration,
  readOnlineIndexDeclarations,
  selectPendingDeclarations,
} from "./declarations.js";
import {
  ONLINE_INDEX_APPLICATION_NAME,
  type OnlineIndexClient,
  type OnlineIndexLogger,
  readAppliedFolderMillis,
  runOnlineIndexStep,
} from "./step.js";

export * from "./declarations.js";
export * from "./step.js";

/** `packages/db/drizzle`, from both `src/online-index` and `dist/online-index`. */
export const DEFAULT_MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

export function readJournal(migrationsFolder: string): JournalMigration[] {
  const journal = JSON.parse(
    readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as { entries: { tag: string; when: number }[] };
  return journal.entries.map((e) => ({ tag: e.tag, folderMillis: e.when }));
}

/**
 * Builds the declared indexes of every migration the runner is about to apply: not in the
 * ledger yet and within `ceilingFolderMillis` (`null` for the whole journal). Run it before
 * `runMigrationsPerTransactionThrough`, with the same ceiling, on an autocommit connection.
 */
export async function runPendingOnlineIndexBuilds(
  client: OnlineIndexClient,
  ceilingFolderMillis: number | null,
  options: { migrationsFolder?: string; log?: OnlineIndexLogger } = {},
): Promise<void> {
  const folder = options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER;
  const journal = readJournal(folder);
  const declarations = readOnlineIndexDeclarations(folder, journal);
  const applied = await readAppliedFolderMillis(client);
  const pending = selectPendingDeclarations(declarations, journal, applied, ceilingFolderMillis);
  await runOnlineIndexStep(client, pending, options.log ? { log: options.log } : {});
}

/**
 * The env switch that makes `migrate.ts` (the full-journal migrate, used by the test environment
 * deploy) run the step too. Only `1` turns it on; unset, empty or `0` leaves it off, so local and
 * CI `db:migrate` stay unchanged. Any other value is rejected so a typo cannot silently skip it.
 */
export const ONLINE_INDEX_STEP_ENV = "ONLINE_INDEX_STEP";

export function onlineIndexStepOptedIn(env: NodeJS.ProcessEnv): boolean {
  const value = env[ONLINE_INDEX_STEP_ENV];
  if (value === undefined || value === "" || value === "0") return false;
  if (value === "1") return true;
  throw new Error(
    `${ONLINE_INDEX_STEP_ENV} must be 1 (on) or unset/0 (off), got ${JSON.stringify(value)}`,
  );
}

/**
 * The entry both migrate scripts call before their transactional runner: opens a dedicated
 * autocommit connection named `lax-online-index`, builds the pending declarations within
 * `ceilingFolderMillis` (`null` for the whole journal) and closes it. Throws
 * OnlineIndexBuildError, before any migration runs, when a build fails.
 */
export async function runOnlineIndexPreStep(
  databaseUrl: string,
  ceilingFolderMillis: number | null,
  options: { migrationsFolder?: string; log?: OnlineIndexLogger } = {},
): Promise<void> {
  const client = new pg.Client({
    ...buildPgConnectionConfig(databaseUrl),
    application_name: ONLINE_INDEX_APPLICATION_NAME,
  });
  await client.connect();
  try {
    await runPendingOnlineIndexBuilds(client, ceilingFolderMillis, options);
  } finally {
    await client.end();
  }
}
