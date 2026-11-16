import { describe, expect, it, vi } from "vitest";
import type { SeedTarget } from "../shared/seed-target-guard.js";
import { LOCAL_SEED_PASSWORD } from "../shared/seed-target-guard.js";
import { type DevSeedSteps, runDevSeedSteps } from "./dev-runner.js";

function steps(target: SeedTarget | Error) {
  const calls: string[] = [];
  const fake: DevSeedSteps = {
    assertTarget: vi.fn(async () => {
      if (target instanceof Error) throw target;
      return target;
    }),
    loadDemoData: vi.fn(async (password: string) => {
      calls.push(`load:${password}`);
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

describe("runDevSeedSteps", () => {
  const remotePassword = "r".repeat(24);

  it("leaves staff two-factor untouched on a test database", async () => {
    const { fake, calls } = steps({ environment: "test", hermetic: false });
    await runDevSeedSteps(fake, { seedAccountPassword: remotePassword });
    expect(fake.relaxStaffTwoFactor).not.toHaveBeenCalled();
    expect(calls).toEqual([`load:${remotePassword}`, "rollout"]);
  });

  it("refuses a test database without SEED_ACCOUNT_PASSWORD before writing anything", async () => {
    const { fake, calls } = steps({ environment: "test", hermetic: false });
    await expect(runDevSeedSteps(fake, {})).rejects.toThrow(/SEED_ACCOUNT_PASSWORD is required/);
    expect(calls).toEqual([]);
  });

  it("writes nothing when the target is refused", async () => {
    const { fake, calls } = steps(new Error("[dev seed] refusing to seed: not marked"));
    await expect(runDevSeedSteps(fake, { seedAccountPassword: remotePassword })).rejects.toThrow(
      /not marked/,
    );
    expect(calls).toEqual([]);
  });

  it("uses the local password and relaxes staff two-factor on a hermetic database", async () => {
    const { fake, calls } = steps({ environment: "local", hermetic: true });
    await runDevSeedSteps(fake, {});
    expect(calls).toEqual([`load:${LOCAL_SEED_PASSWORD}`, "rollout", "relax-2fa"]);
  });
});
