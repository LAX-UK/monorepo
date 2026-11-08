import { DEFAULT_DELIVERY_REGIONS, type DeliveryRegion } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import { DeliveryQuoteRequestRejectedError } from "../../errors/delivery-quote-request-rejected-error.js";
import type { DeliveryRegionsState } from "../delivery-regions/delivery-regions.ports.js";
import type { CreatedQuoteOrder } from "./delivery-quote-request.ports.js";
import {
  type DeliveryQuoteRequestInput,
  createDeliveryQuoteRequestService,
} from "./delivery-quote-request.service.js";

const NOW = new Date("2026-11-11T12:00:00Z");

function state(overrides: Partial<DeliveryRegionsState> = {}): DeliveryRegionsState {
  return {
    regions: DEFAULT_DELIVERY_REGIONS.map((region) => ({ ...region })),
    restrictedCountries: ["BY", "IR", "KP", "RU", "SY"],
    ...overrides,
  };
}

const withRate = (id: string, fixedPricePence: number | null): DeliveryRegion[] =>
  DEFAULT_DELIVERY_REGIONS.map((region) =>
    region.id === id ? { ...region, fixedPricePence } : { ...region },
  );

const input = (overrides: Partial<DeliveryQuoteRequestInput> = {}): DeliveryQuoteRequestInput => ({
  subject: "subject-1",
  basketId: "00000000-0000-4000-8000-000000000001",
  idempotencyKey: "delivery-quote:basket-1",
  successUrl: "https://shop.test/checkout/confirmation",
  cancelUrl: "https://shop.test/checkout",
  deliveryAddress: {
    recipientName: "Anna Weber",
    line1: "Friedrichstrasse 12",
    city: "Berlin",
    postcode: "10117",
    country: "de",
  },
  deliveryPhone: "+49 30 1234567",
  fallbackEmail: null,
  ...overrides,
});

function build(
  regions: DeliveryRegionsState = state(),
  options: { exportPaymentEnabled?: boolean; guestHoldWorkingDays?: number } = {},
) {
  const created: CreatedQuoteOrder = {
    orderId: "order-1",
    orderReference: "LAX-S-10482",
    holdUntil: new Date("2026-11-16T12:00:00Z"),
    country: "DE",
    regionId: "eu",
  };
  const createQuoteOrder = vi.fn(async () => created);
  const createCheckoutOrder = vi.fn(async () => ({
    orderId: "order-2",
    checkoutUrl: "https://pay.test/session",
    expiresAt: new Date("2026-11-11T12:30:00Z"),
  }));
  const service = createDeliveryQuoteRequestService({
    regions: { read: async () => regions },
    orders: { createQuoteOrder },
    checkout: { createCheckoutOrder },
    exportPaymentEnabled: options.exportPaymentEnabled ?? true,
    guestHoldWorkingDays: options.guestHoldWorkingDays ?? 1,
    now: () => NOW,
  });
  return { service, createQuoteOrder, createCheckoutOrder, created };
}

