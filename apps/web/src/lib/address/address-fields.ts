import { countryName } from "@/lib/ui/countries";

/** One postal address as it is typed: every field a string, the country an ISO 3166-1 code. */
export type AddressValues = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type AddressField = "line1" | "city" | "postalCode" | "country";

export type AddressFieldErrors = Partial<Record<AddressField, string>>;

export const EMPTY_ADDRESS: AddressValues = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "GB",
};

/** Field errors in words; empty when the address can be saved. */
export function validateAddress(address: AddressValues): AddressFieldErrors {
  const errors: AddressFieldErrors = {};
  if (!address.line1.trim()) errors.line1 = "Enter the first line of the address.";
  if (!address.city.trim()) errors.city = "Enter the town or city.";
  if (!address.postalCode.trim()) errors.postalCode = "Enter the postcode.";
  if (!/^[A-Za-z]{2}$/.test(address.country.trim())) errors.country = "Choose a country.";
  return errors;
}

/** The address on one line: "14 Riverside Walk, London SE1 9PP, United Kingdom". */
export function addressLine(address: {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
}): string {
  const country = address.country.trim();
  return [
    address.line1,
    address.line2,
    [address.city, address.region].filter((part) => part?.trim()).join(", "),
    address.postalCode,
    // A code is shown as the country's name; a name already is one.
    country.length === 2 ? countryName(country) : country,
  ]
    .filter((part) => part?.trim())
    .join(", ");
}
