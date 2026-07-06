import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleroomRealtimePayload } from "@auction/types";
import { describe, expect, it } from "vitest";

const base: PublicSaleroomSessionStatus = {
  status: "none",
  currentLotId: null,
  nextLotId: null,
};

function event(
  kind: SaleroomRealtimePayload["kind"],
  extra: Partial<SaleroomRealtimePayload> = {},
): SaleroomRealtimePayload {
  return {
    kind,
    saleId: "sale-1",
    emittedAt: new Date().toISOString(),
    ...extra,
  };
}

describe("applySaleroomEvent", () => {
  it("applies nextLotId on opened", () => {
    expect(applySaleroomEvent(base, event("opened", { nextLotId: "lot-2" }))).toEqual({
      status: "live",
      currentLotId: null,
      nextLotId: "lot-2",
    });
  });

  it("applies nextLotId on advanced_to_lot", () => {
    expect(
      applySaleroomEvent(
        { ...base, status: "live", nextLotId: "lot-2" },
        event("advanced_to_lot", { lotId: "lot-1", nextLotId: "lot-3" }),
      ),
    ).toEqual({
      status: "live",
      currentLotId: "lot-1",
      nextLotId: "lot-3",
    });
  });

  it("clears nextLotId on closed", () => {
    expect(
      applySaleroomEvent(
        { status: "live", currentLotId: "lot-1", nextLotId: "lot-2" },
        event("closed"),
      ),
    ).toEqual({
      status: "ended",
      currentLotId: null,
      nextLotId: null,
    });
  });

  it("updates nextLotId after hammer while clearing currentLotId", () => {
    expect(
      applySaleroomEvent(
        { status: "live", currentLotId: "lot-1", nextLotId: "lot-2" },
        event("hammer", { lotId: "lot-1", nextLotId: "lot-2" }),
      ),
    ).toEqual({
      status: "live",
      currentLotId: null,
      nextLotId: "lot-2",
    });
  });

  it("preserves previous nextLotId when event omits it", () => {
    expect(
      applySaleroomEvent(
        { status: "live", currentLotId: "lot-1", nextLotId: "lot-2" },
        event("paused"),
      ),
    ).toEqual({
      status: "paused",
      currentLotId: "lot-1",
      nextLotId: "lot-2",
    });
  });
});
