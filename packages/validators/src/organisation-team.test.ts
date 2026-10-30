import { describe, expect, it } from "vitest";
import {
  organisationActivityQuerySchema,
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
