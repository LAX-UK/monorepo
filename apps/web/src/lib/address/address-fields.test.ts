import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS, addressLine, validateAddress } from "./address-fields";

describe("validateAddress", () => {
  it("asks for the lines a courier needs", () => {
    expect(validateAddress(EMPTY_ADDRESS)).toEqual({
      line1: "Enter the first line of the address.",
      city: "Enter the town or city.",
      postalCode: "Enter the postcode.",
    });
  });

  it("accepts a full address and a country code only", () => {
    const full = {
      ...EMPTY_ADDRESS,
      line1: "14 Riverside Walk",
      city: "London",
      postalCode: "SE1 9PP",
    };
    expect(validateAddress(full)).toEqual({});
    expect(validateAddress({ ...full, country: "United Kingdom" }).country).toBe(
      "Choose a country.",
    );
  });
});

describe("addressLine", () => {
  it("joins the filled parts and names a country code", () => {
    expect(
      addressLine({
        line1: "14 Riverside Walk",
        line2: "",
        city: "London",
        region: null,
        postalCode: "SE1 9PP",
        country: "GB",
      }),
    ).toBe("14 Riverside Walk, London, SE1 9PP, United Kingdom");
  });

  it("keeps a country already written as a name", () => {
    expect(
      addressLine({
        line1: "1 Rue Vivienne",
        city: "Paris",
        postalCode: "75002",
        country: "France",
      }),
    ).toBe("1 Rue Vivienne, Paris, 75002, France");
  });
});
