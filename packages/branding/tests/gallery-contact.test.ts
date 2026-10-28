import { describe, expect, it } from "vitest";
import { GALLERY_CONTACT, LEGAL_ENTITIES } from "../src/index.js";

describe("GALLERY_CONTACT", () => {
  it("uses the registered address of London Art Exchange", () => {
    const { postal } = LEGAL_ENTITIES["london-art-exchange"].registeredAddress;
    expect(GALLERY_CONTACT.streetLine).toBe(postal.streetAddress);
    expect(GALLERY_CONTACT.postcode).toBe(postal.postalCode);
    expect(GALLERY_CONTACT.address).toBe("156 New Cavendish Street, London");
  });

  it("publishes a phone number whose link matches its text", () => {
    expect(GALLERY_CONTACT.phoneHref.replace("tel:", "")).toBe(
      GALLERY_CONTACT.phone.replaceAll(" ", ""),
    );
  });

  it("publishes no opening hours until the gallery supplies them", () => {
    expect(GALLERY_CONTACT.openingHours).toBeNull();
  });
});
