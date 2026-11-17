import { describe, expect, it, vi } from "vitest";
import { fakeSeedDatabase } from "../../testing/fake-seed-database.js";
import { LOCAL_SEED_PASSWORD } from "../shared/seed-target-guard.js";
import { type DevSeedSteps, runDevSeedSteps } from "./dev-runner.js";

const LOCAL_URL = "postgresql://u:p@localhost:5432/auction_ci";
const REMOTE_URL = "postgresql://u:p@db-test-lon1.example.com:25060/defaultdb";

function steps() {
  const calls: string[] = [];
  const fake: DevSeedSteps = {
    loadDemoData: vi.fn(async (password: string, hermetic: boolean) => {
      calls.push(`load:${password}:${hermetic ? "hermetic" : "shared"}`);
    }),
    flagRolloutIdentities: vi.fn(async () => {
      calls.push("rollout");
    }),
    relaxStaffTwoFactor: vi.fn(async () => {
      calls.push("relax-2fa");
    }),
    log: vi.fn(),
  };
  return { fake, calls };
}

const marked = (environment: string, name = "defaultdb") =>
  fakeSeedDatabase({ name, mark: { environment, database_name: name } }).db;

describe("runDevSeedSteps", () => {
  const remotePassword = "r".repeat(24);

  it("leaves staff two-factor untouched on a test database", async () => {
    const { fake, calls } = steps();
    await runDevSeedSteps(
      marked("test"),
      { databaseUrl: REMOTE_URL, appEnv: "test", seedAccountPassword: remotePassword },
      fake,
    );
    expect(fake.relaxStaffTwoFactor).not.toHaveBeenCalled();
    expect(calls).toEqual([`load:${remotePassword}:shared`, "rollout"]);
  });

  it("refuses a test database without SEED_ACCOUNT_PASSWORD before writing anything", async () => {
    const { fake, calls } = steps();
    await expect(
      runDevSeedSteps(marked("test"), { databaseUrl: REMOTE_URL, appEnv: "test" }, fake),
    ).rejects.toThrow(/SEED_ACCOUNT_PASSWORD is required/);
    expect(calls).toEqual([]);
  });

  it("writes nothing on an unmarked database, even at a loopback address", async () => {
    for (const databaseUrl of [LOCAL_URL, REMOTE_URL]) {
      const { fake, calls } = steps();
      const { db, wrote } = fakeSeedDatabase({ name: "auction_ci" });
      await expect(
        runDevSeedSteps(db, { databaseUrl, seedAccountPassword: remotePassword }, fake),
      ).rejects.toThrow(/not marked/);
      expect(calls).toEqual([]);
      expect(wrote()).toBe(false);
    }
  });

  it("treats a tunnelled database marked test as shared, not hermetic", async () => {
    const { fake, calls } = steps();
    await runDevSeedSteps(
      marked("test"),
      {
        databaseUrl: "postgresql://u:p@localhost:15432/defaultdb",
        seedAccountPassword: remotePassword,
      },
      fake,
    );
    expect(calls).toEqual([`load:${remotePassword}:shared`, "rollout"]);
  });

  it("uses the local password and relaxes staff two-factor on a hermetic database", async () => {
    const { fake, calls } = steps();
    await runDevSeedSteps(marked("local", "auction_ci"), { databaseUrl: LOCAL_URL }, fake);
    expect(calls).toEqual([`load:${LOCAL_SEED_PASSWORD}:hermetic`, "rollout", "relax-2fa"]);
  });
});
