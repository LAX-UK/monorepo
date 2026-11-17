import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseIndexDefinition, readOnlineIndexDeclarations } from "./declarations.js";
import { DEFAULT_MIGRATIONS_FOLDER, readJournal } from "./index.js";

/**
 * Every declaration in drizzle/online must match its migration: the migration creates the same
 * index, with the same definition text, as a plain CREATE INDEX IF NOT EXISTS (so local and CI,
 * which run only the runner, behave as before), and it refuses an INVALID index of that name
 * (so a failed concurrent build is never silently kept).
 */
describe("online index declarations", () => {
  const journal = readJournal(DEFAULT_MIGRATIONS_FOLDER);
  const declarations = readOnlineIndexDeclarations(DEFAULT_MIGRATIONS_FOLDER, journal);

  it("are valid and named after journal migrations", () => {
    expect(declarations.map((d) => d.tag)).toEqual(
      expect.arrayContaining([
        "0399_domain_events_event_type_aggregate_idx",
        "0400_unapplied_money_shop_payment_idx",
      ]),
    );
  });

  for (const declaration of declarations) {
    describe(declaration.tag, () => {
      const migration = readFileSync(
        path.join(DEFAULT_MIGRATIONS_FOLDER, `${declaration.tag}.sql`),
        "utf8",
      );
      const migrationIndexes = migration
        .split("--> statement-breakpoint")
        .map((chunk) =>
          chunk
            .split("\n")
            .filter((line) => !line.trimStart().startsWith("--"))
            .join("\n"),
        )
        .map(normaliseIndexDefinition)
        .filter((sql) => /^CREATE (UNIQUE )?INDEX /i.test(sql));

      for (const statement of declaration.statements) {
        it(`${statement.indexName}: the migration builds the same index with IF NOT EXISTS`, () => {
          expect(migrationIndexes).toContain(normaliseIndexDefinition(statement.sql));
        });

        it(`${statement.indexName}: the migration refuses an INVALID index of that name`, () => {
          expect(migration).toMatch(/NOT i\.indisvalid/);
          expect(migration).toMatch(
            new RegExp(String.raw`to_regclass\('(?:\w+\.)?${statement.indexName}'\)`),
          );
        });
      }
    });
  }
});
