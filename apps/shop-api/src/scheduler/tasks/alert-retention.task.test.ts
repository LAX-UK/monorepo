import { describe, expect, it, vi } from "vitest";
import { createAlertRetentionTask } from "./alert-retention.task.js";

const zero = { unconfirmed: 0, stopped: 0, suppressionsTrimmed: 0, matches: 0, digests: 0 };
const setup = () => {
  const prune = vi.fn(async () => zero);
  const task = createAlertRetentionTask({
    store: { name: "shop", prune },
    log: { info: vi.fn(), error: vi.fn() },
  });
  return { prune, task };
};

describe("alert retention task", () => {
  it("runs in the 03:00 UTC hour only", async () => {
    const { prune, task } = setup();
    await task.run(new Date("2026-11-06T02:59:00Z"));
    await task.run(new Date("2026-11-06T04:00:00Z"));
    expect(prune).not.toHaveBeenCalled();
    await task.run(new Date("2026-11-06T03:05:00Z"));
    expect(prune).toHaveBeenCalledOnce();
  });

  it("runs once a day, and again the next day", async () => {
    const { prune, task } = setup();
    await task.run(new Date("2026-11-06T03:00:00Z"));
    await task.run(new Date("2026-11-06T03:30:00Z"));
    expect(prune).toHaveBeenCalledTimes(1);
    await task.run(new Date("2026-11-07T03:00:00Z"));
    expect(prune).toHaveBeenCalledTimes(2);
  });

  it("retries on the next tick after a failure", async () => {
    const { prune, task } = setup();
    prune.mockRejectedValueOnce(new Error("db down"));
    await expect(task.run(new Date("2026-11-06T03:00:00Z"))).rejects.toThrow();
    await task.run(new Date("2026-11-06T03:01:00Z"));
    expect(prune).toHaveBeenCalledTimes(2);
  });
});
