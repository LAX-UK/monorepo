import { describe, expect, it } from "vitest";
import { parseOnlineIndexDeclaration } from "./declarations.js";
import {
  ONLINE_INDEX_SESSION_SETTINGS,
  OnlineIndexBuildError,
  type OnlineIndexClient,
  readAppliedFolderMillis,
  runOnlineIndexStep,
} from "./step.js";

type IndexRow = { valid: boolean } | null;

/**
 * A scripted client: `tableSchema` answers the table lookup, `index` answers each index
 * lookup in turn (before and after the build), `build` decides how the CREATE behaves.
 */
function fakeClient(script: {
  tableSchema?: string | null;
  index?: IndexRow[];
  build?: () => void;
  drop?: () => void;
}) {
  const queries: string[] = [];
  const indexAnswers = [...(script.index ?? [null])];
  const client: OnlineIndexClient = {
    async query(text) {
      queries.push(text.trim());
      if (text.includes("to_regclass")) {
        const schema = script.tableSchema === undefined ? "public" : script.tableSchema;
        return { rows: schema === null ? [] : [{ schema }] } as never;
      }
      if (text.includes("FROM pg_index")) {
        const row = indexAnswers.length > 1 ? indexAnswers.shift() : indexAnswers[0];
        return { rows: row ? [row] : [] } as never;
      }
      if (text.startsWith("CREATE")) script.build?.();
      if (text.startsWith("DROP")) script.drop?.();
      return { rows: [] } as never;
    },
  };
  return { client, queries };
}

const declaration = parseOnlineIndexDeclaration(
  "0399_x",
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS "e_idx" ON "domain_events" ("event_type")`,
);
const logs: string[] = [];
const options = { log: (line: string) => logs.push(line), now: () => 0 };

describe("runOnlineIndexStep", () => {
  it("does nothing, not even the session settings, when nothing is pending", async () => {
    const { client, queries } = fakeClient({});
    await runOnlineIndexStep(client, [], options);
    expect(queries).toEqual([]);
  });

  it("sets lock_timeout 5s, no statement timeout and the application name, then builds", async () => {
    const { client, queries } = fakeClient({ index: [null, { valid: true }] });
    await runOnlineIndexStep(client, [declaration], options);
    expect(ONLINE_INDEX_SESSION_SETTINGS).toEqual([
      "SET lock_timeout = '5s'",
      "SET statement_timeout = 0",
      "SET application_name = 'lax-online-index'",
    ]);
    expect(queries.slice(0, 3)).toEqual([...ONLINE_INDEX_SESSION_SETTINGS]);
    expect(queries).toContain(declaration.statements[0].sql);
    expect(queries.some((q) => q.startsWith("DROP"))).toBe(false);
  });

  it("skips an index that is already valid", async () => {
    const { client, queries } = fakeClient({ index: [{ valid: true }] });
    await runOnlineIndexStep(client, [declaration], options);
    expect(queries.some((q) => q.startsWith("CREATE"))).toBe(false);
  });

  it("skips a table that a pending migration has not created yet", async () => {
    const { client, queries } = fakeClient({ tableSchema: null });
    await runOnlineIndexStep(client, [declaration], options);
    expect(queries.some((q) => q.startsWith("CREATE"))).toBe(false);
  });

  it("refuses an INVALID index it did not create, and never drops it", async () => {
    const { client, queries } = fakeClient({ index: [{ valid: false }] });
    await expect(runOnlineIndexStep(client, [declaration], options)).rejects.toThrow(
      /exists but is INVALID/,
    );
    expect(queries.some((q) => q.startsWith("CREATE") || q.startsWith("DROP"))).toBe(false);
  });

  it("drops the INVALID index a failed build left, then fails", async () => {
    const { client, queries } = fakeClient({
      index: [null, { valid: false }],
      build: () => {
        throw new Error("could not create unique index");
      },
    });
    const run = runOnlineIndexStep(client, [declaration], options);
    await expect(run).rejects.toBeInstanceOf(OnlineIndexBuildError);
    await expect(run).rejects.toThrow(/could not create unique index; dropped the INVALID index/);
    expect(queries.filter((q) => q.startsWith("DROP"))).toEqual([
      'DROP INDEX CONCURRENTLY IF EXISTS "public"."e_idx"',
    ]);
  });

  it("drops nothing when a failed build left no index (lock timeout before it started)", async () => {
    const { client, queries } = fakeClient({
      index: [null, null],
      build: () => {
        throw new Error("canceling statement due to lock timeout");
      },
    });
    await expect(runOnlineIndexStep(client, [declaration], options)).rejects.toThrow(
      /no index was left behind/,
    );
    expect(queries.some((q) => q.startsWith("DROP"))).toBe(false);
  });

  it("never drops a valid index, even after an error", async () => {
    const { client, queries } = fakeClient({
      index: [null, { valid: true }],
      build: () => {
        throw new Error("connection reset");
      },
    });
    await expect(runOnlineIndexStep(client, [declaration], options)).rejects.toThrow(
      OnlineIndexBuildError,
    );
    expect(queries.some((q) => q.startsWith("DROP"))).toBe(false);
  });

  it("reports a cleanup that failed too", async () => {
    const { client } = fakeClient({
      index: [null, { valid: false }],
      build: () => {
        throw new Error("deadlock detected");
      },
      drop: () => {
        throw new Error("lock timeout");
      },
    });
    await expect(runOnlineIndexStep(client, [declaration], options)).rejects.toThrow(
      /could not drop the INVALID index "public"."e_idx" it left \(lock timeout\)/,
    );
  });

  it("stops at the first failure", async () => {
    const two = parseOnlineIndexDeclaration(
      "0400_y",
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "f_idx" ON "domain_events" ("aggregate_id")`,
    );
    const { client, queries } = fakeClient({
      index: [null, null],
      build: () => {
        throw new Error("boom");
      },
    });
    await expect(runOnlineIndexStep(client, [declaration, two], options)).rejects.toThrow(/boom/);
    expect(queries.filter((q) => q.startsWith("CREATE"))).toHaveLength(1);
  });
});

describe("readAppliedFolderMillis", () => {
  it("reads ledger timestamps and treats a missing ledger as empty", async () => {
    const rows = { rows: [{ created_at: "5" }, { created_at: 7 }, { created_at: null }] };
    expect(
      await readAppliedFolderMillis({ query: async () => rows as never } as OnlineIndexClient),
    ).toEqual(new Set([5, 7]));
    const missing = Object.assign(new Error("missing"), { code: "3F000" });
    expect(
      await readAppliedFolderMillis({
        query: async () => {
          throw missing;
        },
      } as OnlineIndexClient),
    ).toEqual(new Set());
  });
});
