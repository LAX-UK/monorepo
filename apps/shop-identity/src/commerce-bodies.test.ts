import { describe, expect, it } from "vitest";
import {
  artworkInterestBodySchema,
  createCheckoutBodySchema,
  generalEnquiryBodySchema,
} from "./commerce-bodies.js";

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

  it("passes on the recipient name and the save-address choice", () => {
    const result = schema.safeParse({
      basketId: "00000000-0000-4000-8000-000000000001",
      fulfilment: "uk_insured_delivery",
      idempotencyKey: "idem-key-12345678",
      successUrl: "http://localhost:3020/checkout/confirmation",
      cancelUrl: "http://localhost:3020/basket",
      deliveryAddress: {
        recipientName: "  Ada Lovelace ",
        line1: "1 High Street",
        city: "London",
        postcode: "sw1a1aa",
        country: "GB",
      },
      deliveryPhone: "07700 900123",
      saveAddress: true,
    });

    expect(result.success && result.data).toMatchObject({
      deliveryAddress: { recipientName: "Ada Lovelace", postcode: "SW1A 1AA" },
      saveAddress: true,
    });
  });
});

describe("enquiry body schemas", () => {
  const contact = { name: " Grace Hopper ", email: "grace@example.com" };

  it("trims contact fields and drops blank optional ones", () => {
    const parsed = artworkInterestBodySchema.parse({
      intent: "enquiry",
      message: "  Is it framed?  ",
      contactPhone: "",
      website: "",
      ...contact,
    });
    expect(parsed).toEqual({
      intent: "enquiry",
      message: "Is it framed?",
      name: "Grace Hopper",
      email: "grace@example.com",
    });
  });

  it("accepts an empty artwork body for availability alerts", () => {
    expect(artworkInterestBodySchema.safeParse({}).success).toBe(true);
  });

  it.each([
    ["an invalid email", { email: "not-an-email" }],
    ["an email over 254 characters", { email: `${"a".repeat(250)}@example.com` }],
    ["a name over 120 characters", { name: "n".repeat(121) }],
    ["a malformed phone number", { contactPhone: "abc" }],
    ["a message over 2000 characters", { message: "m".repeat(2001) }],
    ["an unknown field", { role: "admin" }],
  ])("rejects %s on an artwork enquiry", (_label, override) => {
    expect(artworkInterestBodySchema.safeParse({ intent: "enquiry", ...override }).success).toBe(
      false,
    );
  });

  it("requires a topic and a non-blank message on general enquiries", () => {
    expect(generalEnquiryBodySchema.safeParse({ message: "Hello" }).success).toBe(false);
    expect(generalEnquiryBodySchema.safeParse({ topic: "general", message: "   " }).success).toBe(
      false,
    );
    expect(
      generalEnquiryBodySchema.safeParse({ topic: "selling", message: "Hello", ...contact })
        .success,
    ).toBe(true);
  });

  it("keeps a filled honeypot so the API can drop the enquiry", () => {
    const parsed = generalEnquiryBodySchema.parse({
      topic: "general",
      message: "Hello",
      website: "https://spam.example",
    });
    expect(parsed.website).toBe("https://spam.example");
  });
});
