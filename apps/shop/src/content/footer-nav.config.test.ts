import { describe, expect, it } from "vitest";
import { buildShopLegalMenu } from "./footer-nav.config";

const ALL = ["terms", "delivery", "returns", "help", "privacy", "cookies"] as const;

describe("buildShopLegalMenu", () => {
  it("lists every policy: Shop's own pages, and the rest on lax.art", () => {
    const menu = buildShopLegalMenu({
      current: "delivery",
      linkable: ALL,
      artBaseUrl: new URL("https://art.example"),
    });
    expect(menu.map((link) => [link.label, link.href])).toEqual([
      ["Legal & Policies", "https://art.example/legal"],
      ["Terms of Sale", "/terms"],
      ["Returns & Cancellation", "/returns"],
      ["Shipping & Delivery", "/delivery"],
      ["Privacy Notice", "/privacy"],
      ["Cookie Preferences", "/cookies"],
      ["Complaints & ADR", "/help"],
      ["Accessibility", "https://art.example/legal/accessibility"],
      ["AML & Identity", "https://art.example/legal/aml-identity-checks"],
      ["Reviews Policy", "https://art.example/legal/reviews"],
      ["Ethical Sourcing", "https://art.example/legal/ethical-sourcing"],
    ]);
    expect(menu.filter((link) => link.current).map((link) => link.href)).toEqual(["/delivery"]);
  });

  it("keeps to Shop's own pages when lax.art's address is unknown", () => {
    const menu = buildShopLegalMenu({ current: null, linkable: ["terms"], artBaseUrl: null });
    expect(menu.map((link) => link.href)).toEqual(["/terms"]);
  });
});
