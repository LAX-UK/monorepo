import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OnlineIndexDeclarationError,
  normaliseIndexDefinition,
  parseOnlineIndexDeclaration,
  parseOnlineIndexStatement,
  readOnlineIndexDeclarations,
  selectPendingDeclarations,
} from "./declarations.js";

const parse = (sql: string) => parseOnlineIndexStatement(sql, "test");

describe("parseOnlineIndexStatement", () => {
  it("accepts a quoted btree build and reads the index and table", () => {
    expect(
      parse(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "a_idx"
        ON "domain_events" USING btree ("event_type", "aggregate_id");`),
    ).toEqual({
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a_idx"
        ON "domain_events" USING btree ("event_type", "aggregate_id")`,
      unique: false,
      indexName: "a_idx",
      table: '"domain_events"',
    });
  });

  it("accepts UNIQUE, a schema-qualified table, expressions and a predicate; folds unquoted names", () => {
    const statement = parse(
      `create unique index concurrently if not exists Some_Idx on public.orders ((payload->>'k')) where kind = 'x'`,
    );
    expect(statement.unique).toBe(true);
    expect(statement.indexName).toBe("some_idx");
    expect(statement.table).toBe("public.orders");
  });

  it.each([
    ["a plain build", `CREATE INDEX IF NOT EXISTS "a" ON "t" ("c")`],
    ["no IF NOT EXISTS", `CREATE INDEX CONCURRENTLY "a" ON "t" ("c")`],
    ["an unnamed index", `CREATE INDEX CONCURRENTLY IF NOT EXISTS ON "t" ("c")`],
    ["a drop", `DROP INDEX CONCURRENTLY IF EXISTS "a"`],
    ["a reindex", `REINDEX INDEX CONCURRENTLY "a"`],
    ["an ALTER", `ALTER TABLE "t" ADD COLUMN "c" int`],
    ["a SET", `SET lock_timeout = '5s'`],
    ["ON ONLY", `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON ONLY "t" ("c")`],
    [
      "a second statement",
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c"); DROP TABLE "t"`,
    ],
    ["a line comment", `-- note\nCREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c")`],
    // Only the comment rule catches this one: the statement prefix is valid and there is no `;`.
    ["a trailing line comment", `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c") -- c`],
    ["a block comment", `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" /* x */ ON "t" ("c")`],
    ["an empty chunk", "  \n"],
  ])("rejects %s", (_name, sql) => {
    expect(() => parse(sql)).toThrow(OnlineIndexDeclarationError);
  });

  it.each([
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c") -- c`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c") --`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c") -- c\n`,
  ])("rejects a trailing -- comment with the comment rule: %j", (sql) => {
    expect(() => parse(sql)).toThrow(/comments are not allowed in a declaration/);
  });
});

describe("parseOnlineIndexDeclaration", () => {
  it("splits on statement breakpoints", () => {
    const declaration = parseOnlineIndexDeclaration(
      "0400_x",
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c");
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "b" ON "t" ("d");
`,
    );
    expect(declaration.statements.map((s) => s.indexName)).toEqual(["a", "b"]);
  });

  it("rejects a trailing breakpoint, a duplicate name and anything between statements", () => {
    const one = `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c")`;
    expect(() => parseOnlineIndexDeclaration("x", `${one}\n--> statement-breakpoint\n`)).toThrow(
      /statement 2: empty/,
    );
    expect(() =>
      parseOnlineIndexDeclaration("x", `${one}\n--> statement-breakpoint\n${one}`),
    ).toThrow(/twice/);
    expect(() => parseOnlineIndexDeclaration("x", `${one};\nANALYZE "t";`)).toThrow(
      /one statement per chunk/,
    );
  });
});

describe("normaliseIndexDefinition", () => {
  it("compares a declaration with its migration statement", () => {
    expect(
      normaliseIndexDefinition(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "a"\n  ON "t" ("c");`),
    ).toBe(normaliseIndexDefinition(`CREATE INDEX IF NOT EXISTS "a" ON "t" ("c")`));
    expect(
      normaliseIndexDefinition(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c")`),
    ).toBe(`CREATE UNIQUE INDEX IF NOT EXISTS "a" ON "t" ("c")`);
  });
});

describe("selectPendingDeclarations", () => {
  const journal = [
    { tag: "0001_a", folderMillis: 1 },
    { tag: "0002_b", folderMillis: 2 },
    { tag: "0003_c", folderMillis: 3 },
  ];
  const declarations = journal.map((m) => ({ tag: m.tag, statements: [] }));

  it("keeps unapplied migrations within the ceiling, in journal order", () => {
    const tags = (applied: number[], ceiling: number | null) =>
      selectPendingDeclarations(
        [...declarations].reverse(),
        journal,
        new Set(applied),
        ceiling,
      ).map((d) => d.tag);
    expect(tags([], null)).toEqual(["0001_a", "0002_b", "0003_c"]);
    expect(tags([1], null)).toEqual(["0002_b", "0003_c"]);
    expect(tags([1], 2)).toEqual(["0002_b"]);
    expect(tags([1, 2, 3], null)).toEqual([]);
  });
});

describe("readOnlineIndexDeclarations", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const setUp = (files: Record<string, string>) => {
    dir = mkdtempSync(path.join(tmpdir(), "online-index-"));
    mkdirSync(path.join(dir, "online"));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(dir, "online", name), content);
    }
  };
  const journal = [{ tag: "0001_a", folderMillis: 1 }];
  const ok = `CREATE INDEX CONCURRENTLY IF NOT EXISTS "a" ON "t" ("c")`;

  it("reads files named after journal tags", () => {
    setUp({ "0001_a.sql": ok });
    expect(readOnlineIndexDeclarations(dir, journal).map((d) => d.tag)).toEqual(["0001_a"]);
  });

  it("returns nothing when the folder does not exist", () => {
    dir = mkdtempSync(path.join(tmpdir(), "online-index-"));
    expect(readOnlineIndexDeclarations(dir, journal)).toEqual([]);
  });

  it("fails on a file with no journal migration or not ending in .sql", () => {
    setUp({ "0002_b.sql": ok });
    expect(() => readOnlineIndexDeclarations(dir, journal)).toThrow(/no journal migration/);
    rmSync(dir, { recursive: true, force: true });
    setUp({ "0001_a.sql": ok, README: "x" });
    expect(() => readOnlineIndexDeclarations(dir, journal)).toThrow(/not a \.sql file/);
  });
});
