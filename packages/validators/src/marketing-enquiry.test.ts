import { describe, expect, it } from "vitest";
import {
  adminEnquiryListQuerySchema,
  adminEnquiryPatchSchema,
  adminEnquiryRoutingSchema,
  enquiryIntakeSchema,
  enquiryRefParamSchema,
} from "./marketing-enquiry.js";

const person = { name: "Ada Lovelace", email: "  ADA@example.com ", phone: "+44 20 7946 0000" };

describe("enquiryIntakeSchema", () => {
  it("reads the original contact form payload as a general enquiry", () => {
    const parsed = enquiryIntakeSchema.parse({
      ...person,
      topic: "press",
      message: "A question about the next sale.",
      sourcePage: "/contact?intent=press",
    });
    expect(parsed).toMatchObject({
      intent: "general",
      email: "ada@example.com",
      topic: "press",
      marketingOptIn: false,
      contactPreference: "email",
    });
  });

  it("accepts a seller's enquiry with the work, place and an unsure price", () => {
    const parsed = enquiryIntakeSchema.parse({
      ...person,
      intent: "private_sale_sell",
      departmentSlug: "modern-british",
      artist: "David Hockney",
      title: "Pool study",
      locationTown: "Bath",
      locationCountry: "United Kingdom",
      marketingOptIn: true,
    });
    expect(parsed).toMatchObject({ intent: "private_sale_sell", marketingOptIn: true });
    expect(parsed).not.toHaveProperty("priceInMindMinor");
  });

  it("accepts a buyer's enquiry with a budget band and timing", () => {
    expect(
      enquiryIntakeSchema.safeParse({
        ...person,
        intent: "private_sale_buy",
        lookingFor: "Post-war British painting",
        budgetBand: "50000_to_250000",
        timing: "within_3_months",
      }).success,
    ).toBe(true);
  });

  it.each([
    [
      "a seller with no department",
      {
        intent: "private_sale_sell",
        artist: "A",
        title: "B",
        locationTown: "C",
        locationCountry: "D",
      },
    ],
    [
      "a department that is not a slug",
      {
        intent: "private_sale_sell",
        departmentSlug: "Modern British",
        artist: "A",
        title: "B",
        locationTown: "C",
        locationCountry: "D",
      },
    ],
    [
      "a buyer with an unknown budget band",
      { intent: "private_sale_buy", lookingFor: "A Riley", budgetBand: "lots", timing: "urgent" },
    ],
    ["an unknown path", { intent: "auction", message: "A message long enough" }],
    [
      "a price of zero",
      {
        intent: "private_sale_sell",
        departmentSlug: "prints",
        artist: "A",
        title: "B",
        locationTown: "C",
        locationCountry: "D",
        priceInMindMinor: 0,
      },
    ],
  ])("refuses %s", (_label, body) => {
    expect(enquiryIntakeSchema.safeParse({ ...person, ...body }).success).toBe(false);
  });
});

describe("staff enquiry schemas", () => {
  it("takes a reference or an id", () => {
    expect(enquiryRefParamSchema.safeParse({ ref: "E-1042" }).success).toBe(true);
    expect(
      enquiryRefParamSchema.safeParse({ ref: "00000000-0000-4000-8000-000000000004" }).success,
    ).toBe(true);
    expect(enquiryRefParamSchema.safeParse({ ref: "1042" }).success).toBe(false);
  });

  it("defaults the list to the open view and caps the page size", () => {
    expect(adminEnquiryListQuerySchema.parse({})).toMatchObject({ view: "open", limit: 25 });
    expect(adminEnquiryListQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(adminEnquiryListQuerySchema.safeParse({ view: "mine" }).success).toBe(false);
  });

  it("needs a version and at least one change", () => {
    expect(adminEnquiryPatchSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(adminEnquiryPatchSchema.safeParse({ note: "Called, left a message" }).success).toBe(
      false,
    );
    expect(adminEnquiryPatchSchema.safeParse({ version: 2, assignedToUserId: null }).success).toBe(
      true,
    );
  });

  it("allows each department and the fallback once", () => {
    const rule = (departmentSlug: string | null) => ({ departmentSlug, assignedToUserId: "u1" });
    expect(
      adminEnquiryRoutingSchema.safeParse({ rules: [rule("paintings"), rule(null)] }).success,
    ).toBe(true);
    expect(
      adminEnquiryRoutingSchema.safeParse({ rules: [rule("paintings"), rule("paintings")] })
        .success,
    ).toBe(false);
    expect(adminEnquiryRoutingSchema.safeParse({ rules: [rule(null), rule(null)] }).success).toBe(
      false,
    );
  });
});
