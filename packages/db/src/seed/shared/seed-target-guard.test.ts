import { describe, expect, it, vi } from "vitest";
import {
  LOCAL_SEED_PASSWORD,
  assertSeedEnvironment,
  assertSeedTarget,
  isLocalSeedAddress,
  seedAccountPassword,
  seedTargetEnvFromProcess,
} from "./seed-target-guard.js";

const LOCAL_URL = "postgresql://u:p@localhost:5432/auction_ci";
const REMOTE_URL = "postgresql://u:p@db-test-lon1.example.com:25060/defaultdb";

/** A fake database: current_database() is `name`; `mark` is the demo_seed_target row, if any. */
function fakeDb(options: {
  name: string;
  hasTable?: boolean;
  mark?: { environment: string; database_name: string } | null;
}) {
  let mark = options.mark ?? null;
  const statements: string[] = [];
  const db = {
    execute: vi.fn(async (query: { queryChunks?: unknown[] }) => {
      const text = JSON.stringify(query.queryChunks ?? query);
      statements.push(text);
      if (text.includes("to_regclass")) {
        return { rows: [{ name: options.name, has_table: options.hasTable ?? true }] };
      }
      if (text.includes("insert into demo_seed_target")) {
        mark ??= { environment: "local", database_name: options.name };
        return { rows: [] };
      }
      return { rows: mark ? [mark] : [] };
    }),
  };
  return { db, statements, inserted: () => statements.some((s) => s.includes("insert into")) };
}

describe("assertSeedTarget", () => {
  it("refuses a remote database without the demo seed mark, and never marks it", async () => {
    const { db, inserted } = fakeDb({ name: "defaultdb" });
    await expect(
      assertSeedTarget(db, "dev seed", { databaseUrl: REMOTE_URL, appEnv: "test" }),
    ).rejects.toThrow(/\[dev seed\] refusing to seed: this database is not marked/);
    expect(inserted()).toBe(false);
  });

  it("refuses a remote address even when APP_ENV is unset", async () => {
    const { db, inserted } = fakeDb({ name: "defaultdb" });
    await expect(
      assertSeedTarget(db, "check-accounts", { databaseUrl: "postgres://u:p@10.0.0.5/defaultdb" }),
    ).rejects.toThrow(/not marked/);
    expect(inserted()).toBe(false);
  });

  it("refuses production by environment before touching the database", async () => {
    const { db } = fakeDb({ name: "x", mark: { environment: "test", database_name: "x" } });
    for (const env of [
      { databaseUrl: REMOTE_URL, appEnv: "production" },
      { databaseUrl: REMOTE_URL, nodeEnv: "production" },
      { databaseUrl: "postgres://u:p@lax-prod-db.example.com/x" },
    ]) {
      await expect(assertSeedTarget(db, "dev seed", env)).rejects.toThrow(/production/);
    }
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("accepts a marked test database, which is not hermetic", async () => {
    const { db } = fakeDb({
      name: "defaultdb",
      mark: { environment: "test", database_name: "defaultdb" },
    });
    await expect(
      assertSeedTarget(db, "dev seed", { databaseUrl: REMOTE_URL, appEnv: "test" }),
    ).resolves.toEqual({ environment: "test", hermetic: false });
  });

  it("does not take a remote database marked local for a hermetic one", async () => {
    const { db } = fakeDb({
      name: "defaultdb",
      mark: { environment: "local", database_name: "defaultdb" },
    });
    await expect(assertSeedTarget(db, "dev seed", { databaseUrl: REMOTE_URL })).resolves.toEqual({
      environment: "local",
      hermetic: false,
    });
  });

  it("marks an unmarked loopback database local, so local seeding stays one command", async () => {
    const { db, inserted } = fakeDb({ name: "auction_ci" });
    await expect(
      assertSeedTarget(db, "dev seed", { databaseUrl: LOCAL_URL, appEnv: "development" }),
    ).resolves.toEqual({ environment: "local", hermetic: true });
    expect(inserted()).toBe(true);
  });

  it("does not mark a loopback database when APP_ENV=test", async () => {
    const { db, inserted } = fakeDb({ name: "auction_ci" });
    await expect(
      assertSeedTarget(db, "dev seed", { databaseUrl: LOCAL_URL, appEnv: "test" }),
    ).rejects.toThrow(/not marked/);
    expect(inserted()).toBe(false);
  });

  it("refuses a database whose mark names another database (a restored copy)", async () => {
    const { db } = fakeDb({
      name: "restored",
      mark: { environment: "test", database_name: "defaultdb" },
    });
    await expect(
      assertSeedTarget(db, "demo-full", { databaseUrl: REMOTE_URL, appEnv: "test" }),
    ).rejects.toThrow(/restored copy/);
  });
});

describe("seedAccountPassword", () => {
  const strong = "s".repeat(24);

  it("requires SEED_ACCOUNT_PASSWORD for any database that is not hermetic", () => {
    expect(() =>
      seedAccountPassword({ environment: "test", hermetic: false }, {}, "dev seed"),
    ).toThrow(/SEED_ACCOUNT_PASSWORD is required for a test database/);
    expect(() =>
      seedAccountPassword({ environment: "local", hermetic: false }, {}, "dev seed"),
    ).toThrow(/SEED_ACCOUNT_PASSWORD is required/);
  });

  it("refuses the local password or a short one on a non-hermetic database", () => {
    const target = { environment: "test", hermetic: false };
    expect(() =>
      seedAccountPassword(target, { seedAccountPassword: LOCAL_SEED_PASSWORD }, "dev seed"),
    ).toThrow(/not the local password/);
    expect(() => seedAccountPassword(target, { seedAccountPassword: "short" }, "dev seed")).toThrow(
      /at least 16 characters/,
    );
    expect(seedAccountPassword(target, { seedAccountPassword: strong }, "dev seed")).toBe(strong);
  });

  it("uses the local password only on a hermetic database", () => {
    expect(seedAccountPassword({ environment: "local", hermetic: true }, {}, "dev seed")).toBe(
      LOCAL_SEED_PASSWORD,
    );
  });
});

describe("addresses", () => {
  it("counts loopback and Compose service names as local, never a deployed environment", () => {
    expect(isLocalSeedAddress({ databaseUrl: LOCAL_URL })).toBe(true);
    expect(isLocalSeedAddress({ databaseUrl: "postgresql://u:p@postgres:5432/auction" })).toBe(
      true,
    );
    expect(isLocalSeedAddress({ databaseUrl: LOCAL_URL, appEnv: "test" })).toBe(false);
    expect(isLocalSeedAddress({ databaseUrl: REMOTE_URL })).toBe(false);
    expect(isLocalSeedAddress({ databaseUrl: "postgres://u:p@10.0.0.5/x" })).toBe(false);
  });

  it("needs a database address", () => {
    expect(() => assertSeedEnvironment("dev seed", { databaseUrl: undefined })).toThrow(/required/);
  });

  it("reads the guard's inputs from the environment", () => {
    expect(
      seedTargetEnvFromProcess("DATABASE_URL_SHOP", {
        DATABASE_URL_SHOP: LOCAL_URL,
        APP_ENV: "test",
        SEED_ACCOUNT_PASSWORD: "x",
      }),
    ).toEqual({
      databaseUrl: LOCAL_URL,
      nodeEnv: undefined,
      appEnv: "test",
      seedAccountPassword: "x",
    });
  });
});
