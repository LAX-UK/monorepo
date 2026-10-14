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
      "explore",
      "discover",
      "account",
      "lax-products",
      "legal",
    ]);
    expect(vm.columns[2]?.links).toEqual([
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/register" },
    ]);
  });
});
