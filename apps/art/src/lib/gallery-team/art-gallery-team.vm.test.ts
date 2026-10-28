import { GALLERY_CONTACT } from "@auction/branding";
import { describe, expect, it } from "vitest";
import { type ArtGalleryContact, buildArtGalleryTeam } from "./art-gallery-team.vm";

const CONTACT: ArtGalleryContact = {
  streetLine: "156 New Cavendish Street",
  city: "London",
  postcode: "W1W 6YW",
  phone: "+44 20 8044 1334",
  phoneHref: "tel:+442080441334",
  email: "info@thelax.art",
  openingHours: null,
};

describe("buildArtGalleryTeam", () => {
  it("offers one enquiry action, with the context's topic and subject", () => {
    const team = buildArtGalleryTeam({
      context: "exhibition",
      contact: CONTACT,
      subject: { slug: "new-originals", label: "New originals" },
    });
    expect(team.enquiry).toEqual({
      label: "Begin a private enquiry",
      topic: "private_viewing",
      subject: { slug: "new-originals", label: "New originals" },
    });
    expect(team.eyebrow).toBe("The gallery team");
    expect(team.note).toBe("We reply within one working day.");
  });

  it.each([
    ["home", "general"],
    ["contact", "general"],
    ["visit", "private_viewing"],
    ["venue", "private_viewing"],
    ["pastExhibition", "exhibition"],
    ["advisory", "art_advisory"],
    ["howToBuy", "general"],
  ] as const)("opens the %s enquiry on the %s topic", (context, topic) => {
    expect(buildArtGalleryTeam({ context, contact: CONTACT }).enquiry.topic).toBe(topic);
  });

  it("lists the phone, email and address with a map link", () => {
    const { details } = buildArtGalleryTeam({ context: "contact", contact: CONTACT });
    expect(details).toEqual([
      { kind: "phone", text: "+44 20 8044 1334", href: "tel:+442080441334" },
      { kind: "email", text: "info@thelax.art", href: "mailto:info@thelax.art" },
      {
        kind: "address",
        text: "156 New Cavendish Street, London W1W 6YW",
        href: "https://www.google.com/maps/search/?api=1&query=156%20New%20Cavendish%20Street%2C%20London%2C%20W1W%206YW",
      },
    ]);
  });

  it("shows opening hours only when the gallery has published them", () => {
    const withoutHours = buildArtGalleryTeam({ context: "home", contact: CONTACT });
    expect(withoutHours.details.map((detail) => detail.kind)).not.toContain("hours");

    const blankHours = buildArtGalleryTeam({
      context: "home",
      contact: { ...CONTACT, openingHours: "  " },
    });
    expect(blankHours.details.map((detail) => detail.kind)).not.toContain("hours");

    const withHours = buildArtGalleryTeam({
      context: "home",
      contact: { ...CONTACT, openingHours: "Tuesday to Saturday, 10:00 to 18:00" },
    });
    expect(withHours.details.at(-1)).toEqual({
      kind: "hours",
      text: "Tuesday to Saturday, 10:00 to 18:00",
    });
  });

  it("leaves the direct lines to a venue page, which already lists them", () => {
    expect(buildArtGalleryTeam({ context: "venue", contact: CONTACT }).details).toEqual([]);
  });

  it("reads the gallery's details from the shared contact source by default", () => {
    const { details } = buildArtGalleryTeam({ context: "home" });
    expect(details[0]).toMatchObject({ kind: "phone", text: GALLERY_CONTACT.phone });
    expect(details[1]).toMatchObject({ kind: "email", text: GALLERY_CONTACT.email });
  });
});
