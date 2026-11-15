import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import { ZohoFulfilmentMirror } from "./zoho-fulfilment-mirror.js";

const mirror = (deliver = vi.fn(), orders = vi.fn()) => ({
  deliver,
  orders,
  mirror: new ZohoFulfilmentMirror({ groups: { deliver }, orders: { deliver: orders } }),
});

describe("ZohoFulfilmentMirror", () => {
  it("hands a group event to the print group mirror", async () => {
    const m = mirror(vi.fn().mockResolvedValue({ outcome: "success", providerReference: "r" }));
    expect(
      await m.mirror.deliver({ eventType: "shop.editions.allocated", aggregateId: "art-1" }),
    ).toEqual({ outcome: "success", providerReference: "r" });
    expect(m.deliver).toHaveBeenCalledWith("art-1");
    expect(m.orders).not.toHaveBeenCalled();
  });

  it("hands an order event to the order mirror, with the order named in the payload", async () => {
    const m = mirror(
      vi.fn(),
      vi.fn().mockResolvedValue({ outcome: "success", providerReference: "Order:LAX-S-1" }),
    );
    expect(
      await m.mirror.deliver({
        eventType: "shop.fulfilment.dispatched",
        aggregateId: "ful-1",
        payload: { orderId: "o1" },
      }),
    ).toEqual({ outcome: "success", providerReference: "Order:LAX-S-1" });
    // A dispatch step does not change the prints, so a bad line is not failed again.
    expect(m.orders).toHaveBeenCalledWith("o1", { reportProblems: false });
    expect(m.deliver).not.toHaveBeenCalled();

    await m.mirror.deliver({ eventType: "shop.order.paid", payload: { orderId: "o2" } });
    expect(m.orders).toHaveBeenLastCalledWith("o2", { reportProblems: true });
  });

  it("skips events it does not handle", async () => {
    expect(await mirror().mirror.deliver({ eventType: "lot.created", aggregateId: "x" })).toEqual({
      outcome: "skipped",
      reason: "event_type_not_handled",
    });
  });

  it("retries a failure that may pass and fails one that cannot", async () => {
    const transient = new CrmGatewayError({
      code: "TIMEOUT",
      message: "t",
      status: 503,
      retryable: true,
    });
    const wrong = new CrmGatewayError({
      code: "INVALID_DATA",
      message: "w",
      status: 400,
      retryable: false,
    });
    const event = { eventType: "shop.artwork.updated", aggregateId: "a" };
    expect(await mirror(vi.fn().mockRejectedValue(transient)).mirror.deliver(event)).toMatchObject({
      outcome: "retry",
    });
    expect(await mirror(vi.fn().mockRejectedValue(wrong)).mirror.deliver(event)).toMatchObject({
      outcome: "fatal",
    });
    const order = { eventType: "shop.order.paid", payload: { orderId: "o1" } };
    expect(
      await mirror(vi.fn(), vi.fn().mockRejectedValue(transient)).mirror.deliver(order),
    ).toMatchObject({ outcome: "retry" });
  });
});
