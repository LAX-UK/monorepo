/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fresh module per test: the loader keeps one script per page.
let loadStripeJs: typeof import("./stripe-js").loadStripeJs;
let STRIPE_JS_URL: string;

beforeEach(async () => {
  vi.resetModules();
  ({ loadStripeJs, STRIPE_JS_URL } = await import("./stripe-js"));
});

afterEach(() => {
  document.head.innerHTML = "";
  Reflect.deleteProperty(window, "Stripe");
});

describe("loadStripeJs", () => {
  it("adds Stripe's script once and resolves with Stripe", async () => {
    const first = loadStripeJs();
    const second = loadStripeJs();
    const scripts = document.head.querySelectorAll(`script[src="${STRIPE_JS_URL}"]`);
    expect(scripts).toHaveLength(1);
    const factory = (() => ({})) as unknown as NonNullable<Window["Stripe"]>;
    window.Stripe = factory;
    scripts[0]?.dispatchEvent(new Event("load"));
    expect(await first).toBe(factory);
    expect(await second).toBe(factory);
  });

  it("lets a failed load be retried", async () => {
    const first = loadStripeJs();
    document.head.querySelector("script")?.dispatchEvent(new Event("error"));
    await expect(first).rejects.toThrow();
    loadStripeJs().catch(() => undefined);
    expect(document.head.querySelectorAll("script")).toHaveLength(2);
  });

  it("loads from Stripe's versioned URL", () => {
    expect(STRIPE_JS_URL).toBe("https://js.stripe.com/basil/stripe.js");
  });
});
