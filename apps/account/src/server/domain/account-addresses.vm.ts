import {
  ACCOUNT_ADDRESS_LIMIT,
  ADDRESS_COUNTRY_CODES,
  type AccountAddress,
  type AccountAddressError,
  type AccountAddressInput,
  normalisePostcode,
} from "@auction/identity-contracts/account";
import { normalisePhoneInput } from "./account-contact.vm";

export type AddressFormValues = {
  label: string;
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  phone: string;
};

export type AddressFieldErrors = Partial<Record<keyof AddressFormValues, string>>;

export const DEFAULT_ADDRESS_COUNTRY = "GB";

export function emptyAddressForm(recipientName = ""): AddressFormValues {
  return {
    label: "",
    recipientName,
    line1: "",
    line2: "",
    city: "",
    region: "",
    postcode: "",
    country: DEFAULT_ADDRESS_COUNTRY,
    phone: "",
  };
}

export function addressToFormValues(address: AccountAddress): AddressFormValues {
  return {
    label: address.label,
    recipientName: address.recipientName,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    region: address.region ?? "",
    postcode: address.postcode,
    country: address.country,
    phone: address.phone ?? "",
  };
}

const REQUIRED: [keyof AddressFormValues, string, number][] = [
  ["label", "Give this address a name, such as Home or Studio.", 80],
  ["recipientName", "Enter the name of the person receiving deliveries.", 200],
  ["line1", "Enter the first line of the address.", 200],
  ["city", "Enter the town or city.", 120],
];

/** Postcode wording follows the country, so a US address asks for a ZIP code. */
export function postcodeLabel(country: string): string {
  if (country === "GB") return "Postcode";
  if (country === "US") return "ZIP code";
  return "Postal code";
}

export function regionLabel(country: string): string {
  if (country === "GB") return "County (optional)";
  if (country === "US") return "State";
  return "Region (optional)";
}

/**
 * Checks what the person typed with the same rules the issuer applies, so mistakes are caught
 * before a round trip. The issuer still decides; this only avoids a pointless request.
 */
export function validateAddressForm(
  values: AddressFormValues,
): { ok: true; input: AccountAddressInput } | { ok: false; errors: AddressFieldErrors } {
  const errors: AddressFieldErrors = {};
  for (const [field, message, max] of REQUIRED) {
    const value = values[field].trim();
    if (!value) errors[field] = message;
    else if (value.length > max) errors[field] = `Use ${max} characters or fewer.`;
  }
  if (values.line2.trim().length > 200) errors.line2 = "Use 200 characters or fewer.";
  if (values.region.trim().length > 120) errors.region = "Use 120 characters or fewer.";
  if (!ADDRESS_COUNTRY_CODES.includes(values.country)) errors.country = "Choose a country.";
  const postcode = normalisePostcode(values.postcode, values.country);
  if (!postcode) {
    errors.postcode =
      values.country === "GB"
        ? "Enter a valid UK postcode, for example SW1A 1AA."
        : values.country === "US"
          ? "Enter a valid ZIP code, for example 90210."
          : "Enter a valid postal code.";
  }
  const phone = values.phone.trim() ? normalisePhoneInput(values.phone) : null;
  if (values.phone.trim() && !phone) {
    errors.phone = "Include the country code, for example +44 7700 900123.";
  }
  if (Object.keys(errors).length > 0 || !postcode) return { ok: false, errors };
  return {
    ok: true,
    input: {
      label: values.label.trim(),
      recipientName: values.recipientName.trim(),
      line1: values.line1.trim(),
      line2: values.line2.trim() || null,
      city: values.city.trim(),
      region: values.region.trim() || null,
      postcode,
      country: values.country,
      phone,
    },
  };
}

export type CountryOption = { value: string; label: string };

/** Countries by name in British English, with the United Kingdom first because most addresses are. */
export function countryOptions(): CountryOption[] {
  const names = new Intl.DisplayNames(["en-GB"], { type: "region" });
  const all = ADDRESS_COUNTRY_CODES.map((value) => ({ value, label: names.of(value) ?? value }));
  const rest = all
    .filter((option) => option.value !== DEFAULT_ADDRESS_COUNTRY)
    .sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
  const first = all.find((option) => option.value === DEFAULT_ADDRESS_COUNTRY);
  return first ? [first, ...rest] : rest;
}

export function countryName(code: string): string {
  return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code) ?? code;
}

/** The address as printed lines, skipping the ones left blank. */
export function addressLines(address: AccountAddress): string[] {
  return [
    address.recipientName,
    address.line1,
    address.line2,
    address.city,
    [address.region, address.postcode].filter(Boolean).join(" "),
    countryName(address.country),
  ].filter((line): line is string => Boolean(line));
}

export function addressDefaultBadges(address: AccountAddress): string[] {
  return [
    ...(address.isDefaultShipping ? ["Default shipping"] : []),
    ...(address.isDefaultBilling ? ["Default billing"] : []),
  ];
}

export function canAddAddress(count: number): boolean {
  return count < ACCOUNT_ADDRESS_LIMIT;
}

const REJECTION_MESSAGES: Record<AccountAddressError, string> = {
  invalid_address: "Check the address details and try again.",
  address_not_found: "That address no longer exists. Refresh the page to see your current list.",
  address_limit_reached: `You can save up to ${ACCOUNT_ADDRESS_LIMIT} addresses. Delete one to add another.`,
  version_conflict:
    "This address was changed somewhere else. Refresh the page to see the latest version, then try again.",
};

export function addressRejectionMessage(reason: AccountAddressError): string {
  return REJECTION_MESSAGES[reason];
}

export function isAddressRejection(reason: string): reason is AccountAddressError {
  return reason in REJECTION_MESSAGES;
}
