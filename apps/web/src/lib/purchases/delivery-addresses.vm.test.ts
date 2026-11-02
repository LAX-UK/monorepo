import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADDRESS_LABEL,
  deliveryAddresses,
  initialDeliveryAddressId,
  newDeliveryAddressBody,
} from "./delivery-addresses.vm";

const row = (over: Partial<ProfileAddressRow>): ProfileAddressRow => ({
  id: "a1",
  label: "Gallery store",
  line1: "14 Riverside Walk",
  line2: null,
  city: "London",
  state: null,
  postalCode: "SE1 9PP",
  country: "GB",
  addressType: "shipping",
  isDefault: false,
  ...over,
});

const INVOICE = {
  line1: "2 Mill Lane",
  line2: null,
  city: "Leeds",
  region: null,
  postalCode: "LS1 4AB",
  country: "GB",
};

describe("deliveryAddresses", () => {
  it("is empty when nothing is saved and the organisation has no invoice address", () => {
    expect(deliveryAddresses({ book: [], invoice: null })).toEqual([]);
    expect(initialDeliveryAddressId([])).toBeNull();
  });

  it("lists the default saved address first, then the invoice address", () => {
    const list = deliveryAddresses({
      book: [
        row({ id: "a1" }),
        row({ id: "a2", label: "Home", line1: "9 Elm Road", isDefault: true }),
      ],
      invoice: INVOICE,
    });
    expect(list.map((a) => a.id)).toEqual(["a2", "a1", "invoice"]);
    expect(list[2]).toEqual({
      id: "invoice",
      label: "Invoice address",
      detail: "2 Mill Lane, Leeds, LS1 4AB, United Kingdom",
    });
    expect(initialDeliveryAddressId(list)).toBe("a2");
  });

  it("leaves out billing-only addresses and lists an address that appears twice once", () => {
    const list = deliveryAddresses({
      book: [
        row({ id: "bill", addressType: "billing", line1: "1 Bill St" }),
        row({ id: "a1", line1: "2 Mill Lane", city: "Leeds", postalCode: "LS1 4AB" }),
      ],
      invoice: INVOICE,
    });
    expect(list.map((a) => a.id)).toEqual(["a1"]);
  });
});

describe("newDeliveryAddressBody", () => {
  it("trims, drops empty optional lines and saves it as a shipping address", () => {
    expect(
      newDeliveryAddressBody("  ", {
        line1: " 14 Riverside Walk ",
        line2: "",
        city: "London",
        region: "",
        postalCode: "SE1 9PP",
        country: "gb",
      }),
    ).toEqual({
      label: DEFAULT_ADDRESS_LABEL,
      line1: "14 Riverside Walk",
      city: "London",
      postalCode: "SE1 9PP",
      country: "GB",
      addressType: "shipping",
    });
  });
});
