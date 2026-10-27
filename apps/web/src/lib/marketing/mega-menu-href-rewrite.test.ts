import { describe, expect, it } from "vitest";
import {
  restoreDashboardHrefForAuthed,
  restoreMegaMenuAuthedHrefs,
  rewriteDashboardHrefForGuest,
  rewriteMegaMenuForGuest,
} from "./mega-menu-href-rewrite";

describe("mega-menu-href-rewrite", () => {
  it("rewrites dashboard hrefs for guests and restores them for authed users", () => {
    const guestHref = rewriteDashboardHrefForGuest("/selling");
    expect(guestHref).toBe("/login?next=%2Fselling");
    expect(restoreDashboardHrefForAuthed(guestHref)).toBe("/selling");
  });

  it("leaves non-dashboard hrefs unchanged", () => {
    expect(rewriteDashboardHrefForGuest("/search")).toBe("/search");
    expect(restoreDashboardHrefForAuthed("/search")).toBe("/search");
  });

  it("round-trips mega menu sections", () => {
    const sections = [
      {
        id: "sell",
        href: "/sell",
        label: "Sell",
        items: [{ href: "/selling", label: "Seller dashboard" }],
      },
    ];
    const guest = rewriteMegaMenuForGuest(sections);
    expect(guest[0]?.items[0]?.href).toContain("/login?next=");
    const authed = restoreMegaMenuAuthedHrefs(guest);
    expect(authed[0]?.items[0]?.href).toBe("/selling");
  });
});
