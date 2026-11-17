import { applySaleroomEvent, isOutcomeForCurrentLot } from "@/lib/saleroom/apply-saleroom-event";
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

  describe("outcome for a lot that is no longer on the block", () => {
    const onB: PublicSaleroomSessionStatus = {
      status: "live",
      currentLotId: "lot-b",
      nextLotId: "lot-c",
    };

    for (const kind of ["hammer", "no_sale"] as const) {
      it(`keeps lot-b when ${kind} for lot-a arrives after the advance`, () => {
        expect(
          applySaleroomEvent(onB, event(kind, { lotId: "lot-a", nextLotId: "lot-c" })),
        ).toEqual({ status: "live", currentLotId: "lot-b", nextLotId: "lot-c" });
      });

      it(`keeps lot-b when ${kind} for lot-a says clearedFromBlock: false`, () => {
        expect(
          applySaleroomEvent(
            onB,
            event(kind, { lotId: "lot-a", clearedFromBlock: false, nextLotId: "lot-c" }),
          ),
        ).toEqual({ status: "live", currentLotId: "lot-b", nextLotId: "lot-c" });
      });

      it(`clears lot-b when ${kind} resolves lot-b itself`, () => {
        expect(
          applySaleroomEvent(
            onB,
            event(kind, { lotId: "lot-b", clearedFromBlock: true, nextLotId: "lot-c" }),
          ),
        ).toEqual({ status: "live", currentLotId: null, nextLotId: "lot-c" });
      });
    }

    it("keeps the current lot when the server says it was not cleared, even for the same id", () => {
      expect(
        applySaleroomEvent(onB, event("hammer", { lotId: "lot-b", clearedFromBlock: false })),
      ).toMatchObject({ currentLotId: "lot-b" });
    });

    it("treats a legacy outcome with no lotId as resolving the current lot", () => {
      expect(isOutcomeForCurrentLot("lot-b", event("hammer"))).toBe(true);
      expect(applySaleroomEvent(onB, event("no_sale"))).toMatchObject({ currentLotId: null });
    });

    it("is false for non-outcome events", () => {
      expect(isOutcomeForCurrentLot("lot-b", event("advanced_to_lot", { lotId: "lot-b" }))).toBe(
        false,
      );
    });
  });
});
