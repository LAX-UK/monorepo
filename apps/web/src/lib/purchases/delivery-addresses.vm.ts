import { type AddressValues, addressLine } from "@/lib/address/address-fields";
import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import type {
  InvoiceAddressView,
  OrganisationAddressView,
} from "@/lib/data/http/organisation-team.types";

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

/**
 * Where the picker's addresses belong when the buyer acts for an organisation: whom a new
 * address is added to, whether this member may add one, and whether the organisation's own
 * addresses could be read.
 */
export type AddressContext = {
  organisationId: string;
  organisationName: string;
  canAdd: boolean;
  /** The organisation's addresses could not be read; the picker says so and still lets one be added. */
  loadFailed: boolean;
};

/** An address of the organisation, as the picker lists it. */
export function deliveryAddressFromOrganisation(row: OrganisationAddressView): DeliveryAddress {
  return {
    id: `organisation-${row.id}`,
    label: row.kind === "registered" ? "Registered address" : DEFAULT_ADDRESS_LABEL,
    detail: addressLine(row),
  };
}

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
 * The addresses to choose from: the organisation's own (registered, then delivery addresses)
 * when the buyer acts for one, the member's saved delivery addresses (the default first), then
 * the organisation's invoice address when it has its own. An address that appears twice is
 * listed once, under its first name.
 */
export function deliveryAddresses(input: {
  book: readonly ProfileAddressRow[];
  invoice: InvoiceAddressView | null;
  organisation?: readonly OrganisationAddressView[];
}): DeliveryAddress[] {
  const saved = input.book
    .filter((row) => row.addressType !== "billing")
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .map(fromBook);
  const invoice: DeliveryAddress[] = input.invoice
    ? [{ id: INVOICE_ID, label: "Invoice address", detail: addressLine(input.invoice) }]
    : [];
  const seen = new Set<string>();
  const owned = (input.organisation ?? []).map(deliveryAddressFromOrganisation);
  return [...owned, ...saved, ...invoice].filter((address) => {
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

/** The organisation's request for a new delivery address. */
export function newOrganisationAddressBody(address: AddressValues) {
  return {
    line1: address.line1.trim(),
    line2: address.line2.trim() || null,
    city: address.city.trim(),
    region: address.region.trim() || null,
    postalCode: address.postalCode.trim(),
    country: address.country.trim().toUpperCase(),
  };
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
