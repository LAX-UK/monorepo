import type { SavedDeliveryAddress } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import type { DeliveryAddressBook } from "../ports/delivery-address-book.port.js";
import {
  createListSavedDeliveryAddressesHandler,
  createSaveDeliveryAddressHandler,
  deliveryPhoneToE164,
} from "./delivery-address-book.handler.js";

const saved = (overrides: Partial<SavedDeliveryAddress> = {}): SavedDeliveryAddress => ({
  id: "550e8400-e29b-41d4-a716-846655440002",
  label: "Home",
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  line2: null,
  city: "London",
  postcode: "SW1A 1AA",
  country: "GB",
  phone: null,
  isDefaultShipping: false,
  ...overrides,
});

function book(addresses: SavedDeliveryAddress[] = []) {
  return {
    list: vi.fn(async () => addresses),
    add: vi.fn(async () => undefined),
  } satisfies DeliveryAddressBook;
}

describe("createListSavedDeliveryAddressesHandler", () => {
  it("lists the default delivery address first", async () => {
    const list = createListSavedDeliveryAddressesHandler(
      book([saved({ id: "a", label: "Work" }), saved({ id: "b", isDefaultShipping: true })]),
    );
    const result = await list("subject-1", vi.fn());
    expect(result.available).toBe(true);
    expect(result.addresses.map((address) => address.id)).toEqual(["b", "a"]);
  });

  it("answers unavailable, and reports why, when the book cannot be read", async () => {
    const failing = book();
    failing.list.mockRejectedValueOnce(new Error("down"));
    const report = vi.fn();
    const result = await createListSavedDeliveryAddressesHandler(failing)("subject-1", report);
    expect(result).toEqual({ available: false, addresses: [] });
    expect(report).toHaveBeenCalledOnce();
  });

  it("answers unavailable without an address book", async () => {
    await expect(
      createListSavedDeliveryAddressesHandler(null)("subject-1", vi.fn()),
    ).resolves.toEqual({ available: false, addresses: [] });
  });
});

describe("createSaveDeliveryAddressHandler", () => {
  const input = {
    recipientName: "Ada Lovelace",
    line1: "1 High Street",
    line2: null,
    city: "London",
    postcode: "SW1A 1AA",
    country: "GB",
    phone: "07700 900123",
  };

  it("adds a new address under its first line, with the phone in E.164", async () => {
    const target = book();
    await expect(
      createSaveDeliveryAddressHandler(target)("subject-1", input, vi.fn()),
    ).resolves.toBe("saved");
    expect(target.add).toHaveBeenCalledWith("subject-1", {
      ...input,
      label: "1 High Street",
      phone: "+447700900123",
    });
  });

  it("skips an address the book already holds, ignoring case and spacing", async () => {
    const target = book([saved({ line1: "1  high street", postcode: "sw1a 1aa" })]);
    await expect(
      createSaveDeliveryAddressHandler(target)("subject-1", input, vi.fn()),
    ).resolves.toBe("already_saved");
    expect(target.add).not.toHaveBeenCalled();
  });

  it("reports a failure instead of throwing", async () => {
    const target = book();
    target.add.mockRejectedValueOnce(new Error("limit"));
    const report = vi.fn();
    await expect(
      createSaveDeliveryAddressHandler(target)("subject-1", input, report),
    ).resolves.toBe("failed");
    expect(report).toHaveBeenCalledOnce();
  });
});

describe("deliveryPhoneToE164", () => {
  it.each([
    ["07700 900123", "+447700900123"],
    ["+44 (0)7700", null],
    ["+44 7700 900123", "+447700900123"],
    ["12345", null],
    [null, null],
  ])("%s becomes %s", (phone, expected) => {
    expect(deliveryPhoneToE164(phone)).toBe(expected);
  });
});
