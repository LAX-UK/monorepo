import { describe, expect, it, vi } from "vitest";
import { type SyncEnvironment, createServerClockSync } from "./server-clock-sync";
import type { ServerTimeSource } from "./server-time-source.client";

/** A server answer after `roundTripMs` on a monotonic clock the test owns. */
function setup(answers: { serverMs: number; roundTripMs: number | "fail" }[], startMono = 1_000) {
  let mono = startMono;
  const applied: { serverMs: number; monotonicMs: number }[] = [];
  let index = 0;
  const source: ServerTimeSource = {
    async readServerNowMs() {
      const answer = answers[Math.min(index++, answers.length - 1)];
      if (!answer) throw new Error("no answer");
      if (answer.roundTripMs === "fail") throw new Error("network");
      mono += answer.roundTripMs;
      return answer.serverMs;
    },
  };
  let clockNow = 0;
  const sync = createServerClockSync({
    source,
    clock: {
      now: () => clockNow,
      applyMeasurement: (serverMs, monotonicMs) => applied.push({ serverMs, monotonicMs }),
    },
    monotonicNow: () => mono,
  });
  return {
    sync,
    applied,
    reads: () => index,
    setClockNow: (v: number) => {
      clockNow = v;
    },
    advance: (ms: number) => {
      mono += ms;
    },
    getMono: () => mono,
  };
}

describe("createServerClockSync", () => {
  it("measures three round trips and keeps the quickest", async () => {
    const t = setup([
      { serverMs: 10_000, roundTripMs: 300 },
      { serverMs: 10_400, roundTripMs: 80 },
      { serverMs: 10_900, roundTripMs: 500 },
    ]);
    await t.sync.resync("start");
    expect(t.reads()).toBe(3);
    expect(t.applied).toHaveLength(1);
    // server time + half the round trip, read at the monotonic moment the answer arrived
    expect(t.applied[0]?.serverMs).toBe(10_400 + 40);
    expect(t.applied[0]?.monotonicMs).toBe(1_000 + 300 + 80);
  });

  it("drops round trips slower than two seconds", async () => {
    const t = setup([
      { serverMs: 10_000, roundTripMs: 2_500 },
      { serverMs: 10_000, roundTripMs: 2_100 },
      { serverMs: 10_000, roundTripMs: 3_000 },
    ]);
    await t.sync.resync("start");
    expect(t.applied).toHaveLength(0);
  });

  it("keeps the provisional offset when every call fails, and tries again later", async () => {
    const t = setup([{ serverMs: 0, roundTripMs: "fail" }]);
    await t.sync.resync("start");
    expect(t.applied).toHaveLength(0);
    await expect(t.sync.resync("interval")).resolves.toBeUndefined();
  });

  it("uses what it got when only some calls fail", async () => {
    const t = setup([
      { serverMs: 0, roundTripMs: "fail" },
      { serverMs: 20_000, roundTripMs: 100 },
      { serverMs: 0, roundTripMs: "fail" },
    ]);
    await t.sync.resync("start");
    expect(t.applied).toHaveLength(1);
    expect(t.applied[0]?.serverMs).toBe(20_050);
  });

  it("shares one measurement between simultaneous triggers", async () => {
    const t = setup([{ serverMs: 10_000, roundTripMs: 50 }]);
    await Promise.all([
      t.sync.resync("start"),
      t.sync.resync("reconnect"),
      t.sync.resync("visible"),
    ]);
    expect(t.reads()).toBe(3);
    expect(t.applied).toHaveLength(1);
  });

  it("a live event ahead of our clock by more than 250 ms triggers a resync, but not a close one", async () => {
    const t = setup([{ serverMs: 50_000, roundTripMs: 10 }]);
    t.setClockNow(50_000);
    t.sync.observeServerNow(50_200);
    expect(t.reads()).toBe(0);
    t.sync.observeServerNow(50_300);
    await vi.waitFor(() => expect(t.applied).toHaveLength(1));
    expect(t.reads()).toBe(3);
  });

  it("live events resync at most once every 30 seconds", async () => {
    const t = setup([{ serverMs: 50_000, roundTripMs: 10 }]);
    t.setClockNow(40_000);
    t.sync.observeServerNow(50_000);
    await vi.waitFor(() => expect(t.applied).toHaveLength(1));
    t.sync.observeServerNow(50_000);
    t.advance(1_000);
    t.sync.observeServerNow(50_000);
    await Promise.resolve();
    expect(t.applied).toHaveLength(1);
    t.advance(30_000);
    t.sync.observeServerNow(50_000);
    await vi.waitFor(() => expect(t.applied).toHaveLength(2));
  });

  it("a reconnect resyncs", async () => {
    const t = setup([{ serverMs: 50_000, roundTripMs: 10 }]);
    t.sync.notifyReconnected();
    await vi.waitFor(() => expect(t.applied).toHaveLength(1));
  });
});

