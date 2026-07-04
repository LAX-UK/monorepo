import type { LotFulfilmentAddressSnapshot } from "@auction/persistence/interfaces";
import type { IAddressRepository } from "@auction/persistence/interfaces";
import { LotError } from "../../lib/errors.js";

export function toFulfilmentAddressSnapshot(row: {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  addressType: "shipping" | "billing" | "both";
}): LotFulfilmentAddressSnapshot {
  return {
    addressId: row.id,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    addressType: row.addressType,
  };
}

/** Validates buyer-owned shipping/both address for checkout fulfilment snapshot. */
export async function resolveCheckoutAddressSnapshot(
  addresses: IAddressRepository,
  buyerId: string,
  addressId: string,
): Promise<LotFulfilmentAddressSnapshot> {
  const row = await addresses.findByIdForUser(buyerId, addressId);
  if (!row) {
    throw new LotError("Address not found", 404, "address_not_found");
  }
  if (row.addressType === "billing") {
    throw new LotError(
      "Choose a shipping or billing & shipping address for checkout",
      400,
      "address_not_eligible",
    );
  }
  return toFulfilmentAddressSnapshot(row);
}
