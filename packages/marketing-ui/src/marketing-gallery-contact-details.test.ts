import { describe, expect, it } from "vitest";
import {
  type MarketingGalleryContact,
  marketingGalleryContactDetails,
} from "./marketing-gallery-contact-details.js";

const CONTACT: MarketingGalleryContact = {
  streetLine: "156 New Cavendish Street",
  city: "London",
  postcode: "W1W 6YW",
  phone: "+44 800 208 4800",
  phoneHref: "tel:+448002084800",
  email: "info@lax.art",
  openingHours: "Monday to Friday, 10:00 to 19:00. Closed at weekends.",
};

describe("marketingGalleryContactDetails", () => {
  it("lists the phone, email, address with a map link and hours, in that order", () => {
    expect(marketingGalleryContactDetails(CONTACT)).toEqual([
      { kind: "phone", text: "+44 800 208 4800", href: "tel:+448002084800" },
      { kind: "email", text: "info@lax.art", href: "mailto:info@lax.art" },
      {
        kind: "address",
        text: "156 New Cavendish Street, London W1W 6YW",
        href: "https://www.google.com/maps/search/?api=1&query=156%20New%20Cavendish%20Street%2C%20London%2C%20W1W%206YW",
      },
      { kind: "hours", text: "Monday to Friday, 10:00 to 19:00. Closed at weekends." },
    ]);
  });

  it.each([null, "", "   "])("leaves the hours out when none are published (%j)", (hours) => {
    const kinds = marketingGalleryContactDetails({ ...CONTACT, openingHours: hours }).map(
      (detail) => detail.kind,
    );
    expect(kinds).toEqual(["phone", "email", "address"]);
  });

  it("drops the map link when the address is blank", () => {
    const address = marketingGalleryContactDetails({
      ...CONTACT,
      streetLine: " ",
      city: "",
      postcode: "",
    }).find((detail) => detail.kind === "address");
    expect(address).not.toHaveProperty("href");
  });
});
