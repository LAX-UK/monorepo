import type { ConnectionStatus } from "@/lib/realtime/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSocketHealthAdapter,
  resetSocketHealthAdapterForTests,
} from "./socket-health-adapter";

type AckFn = (err: unknown, res: unknown) => void;

function buildFakeSocket(opts?: { failProbe?: boolean }) {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const api = {
    connected: true,
    on(ev: string, fn: (...args: unknown[]) => void) {
      let s = handlers.get(ev);
      if (!s) {
        s = new Set();
        handlers.set(ev, s);
      }
      s.add(fn);
      return api;
    },
    io: { on: vi.fn() },
    timeout() {
      return {
        emit(_ev: string, _payload: unknown, ack?: AckFn) {
          queueMicrotask(() => {
            if (opts?.failProbe) ack?.(new Error("probe failed"), null);
            else ack?.(null, { ok: true, serverNow: Date.now() });
          });
        },
      };
    },
    emitBid(payload: unknown) {
      for (const fn of handlers.get("bidUpdate") ?? []) {
        (fn as (p: unknown) => void)(payload);
      }
    },
  };
  return api;
}

const fakeRef = vi.hoisted(() => ({ current: buildFakeSocket() }));

vi.mock("@/lib/socket", () => ({
  getSocket: () => fakeRef.current,
}));

describe("createSocketHealthAdapter", () => {
  beforeEach(() => {
    resetSocketHealthAdapterForTests();
    fakeRef.current = buildFakeSocket();
  });

  it("records RTT after probe ack", async () => {
    const health = createSocketHealthAdapter();
    const snapshots: ConnectionStatus[] = [];
    health.subscribe((s) => {
      snapshots.push({ ...s });
    });
    await vi.waitFor(() => {
      const hit = snapshots.find((x) => x.rttMs != null && x.state === "online");
      expect(hit).toBeDefined();
    });
  });

  it("marks offline when probe ack fails", async () => {
    fakeRef.current = buildFakeSocket({ failProbe: true });
    resetSocketHealthAdapterForTests();
    const health = createSocketHealthAdapter();
    const snapshots: ConnectionStatus[] = [];
    health.subscribe((s) => {
      snapshots.push({ ...s });
    });
    await vi.waitFor(() => {
      expect(snapshots.some((x) => x.state === "offline")).toBe(true);
    });
  });

  it("updates lastBidPropagationMs for active lot bidUpdate", async () => {
    const health = createSocketHealthAdapter();
    health.setBidPropagationLotId("lot-a");
    const snapshots: ConnectionStatus[] = [];
    health.subscribe((s) => {
      snapshots.push({ ...s });
    });
    await vi.waitFor(() => {
      expect(snapshots.some((x) => x.rttMs != null)).toBe(true);
    });
    fakeRef.current.emitBid({
      type: "bid_placed",
      lotId: "lot-a",
      bid: { id: "b1", bidderId: "u1", amount: "10" },
      currentPrice: "10",
      emittedAt: Date.now() - 30,
    });
    await vi.waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last?.lastBidPropagationMs).not.toBeNull();
      expect(last?.lastBidPropagationMs).toBeGreaterThanOrEqual(0);
    });
  });

  it("ignores bidUpdate for other lots", async () => {
    const health = createSocketHealthAdapter();
    health.setBidPropagationLotId("lot-a");
    const snapshots: ConnectionStatus[] = [];
    health.subscribe((s) => {
      snapshots.push({ ...s });
    });
    await vi.waitFor(() => {
      expect(snapshots.some((x) => x.rttMs != null)).toBe(true);
    });
    const lenBefore = snapshots.length;
    fakeRef.current.emitBid({
      type: "bid_placed",
      lotId: "lot-b",
      bid: { id: "b1", bidderId: "u1", amount: "10" },
      currentPrice: "10",
      emittedAt: Date.now() - 30,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(snapshots.length).toBe(lenBefore);
  });
});