describe("start", () => {
  function environment() {
    let visible = true;
    let visibilityCallback: () => void = () => undefined;
    let intervalCallback: () => void = () => undefined;
    let intervalMs = 0;
    let mono = 0;
    let wallExtra = 0;
    let needed = true;
    let resumeCallback: () => void = () => undefined;
    const env: SyncEnvironment = {
      wallNow: () => 1_000_000 + mono + wallExtra,
      onResume(cb) {
        resumeCallback = cb;
        return () => undefined;
      },
      isNeeded: () => needed,
      isVisible: () => visible,
      onVisibilityChange(cb) {
        visibilityCallback = cb;
        return () => undefined;
      },
      setInterval(cb, ms) {
        intervalCallback = cb;
        intervalMs = ms;
        return () => undefined;
      },
      monotonicNow: () => mono,
    };
    return {
      env,
      setVisible(value: boolean) {
        visible = value;
        visibilityCallback();
      },
      tick: () => intervalCallback(),
      intervalMs: () => intervalMs,
      advance(ms: number) {
        mono += ms;
      },
      /** The device sleeps: the wall clock moves on while the monotonic clock does not. */
      sleep(ms: number) {
        wallExtra += ms;
      },
      resume: () => resumeCallback(),
      setNeeded(value: boolean) {
        needed = value;
      },
    };
  }

  it("syncs at start and every ten minutes while the tab is visible", async () => {
    const t = setup([{ serverMs: 50_000, roundTripMs: 10 }]);
    const e = environment();
    t.sync.start(e.env);
    await vi.waitFor(() => expect(t.applied).toHaveLength(1));
    expect(e.intervalMs()).toBe(10 * 60_000);
    e.tick();
    await vi.waitFor(() => expect(t.applied).toHaveLength(2));
    e.setVisible(false);
    e.tick();
    await Promise.resolve();
    expect(t.applied).toHaveLength(2);
  });

  it("resyncs on tab return only after more than 60 seconds hidden", async () => {
    const t = setup([{ serverMs: 50_000, roundTripMs: 10 }]);
    const e = environment();
    t.sync.start(e.env);
    await vi.waitFor(() => expect(t.applied).toHaveLength(1));

    e.setVisible(false);
    e.advance(30_000);
    e.setVisible(true);
    await Promise.resolve();
    expect(t.applied).toHaveLength(1);

    e.setVisible(false);
    e.advance(61_000);
    e.setVisible(true);
    await vi.waitFor(() => expect(t.applied).toHaveLength(2));
  });

  it("resyncs after the device sleeps, even though the monotonic clock did not move", async () => {
    const t = setup([{ serverMs: 50_000, roundTripMs: 10 }]);
    const e = environment();
    t.sync.start(e.env);
    await vi.waitFor(() => expect(t.applied).toHaveLength(1));

    e.resume();
    await Promise.resolve();
    expect(t.applied).toHaveLength(1);

    e.sleep(2 * 60 * 60_000);
    e.resume();
    await vi.waitFor(() => expect(t.applied).toHaveLength(2));
  });

  it("skips the ten-minute resync when no countdown is on screen", async () => {
    const t = setup([{ serverMs: 50_000, roundTripMs: 10 }]);
    const e = environment();
    t.sync.start(e.env);
    await vi.waitFor(() => expect(t.applied).toHaveLength(1));
    e.setNeeded(false);
    e.tick();
    await Promise.resolve();
    expect(t.applied).toHaveLength(1);
    e.setNeeded(true);
    e.tick();
    await vi.waitFor(() => expect(t.applied).toHaveLength(2));
  });
});
