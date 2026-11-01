import { describe, expect, it } from "vitest";
import {
  organisationActivityQuerySchema,
  updateContactDetailsSchema,
  updateInvoiceDetailsSchema,
} from "./organisation-team.js";

describe("updateInvoiceDetailsSchema", () => {
  it("normalises the email, country and empty fields", () => {
    expect(
      updateInvoiceDetailsSchema.parse({
        billingEmail: " Accounts@Northbank.example ",
        address: {
          line1: "1 Cork Street",
          line2: "",
          city: "London",
          region: "",
          postalCode: "W1S 3LL",
          country: "gb",
        },
        poReference: " ",
      }),
    ).toEqual({
      billingEmail: "accounts@northbank.example",
      address: {
        line1: "1 Cork Street",
        line2: null,
        city: "London",
        region: null,
        postalCode: "W1S 3LL",
        country: "GB",
      },
      poReference: null,
    });
  });

  it("clears everything with empty values", () => {
    expect(
      updateInvoiceDetailsSchema.parse({ billingEmail: "", address: null, poReference: null }),
    ).toEqual({ billingEmail: null, address: null, poReference: null });
  });

  it("refuses a bad email, a partial address or a long PO reference", () => {
    const base = { billingEmail: null, address: null, poReference: null };
    expect(updateInvoiceDetailsSchema.safeParse({ ...base, billingEmail: "nope" }).success).toBe(
      false,
    );
    expect(
      updateInvoiceDetailsSchema.safeParse({ ...base, address: { line1: "1 Cork Street" } })
        .success,
    ).toBe(false);
    expect(
      updateInvoiceDetailsSchema.safeParse({ ...base, poReference: "x".repeat(61) }).success,
    ).toBe(false);
  });
});

describe("updateContactDetailsSchema", () => {
  const base = { email: null, phone: null, website: null };

  it("normalises the email and adds https to a bare web address", () => {
    expect(
      updateContactDetailsSchema.parse({
        email: " Hello@Northbank.Gallery ",
        phone: " +44 20 7946 0321 ",
        website: "northbank.gallery",
      }),
    ).toEqual({
      email: "hello@northbank.gallery",
      phone: "+44 20 7946 0321",
      website: "https://northbank.gallery",
    });
  });

  it("keeps a full web address with its path", () => {
    expect(
      updateContactDetailsSchema.parse({ ...base, website: "http://northbank.gallery/visit/" })
        .website,
    ).toBe("http://northbank.gallery/visit");
  });

  it("clears every field with empty values", () => {
    expect(updateContactDetailsSchema.parse({ email: "", phone: " ", website: "" })).toEqual(base);
  });

  it.each([
    ["email", "nope"],
    ["phone", "call us"],
    ["phone", "12345"],
    ["phone", "+44 1234 5678 9012 3456"],
    ["website", "javascript:alert(1)"],
    ["website", "localhost"],
    ["website", "https://user:pass@northbank.gallery"],
  ])("refuses %s %j", (field, value) => {
    expect(updateContactDetailsSchema.safeParse({ ...base, [field]: value }).success).toBe(false);
  });

  it("refuses unknown fields", () => {
    expect(updateContactDetailsSchema.safeParse({ ...base, fax: "1" }).success).toBe(false);
  });
});

describe("organisationActivityQuerySchema", () => {
  it("reads groups repeated or comma-separated, and defaults the page size", () => {
    expect(organisationActivityQuerySchema.parse({ group: "members,money" })).toEqual({
      group: ["members", "money"],
      limit: 50,
    });
    expect(organisationActivityQuerySchema.parse({ group: ["bidding"] }).group).toEqual([
      "bidding",
    ]);
  });

  it("refuses an unknown group and a range that ends before it starts", () => {
    expect(organisationActivityQuerySchema.safeParse({ group: "everything" }).success).toBe(false);
    expect(
      organisationActivityQuerySchema.safeParse({
        from: "2026-10-30T00:00:00Z",
        to: "2026-10-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });
});
