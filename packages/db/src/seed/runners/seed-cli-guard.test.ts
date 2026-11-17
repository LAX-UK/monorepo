import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fakeSeedDatabase } from "../../testing/fake-seed-database.js";
import { runCheckAccountsSeed } from "../check/check-accounts-seed.js";
import { runDemoFull } from "../demo/demo-full-seed.js";
import { ensurePeople, runDemoTopUp } from "../demo/demo-topup-seed.js";
import { LOCAL_SEED_PASSWORD } from "../shared/seed-target-guard.js";
import { seedCheckAccounts } from "./check-accounts-cli.js";
import { seedDemoFull } from "./demo-full-cli.js";
import { seedDemoTopUp } from "./demo-topup-cli.js";

/**
 * Each seed CLI that writes accounts or passwords goes through the seed target guard. These tests
 * drive the function each CLI's main() runs, with the real seed replaced by a spy, so taking the
 * guard out of a CLI fails here.
 */

const LOCAL_URL = "postgresql://u:p@localhost:5432/auction_ci";
const REMOTE_URL = "postgresql://u:p@db-test-lon1.example.com:25060/defaultdb";
const STRONG = "s".repeat(24);
const NOW = 1_700_000_000_000;

type Db = Parameters<typeof seedCheckAccounts>[0];
const asDb = (db: ReturnType<typeof fakeSeedDatabase>["db"]) => db as unknown as Db;

type Runner = (
  db: Db,
  env: Parameters<typeof seedCheckAccounts>[1],
  write: (...args: unknown[]) => Promise<unknown>,
) => Promise<unknown>;

const CLIS: { name: string; run: Runner; password: (args: unknown[]) => unknown }[] = [
  {
    name: "check-accounts",
    run: (db, env, write) => seedCheckAccounts(db, env, write as never),
    password: (args) => args[1],
  },
  {
    name: "demo-topup",
    run: (db, env, write) => seedDemoTopUp(db, env, NOW, write as never),
    password: (args) => args[2],
  },
  {
    name: "demo-full",
    run: (db, env, write) => seedDemoFull(db, env, NOW, write as never),
    password: (args) => args[2],
  },
];

describe.each(CLIS)("$name CLI", ({ run, password }) => {
  it("writes nothing on an unmarked database, even at a loopback address", async () => {
    for (const databaseUrl of [LOCAL_URL, REMOTE_URL]) {
      const fake = fakeSeedDatabase({ name: "auction_ci" });
      const write = vi.fn(async () => ({}));
      await expect(
        run(asDb(fake.db), { databaseUrl, seedAccountPassword: STRONG }, write),
      ).rejects.toThrow(/not marked/);
      expect(write).not.toHaveBeenCalled();
      expect(fake.wrote()).toBe(false);
    }
  });

  it("writes nothing on production", async () => {
    const fake = fakeSeedDatabase({
      name: "x",
      mark: { environment: "test", database_name: "x" },
    });
    const write = vi.fn(async () => ({}));
    await expect(
      run(asDb(fake.db), { databaseUrl: REMOTE_URL, appEnv: "production" }, write),
    ).rejects.toThrow(/production/);
    expect(write).not.toHaveBeenCalled();
  });

  it("writes nothing on a test database without SEED_ACCOUNT_PASSWORD", async () => {
    const fake = fakeSeedDatabase({
      name: "defaultdb",
      mark: { environment: "test", database_name: "defaultdb" },
    });
    const write = vi.fn(async () => ({}));
    await expect(
      run(asDb(fake.db), { databaseUrl: REMOTE_URL, appEnv: "test" }, write),
    ).rejects.toThrow(/SEED_ACCOUNT_PASSWORD is required/);
    expect(write).not.toHaveBeenCalled();
  });

  it("uses SEED_ACCOUNT_PASSWORD on a test database", async () => {
    const fake = fakeSeedDatabase({
      name: "defaultdb",
      mark: { environment: "test", database_name: "defaultdb" },
    });
    const write = vi.fn(async (..._args: unknown[]) => ({}));
    await run(
      asDb(fake.db),
      { databaseUrl: REMOTE_URL, appEnv: "test", seedAccountPassword: STRONG },
      write,
    );
    expect(password(write.mock.calls[0] ?? [])).toBe(STRONG);
  });

  it("uses the local password only on a hermetic database", async () => {
    const fake = fakeSeedDatabase({
      name: "auction_ci",
      mark: { environment: "local", database_name: "auction_ci" },
    });
    const write = vi.fn(async (..._args: unknown[]) => ({}));
    await run(asDb(fake.db), { databaseUrl: LOCAL_URL }, write);
    expect(password(write.mock.calls[0] ?? [])).toBe(LOCAL_SEED_PASSWORD);
  });
});

describe("seed CLI wiring", () => {
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

  it.each([
    ["check-accounts-cli.ts", "seedCheckAccounts(tx, env)", "runCheckAccountsSeed(tx"],
    ["demo-topup-cli.ts", "seedDemoTopUp(tx, env,", "runDemoTopUp(tx"],
    ["demo-full-cli.ts", "seedDemoFull(tx, env,", "runDemoFull(tx"],
    ["dev-runner.ts", "runDevSeedSteps(", "runLegacyDemoSeed({ password, hermetic })"],
  ])("%s's main() goes through the guarded function", (file, guarded, raw) => {
    const source = read(`./${file}`);
    const main = source.slice(source.indexOf("async function "));
    expect(source).toContain(guarded);
    if (file !== "dev-runner.ts") expect(main).not.toContain(raw);
  });
});

describe("seed functions", () => {
  // A parameter with a default is not counted in Function.length, so these fail if the password
  // gets a default (the local password) again.
  it.each([
    ["runCheckAccountsSeed", runCheckAccountsSeed, 2],
    ["runDemoTopUp", runDemoTopUp, 3],
    ["runDemoFull", runDemoFull, 3],
    ["ensurePeople", ensurePeople, 3],
  ] as const)("%s takes the password from its caller, with no default", (_name, fn, required) => {
    expect(fn.length).toBe(required);
  });
});
