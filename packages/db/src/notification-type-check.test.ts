import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const journal = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8")) as {
  entries: { idx: number; tag: string }[];
};

/** The types a migration's rebuilt `notification_type_check` allows, or `null` if it has none. */
function checkTypesIn(sql: string): string[] | null {
  const at = sql.lastIndexOf("ADD CONSTRAINT notification_type_check");
  if (at < 0) return null;
  const list = sql.slice(at, sql.indexOf(")", sql.indexOf("IN (", at)));
  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

/**
 * Every migration that adds a notification type rebuilds `notification_type_check` with the full
 * list, so the constraint a database ends with is the one the last such migration writes. A
 * rebuild that forgets a type someone else added would make every send of it fail; this keeps the
 * final constraint a superset of every type the code declares.
 */
describe("notification_type_check after all migrations", () => {
  const ordered = [...journal.entries].sort((a, b) => a.idx - b.idx);
  const last = ordered
    .map((entry) => ({
      tag: entry.tag,
      types: checkTypesIn(readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf8")),
    }))
    .filter((m): m is { tag: string; types: string[] } => m.types !== null)
    .at(-1);

  it("is rebuilt by at least one migration", () => {
    expect(last).toBeDefined();
  });

  it("allows every notification type in the schema", () => {
    const allowed = new Set(last?.types);
    expect(NOTIFICATION_TYPES.filter((type) => !allowed.has(type))).toEqual([]);
  });
});
