import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import {
  BID_COOKIE_PREFERENCES_HREF,
  bidFooterAccountLinks,
  buildBidFooterColumns,
} from "./footer-link-groups";

const shop: LaxProductLinkVm = {
  id: "shop",
  label: "LAX Shop",
  href: "https://shop.example/",
  current: false,
  external: true,
};

describe("buildBidFooterColumns", () => {
  it("orders navigation, LAX products, then legal", () => {
    expect(buildBidFooterColumns([shop]).map((column) => column.id)).toEqual([
      "auctions",
      "selling",
      "account",
      "company",
      "lax-products",
      "legal",
    ]);
    expect(buildBidFooterColumns([]).map((column) => column.id)).not.toContain("lax-products");
  });

  it("ends the legal column with cookie settings", () => {
    const legal = buildBidFooterColumns([]).find((column) => column.id === "legal");
    expect(legal?.links.map((link) => link.label)).toEqual([
      "Legal and policies",
      "Terms",
      "Privacy",
      "Cookies",
      "Cookie settings",
    ]);
    expect(legal?.links.at(-1)?.href).toBe(BID_COOKIE_PREFERENCES_HREF);
  });

  it("lists private sales with the selling links", () => {
    const selling = buildBidFooterColumns([]).find((column) => column.id === "selling");
    expect(selling?.links).toContainEqual({ href: "/sell/private-sales", label: "Private sales" });
  });
});

describe("bidFooterAccountLinks", () => {
  const labels = (person: Parameters<typeof bidFooterAccountLinks>[0]) =>
    bidFooterAccountLinks(person).map((link) => link.label);

  it("offers a visitor the ways in", () => {
    expect(labels(null)).toEqual([
      "Sign in",
      "Create account",
      "Auction alerts",
      "Client services",
      "FAQ",
    ]);
  });

  it("shows a signed-in client their own pages instead of sign in", () => {
    expect(labels({ role: "client", staffRoles: [] })).toEqual([
      "My bids",
      "Purchases",
      "Watching",
      "Notifications",
      "Client services",
      "FAQ",
    ]);
  });

  it("sends staff, who have no client pages, to LAX Account", () => {
    const staff = labels({ role: "staff", staffRoles: ["finance"] });
    expect(staff).not.toContain("Sign in");
    expect(staff).not.toContain("My bids");
    expect(staff).toContain("LAX Account");
  });

  it("builds the Account column from the person", () => {
    const account = buildBidFooterColumns([], { role: "client", staffRoles: [] }).find(
      (column) => column.id === "account",
    );
    expect(account?.links[0]?.label).toBe("My bids");
  });
});
