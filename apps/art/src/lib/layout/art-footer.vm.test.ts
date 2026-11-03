import { LAX_ART_POLICY_ORDER } from "@auction/marketing-ui";
import { describe, expect, it } from "vitest";
import { buildArtFooterVm } from "./art-footer.vm";

const ALL_POLICIES = LAX_ART_POLICY_ORDER;

function legalLinks() {
  const vm = buildArtFooterVm({
    crossProductLinks: [],
    accountState: { kind: "guest" },
    linkablePolicies: ALL_POLICIES,
  });
  return vm.columns.find((column) => column.id === "legal")?.links ?? [];
}

describe("buildArtFooterVm", () => {
  it("always ends the Legal column with cookie settings", () => {
    expect(legalLinks().at(-1)).toEqual({ label: "Cookie settings", href: "#cookie-settings" });
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
      linkablePolicies: ALL_POLICIES,
    });
    expect(vm.columns.map((column) => column.id)).toEqual([
      "gallery",
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
      linkablePolicies: ALL_POLICIES,
    });
    const linksOf = (id: string) => vm.columns.find((column) => column.id === id)?.links ?? [];
    expect(vm.columns.map((column) => column.title)).toEqual([
      "Gallery",
      "Our services",
      "Account",
      "Legal",
    ]);
    expect(linksOf("gallery")).toEqual([
      { label: "Visit", href: "/visit" },
      { label: "Contact", href: "/contact" },
    ]);
    expect(linksOf("services").map((link) => link.href)).toEqual([
      "/how-to-buy",
      "/how-to-sell",
      "/for-artists",
      "/collector-hub",
      "/help",
    ]);
    expect(linksOf("legal")).toEqual([
      { label: "Legal and policies", href: "/legal" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Cookies", href: "/legal/cookies" },
      { label: "Cookie settings", href: "#cookie-settings" },
    ]);
  });

  it("leaves out policies that cannot be linked, such as drafts on production", () => {
    const vm = buildArtFooterVm({
      crossProductLinks: [],
      accountState: { kind: "guest" },
      linkablePolicies: ["terms"],
    });
    const legal = vm.columns.find((column) => column.id === "legal")?.links ?? [];
    expect(legal.map((link) => link.href)).not.toContain("/legal/privacy");
    expect(legal.map((link) => link.href)).not.toContain("/legal/cookies");
    expect(legal.map((link) => link.href)).toContain("/legal/terms");
  });
});
