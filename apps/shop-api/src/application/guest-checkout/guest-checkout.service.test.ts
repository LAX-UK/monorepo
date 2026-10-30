import { describe, expect, it, vi } from "vitest";
import { createGuestCheckoutService } from "./guest-checkout.service.js";

const NOW = new Date("2026-10-30T12:00:00Z");

function setup(options: { hasAccount?: boolean | Error; allowed?: boolean } = {}) {
  const accounts = {
    hasAccount: vi.fn(async () => {
      if (options.hasAccount instanceof Error) throw options.hasAccount;
      return options.hasAccount ?? false;
    }),
  };
  const guests = { record: vi.fn(async () => ({ guestCustomerId: "g-1" })) };
  const checkout = {
    createCheckoutOrder: vi.fn(async () => ({
      orderId: "o-1",
      checkoutUrl: "https://pay.example/session",
      expiresAt: NOW,
    })),
  };
  const links = { issue: vi.fn(async () => ({ token: "t".repeat(43), expiresAt: NOW })) };
  const rateLimiter = {
    consume: vi.fn(async () =>
      options.allowed === false
        ? { allowed: false as const, retryAfterSeconds: 120 }
        : { allowed: true as const },
    ),
  };
  const sleep = vi.fn(async () => undefined);
  const service = createGuestCheckoutService({
    accounts,
    guests,
    checkout,
    links,
    rateLimiter,
    now: () => NOW,
    sleep,
    minimumCheckMs: 450,
  });
  return { service, accounts, guests, checkout, links, rateLimiter, sleep };
}

const order = {
  basketId: "b-1",
  fulfilment: "collect_new_cavendish" as const,
  idempotencyKey: "guest-checkout:b-1",
  successUrl: "https://shop.example/checkout/confirmation",
  cancelUrl: "https://shop.example/checkout/cancel",
  email: " Ada@Example.com ",
  name: " Ada Lovelace ",
  phone: "",
  marketingConsent: false,
  basketTokenHash: "hash",
  clientIp: "203.0.113.9",
};

describe("guest checkout email step", () => {
  it("lets a new email continue and records it as a lead", async () => {
    const { service, accounts, guests, rateLimiter } = setup();
    const result = await service.checkEmail({
      email: " Ada@Example.com ",
      marketingConsent: true,
      clientIp: "203.0.113.9",
    });
    expect(result).toEqual({ kind: "continue_as_guest" });
    expect(accounts.hasAccount).toHaveBeenCalledWith("ada@example.com");
    expect(rateLimiter.consume).toHaveBeenCalledWith({
      clientIp: "203.0.113.9",
      senderKey: "email:ada@example.com",
    });
    expect(guests.record).toHaveBeenCalledWith(
      { email: "ada@example.com", marketingConsent: true },
      NOW,
    );
  });

  it("asks someone with a LAX account to sign in and records nothing", async () => {
    const { service, guests } = setup({ hasAccount: true });
    const result = await service.checkEmail({
      email: "ada@example.com",
      marketingConsent: false,
      clientIp: null,
    });
    expect(result).toEqual({ kind: "sign_in_required" });
    expect(guests.record).not.toHaveBeenCalled();
  });

  it("pads every answer to the same minimum time", async () => {
    const known = setup({ hasAccount: true });
    const fresh = setup();
    await known.service.checkEmail({ email: "a@b.co", marketingConsent: false, clientIp: null });
    await fresh.service.checkEmail({ email: "a@b.co", marketingConsent: false, clientIp: null });
    expect(known.sleep).toHaveBeenCalledTimes(1);
    expect(fresh.sleep).toHaveBeenCalledTimes(1);
  });

  it("stops at the rate limit before asking Identity", async () => {
    const { service, accounts } = setup({ allowed: false });
    const result = await service.checkEmail({
      email: "ada@example.com",
      marketingConsent: false,
      clientIp: "203.0.113.9",
    });
    expect(result).toEqual({ kind: "rate_limited", retryAfterSeconds: 120 });
    expect(accounts.hasAccount).not.toHaveBeenCalled();
  });

  it("fails closed when Identity cannot answer", async () => {
    const { service, guests } = setup({ hasAccount: new Error("down") });
    const result = await service.checkEmail({
      email: "ada@example.com",
      marketingConsent: false,
      clientIp: null,
    });
    expect(result).toEqual({ kind: "unavailable" });
    expect(guests.record).not.toHaveBeenCalled();
  });

  it("rejects an email that cannot be real without counting it", async () => {
    const { service, rateLimiter } = setup();
    expect(
      await service.checkEmail({ email: "not-an-email", marketingConsent: false, clientIp: null }),
    ).toEqual({ kind: "invalid_email" });
    expect(rateLimiter.consume).not.toHaveBeenCalled();
  });
});

describe("guest checkout order", () => {
  it("checks the email again on the server and places the order for the guest", async () => {
    const { service, checkout, guests, links, accounts } = setup();
    const result = await service.placeOrder(order);
    expect(accounts.hasAccount).toHaveBeenCalledWith("ada@example.com");
    expect(guests.record).toHaveBeenCalledWith(
      { email: "ada@example.com", name: "Ada Lovelace", marketingConsent: false },
      NOW,
    );
    expect(checkout.createCheckoutOrder).toHaveBeenCalledWith({
      basketId: "b-1",
      fulfilment: "collect_new_cavendish",
      idempotencyKey: "guest-checkout:b-1",
      successUrl: order.successUrl,
      cancelUrl: order.cancelUrl,
      subject: "guest:g-1",
      guest: { guestCustomerId: "g-1", basketTokenHash: "hash" },
    });
    expect(links.issue).toHaveBeenCalledWith("o-1", NOW);
    expect(result.kind).toBe("created");
  });

  it("never creates an order for an email that has a LAX account", async () => {
    const { service, checkout } = setup({ hasAccount: true });
    expect(await service.placeOrder(order)).toEqual({ kind: "sign_in_required" });
    expect(checkout.createCheckoutOrder).not.toHaveBeenCalled();
  });
});
