import { describe, expect, it } from "vitest";
import { createCheckoutBodySchema } from "./commerce-bodies.js";

describe("createCheckoutBodySchema", () => {
  const storefrontOrigin = "http://localhost:3020";
  const schema = createCheckoutBodySchema(storefrontOrigin);

  it("requires a delivery address for UK insured delivery", () => {
    const result = schema.safeParse({
      basketId: "00000000-0000-4000-8000-000000000001",
      fulfilment: "uk_insured_delivery",
      idempotencyKey: "idem-key-12345678",
      successUrl: "http://localhost:3020/checkout/confirmation",
      cancelUrl: "http://localhost:3020/basket",
    });

    expect(result.success).toBe(false);
  });

  it("rejects redirect URLs that leave the storefront origin", () => {
    const result = schema.safeParse({
      basketId: "00000000-0000-4000-8000-000000000001",
      fulfilment: "lax_storage",
      idempotencyKey: "idem-key-12345678",
      successUrl: "https://evil.example/done",
      cancelUrl: "http://localhost:3020/basket",
    });

    expect(result.success).toBe(false);
  });
});
