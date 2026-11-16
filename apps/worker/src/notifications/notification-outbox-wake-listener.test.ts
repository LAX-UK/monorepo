import { EventEmitter } from "node:events";
import { NOTIFICATION_OUTBOX_WAKE_CHANNEL } from "@auction/persistence/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationOutboxWakeListener,
  type WakeListenerClient,
} from "./notification-outbox-wake-listener.js";

class FakeClient extends EventEmitter {
  queries: string[] = [];
  ended = false;
  constructor(private readonly failConnect = false) {
    super();
  }
  async connect() {
    if (this.failConnect) throw new Error("connection refused");
  }
  async query(text: string) {
    this.queries.push(text);
  }
  async end() {
    this.ended = true;
  }
}

function setup(plan: boolean[] = []) {
  const clients: FakeClient[] = [];
  const onWake = vi.fn();
  const log = { info: vi.fn(), warn: vi.fn() };
  const listener = new NotificationOutboxWakeListener({
    createClient: () => {
      const client = new FakeClient(plan[clients.length] ?? false);
      clients.push(client);
      return client as unknown as WakeListenerClient;
    },
    onWake,
    log,
  });
  return { listener, clients, onWake, log };
}

describe("NotificationOutboxWakeListener", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("listens on the outbox channel and wakes once on connect", async () => {
    const { listener, clients, onWake } = setup();
    await listener.start();
    expect(clients[0]?.queries).toEqual([`LISTEN ${NOTIFICATION_OUTBOX_WAKE_CHANNEL}`]);
    expect(onWake).toHaveBeenCalledTimes(1);
    await listener.stop();
  });

  it("wakes for each signal on the outbox channel and ignores other channels", async () => {
    const { listener, clients, onWake } = setup();
    await listener.start();
    onWake.mockClear();
    clients[0]?.emit("notification", { channel: NOTIFICATION_OUTBOX_WAKE_CHANNEL });
    clients[0]?.emit("notification", { channel: "something_else" });
    clients[0]?.emit("notification", { channel: NOTIFICATION_OUTBOX_WAKE_CHANNEL });
    expect(onWake).toHaveBeenCalledTimes(2);
    await listener.stop();
  });

  it("reconnects with backoff after the connection drops, and wakes to catch missed signals", async () => {
    const { listener, clients, onWake, log } = setup();
    await listener.start();
    onWake.mockClear();
    clients[0]?.emit("error", new Error("terminated"));
    expect(clients[0]?.ended).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ retryInMs: 1_000 }),
      "notification_outbox_wake_listener_dropped",
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(clients).toHaveLength(2);
    expect(clients[1]?.queries).toEqual([`LISTEN ${NOTIFICATION_OUTBOX_WAKE_CHANNEL}`]);
    expect(onWake).toHaveBeenCalledTimes(1);
    // Signals on the discarded client no longer count; a late error on it is not fatal.
    clients[0]?.emit("notification", { channel: NOTIFICATION_OUTBOX_WAKE_CHANNEL });
    expect(() => clients[0]?.emit("error", new Error("late"))).not.toThrow();
    expect(onWake).toHaveBeenCalledTimes(1);
    await listener.stop();
  });

  it("backs off further while the database stays unreachable", async () => {
    const { listener, clients, log } = setup([true, true, false]);
    await listener.start();
    expect(clients).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(clients).toHaveLength(2);
    expect(log.warn).toHaveBeenLastCalledWith(
      expect.objectContaining({ retryInMs: 2_000 }),
      "notification_outbox_wake_listener_dropped",
    );
    await vi.advanceTimersByTimeAsync(1_999);
    expect(clients).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(clients).toHaveLength(3);
    expect(clients[2]?.queries).toHaveLength(1);
    await listener.stop();
  });

  it("stops listening and does not reconnect after stop", async () => {
    const { listener, clients } = setup();
    await listener.start();
    await listener.stop();
    expect(clients[0]?.ended).toBe(true);
    clients[0]?.emit("end");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(clients).toHaveLength(1);
  });
});
