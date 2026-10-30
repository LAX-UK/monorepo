import type {
  InvoiceAddressView,
  InvoiceDetailsView,
} from "@/lib/data/http/organisation-team.types";
import { countryName } from "@/lib/ui/countries";
import type { InvoiceDetailsInput } from "./organisation-team.actions";

/** The invoice details as the Profile reads them, and the form they are edited in. */

export type InvoiceAddressForm = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type InvoiceDetailsForm = {
  billingEmail: string;
  /** `false`: invoices use the registered address. */
  ownAddress: boolean;
  address: InvoiceAddressForm;
  poReference: string;
};

export type InvoiceDetailsField =
  | "billingEmail"
  | "line1"
  | "city"
  | "postalCode"
  | "country"
  | "poReference";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function invoiceDetailsForm(view: InvoiceDetailsView): InvoiceDetailsForm {
  const a = view.address;
  return {
    billingEmail: view.billingEmail ?? "",
    ownAddress: a !== null,
    address: {
      line1: a?.line1 ?? "",
      line2: a?.line2 ?? "",
      city: a?.city ?? "",
      region: a?.region ?? "",
      postalCode: a?.postalCode ?? "",
      country: a?.country ?? "GB",
    },
    poReference: view.poReference ?? "",
  };
}

/** Field errors in words; empty when the form can be saved. */
export function validateInvoiceDetails(
  form: InvoiceDetailsForm,
): Partial<Record<InvoiceDetailsField, string>> {
  const errors: Partial<Record<InvoiceDetailsField, string>> = {};
  const email = form.billingEmail.trim();
  if (email && !EMAIL.test(email))
    errors.billingEmail = "Enter an email address, like accounts@gallery.com.";
  if (form.ownAddress) {
    const a = form.address;
    if (!a.line1.trim()) errors.line1 = "Enter the first line of the address.";
    if (!a.city.trim()) errors.city = "Enter the town or city.";
    if (!a.postalCode.trim()) errors.postalCode = "Enter the postcode.";
    if (!/^[A-Za-z]{2}$/.test(a.country.trim())) errors.country = "Choose a country.";
  }
  if (form.poReference.trim().length > 60) errors.poReference = "Use 60 characters or fewer.";
  return errors;
}

/** The whole set for the API: an empty field means none. */
export function invoiceDetailsInput(form: InvoiceDetailsForm): InvoiceDetailsInput {
  return {
    billingEmail: form.billingEmail.trim(),
    address: form.ownAddress
      ? {
          line1: form.address.line1.trim(),
          line2: form.address.line2.trim(),
          city: form.address.city.trim(),
          region: form.address.region.trim(),
          postalCode: form.address.postalCode.trim(),
          country: form.address.country.trim().toUpperCase(),
        }
      : null,
    poReference: form.poReference.trim(),
  };
}

/** "14 Riverside Walk, London SE1 9PP, United Kingdom". */
export function invoiceAddressLine(address: InvoiceAddressView): string {
  return [
    address.line1,
    address.line2,
    [address.city, address.region].filter(Boolean).join(", "),
    address.postalCode,
    countryName(address.country),
  ]
    .filter((part) => part?.trim())
    .join(", ");
}