describe("delivery quote request", () => {
  it("holds the print for three working days and asks for a quote in a quoted region", async () => {
    const { service, createQuoteOrder, createCheckoutOrder, created } = build();
    const outcome = await service.request(input());
    expect(outcome).toEqual({ kind: "quote_requested", request: created });
    expect(createCheckoutOrder).not.toHaveBeenCalled();
    expect(createQuoteOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "subject-1",
        country: "DE",
        regionId: "eu",
        // The saleroom's request step, not a status this service invents.
        status: "requested",
        // Wednesday 11 November: Thursday, Friday, Monday.
        holdUntil: new Date("2026-11-16T12:00:00Z"),
      }),
    );
  });

  it("quotes a country outside the four regions with no region", async () => {
    const { service, createQuoteOrder } = build();
    await service.request(
      input({ deliveryAddress: { ...input().deliveryAddress, country: "BR" } }),
    );
    expect(createQuoteOrder).toHaveBeenCalledWith(
      expect.objectContaining({ country: "BR", regionId: null }),
    );
  });

  it("carries the guest through to the order", async () => {
    const { service, createQuoteOrder } = build();
    const guest = { guestCustomerId: "guest-1", basketTokenHash: "hash" };
    await service.request(input({ subject: "guest:guest-1", guest, fallbackEmail: "a@b.test" }));
    expect(createQuoteOrder).toHaveBeenCalledWith(
      expect.objectContaining({ guest, fallbackEmail: "a@b.test" }),
    );
  });

  it("goes straight to payment, with the rate, when the region has a fixed price", async () => {
    const { service, createQuoteOrder, createCheckoutOrder } = build(
      state({ regions: withRate("eu", 3500) }),
    );
    const outcome = await service.request(input());
    expect(outcome).toMatchObject({ kind: "pay_now", session: { orderId: "order-2" } });
    expect(createQuoteOrder).not.toHaveBeenCalled();
    expect(createCheckoutOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfilment: "international_quotation",
        outsideUk: { country: "DE", regionId: "eu", pricePence: 3500 },
        deliveryAddress: expect.objectContaining({ country: "DE" }),
      }),
    );
  });

  it("asks for a quote instead of charging a fixed rate while export payment is off", async () => {
    const { service, createQuoteOrder, createCheckoutOrder } = build(
      state({ regions: withRate("eu", 3500) }),
      { exportPaymentEnabled: false },
    );
    const outcome = await service.request(input());
    expect(outcome.kind).toBe("quote_requested");
    // No payment is opened and no rate is read into an order.
    expect(createCheckoutOrder).not.toHaveBeenCalled();
    expect(createQuoteOrder).toHaveBeenCalledWith(
      expect.objectContaining({ country: "DE", regionId: "eu", status: "requested" }),
    );
  });

  it("keeps quote requests on while export payment is off: nothing is charged", async () => {
    const { service, createQuoteOrder } = build(state(), { exportPaymentEnabled: false });
    expect((await service.request(input())).kind).toBe("quote_requested");
    expect(createQuoteOrder).toHaveBeenCalledOnce();
  });

  it("holds a guest's print for the shorter guest hold, a buyer's for three days", async () => {
    const { service, createQuoteOrder } = build();
    await service.request(
      input({
        subject: "guest:guest-1",
        guest: { guestCustomerId: "guest-1", basketTokenHash: "token" },
        guestIpHash: "iphash",
      }),
    );
    // Wednesday 11 November at noon: one working day is Thursday.
    expect(createQuoteOrder).toHaveBeenLastCalledWith(
      expect.objectContaining({
        holdUntil: new Date("2026-11-12T12:00:00Z"),
        guestIpHash: "iphash",
      }),
    );
    await service.request(input());
    expect(createQuoteOrder).toHaveBeenLastCalledWith(
      expect.objectContaining({ holdUntil: new Date("2026-11-16T12:00:00Z"), guestIpHash: null }),
    );
  });

  it("refuses an export-restricted country and creates nothing", async () => {
    const { service, createQuoteOrder, createCheckoutOrder } = build();
    const outcome = await service.request(
      input({ deliveryAddress: { ...input().deliveryAddress, country: "RU" } }),
    );
    expect(outcome).toEqual({ kind: "not_delivered", country: "RU" });
    expect(createQuoteOrder).not.toHaveBeenCalled();
    expect(createCheckoutOrder).not.toHaveBeenCalled();
  });

  it("follows the list staff keep: a country staff take off it is quoted", async () => {
    const { service, createQuoteOrder } = build(state({ restrictedCountries: [] }));
    await service.request(
      input({ deliveryAddress: { ...input().deliveryAddress, country: "RU" } }),
    );
    expect(createQuoteOrder).toHaveBeenCalledWith(expect.objectContaining({ country: "RU" }));
  });

  it("names each field of an address that needs another look, creating nothing", async () => {
    const { service, createQuoteOrder } = build();
    await expect(
      service.request(
        input({
          deliveryPhone: "",
          deliveryAddress: { ...input().deliveryAddress, city: " ", country: "GB" },
        }),
      ),
    ).rejects.toMatchObject({
      name: "DeliveryQuoteRequestRejectedError",
      issues: [
        { field: "city", reason: "required" },
        { field: "country", reason: "united_kingdom" },
        { field: "phone", reason: "required" },
      ],
    });
    expect(createQuoteOrder).not.toHaveBeenCalled();
    expect(DeliveryQuoteRequestRejectedError.name).toBe("DeliveryQuoteRequestRejectedError");
  });
});
