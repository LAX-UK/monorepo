import { describe, expect, it, vi } from "vitest";
import { fakeSeedDatabase } from "../../testing/fake-seed-database.js";
import {
  LOCAL_SEED_PASSWORD,
  assertSeedEnvironment,
  assertSeedTarget,
  isLocalSeedAddress,
  seedAccountPassword,
  seedTargetEnvFromProcess,
  withSeedTarget,
} from "./seed-target-guard.js";

const LOCAL_URL = "postgresql://u:p@localhost:5432/auction_ci";
const REMOTE_URL = "postgresql://u:p@db-test-lon1.example.com:25060/defaultdb";

function fakeDb(options: Parameters<typeof fakeSeedDatabase>[0]) {
  const fake = fakeSeedDatabase(options);
  const db = { execute: vi.fn(fake.db.execute) };
  return { db, inserted: () => fake.statements.some((s) => s.includes("insert into")) };
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

  it("never marks an unmarked loopback database: it could be a tunnel to a remote one", async () => {
    for (const env of [
      { databaseUrl: LOCAL_URL },
      { databaseUrl: LOCAL_URL, appEnv: "development" },
      { databaseUrl: "postgresql://u:p@127.0.0.1:15432/defaultdb" },
      { databaseUrl: LOCAL_URL, appEnv: "test" },
    ]) {
      const { db, inserted } = fakeDb({ name: "auction_ci" });
      await expect(assertSeedTarget(db, "dev seed", env)).rejects.toThrow(
        /not marked as a demo seed target.*db:seed:mark-demo-target local/,
      );
      expect(inserted()).toBe(false);
    }
  });

  it("takes a loopback database marked local for a hermetic one", async () => {
    const { db, inserted } = fakeDb({
      name: "auction_ci",
      mark: { environment: "local", database_name: "auction_ci" },
    });
    await expect(
      assertSeedTarget(db, "dev seed", { databaseUrl: LOCAL_URL, appEnv: "development" }),
    ).resolves.toEqual({ environment: "local", hermetic: true });
    expect(inserted()).toBe(false);
  });

  it("does not take a loopback database marked test for a hermetic one", async () => {
    const { db } = fakeDb({
      name: "defaultdb",
      mark: { environment: "test", database_name: "defaultdb" },
    });
    await expect(
      assertSeedTarget(db, "dev seed", {
        databaseUrl: "postgresql://u:p@localhost:15432/defaultdb",
      }),
    ).resolves.toEqual({ environment: "test", hermetic: false });
  });

  it("does not take a single-label host other than the Compose service names for local", async () => {
    const { db } = fakeDb({
      name: "defaultdb",
      mark: { environment: "local", database_name: "defaultdb" },
    });
    await expect(
      assertSeedTarget(db, "dev seed", { databaseUrl: "postgresql://u:p@dbhost/defaultdb" }),
    ).resolves.toEqual({ environment: "local", hermetic: false });
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

describe("withSeedTarget", () => {
  it("writes nothing when the target or the password is refused", async () => {
    const write = vi.fn(async () => "written");
    await expect(
      withSeedTarget(fakeDb({ name: "x" }).db, "s", { databaseUrl: LOCAL_URL }, write),
    ).rejects.toThrow(/not marked/);
    const test = fakeDb({ name: "x", mark: { environment: "test", database_name: "x" } }).db;
    await expect(withSeedTarget(test, "s", { databaseUrl: REMOTE_URL }, write)).rejects.toThrow(
      /SEED_ACCOUNT_PASSWORD is required/,
    );
    expect(write).not.toHaveBeenCalled();
  });

  it("passes the checked password and target to the write", async () => {
    const local = fakeDb({ name: "x", mark: { environment: "local", database_name: "x" } }).db;
    const write = vi.fn(async () => "written");
    await expect(withSeedTarget(local, "s", { databaseUrl: LOCAL_URL }, write)).resolves.toBe(
      "written",
    );
    expect(write).toHaveBeenCalledWith(LOCAL_SEED_PASSWORD, {
      environment: "local",
      hermetic: true,
    });
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
    expect(isLocalSeedAddress({ databaseUrl: "postgresql://u:p@db:5432/auction" })).toBe(true);
    expect(isLocalSeedAddress({ databaseUrl: "postgresql://u:p@pgbouncer:6432/auction" })).toBe(
      false,
    );
    expect(isLocalSeedAddress({ databaseUrl: "postgresql://u:p@dbhost/auction" })).toBe(false);
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
