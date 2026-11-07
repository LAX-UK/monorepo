import { describe, expect, it } from "vitest";
import { ART_HELP_LINKS, buildArtTopBarHelpLinks } from "./art-help-links.js";

describe("lax.art help links", () => {
  it("lists Visit us, Enquire and Help in that order", () => {
    expect(ART_HELP_LINKS.map((link) => [link.label, link.href])).toEqual([
      ["Visit us", "/visit"],
      ["Enquire", "/contact"],
      ["Help", "/help"],
    ]);
  });

  it("keeps plain links when signed out", () => {
    const links = buildArtTopBarHelpLinks();
    expect(links.map((link) => link.label)).toEqual(["Visit us", "Enquire", "Help"]);
    expect(links.every((link) => link.render === undefined)).toBe(true);
  });

  it("swaps only Enquire for the sheet control when signed in", () => {
    const links = buildArtTopBarHelpLinks(() => "sheet");
    expect(links.filter((link) => link.render).map((link) => link.label)).toEqual(["Enquire"]);
  });
});
