import { describe, expect, it } from "vitest";
import { presentDeliveryEstimate, presentDeliveryLine } from "./delivery-estimate.presenter";

// A Wednesday in London.
const NOW = new Date("2026-10-28T12:00:00.000Z");

describe("delivery estimate", () => {
  it("dates delivery and collection in working days, priced as checkout charges them", () => {
    expect(
      presentDeliveryEstimate({
        now: NOW,
        times: { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } },
      }),
    ).toEqual({
      delivery: "Arrives Mon 2 Nov – Wed 4 Nov with insured UK delivery, £15",
      collection:
        "Free collection from 156 New Cavendish St, London W1W 6YW, ready from Fri 30 Oct",
    });
  });

  it("skips the weekend", () => {
    const friday = new Date("2026-10-30T12:00:00.000Z");
    expect(
      presentDeliveryEstimate({
        now: friday,
        times: { ukDelivery: { min: 1, max: 1 }, collection: null },
      }),
    ).toEqual({ delivery: "Arrives Mon 2 Nov with insured UK delivery, £15", collection: null });
  });

  it("gives no date when no delivery time is configured", () => {
    expect(
      presentDeliveryEstimate({
        now: NOW,
        times: { ukDelivery: null, collection: { min: 2, max: 2 } },
      }),
    ).toBeNull();
  });
});

describe("delivery line", () => {
  it("reads as one line with delivery and collection dated", () => {
    expect(
      presentDeliveryLine({
        now: NOW,
        times: { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } },
      }),
    ).toBe("Insured UK delivery £15, arrives 2 to 4 Nov · Free collection, ready Fri 30 Oct");
  });

  it("names both months when the window crosses one", () => {
    expect(
      presentDeliveryLine({
        now: new Date("2026-10-28T12:00:00.000Z"),
        times: { ukDelivery: { min: 2, max: 4 }, collection: null },
      }),
    ).toBe("Insured UK delivery £15, arrives 30 Oct to 3 Nov · Free collection");
  });

  it("leaves out times that are not configured", () => {
    expect(presentDeliveryLine({ now: NOW, times: { ukDelivery: null, collection: null } })).toBe(
      "Insured UK delivery £15 · Free collection",
    );
  });
});
