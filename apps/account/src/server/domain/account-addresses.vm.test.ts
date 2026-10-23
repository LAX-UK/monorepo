import type { AccountAddress } from "@auction/identity-contracts/account";
import { describe, expect, it } from "vitest";
import {
  addressDefaultBadges,
  addressLines,
  addressRejectionMessage,
  addressToFormValues,
  canAddAddress,
  countryOptions,
  emptyAddressForm,
  isAddressRejection,
  postcodeLabel,
  validateAddressForm,
} from "./account-addresses.vm";

const address: AccountAddress = {
  id: "33333333-3333-4333-8333-333333333333",
  label: "Home",
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  line2: null,
  city: "London",
  region: "Greater London",
  postcode: "SW1A 1AA",
  country: "GB",
  phone: null,
  isDefaultShipping: true,
  isDefaultBilling: false,
  version: 1,
  createdAt: "2026-10-23T12:00:00.000Z",
  updatedAt: "2026-10-23T12:00:00.000Z",
};

const filled = {
  ...emptyAddressForm("Ada Lovelace"),
  label: "Home",
  line1: "1 High Street",
  city: "London",
  postcode: "sw1a1aa",
};

describe("validateAddressForm", () => {
  it("accepts a complete address and returns the normalised input", () => {
    expect(validateAddressForm(filled)).toEqual({
      ok: true,
      input: {
        label: "Home",
        recipientName: "Ada Lovelace",
        line1: "1 High Street",
        line2: null,
        city: "London",
        region: null,
        postcode: "SW1A 1AA",
        country: "GB",
        phone: null,
      },
    });
  });

  it("explains each missing required field in plain language", () => {
    const result = validateAddressForm(emptyAddressForm());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ["city", "label", "line1", "postcode", "recipientName"].sort(),
    );
    expect(result.errors.postcode).toBe("Enter a valid UK postcode, for example SW1A 1AA.");
  });

  it("checks the postcode against the chosen country", () => {
    const us = validateAddressForm({ ...filled, country: "US", postcode: "SW1A 1AA" });
    expect(us.ok).toBe(false);
    if (!us.ok) expect(us.errors.postcode).toBe("Enter a valid ZIP code, for example 90210.");
    expect(validateAddressForm({ ...filled, country: "US", postcode: "90210" }).ok).toBe(true);
  });

  it("normalises a phone number and refuses one without a country code", () => {
    const ok = validateAddressForm({ ...filled, phone: "+44 (0) 7700 900123" });
    expect(ok.ok && ok.input.phone).toBe("+447700900123");
    const bad = validateAddressForm({ ...filled, phone: "07700 900123" });
    expect(!bad.ok && bad.errors.phone).toMatch(/country code/);
  });
});

describe("presentation", () => {
  it("lists the address lines, skipping blanks, with the country name", () => {
    expect(addressLines(address)).toEqual([
      "Ada Lovelace",
      "1 High Street",
      "London",
      "Greater London SW1A 1AA",
      "United Kingdom",
    ]);
  });

  it("names the defaults and round-trips an address into form values", () => {
    expect(addressDefaultBadges(address)).toEqual(["Default shipping"]);
    expect(addressDefaultBadges({ ...address, isDefaultBilling: true })).toEqual([
      "Default shipping",
      "Default billing",
    ]);
    expect(addressToFormValues(address)).toMatchObject({ line2: "", region: "Greater London" });
  });

  it("puts the United Kingdom first and sorts the rest by name", () => {
    const options = countryOptions();
    expect(options[0]).toEqual({ value: "GB", label: "United Kingdom" });
    const labels = options.slice(1).map((option) => option.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en-GB")));
  });

  it("uses the local word for the postcode", () => {
    expect([postcodeLabel("GB"), postcodeLabel("US"), postcodeLabel("FR")]).toEqual([
      "Postcode",
      "ZIP code",
      "Postal code",
    ]);
  });

  it("stops offering to add at the limit and words each refusal", () => {
    expect(canAddAddress(19)).toBe(true);
    expect(canAddAddress(20)).toBe(false);
    expect(isAddressRejection("version_conflict")).toBe(true);
    expect(isAddressRejection("email_taken")).toBe(false);
    expect(addressRejectionMessage("address_limit_reached")).toMatch(/up to 20/);
  });
});
