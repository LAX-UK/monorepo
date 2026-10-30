import {
  type ShopStaffRole,
  capabilitiesForRole,
  capabilitiesForRoles,
  clientListScope,
} from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { buildAdminNavGroups, flattenAdminNav } from "./admin-nav.vm";

const EDITORIAL_HREFS = [
  "/editorial/exhibitions",
  "/editorial/stories",
  "/editorial/venues",
  "/editorial/pages",
  "/help",
  "/editorial/home",
  "/editorial/featured",
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
  it.each([
    "shop_admin",
    "account_manager",
    "broker",
    "operations",
    "finance",
    "catalogue_editor",
  ] as const)("shows the overview to %s staff, the landing page every role reaches", (role) => {
    expect(navHrefsFor(role)).toContain("/overview");
  });

  it("shows catalogue editors the catalogue and applications, and editors the editorial areas", () => {
    expect(navHrefsFor("catalogue_editor")).toEqual([
      "/overview",
      "/artworks",
      "/artists",
      "/artist-applications",
    ]);
    expect(navHrefsFor("editor")).toEqual(["/overview", ...EDITORIAL_HREFS]);
  });

  it("shows Read-only the catalogue and editorial pages, and nothing from clients or the audit log", () => {
    const hrefs = navHrefsFor("read_only");
    for (const href of ["/artworks", "/artists", ...EDITORIAL_HREFS]) expect(hrefs).toContain(href);
    expect(hrefs).not.toContain("/artist-applications");
    expect(hrefs).not.toContain("/clients");
    expect(hrefs).not.toContain("/audit");
  });

  it("shows someone with both roles everything either opens", () => {
    const hrefs = flattenAdminNav(
      buildAdminNavGroups({
        capabilities: [...capabilitiesForRoles(["catalogue_editor", "editor"])],
        features: ALL_FEATURES,
      }),
    ).map((item) => item.href);
    expect(hrefs).toEqual([
      "/overview",
      "/artworks",
      "/artists",
      "/artist-applications",
      ...EDITORIAL_HREFS,
    ]);
  });

  it("shows Read-only staff the lists they may read and nothing else", () => {
    expect(navHrefsFor("read_only")).toEqual(
      expect.arrayContaining(["/overview", "/orders", "/enquiries"]),
    );
    expect(navHrefsFor("read_only")).not.toContain("/clients");
    expect(navHrefsFor("read_only")).not.toContain("/audit");
  });

  it("lets operations view orders and enquiries but not editorial or the audit log", () => {
    const hrefs = navHrefsFor("operations");
    expect(hrefs).toEqual(
      expect.arrayContaining(["/orders", "/enquiries", "/production", "/fulfilment"]),
    );
    expect(EDITORIAL_HREFS.filter((href) => hrefs.includes(href))).toEqual([]);
    expect(hrefs).not.toContain("/audit");
  });

  it("shows third-party sales to operations, who record them, and to finance, who approve their fees", () => {
    expect(navHrefsFor("operations")).toContain("/third-party-sales");
    expect(navHrefsFor("finance")).toContain("/third-party-sales");
    expect(navHrefsFor("broker")).not.toContain("/third-party-sales");
    expect(navHrefsFor("account_manager")).not.toContain("/third-party-sales");
  });

  it("lets finance view orders but not enquiries or editorial", () => {
    const hrefs = navHrefsFor("finance");
    expect(hrefs).toContain("/orders");
    expect(hrefs).toContain("/audit");
    expect(hrefs).not.toContain("/enquiries");
    expect(EDITORIAL_HREFS.filter((href) => hrefs.includes(href))).toEqual([]);
  });

  it("lets finance open artworks to set prices, but not artists", () => {
    const hrefs = navHrefsFor("finance");
    expect(hrefs).toContain("/artworks");
    expect(hrefs).not.toContain("/artists");
  });

  it("lets account managers view orders and enquiries", () => {
    const hrefs = navHrefsFor("account_manager");
    expect(hrefs).toEqual(expect.arrayContaining(["/orders", "/enquiries", "/clients"]));
    expect(EDITORIAL_HREFS.filter((href) => hrefs.includes(href))).toEqual([]);
  });

  it("lets brokers read enquiries but not orders", () => {
    const hrefs = navHrefsFor("broker");
    expect(hrefs).toContain("/enquiries");
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
        "/enquiries",
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
          "Artist applications",
          "Exhibitions",
          "Stories",
          "Venues",
          "Pages",
          "Help centre",
          "lax.art home",
          "Featured on home",
          "Enquiries",
        ],
      ],
      ["Shop", ["Products", "Orders", "Production", "Fulfilment", "Stock holds"]],
      ["Sales", ["Original sales", "Third-party sales", "Sale limit requests"]],
      ["Clients", ["Clients", "Leads"]],
      ["Finance", ["Payouts", "Disputes"]],
      ["Admin", ["Staff", "Audit log", "Settings"]],
    ]);
  });

  it("hides groups that have no visible links", () => {
    const titles = buildAdminNavGroups({
      capabilities: capabilitiesForRole("catalogue_editor"),
      features: ALL_FEATURES,
    }).map((group) => group.title);
    expect(titles).toEqual(["Overview", "Gallery"]);
  });

  it("shows only the overview without capabilities", () => {
    expect(
      flattenAdminNav(buildAdminNavGroups({ capabilities: [], features: ALL_FEATURES })),
    ).toEqual([{ href: "/overview", icon: "overview", label: "Overview" }]);
  });

  describe("enquiry attention count", () => {
    const enquiriesItem = (role: ShopStaffRole, enquiryAttentionCount?: number) =>
      flattenAdminNav(
        buildAdminNavGroups({
          capabilities: capabilitiesForRole(role),
          features: ALL_FEATURES,
          ...(enquiryAttentionCount !== undefined ? { enquiryAttentionCount } : {}),
        }),
      ).find((item) => item.href === "/enquiries");

    it("shows the number of new, unassigned enquiries beside the Enquiries link", () => {
      expect(enquiriesItem("account_manager", 4)).toMatchObject({ attentionCount: 4 });
    });

    it("omits the count when nothing needs attention or it is unknown", () => {
      expect(enquiriesItem("account_manager", 0)).not.toHaveProperty("attentionCount");
      expect(enquiriesItem("account_manager")).not.toHaveProperty("attentionCount");
    });

    it("never adds a link for a role that cannot read enquiries", () => {
      expect(enquiriesItem("finance", 9)).toBeUndefined();
    });
  });
});

