import type { IAddressRepository } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { LotError } from "../../lib/errors.js";
import { resolveCheckoutAddressSnapshot } from "./checkout-address.js";

describe("resolveCheckoutAddressSnapshot", () => {
  it("rejects billing-only addresses", async () => {
    const addresses = {
      findByIdForUser: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-0000000000a1",
        userId: "u1",
        label: "Office",
        line1: "1 St",
        line2: null,
        city: "London",
        state: null,
        postalCode: "SW1",
        country: "GB",
        addressType: "billing",
        isDefault: true,
        createdAt: new Date(),
      }),
    } as unknown as IAddressRepository;

    await expect(
      resolveCheckoutAddressSnapshot(addresses, "u1", "00000000-0000-4000-8000-0000000000a1"),
    ).rejects.toBeInstanceOf(LotError);
  });

  it("returns snapshot for shipping-eligible address", async () => {
    const addresses = {
      findByIdForUser: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-0000000000a1",
        userId: "u1",
        label: "Home",
        line1: "1 St",
        line2: null,
        city: "London",
        state: null,
        postalCode: "SW1",
        country: "GB",
        addressType: "both",
        isDefault: true,
        createdAt: new Date(),
      }),
    } as unknown as IAddressRepository;

    const snap = await resolveCheckoutAddressSnapshot(
      addresses,
      "u1",
      "00000000-0000-4000-8000-0000000000a1",
    );
    expect(snap.addressId).toBe("00000000-0000-4000-8000-0000000000a1");
    expect(snap.label).toBe("Home");
  });
});
