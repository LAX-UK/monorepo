import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import { describe, expect, it } from "vitest";

describe("saleroom live UX", () => {
  it("classifies hybrid lot as saleroomPaused when session is paused", () => {
    const now = Date.now();
    const lifecycle = classifyLotLifecycle(
      {
        id: "lot-1",
        status: "active",
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 60_000),
        winnerId: null,
        reservePrice: null,
        currentPrice: "100.00",
      },
      { status: "active", deliveryMode: "hybrid" },
      now,
      { saleroomSessionPaused: true },
    );
    expect(lifecycle.kind).toBe("saleroomPaused");
  });

  it("classifies hybrid lot as liveSaleroom when session is live", () => {
    const now = Date.now();
    const lifecycle = classifyLotLifecycle(
      {
        id: "lot-1",
        status: "active",
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 60_000),
        winnerId: null,
        reservePrice: null,
        currentPrice: "100.00",
      },
      { status: "active", deliveryMode: "hybrid" },
      now,
      { saleroomSessionActive: true },
    );
    expect(lifecycle.kind).toBe("liveSaleroom");
    expect(lifecycle.msLeft).toBeNull();
  });

  it("tracks lot on block from saleroom events", () => {
    let state = applySaleroomEvent(
      { status: "none", currentLotId: null },
      { kind: "opened", saleId: "s1", emittedAt: new Date().toISOString() },
    );
    state = applySaleroomEvent(state, {
      kind: "advanced_to_lot",
      saleId: "s1",
      lotId: "lot-9",
      emittedAt: new Date().toISOString(),
    });
    expect(state.currentLotId).toBe("lot-9");
    state = applySaleroomEvent(state, {
      kind: "hammer",
      saleId: "s1",
      lotId: "lot-9",
      emittedAt: new Date().toISOString(),
    });
    expect(state.currentLotId).toBeNull();
  });

  it("tracks paused and resumed session states", () => {
    let state = applySaleroomEvent(
      { status: "live", currentLotId: "lot-1" },
      { kind: "paused", saleId: "s1", emittedAt: new Date().toISOString() },
    );
    expect(state.status).toBe("paused");
    state = applySaleroomEvent(state, {
      kind: "resumed",
      saleId: "s1",
      emittedAt: new Date().toISOString(),
    });
    expect(state.status).toBe("live");
  });
});
