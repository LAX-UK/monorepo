import { describe, expect, it, vi } from "vitest";
import type { IImpersonationSweepRepository } from "../interfaces/impersonation-sweep.repository.js";
import { runImpersonationSweeperJob } from "./impersonation-sweeper.js";

describe("runImpersonationSweeperJob", () => {
  it("logs when sessions are swept", async () => {
    const impersonationSweepRepo: IImpersonationSweepRepository = {
      sweepStaleSessions: vi.fn().mockResolvedValue(2),
    };
    const log = { info: vi.fn() };
    await runImpersonationSweeperJob({
      impersonationSweepRepo,
      log: log as never,
    });
    expect(impersonationSweepRepo.sweepStaleSessions).toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith({ inserted: 2 }, "impersonation_sweeper_inserted_timeout_ends");
  });
});
