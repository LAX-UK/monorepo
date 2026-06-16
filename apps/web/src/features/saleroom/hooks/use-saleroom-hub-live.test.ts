import { createMockSaleroomSocketAdapter } from "@/features/saleroom/adapters/saleroom-socket.adapter";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { describe, expect, it } from "vitest";

describe("saleroom hub live event routing", () => {
  it("applySaleroomEvent clears current lot on hammer for one sale only", () => {
    const saleA = { status: "live" as const, currentLotId: "lot-a" };
    const saleB = { status: "live" as const, currentLotId: "lot-b" };

    const afterHammerA = applySaleroomEvent(saleA, {
      kind: "hammer",
      saleId: "sale-a",
      lotId: "lot-a",
      emittedAt: new Date().toISOString(),
    });
    expect(afterHammerA.currentLotId).toBeNull();
    expect(saleB.currentLotId).toBe("lot-b");
  });

  it("routes socket events by saleId", () => {
    const adapter = createMockSaleroomSocketAdapter();
    let sale1: PublicSaleroomSessionStatus = { status: "live", currentLotId: "l1" };
    let sale2: PublicSaleroomSessionStatus = { status: "live", currentLotId: "l2" };

    const handler = (raw: unknown) => {
      const event = raw as {
        saleId: string;
        kind: string;
        lotId?: string;
        emittedAt: string;
      };
      if (event.saleId === "sale-1") {
        sale1 = applySaleroomEvent(sale1, event);
      } else if (event.saleId === "sale-2") {
        sale2 = applySaleroomEvent(sale2, event);
      }
    };

    adapter.onSaleroomEvent(handler);
    adapter.emit({
      kind: "advanced_to_lot",
      saleId: "sale-1",
      lotId: "l3",
      emittedAt: new Date().toISOString(),
    });

    expect(sale1.currentLotId).toBe("l3");
    expect(sale2.currentLotId).toBe("l2");
  });
});
