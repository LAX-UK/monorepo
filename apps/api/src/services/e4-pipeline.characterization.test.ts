import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import type { LifecycleAdminOp } from "../lib/legal-entity-lifecycle-transitions.js";
import { lifecycleDomainEventTypeForOp } from "./legal-entity-lifecycle-admin.service.js";
import { LIFECYCLE_DOMAIN_EVENT_TYPE_BY_OP } from "./legal-entity-lifecycle-domain-events.js";
import {
  EXISTING_PAYMENT_STATUS_HANDLERS,
  handleExistingPaymentForWinner,
} from "./payment/create-pending-for-winner.pipeline.js";
import { lotScheduleWindowForPublish } from "./sale/sale-publish.pipeline.js";

describe("createPendingForWinner pipeline registry", () => {
  it("registers terminal handlers for captured, refunded, and authorized statuses", () => {
    expect(EXISTING_PAYMENT_STATUS_HANDLERS.captured).toBeTypeOf("function");
    expect(EXISTING_PAYMENT_STATUS_HANDLERS.refunded).toBeTypeOf("function");
    expect(EXISTING_PAYMENT_STATUS_HANDLERS.authorized).toBeTypeOf("function");
    expect(EXISTING_PAYMENT_STATUS_HANDLERS.requires_manual_review).toBeTypeOf("function");
    expect(EXISTING_PAYMENT_STATUS_HANDLERS.pending).toBeUndefined();
  });

  it("returns null when no open payment exists", async () => {
    const result = await handleExistingPaymentForWinner(
      {
        payments: {
          findOpenByLotAndBuyer: async () => null,
        },
      } as never,
      { id: "lot-1" } as never,
      "buyer-1",
      {} as never,
    );
    expect(result).toBeNull();
  });
});

describe("lifecycleDomainEventTypeForOp registry", () => {
  it.each(Object.entries(LIFECYCLE_DOMAIN_EVENT_TYPE_BY_OP) as [LifecycleAdminOp, string][])(
    "maps op %s via registry to %s",
    (op, expected) => {
      expect(lifecycleDomainEventTypeForOp(op)).toBe(expected);
    },
  );
});

describe("sale publish pipeline helpers", () => {
  it("inherits lot schedule window from sale when caps require it", () => {
    const saleStart = new Date("2030-01-01T10:00:00Z");
    const saleEnd = new Date("2030-01-01T18:00:00Z");
    const lotStart = new Date("2030-02-01T10:00:00Z");
    const lotEnd = new Date("2030-02-01T18:00:00Z");
    const lot = { startTime: lotStart, endTime: lotEnd } as Lot;

    const inherited = lotScheduleWindowForPublish(
      {
        sale: { startTime: saleStart, endTime: saleEnd } as never,
        lots: [lot],
        caps: { inheritsLotTiming: true } as never,
      },
      lot,
    );
    expect(inherited.lotStart).toEqual(saleStart);
    expect(inherited.lotEnd).toEqual(saleEnd);

    const perLot = lotScheduleWindowForPublish(
      {
        sale: { startTime: saleStart, endTime: saleEnd } as never,
        lots: [lot],
        caps: { inheritsLotTiming: false } as never,
      },
      lot,
    );
    expect(perLot.lotStart).toEqual(lotStart);
    expect(perLot.lotEnd).toEqual(lotEnd);
  });
});
