import { type AddressValues, addressLine } from "@/lib/address/address-fields";
import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import type { InvoiceAddressView } from "@/lib/data/http/organisation-team.types";

/** One address a courier quote can be asked for, as the picker shows it. */
export type DeliveryAddress = {
  id: string;
  /** What the address is called: "Invoice address", "Gallery store". */
  label: string;
  /** The address on one line; this is also what the quote request carries. */
  detail: string;
};

/** The label a delivery address saved from the purchase page is given when none is typed. */
export const DEFAULT_ADDRESS_LABEL = "Delivery address";

const INVOICE_ID = "invoice";

function fromBook(row: ProfileAddressRow): DeliveryAddress {
  return {
    id: row.id,
    label: row.label || DEFAULT_ADDRESS_LABEL,
    detail: addressLine({ ...row, region: row.state }),
  };
}

/** A saved address of the address book, as the picker lists it. */
export function deliveryAddressFromBook(row: ProfileAddressRow): DeliveryAddress {
  return fromBook(row);
}

/**
 * The addresses to choose from: the member's saved delivery addresses (the default first), then
 * the organisation's invoice address when it has its own. An address that appears twice is
 * listed once, under its first name.
 */
export function deliveryAddresses(input: {
  book: readonly ProfileAddressRow[];
  invoice: InvoiceAddressView | null;
}): DeliveryAddress[] {
  const saved = input.book
    .filter((row) => row.addressType !== "billing")
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .map(fromBook);
  const invoice: DeliveryAddress[] = input.invoice
    ? [{ id: INVOICE_ID, label: "Invoice address", detail: addressLine(input.invoice) }]
    : [];
  const seen = new Set<string>();
  return [...saved, ...invoice].filter((address) => {
    const key = address.detail.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The address to have chosen when the picker opens: the first, which is the default if any. */
export function initialDeliveryAddressId(addresses: readonly DeliveryAddress[]): string | null {
  return addresses[0]?.id ?? null;
}

/** The address book's request for a new delivery address. */
export function newDeliveryAddressBody(label: string, address: AddressValues) {
  return {
    label: label.trim() || DEFAULT_ADDRESS_LABEL,
    line1: address.line1.trim(),
    ...(address.line2.trim() ? { line2: address.line2.trim() } : {}),
    city: address.city.trim(),
    ...(address.region.trim() ? { state: address.region.trim() } : {}),
    postalCode: address.postalCode.trim(),
    country: address.country.trim().toUpperCase(),
    addressType: "shipping" as const,
  };
}
