import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type JournalMigration,
  readOnlineIndexDeclarations,
  selectPendingDeclarations,
} from "./declarations.js";
import {
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
