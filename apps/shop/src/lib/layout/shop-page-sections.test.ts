import { describe, expect, it } from "vitest";
import { type ShopSectionSurfaceRule, resolveShopPageSections } from "./shop-page-sections";

type Id = "opening" | "middle" | "promo" | "closing";

const RULES: Record<Id, ShopSectionSurfaceRule<Id>> = {
  opening: { surface: "band", flexible: false },
  middle: { surface: "plain", flexible: false },
  promo: { surface: "band", flexible: true },
  closing: { surface: "band", flexible: false },
};

const ALL_SHOWN: Record<Id, boolean> = { opening: true, middle: true, promo: true, closing: true };

describe("resolveShopPageSections", () => {
  it("keeps page order and leaves hidden sections out", () => {
    const { sections } = resolveShopPageSections(RULES, { ...ALL_SHOWN, middle: false });
    expect(sections).toEqual(["opening", "promo", "closing"]);
  });

  it("puts a flexible band on the plain page when it would touch a fixed band", () => {
    const { surfaces } = resolveShopPageSections(RULES, ALL_SHOWN);
    expect(surfaces).toEqual({
      opening: "band",
      middle: "plain",
      promo: "plain",
      closing: "band",
    });
  });

  it("recomputes from the sections shown, so a band keeps its tint once its neighbour hides", () => {
    const { surfaces } = resolveShopPageSections(RULES, { ...ALL_SHOWN, closing: false });
    expect(surfaces.promo).toBe("band");
  });

  it("never leaves two tinted bands next to each other when one can give way", () => {
    const { sections, surfaces } = resolveShopPageSections(RULES, { ...ALL_SHOWN, middle: false });
    const tints = sections.map((id) => surfaces[id]);
    for (let index = 1; index < tints.length; index++) {
      expect(tints[index] === "band" && tints[index - 1] === "band").toBe(false);
    }
  });
});