describe("Artist applications nav item", () => {
  const applicationsItem = (role: ShopStaffRole, applicationAttentionCount?: number) =>
    flattenAdminNav(
      buildAdminNavGroups({
        capabilities: capabilitiesForRole(role),
        features: ALL_FEATURES,
        ...(applicationAttentionCount !== undefined ? { applicationAttentionCount } : {}),
      }),
    ).find((item) => item.href === "/artist-applications");

  it("is shown to the roles that review applications, with the new ones counted", () => {
    expect(applicationsItem("catalogue_editor", 3)).toMatchObject({ attentionCount: 3 });
    expect(applicationsItem("shop_admin")).toBeDefined();
  });

  it.each(["account_manager", "broker", "operations", "finance"] as const)(
    "is hidden from %s",
    (role) => {
      expect(applicationsItem(role, 3)).toBeUndefined();
    },
  );
});

describe("Clients nav item", () => {
  it.each([
    "shop_admin",
    "account_manager",
    "broker",
    "operations",
    "finance",
    "catalogue_editor",
  ] as const)("is shown to %s exactly when the client list route will answer", (role) => {
    const shown = navHrefsFor(role).includes("/clients");
    expect(shown).toBe(clientListScope(capabilitiesForRole(role)) !== "none");
  });

  it("shows brokers the page, which lists only their assigned clients", () => {
    expect(navHrefsFor("broker")).toContain("/clients");
  });
});
