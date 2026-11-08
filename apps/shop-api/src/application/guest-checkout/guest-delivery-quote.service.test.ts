import { describe, expect, it, vi } from "vitest";
import {
  GUEST_CHECKOUT_RATE_LIMITS,
  GUEST_QUOTE_REQUEST_RATE_LIMITS,
} from "../enquiry-rate-limit.js";
import { createGuestCheckoutService } from "./guest-checkout.service.js";

const NOW = new Date("2026-11-11T12:00:00Z");

function setup(options: { quoteAllowed?: boolean } = {}) {
  const accounts = { hasAccount: vi.fn(async () => false) };
  const guests = { record: vi.fn(async () => ({ guestCustomerId: "g-1" })) };
  const links = { issue: vi.fn(async () => ({ token: "t".repeat(43), expiresAt: NOW })) };
  const checkoutLimiter = { consume: vi.fn(async () => ({ allowed: true as const })) };
  const quoteLimiter = {
    consume: vi.fn(async () =>
      options.quoteAllowed === false
        ? { allowed: false as const, retryAfterSeconds: 600 }
        : { allowed: true as const },
    ),
  };
  const request = vi.fn(async () => ({
    kind: "quote_requested" as const,
    request: {
      orderId: "o-1",
      orderReference: "LAX-S-10482",
      holdUntil: NOW,
      country: "DE",
      regionId: "eu" as const,
    },
  }));
  const service = createGuestCheckoutService({
    accounts,
    guests,
    checkout: { createCheckoutOrder: vi.fn() },
    quotes: { request },
    links,
    rateLimiter: checkoutLimiter,
    quoteRateLimiter: quoteLimiter,
    hashClientIp: (ip) => `hash(${ip})`,
    now: () => NOW,
    sleep: async () => undefined,
    minimumCheckMs: 0,
  });
  return { service, request, checkoutLimiter, quoteLimiter, guests, links };
}

const input = {
  basketId: "00000000-0000-4000-8000-000000000001",
  idempotencyKey: "delivery-quote:basket-1",
  successUrl: "https://shop.test/checkout/confirmation",
  cancelUrl: "https://shop.test/checkout",
  deliveryAddress: {
    recipientName: "Anna Weber",
    line1: "Friedrichstrasse 12",
    city: "Berlin",
    postcode: "10117",
    country: "DE",
  },
  deliveryPhone: "+49 30 1234567",
  email: "anna@example.com",
  name: "Anna Weber",
  marketingConsent: false,
  basketTokenHash: "token-hash",
  clientIp: "203.0.113.9",
};

describe("a guest's delivery quote request", () => {
  it("is admitted by its own, lower allowance, not checkout's", async () => {
    const { service, quoteLimiter, checkoutLimiter } = setup();
    await service.requestDeliveryQuote(input);
    expect(quoteLimiter.consume).toHaveBeenCalledWith({
      clientIp: "203.0.113.9",
      senderKey: "email:anna@example.com",
    });
    expect(checkoutLimiter.consume).not.toHaveBeenCalled();
    expect(GUEST_QUOTE_REQUEST_RATE_LIMITS.perClientIp.max).toBeLessThan(
      GUEST_CHECKOUT_RATE_LIMITS.perClientIp.max,
    );
    expect(GUEST_QUOTE_REQUEST_RATE_LIMITS.perSender.max).toBeLessThan(
      GUEST_CHECKOUT_RATE_LIMITS.perSender.max,
    );
  });

  it("refuses a guest over the allowance and holds nothing", async () => {
    const { service, request, guests } = setup({ quoteAllowed: false });
    const result = await service.requestDeliveryQuote(input);
    expect(result).toEqual({ kind: "rate_limited", retryAfterSeconds: 600 });
    expect(request).not.toHaveBeenCalled();
    expect(guests.record).not.toHaveBeenCalled();
  });

  it("passes the browser and a keyed hash of the network, never the address itself", async () => {
    const { service, request } = setup();
    await service.requestDeliveryQuote(input);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        guest: { guestCustomerId: "g-1", basketTokenHash: "token-hash" },
        guestIpHash: "hash(203.0.113.9)",
      }),
    );
    expect(JSON.stringify(request.mock.calls)).not.toContain('"clientIp"');
  });

  it("gives the guest their order link once a request is held", async () => {
    const { service, links } = setup();
    const result = await service.requestDeliveryQuote(input);
    expect(result).toMatchObject({ kind: "answered", access: { token: "t".repeat(43) } });
    expect(links.issue).toHaveBeenCalledWith("o-1", NOW);
  });

  it("is unavailable where quote requests are not wired", async () => {
    const service = createGuestCheckoutService({
      accounts: { hasAccount: vi.fn(async () => false) },
      guests: { record: vi.fn() },
      checkout: { createCheckoutOrder: vi.fn() },
      links: { issue: vi.fn() },
      rateLimiter: { consume: vi.fn(async () => ({ allowed: true as const })) },
    });
    expect(await service.requestDeliveryQuote(input)).toEqual({ kind: "unavailable" });
  });
});
