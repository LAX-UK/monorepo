import { describe, expect, it } from "vitest";
import { accountAddressInputSchema, normalisePostcode } from "./account-addresses.js";

const valid = {
  label: "Home",
  recipientName: "Ann Buyer",
  line1: "1 High Street",
  city: "London",
  postcode: "sw1a1aa",
  country: "GB",
};

describe("normalisePostcode", () => {
  it.each([
    ["sw1a1aa", "GB", "SW1A 1AA"],
    ["EC1A  1BB", "GB", "EC1A 1BB"],
    ["m1 1ae", "GB", "M1 1AE"],
    ["90210", "US", "90210"],
    ["90210-1234", "US", "90210-1234"],
    ["75008", "FR", "75008"],
    ["D02 X285", "IE", "D02 X285"],
  ])("accepts %s for %s", (raw, country, expected) => {
    expect(normalisePostcode(raw, country)).toBe(expected);
  });

  it.each([
    ["SW1A", "GB"],
    ["1234", "US"],
    ["!!", "FR"],
    ["", "FR"],
  ])("rejects %s for %s", (raw, country) => {
    expect(normalisePostcode(raw, country)).toBeNull();
  });
});

describe("accountAddressInputSchema", () => {
  it("normalises the postcode and turns blank optional lines into null", () => {
    const parsed = accountAddressInputSchema.parse({ ...valid, line2: " ", region: "" });
    expect(parsed).toMatchObject({ postcode: "SW1A 1AA", line2: null, region: null, phone: null });
  });

  it("rejects a country that is not an ISO code", () => {
    expect(
      accountAddressInputSchema.safeParse({ ...valid, country: "United Kingdom" }).success,
    ).toBe(false);
    expect(accountAddressInputSchema.safeParse({ ...valid, country: "gb" }).success).toBe(false);
  });

  it("rejects a postcode that does not fit the country and a phone that is not E.164", () => {
    expect(accountAddressInputSchema.safeParse({ ...valid, postcode: "12345" }).success).toBe(
      false,
    );
    expect(accountAddressInputSchema.safeParse({ ...valid, phone: "07700900123" }).success).toBe(
      false,
    );
  });

  it("requires the recipient and the first line", () => {
    expect(accountAddressInputSchema.safeParse({ ...valid, recipientName: " " }).success).toBe(
      false,
    );
    expect(accountAddressInputSchema.safeParse({ ...valid, line1: "" }).success).toBe(false);
  });
});
