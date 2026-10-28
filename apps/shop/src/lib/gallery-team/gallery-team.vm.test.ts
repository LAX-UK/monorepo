import { GALLERY_CONTACT } from "@auction/branding";
import { describe, expect, it } from "vitest";
import { buildGalleryTeam } from "./gallery-team.vm";

describe("buildGalleryTeam", () => {
  it.each([
    ["home", "Help choosing a size, a frame or a gift"],
    ["edition", "Questions about this edition?"],
  ] as const)("invites questions on the %s page", (context, title) => {
    expect(buildGalleryTeam({ context }).title).toBe(title);
  });

  it("links to help and contact, with the reply promise under it", () => {
    const team = buildGalleryTeam({ context: "home" });
    expect(team.action).toEqual({ label: "Help and contact", href: "/help" });
    expect(team.note).toBe("We reply within one working day.");
    expect(team.eyebrow).toBe("The gallery team");
  });

  it("lists the gallery's four details from the shared contact", () => {
    const { details } = buildGalleryTeam({ context: "edition" });
    expect(details.map((detail) => detail.kind)).toEqual(["phone", "email", "address", "hours"]);
    expect(details[0]).toMatchObject({
      text: GALLERY_CONTACT.phone,
      href: GALLERY_CONTACT.phoneHref,
    });
    expect(details[2]?.href).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    expect(details[3]).toEqual({
      kind: "hours",
      text: "Monday to Friday, 10:00 to 19:00. Closed at weekends.",
    });
  });

  it("leaves the hours out when the gallery has published none", () => {
    const { details } = buildGalleryTeam({
      context: "home",
      contact: { ...GALLERY_CONTACT, openingHours: null },
    });
    expect(details.map((detail) => detail.kind)).not.toContain("hours");
  });
});
