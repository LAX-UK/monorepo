import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import { ZohoFulfilmentMirror } from "./zoho-fulfilment-mirror.js";

const mirror = (deliver = vi.fn()) => ({
  deliver,
  mirror: new ZohoFulfilmentMirror({ groups: { deliver } }),
});

describe("ZohoFulfilmentMirror", () => {
  it("hands a group event to the print group mirror", async () => {
    const m = mirror(vi.fn().mockResolvedValue({ outcome: "success", providerReference: "r" }));
    expect(
      await m.mirror.deliver({ eventType: "shop.editions.allocated", aggregateId: "art-1" }),
    ).toEqual({ outcome: "success", providerReference: "r" });
    expect(m.deliver).toHaveBeenCalledWith("art-1");
  });

  it("answers that the order mirror is not built, and calls nothing", async () => {
    const m = mirror();
    expect(await m.mirror.deliver({ eventType: "shop.order.paid", aggregateId: "o1" })).toEqual({
      outcome: "skipped",
      reason: "order_mirror_not_built",
    });
    expect(m.deliver).not.toHaveBeenCalled();
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
  });
});
