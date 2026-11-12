import { describe, expect, it, vi } from "vitest";
import { type HeldSession, SessionCap, type SessionCapStore } from "./session-cap.service.js";
import { SESSION_LIFETIME_POLICY } from "./session-lifetime-policy.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-11T12:00:00.000Z");

function held(id: string, idleFor: number, over: Partial<HeldSession> = {}): HeldSession {
  return {
    id,
    expiresAt: new Date(NOW.getTime() + DAY),
    lastActiveAt: new Date(NOW.getTime() - idleFor),
    signedInAt: new Date(NOW.getTime() - HOUR),
    ...over,
  };
}

/** A store over an in-memory list that applies `choose` and records what `beforeDelete` saw. */
function setup(sessions: HeldSession[], isStaff = false) {
  const seen: string[][] = [];
  const store: SessionCapStore = {
    findOverCap: async () => [],
    endChosen: async (_userId, choose, beforeDelete) => {
      const chosen = choose({ isStaff, sessions });
      if (chosen.length === 0) return null;
      const batch = chosen.map((id) => ({ id, userId: "ann", previousSids: [`${id}-before`] }));
      seen.push(chosen.map((id) => id));
      const prepared = await beforeDelete(batch);
      return { ended: batch.length, prepared } as never;
    },
  };
  const run = vi.fn(async () => undefined);
  const ended = { reserve: vi.fn(async () => ({ run })) };
  return { cap: new SessionCap(store, ended, () => NOW), ended, run, seen };
}

const many = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    held(`s${String(i).padStart(2, "0")}`, (count - i) * HOUR),
  );

describe("SessionCap", () => {
  it("does nothing while the person is at or under 20 browsers", async () => {
    const { cap, ended } = setup(many(SESSION_LIFETIME_POLICY.client.maxBrowsers));
    await expect(cap.enforce({ userId: "ann", keepSessionId: "s19" })).resolves.toBe(0);
    expect(ended.reserve).not.toHaveBeenCalled();
  });

  it("ends the least recently used record on the 21st sign-in, with every id it stood for", async () => {
    const { cap, ended, run, seen } = setup(many(21));
    await expect(cap.enforce({ userId: "ann", keepSessionId: "s20" })).resolves.toBe(1);
    expect(seen).toEqual([["s00"]]);
    expect(ended.reserve).toHaveBeenCalledWith({
      userId: "ann",
      sessionIds: ["s00", "s00-before"],
    });
    expect(run).toHaveBeenCalledOnce();
  });

  it("holds staff to 5", async () => {
    const { cap, seen } = setup(many(6), true);
    await expect(cap.enforce({ userId: "ann", keepSessionId: "s05" })).resolves.toBe(1);
    expect(seen).toEqual([["s00"]]);
    const underStaffCap = setup(many(5), true);
    await expect(underStaffCap.cap.enforce({ userId: "ann", keepSessionId: "s04" })).resolves.toBe(
      0,
    );
  });

  it("does not count records that are already over; the sweep ends those", async () => {
    const stale = Array.from({ length: 5 }, (_, i) =>
      held(`stale${i}`, 8 * DAY, { expiresAt: new Date(NOW.getTime() - 1) }),
    );
    const { cap } = setup([...stale, ...many(20)]);
    await expect(cap.enforce({ userId: "ann", keepSessionId: "s19" })).resolves.toBe(0);
  });

  it("makes the sign-out durable before anything is run", async () => {
    const order: string[] = [];
    const { cap, ended, run } = setup(many(21));
    ended.reserve.mockImplementation(async () => {
      order.push("reserve");
      return { run };
    });
    run.mockImplementation(async () => void order.push("run"));
    await cap.enforce({ userId: "ann", keepSessionId: "s20" });
    expect(order).toEqual(["reserve", "run"]);
  });

  it("holds everyone the store finds over their cap, reporting one that fails and carrying on", async () => {
    const onFailed = vi.fn();
    const calls: string[] = [];
    const store: SessionCapStore = {
      findOverCap: async () => ["ann", "ben"],
      endChosen: async (userId) => {
        calls.push(userId);
        if (userId === "ann") throw new Error("deadlock detected");
        return { ended: 2, prepared: [] } as never;
      },
    };
    const cap = new SessionCap(store, { reserve: vi.fn() }, () => NOW, onFailed);

    await expect(cap.enforceOverCap()).resolves.toBe(2);

    expect(calls).toEqual(["ann", "ben"]);
    expect(onFailed).toHaveBeenCalledWith(expect.any(Error), "ann");
  });
});
