import { describe, expect, it, vi } from "vitest";
import {
  type ExpiredSession,
  type SessionExpiryStore,
  SessionExpirySweep,
} from "./session-expiry-sweep.service.js";

const NOW = new Date("2026-11-11T12:00:00Z");

function setup(initial: ExpiredSession[]) {
  const remaining = [...initial];
  const calls: string[] = [];
  const store: SessionExpiryStore = {
    findExpired: vi.fn(async (_now, limit) => remaining.slice(0, limit)),
    deleteExpired: vi.fn(async (sessions) => {
      calls.push("delete");
      for (const session of sessions) {
        const index = remaining.findIndex((entry) => entry.id === session.id);
        if (index >= 0) remaining.splice(index, 1);
      }
      return [...sessions];
    }),
  };
  const run = vi.fn(async () => {
    calls.push("run");
  });
  const reserve = vi.fn(async (_input: { userId: string; sessionIds: readonly string[] }) => {
    calls.push("reserve");
    return { run };
  });
  return {
    sweep: new SessionExpirySweep(store, { reserve }, () => NOW, 2),
    store,
    reserve,
    run,
    calls,
    remaining,
  };
}

describe("SessionExpirySweep", () => {
  it("does nothing when no record has run out", async () => {
    const { sweep, reserve } = setup([]);
    await expect(sweep.run()).resolves.toBe(0);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("sends the same back-channel sign-out as a manual one: the record and each earlier id, per person", async () => {
    const { sweep, reserve } = setup([
      { id: "a1", userId: "ann", previousSids: ["a0"] },
      { id: "b1", userId: "ben", previousSids: [] },
    ]);

    await expect(sweep.run()).resolves.toBe(2);

    expect(reserve.mock.calls.map(([input]) => input)).toEqual([
      { userId: "ann", sessionIds: ["a1", "a0"] },
      { userId: "ben", sessionIds: ["b1"] },
    ]);
  });

  it("makes the sign-out durable before the records go, and sends it after", async () => {
    const { sweep, calls } = setup([{ id: "a1", userId: "ann", previousSids: [] }]);
    await sweep.run();
    expect(calls).toEqual(["reserve", "delete", "run"]);
  });

  it("is idempotent: a second run finds nothing and tells no product again", async () => {
    const { sweep, reserve, store } = setup([{ id: "a1", userId: "ann", previousSids: [] }]);

    await sweep.run();
    await expect(sweep.run()).resolves.toBe(0);

    expect(reserve).toHaveBeenCalledOnce();
    expect(store.findExpired).toHaveBeenCalledTimes(2);
  });

  it("takes a batch at a time and leaves the rest for the next run", async () => {
    const { sweep, remaining } = setup([
      { id: "s1", userId: "ann", previousSids: [] },
      { id: "s2", userId: "ann", previousSids: [] },
      { id: "s3", userId: "ann", previousSids: [] },
    ]);

    await expect(sweep.run()).resolves.toBe(2);
    expect(remaining.map((entry) => entry.id)).toEqual(["s3"]);
    await expect(sweep.run()).resolves.toBe(1);
  });

  it("leaves records in place when the durable write fails, to be tried again", async () => {
    const { sweep, store, reserve } = setup([{ id: "a1", userId: "ann", previousSids: [] }]);
    reserve.mockRejectedValueOnce(new Error("outbox down"));

    await expect(sweep.run()).rejects.toThrow("outbox down");

    expect(store.deleteExpired).not.toHaveBeenCalled();
    await expect(sweep.run()).resolves.toBe(1);
  });
});
