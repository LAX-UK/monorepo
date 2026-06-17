import {
  applyDisplayControlEvent,
  parseSessionDisplayOverlay,
  reconcileDisplayOverlay,
  toClerkDisplayOverlay,
} from "@/features/saleroom/lib/display-overlay-state";
import { describe, expect, it } from "vitest";

describe("display-overlay-state", () => {
  it("applies fair warning control events", () => {
    const next = applyDisplayControlEvent(null, {
      kind: "fair_warning",
      emittedAt: "2026-06-17T10:00:00.000Z",
    });
    expect(next?.kind).toBe("fair_warning");
  });

  it("clears overlay on clear control events", () => {
    const next = applyDisplayControlEvent(
      { kind: "fair_warning", emittedAt: "2026-06-17T10:00:00.000Z" },
      { kind: "clear", emittedAt: "2026-06-17T10:01:00.000Z" },
    );
    expect(next).toBeNull();
  });

  it("ignores bid_summary control events for overlay state", () => {
    const prev = { kind: "fair_warning" as const, emittedAt: "2026-06-17T10:00:00.000Z" };
    const next = applyDisplayControlEvent(prev, {
      kind: "bid_summary",
      lotId: "lot-1",
      currentPrice: "150.00",
      bidCount: 2,
      leaderPaddleNumber: 205,
      emittedAt: "2026-06-17T10:01:00.000Z",
    });
    expect(next).toEqual(prev);
  });

  it("prefers newer overlay by emittedAt when reconciling", () => {
    const live = {
      kind: "announcement" as const,
      message: "Live",
      emittedAt: "2026-06-17T11:00:00.000Z",
    };
    const server = { kind: "fair_warning" as const, emittedAt: "2026-06-17T10:00:00.000Z" };
    expect(reconcileDisplayOverlay(live, server)).toEqual(live);
  });

  it("parses session overlay payloads", () => {
    expect(
      parseSessionDisplayOverlay({
        kind: "announcement",
        message: "Last chance",
        emittedAt: "2026-06-17T10:00:00.000Z",
      }),
    ).toEqual({
      kind: "announcement",
      message: "Last chance",
      emittedAt: "2026-06-17T10:00:00.000Z",
    });
  });

  it("maps overlay to clerk display shape", () => {
    expect(
      toClerkDisplayOverlay({
        kind: "fair_warning",
        emittedAt: "2026-06-17T10:00:00.000Z",
      }),
    ).toEqual({ kind: "fair_warning" });
  });
});
