import {
  type ShopStaffRole,
  capabilitiesForRole,
  overviewKpiKeysForRole,
} from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { buildAdminNavGroups } from "./admin-nav.vm";
import { buildOverviewTiles, buildWelcomeSections, overviewNeedsAttention } from "./overview.vm";

const FEATURES = { payouts: true, thirdPartySales: true, originalSales: true, merchandise: true };

/** What the API sends a role: a count for each figure it may see. */
function kpisFor(role: ShopStaffRole) {
  return Object.fromEntries(overviewKpiKeysForRole(role).map((key) => [key, 3]));
}

function tilesFor(role: ShopStaffRole, features = FEATURES) {
  const capabilities = capabilitiesForRole(role);
  const navGroups = buildAdminNavGroups({ capabilities, features });
  return buildOverviewTiles({
    navGroups,
    kpis: kpisFor(role),
    newEnquiryCount: capabilities.includes("enquiry.read") ? 5 : null,
  }).map((tile) => tile.label);
}

describe("buildOverviewTiles", () => {
  it.each([
    [
      "shop_admin",
      ["To fulfil", "Payouts due", "Active holds", "Pending limit requests", "New enquiries"],
    ],
    ["account_manager", ["Active holds", "Pending limit requests", "New enquiries"]],
    ["broker", ["Active holds", "New enquiries"]],
    ["operations", ["To fulfil", "New enquiries"]],
    ["finance", ["Payouts due"]],
    ["catalogue_editor", []],
  ] as const)("shows %s staff only the tiles for what they can open", (role, expected) => {
    expect(tilesFor(role)).toEqual(expected);
  });

  it("links each tile to the list it counts", () => {
    const capabilities = capabilitiesForRole("shop_admin");
    const tiles = buildOverviewTiles({
      navGroups: buildAdminNavGroups({ capabilities, features: FEATURES }),
      kpis: kpisFor("shop_admin"),
      newEnquiryCount: 5,
    });
    expect(tiles.map((tile) => tile.href)).toEqual([
      "/fulfilment",
      "/payouts?view=due",
      "/holds?view=active",
      "/requests",
      "/enquiries?view=new",
    ]);
  });

  it("drops a figure the API sent when its page is switched off", () => {
    const capabilities = capabilitiesForRole("shop_admin");
    const tiles = buildOverviewTiles({
      navGroups: buildAdminNavGroups({
        capabilities,
        features: { ...FEATURES, payouts: false, thirdPartySales: false },
      }),
      kpis: kpisFor("shop_admin"),
      newEnquiryCount: null,
    });
    expect(tiles.map((tile) => tile.label)).toEqual(["Pending limit requests"]);
  });

  it("never shows a figure the API withheld, even where the page is reachable", () => {
    const capabilities = capabilitiesForRole("shop_admin");
    const tiles = buildOverviewTiles({
      navGroups: buildAdminNavGroups({ capabilities, features: FEATURES }),
      kpis: {},
      newEnquiryCount: null,
    });
    expect(tiles).toEqual([]);
  });

  it("keeps a count of zero, which is a real answer", () => {
    const capabilities = capabilitiesForRole("finance");
    const [tile] = buildOverviewTiles({
      navGroups: buildAdminNavGroups({ capabilities, features: FEATURES }),
      kpis: { payoutsDueCount: 0 },
      newEnquiryCount: null,
    });
    expect(tile).toMatchObject({ label: "Payouts due", value: 0 });
  });
});

describe("open editions low on stock", () => {
  const NIGHT = "11111111-1111-4111-8111-111111111111";
  const lowStockRuns = [
    { artworkId: NIGHT, title: "Night garden", onSale: 2 },
    { artworkId: "22222222-2222-4222-8222-222222222222", title: "Dune", onSale: 0 },
  ];
  const tiles = (role: ShopStaffRole) =>
    buildOverviewTiles({
      navGroups: buildAdminNavGroups({
        capabilities: capabilitiesForRole(role),
        features: FEATURES,
      }),
      kpis: { lowStockRuns },
      newEnquiryCount: null,
    });

  it("lists each run with its prints on sale, linking to its stock, kept even at none", () => {
    const [night, dune] = tiles("catalogue_editor");
    expect(night).toEqual({
      key: `low-stock-${NIGHT}`,
      label: "Night garden: prints on sale",
      value: 2,
      href: `/artworks/${NIGHT}#stock`,
      tone: "warning",
      keepWhenZero: true,
    });
    expect(dune?.value).toBe(0);
    expect(overviewNeedsAttention(tiles("catalogue_editor"))).toBe(true);
  });

  it("is not shown to staff who cannot open artworks", () => {
    expect(tiles("operations")).toEqual([]);
  });
});

describe("buildWelcomeSections", () => {
  it("lists the sections a catalogue editor can open, without the overview itself", () => {
    const sections = buildWelcomeSections(
      buildAdminNavGroups({
        capabilities: capabilitiesForRole("catalogue_editor"),
        features: FEATURES,
      }),
    );
    expect(sections.map((section) => section.title)).toEqual(["Gallery"]);
    expect(sections[0]?.items.map((item) => item.href)).toContain("/artworks");
  });
});
