import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerSrc = join(__dirname, "../../../apps/worker/src");
const migrateRolesSource = readFileSync(join(__dirname, "migrate-roles.ts"), "utf8");

/** Drizzle calls whose first argument is the table the query touches. */
const TABLE_CALL =
  /\.(?:from|innerJoin|leftJoin|rightJoin|fullJoin|insert|update|delete)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;

function workerSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return workerSourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Schema export name → Postgres table name, for every table in the schema. */
const tableNameByExport = new Map(
  Object.entries(schema)
    .filter(([, value]) => is(value, PgTable))
    .map(([exportName, table]) => [exportName, getTableName(table as PgTable)]),
);

/** Every table the worker's own queries touch, with the files that touch it. */
function tablesTouchedByWorker(): Map<string, string[]> {
  const touched = new Map<string, string[]>();
  for (const file of workerSourceFiles(workerSrc)) {
    for (const match of readFileSync(file, "utf8").matchAll(TABLE_CALL)) {
      const table = tableNameByExport.get(match[1] ?? "");
      if (!table) continue;
      const files = touched.get(table) ?? [];
      const relative = file.slice(workerSrc.length + 1);
      if (!files.includes(relative)) files.push(relative);
      touched.set(table, files);
    }
  }
  return touched;
}

/**
 * Guards against the failure where a worker job queries a table that `migrate-roles.ts` never
 * grants to worker_app. The job then fails with "permission denied" on every run in production,
 * as the refund notice projector did with `payment`. A table named nowhere in migrate-roles.ts
 * cannot have been granted, so this fails as soon as such a query is added.
 */
describe("worker_app grants", () => {
  it("finds the worker's queries", () => {
    expect(tablesTouchedByWorker().size).toBeGreaterThan(10);
  });

  it("names every table the worker queries in migrate-roles.ts", () => {
    const missing = [...tablesTouchedByWorker()]
      .filter(([table]) => !migrateRolesSource.includes(`"${table}"`))
      .map(([table, files]) => `${table} (${files.join(", ")})`);
    expect(missing, `tables the worker queries with no grant: ${missing.join("; ")}`).toEqual([]);
  });
});
