import { describe, expect, it } from "vitest";
import {
  GALLERY_CONTACT,
  GALLERY_OPENING_HOURS,
  LEGAL_ENTITIES,
  openingHoursRows,
  openingHoursSentence,
} from "../src/index.js";

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

  it("publishes the gallery's opening hours", () => {
    expect(GALLERY_CONTACT.openingHours).toBe(
      "Monday to Friday, 10:00 to 19:00. Closed at weekends.",
    );
  });

  it("uses lax.art's contact address", () => {
    expect(GALLERY_CONTACT.email).toBe("info@thelax.art");
  });

  it("derives the sentence and the venue rows from the one structured source", () => {
    expect(GALLERY_OPENING_HOURS).toEqual({
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "10:00",
      closes: "19:00",
    });
    expect(openingHoursRows(GALLERY_OPENING_HOURS)).toEqual([
      { label: "Mon – Fri", hours: "10:00 – 19:00" },
      { label: "Sat – Sun", hours: "Closed" },
    ]);
    expect(GALLERY_CONTACT.openingHoursRows).toEqual(openingHoursRows(GALLERY_OPENING_HOURS));
  });
});

describe("openingHoursSentence", () => {
  it("names a single open day, and leaves out the weekend note when the weekend is open", () => {
    expect(openingHoursSentence({ dayOfWeek: ["Saturday"], opens: "11:00", closes: "16:00" })).toBe(
      "Saturday, 11:00 to 16:00.",
    );
    expect(
      openingHoursSentence({
        dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "10:00",
        closes: "18:00",
      }),
    ).toBe("Tuesday to Saturday, 10:00 to 18:00.");
  });
});
