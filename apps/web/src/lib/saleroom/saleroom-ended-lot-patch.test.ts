import { extractSaleroomEndedLotPatch } from "@/lib/saleroom/saleroom-ended-lot-patch";
import type { SaleroomRealtimePayload } from "@auction/types";
import { describe, expect, it } from "vitest";

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

describe("extractSaleroomEndedLotPatch", () => {
  it("returns sold patch for hammer with winner", () => {
    expect(
      extractSaleroomEndedLotPatch(
        event("hammer", {
          lotId: "lot-1",
          lotStatus: "ended",
          winnerId: "user-1",
          lotOutcome: "sold",
        }),
      ),
    ).toEqual({
      status: "ended",
      winnerId: "user-1",
      hasWinner: true,
    });
  });

  it("returns unsold patch for no_sale", () => {
    expect(
      extractSaleroomEndedLotPatch(
        event("no_sale", {
          lotId: "lot-2",
          lotStatus: "ended",
          winnerId: null,
          lotOutcome: "no_sale",
        }),
      ),
    ).toEqual({
      status: "ended",
      winnerId: null,
      hasWinner: false,
    });
  });

  it("returns voided patch without hasWinner", () => {
    expect(
      extractSaleroomEndedLotPatch(
        event("hammer", { lotId: "lot-3", lotStatus: "voided", winnerId: null }),
      ),
    ).toEqual({
      status: "voided",
      winnerId: null,
      hasWinner: false,
    });
  });

  it("returns null for non-terminal events", () => {
    expect(extractSaleroomEndedLotPatch(event("advanced_to_lot", { lotId: "lot-1" }))).toBeNull();
  });
});
