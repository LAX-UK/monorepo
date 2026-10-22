import { type ShopStaffRole, capabilitiesForRole } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { buildAdminNavGroups, flattenAdminNav } from "./admin-nav.vm";

const EDITORIAL_HREFS = [
  "/editorial/exhibitions",
  "/editorial/stories",
  "/editorial/venues",
  "/editorial/pages",
  "/editorial/home",
];

const ALL_FEATURES = {
  payouts: true,
  thirdPartySales: true,
  originalSales: true,
  merchandise: true,
};

function navHrefsFor(role: ShopStaffRole, features = ALL_FEATURES): string[] {
  const groups = buildAdminNavGroups({ capabilities: capabilitiesForRole(role), features });
  return flattenAdminNav(groups).map((item) => item.href);
}

describe("buildAdminNavGroups", () => {
  it("shows catalogue editors the catalogue and editorial areas only", () => {
    expect(navHrefsFor("catalogue_editor")).toEqual(["/artworks", "/artists", ...EDITORIAL_HREFS]);
  });

  it("lets operations view orders and enquiries but not editorial or the audit log", () => {
    const hrefs = navHrefsFor("operations");
    expect(hrefs).toEqual(
      expect.arrayContaining(["/orders", "/general-enquiries", "/production", "/fulfilment"]),
    );
    expect(EDITORIAL_HREFS.filter((href) => hrefs.includes(href))).toEqual([]);
    expect(hrefs).not.toContain("/audit");
  });

  it("lets finance view orders but not enquiries or editorial", () => {
    const hrefs = navHrefsFor("finance");
    expect(hrefs).toContain("/orders");
    expect(hrefs).toContain("/audit");
    expect(hrefs).not.toContain("/general-enquiries");
    expect(EDITORIAL_HREFS.filter((href) => hrefs.includes(href))).toEqual([]);
  });

  it("lets account managers view orders and enquiries", () => {
    const hrefs = navHrefsFor("account_manager");
    expect(hrefs).toEqual(expect.arrayContaining(["/orders", "/general-enquiries", "/clients"]));
    expect(EDITORIAL_HREFS.filter((href) => hrefs.includes(href))).toEqual([]);
  });

  it("lets brokers read enquiries but not orders", () => {
    const hrefs = navHrefsFor("broker");
    expect(hrefs).toContain("/general-enquiries");
    expect(hrefs).not.toContain("/orders");
  });

  it("shows shop admins every area", () => {
    const hrefs = navHrefsFor("shop_admin");
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/overview",
        "/artists",
        "/artworks",
        ...EDITORIAL_HREFS,
        "/orders",
        "/general-enquiries",
        "/staff",
        "/settings",
        "/audit",
      ]),
    );
  });

  it("hides payout, fulfilment, sales and merchandise links when their features are off", () => {
    const hrefs = navHrefsFor("shop_admin", {
      payouts: false,
      thirdPartySales: false,
      originalSales: false,
      merchandise: false,
    });
    for (const hidden of ["/payouts", "/fulfilment", "/holds", "/original-sales", "/merchandise"]) {
      expect(hrefs).not.toContain(hidden);
    }
  });

  it("groups links by job, in staff-facing order, with the labels staff see", () => {
    const groups = buildAdminNavGroups({
      capabilities: capabilitiesForRole("shop_admin"),
      features: ALL_FEATURES,
    });
    expect(groups.map((group) => [group.title, group.items.map((item) => item.label)])).toEqual([
      ["Overview", ["Overview"]],
      [
        "Gallery",
        [
          "Artworks",
          "Artists",
          "Exhibitions",
          "Stories",
          "Venues",
          "Pages",
          "Home placements",
          "Enquiries",
        ],
      ],
      ["Shop", ["Products", "Orders", "Production", "Fulfilment", "Stock holds"]],
      ["Sales", ["Original sales", "Third-party sales", "Sale limit requests"]],
      ["Clients", ["Clients"]],
      ["Finance", ["Payouts", "Disputes"]],
      ["Admin", ["Staff", "Audit log", "Settings"]],
    ]);
  });

  it("hides groups that have no visible links", () => {
    const titles = buildAdminNavGroups({
      capabilities: capabilitiesForRole("catalogue_editor"),
      features: ALL_FEATURES,
    }).map((group) => group.title);
    expect(titles).toEqual(["Gallery"]);
  });

  it("shows nothing without capabilities", () => {
    expect(buildAdminNavGroups({ capabilities: [], features: ALL_FEATURES })).toEqual([]);
  });
});
