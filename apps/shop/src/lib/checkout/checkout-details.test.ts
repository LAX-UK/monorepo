import type { SavedDeliveryAddress } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  type CheckoutDetails,
  checkoutDeliveryPayload,
  initialCheckoutAddress,
  orderedCheckoutErrors,
  outsideUkDeliveryPayload,
  validateCheckoutDetails,
} from "./checkout-details";

const saved = (overrides: Partial<SavedDeliveryAddress>): SavedDeliveryAddress => ({
  id: "a",
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

const blank: CheckoutDetails = {
  choice: "uk_insured_delivery",
  contactName: "",
  address: "new",
  recipientName: "",
  line1: "",
  line2: "",
  city: "",
  postcode: "",
  country: "",
  phone: "",
  saveAddress: true,
};

describe("initialCheckoutAddress", () => {
  it("starts on the default UK address, never one outside the UK", () => {
    expect(
      initialCheckoutAddress([
        saved({ id: "fr", country: "FR", isDefaultShipping: true }),
        saved({ id: "uk" }),
      ]),
    ).toBe("uk");
    expect(initialCheckoutAddress([saved({ id: "fr", country: "FR" })])).toBe("new");
    expect(initialCheckoutAddress([])).toBe("new");
  });
});

describe("validateCheckoutDetails", () => {
  it("asks for every missing field, in page order, saying how to fix each", () => {
    const errors = validateCheckoutDetails(blank, []);
    expect(orderedCheckoutErrors(errors)).toEqual([
      {
        fieldId: "checkout-recipient-name",
        message: "Enter the full name of the person receiving the delivery",
      },
      { fieldId: "checkout-line1", message: "Enter the first line of the address" },
      { fieldId: "checkout-city", message: "Enter a town or city" },
      { fieldId: "checkout-postcode", message: "Enter a postcode" },
      { fieldId: "checkout-phone", message: "Enter a phone number for the courier" },
    ]);
  });

  it("explains a postcode or phone in the wrong form", () => {
    const errors = validateCheckoutDetails({ ...blank, postcode: "12345", phone: "12" }, []);
    expect(errors.postcode).toBe("Enter a UK postcode, like SW1A 1AA");
    expect(errors.phone).toBe("Enter a phone number, like 07700 900123");
  });

  it("needs only a phone with a saved UK address, and nothing for collection", () => {
    const book = [saved({ id: "a" })];
    expect(
      validateCheckoutDetails({ ...blank, address: "a", phone: "07700 900123" }, book),
    ).toEqual({});
    expect(validateCheckoutDetails({ ...blank, choice: "collect_new_cavendish" }, [])).toEqual({});
  });

  it("asks a guest for their name, whatever the delivery", () => {
    const collect = { ...blank, choice: "collect_new_cavendish" as const };
    expect(validateCheckoutDetails(collect, [], { requireContactName: true })).toEqual({
      contactName: "Enter your full name",
    });
    expect(
      validateCheckoutDetails({ ...collect, contactName: "Ada" }, [], { requireContactName: true }),
    ).toEqual({});
  });

  it("refuses a saved address outside the UK", () => {
    const book = [saved({ id: "fr", country: "FR" })];
    expect(
      validateCheckoutDetails({ ...blank, address: "fr", phone: "07700 900123" }, book)
        .savedAddress,
    ).toBe("Choose a UK delivery address, or use a new address");
  });
});

describe("checkoutDeliveryPayload", () => {
  it("sends a new address with the recipient, a tidy postcode and the save choice", () => {
    expect(
      checkoutDeliveryPayload(
        {
          ...blank,
          recipientName: " Ada Lovelace ",
          line1: "1 High Street",
          city: "London",
          postcode: "sw1a1aa",
          phone: "07700 900123",
        },
        [],
      ),
    ).toEqual({
      deliveryAddress: {
        recipientName: "Ada Lovelace",
        line1: "1 High Street",
        city: "London",
        postcode: "SW1A 1AA",
        country: "GB",
      },
      deliveryPhone: "07700 900123",
      saveAddress: true,
    });
  });

  it("sends a saved address as it is and never saves it again", () => {
    const payload = checkoutDeliveryPayload({ ...blank, address: "a", phone: "07700 900123" }, [
      saved({ id: "a", line2: "Flat 3" }),
    ]);
    expect(payload?.deliveryAddress).toMatchObject({
      recipientName: "Ada Lovelace",
      line2: "Flat 3",
    });
    expect(payload?.saveAddress).toBe(false);
  });

  it("sends no address for collection", () => {
    expect(checkoutDeliveryPayload({ ...blank, choice: "collect_new_cavendish" }, [])).toBeNull();
  });
});

describe("delivery outside the UK", () => {
  const abroad: CheckoutDetails = {
    ...blank,
    choice: "international_quotation",
    recipientName: "Anna Weber",
    line1: "Friedrichstrasse 12",
    city: "Berlin",
    postcode: "10117",
    country: "DE",
    phone: "+49 30 1234567",
  };

  it("accepts a complete address, with a postal code in any country's format", () => {
    expect(validateCheckoutDetails(abroad, [])).toEqual({});
    expect(validateCheckoutDetails({ ...abroad, postcode: "K1A 0B1" }, [])).toEqual({});
  });

  it("names each missing part, in page order", () => {
    const errors = validateCheckoutDetails({ ...blank, choice: "international_quotation" }, []);
    expect(Object.keys(errors)).toEqual([
      "recipientName",
      "line1",
      "city",
      "postcode",
      "country",
      "phone",
    ]);
    expect(orderedCheckoutErrors(errors).map((e) => e.fieldId)).toEqual([
      "checkout-recipient-name",
      "checkout-line1",
      "checkout-city",
      "checkout-postcode",
      "checkout-country",
      "checkout-phone",
    ]);
    expect(errors.postcode).toBe("Enter a postal code");
  });

  it("sends a UK country to UK delivery, and asks a guest for their name too", () => {
    expect(validateCheckoutDetails({ ...abroad, country: "GB" }, []).country).toMatch(
      /UK insured delivery/,
    );
    expect(validateCheckoutDetails(abroad, [], { requireContactName: true }).contactName).toBe(
      "Enter your full name",
    );
  });

  it("asks for a phone with a country code a courier could ring", () => {
    expect(validateCheckoutDetails({ ...abroad, phone: "call me" }, []).phone).toMatch(
      /country code/,
    );
  });

  it("builds the request address with the country upper-cased and blank lines left out", () => {
    expect(outsideUkDeliveryPayload({ ...abroad, country: "de", line2: "  " })).toEqual({
      deliveryAddress: {
        recipientName: "Anna Weber",
        line1: "Friedrichstrasse 12",
        city: "Berlin",
        postcode: "10117",
        country: "DE",
      },
      deliveryPhone: "+49 30 1234567",
    });
  });

  it("leaves the UK rules as they were: a UK delivery with no country still validates", () => {
    const uk = {
      ...blank,
      recipientName: "Ada",
      line1: "1 High St",
      city: "London",
      postcode: "SW1A 1AA",
      phone: "07700 900123",
    };
    expect(validateCheckoutDetails(uk, [])).toEqual({});
  });
});
