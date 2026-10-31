import { describe, expect, it } from "vitest";
import {
  invoiceAddressLine,
  invoiceDetailsForm,
  invoiceDetailsInput,
  validateInvoiceDetails,
} from "./invoice-details.vm";

const empty = {
  billingEmail: null,
  address: null,
  poReference: null,
  updatedAt: null,
  canEdit: true,
};

describe("invoice details", () => {
  it("starts from the saved details, with the registered address when none is set", () => {
    const form = invoiceDetailsForm(empty);
    expect(form.ownAddress).toBe(false);
    expect(form.address.country).toBe("GB");
    expect(invoiceDetailsInput(form)).toEqual({ billingEmail: "", address: null, poReference: "" });
  });

  it("asks for a whole address only when invoices use their own", () => {
    const form = { ...invoiceDetailsForm(empty), billingEmail: "accounts@", ownAddress: true };
    expect(validateInvoiceDetails(form)).toEqual({
      billingEmail: "Enter an email address, like accounts@gallery.com.",
      line1: "Enter the first line of the address.",
      city: "Enter the town or city.",
      postalCode: "Enter the postcode.",
    });
  });

  it("reads an address on one line with the country's name", () => {
    expect(
      invoiceAddressLine({
        line1: "14 Riverside Walk",
        line2: null,
        city: "London",
        region: null,
        postalCode: "SE1 9PP",
        country: "GB",
      }),
    ).toBe("14 Riverside Walk, London, SE1 9PP, United Kingdom");
  });
});
