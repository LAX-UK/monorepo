import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADDRESS_LABEL,
  deliveryAddresses,
  initialDeliveryAddressId,
  newDeliveryAddressBody,
  newOrganisationAddressBody,
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

describe("an organisation's addresses", () => {
  const REGISTERED = {
    id: "r1",
    kind: "registered" as const,
    line1: "1 Cork Street",
    line2: null,
    city: "London",
    region: null,
    postalCode: "W1S 3LL",
    country: "GB",
  };

  it("lists the registered and delivery addresses before the member's own", () => {
    const list = deliveryAddresses({
      book: [row({ id: "a1" })],
      invoice: null,
      organisation: [
        REGISTERED,
        { ...REGISTERED, id: "d1", kind: "delivery", line1: "7 Dock Road" },
      ],
    });
    expect(list.map((a) => [a.id, a.label])).toEqual([
      ["organisation-r1", "Registered address"],
      ["organisation-d1", DEFAULT_ADDRESS_LABEL],
      ["a1", "Gallery store"],
    ]);
  });

  it("lists the registered address once when the invoice address is the same", () => {
    const list = deliveryAddresses({
      book: [],
      invoice: { ...REGISTERED, region: null },
      organisation: [REGISTERED],
    });
    expect(list.map((a) => a.label)).toEqual(["Registered address"]);
  });

  it("asks the organisation to add an address without a name, trimmed, with a null for each blank", () => {
    expect(
      newOrganisationAddressBody({
        line1: " 7 Dock Road ",
        line2: " ",
        city: "Bristol",
        region: "",
        postalCode: "BS1 4XX",
        country: "gb",
      }),
    ).toEqual({
      line1: "7 Dock Road",
      line2: null,
      city: "Bristol",
      region: null,
      postalCode: "BS1 4XX",
      country: "GB",
    });
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
