import { describe, expect, it } from "vitest";
import { buildArtFooterVm } from "./art-footer.vm";

function legalLinks(cookieSettings: boolean) {
  const vm = buildArtFooterVm({
    crossProductLinks: [],
    accountState: { kind: "guest" },
    cookieSettings,
  });
  return vm.columns.find((column) => column.id === "legal")?.links ?? [];
}

describe("buildArtFooterVm", () => {
  it("offers cookie preferences under Legal only when analytics consent is collected", () => {
    expect(legalLinks(true)).toContainEqual({
      label: "Cookie preferences",
      href: "#cookie-settings",
    });
    expect(legalLinks(false).some((link) => link.label === "Cookie preferences")).toBe(false);
  });

  it("orders navigation, account, products, then legal", () => {
    const vm = buildArtFooterVm({
      crossProductLinks: [
        {
          id: "bid",
          label: "LAX Bid",
          href: "https://bid.example/",
          current: false,
          external: true,
        },
      ],
      accountState: { kind: "guest" },
      cookieSettings: false,
    });
    expect(vm.columns.map((column) => column.id)).toEqual([
      "about",
      "services",
      "account",
      "lax-products",
      "legal",
    ]);
    expect(vm.columns[2]?.links).toEqual([
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/register" },
    ]);
  });

  it("fills the columns with Figma's links that have Art routes", () => {
    const vm = buildArtFooterVm({
      crossProductLinks: [],
      accountState: { kind: "authenticated" },
      cookieSettings: false,
    });
    const linksOf = (id: string) => vm.columns.find((column) => column.id === id)?.links ?? [];
    expect(vm.columns.map((column) => column.title)).toEqual([
      "About us",
      "Our services",
      "Account",
      "Legal",
    ]);
    expect(linksOf("about")).toEqual([
      { label: "Visit", href: "/visit" },
      { label: "Contact", href: "/contact" },
    ]);
    expect(linksOf("services").map((link) => link.href)).toEqual([
      "/how-to-buy",
      "/how-to-sell",
      "/collector-hub",
      "/help",
    ]);
    expect(linksOf("legal").map((link) => link.href)).toEqual([
      "/legal/privacy",
      "/legal/cookies",
      "/legal/returns",
      "/legal/shipping",
      "/legal/terms",
      "/legal/accessibility",
      "/legal/modern-slavery",
    ]);
  });
});
