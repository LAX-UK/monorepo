import { describe, expect, it } from "vitest";
import {
  OVERVIEW_KPI_CAPABILITY,
  SHOP_STAFF_CAPABILITIES,
  type ShopStaffCapability,
  type ShopStaffRole,
  capabilitiesForRole,
  clientListScope,
  overviewKpiKeysForRole,
  roleHasCapability,
} from "./staff-capabilities.js";

const ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];

describe("staff capabilities matrix", () => {
  it.each(
    ROLES.flatMap((role) =>
      SHOP_STAFF_CAPABILITIES.map((capability) => [role, capability] as const),
    ),
  )("role %s capability %s", (role, capability) => {
    const allowed = capabilitiesForRole(role).includes(capability);
    expect(roleHasCapability(role, capability)).toBe(allowed);
  });

  it("brokers do not receive third_party_sale.write", () => {
    expect(roleHasCapability("broker", "third_party_sale.write")).toBe(false);
  });

  it("operations receive third_party_sale.write", () => {
    expect(roleHasCapability("operations", "third_party_sale.write")).toBe(true);
  });

  it("merchandise capabilities exist on shop_admin", () => {
    for (const cap of ["merchandise.read", "merchandise.write"] as ShopStaffCapability[]) {
      expect(roleHasCapability("shop_admin", cap)).toBe(true);
    }
  });

  it("stock_hold.override is limited to managers and admins", () => {
    expect(roleHasCapability("shop_admin", "stock_hold.override")).toBe(true);
    expect(roleHasCapability("account_manager", "stock_hold.override")).toBe(true);
    expect(roleHasCapability("broker", "stock_hold.override")).toBe(false);
    expect(roleHasCapability("operations", "stock_hold.override")).toBe(false);
  });

  it.each<[ShopStaffRole, ShopStaffCapability[]]>([
    [
      "shop_admin",
      ["editorial.write", "editorial.publish", "enquiry.read", "enquiry.write", "order.read"],
    ],
    ["catalogue_editor", ["editorial.write", "editorial.publish"]],
    ["account_manager", ["enquiry.read", "enquiry.write", "order.read"]],
    ["broker", ["enquiry.read"]],
    ["operations", ["order.read", "enquiry.read"]],
    ["finance", ["order.read"]],
  ])("%s holds %j from the editorial, enquiry and order capabilities", (role, expected) => {
    const scoped = [
      "editorial.write",
      "editorial.publish",
      "enquiry.read",
      "enquiry.write",
      "order.read",
    ];
    const held = capabilitiesForRole(role).filter((capability) => scoped.includes(capability));
    expect([...held].sort()).toEqual([...expected].sort());
  });

  it("lets only admins and catalogue editors review artist applications", () => {
    const reviewers = ROLES.filter((role) => roleHasCapability(role, "artist_application.review"));
    expect(reviewers).toEqual(["shop_admin", "catalogue_editor"]);
  });

  it("keeps editorial publishing out of every role except admins and catalogue editors", () => {
    for (const role of ["account_manager", "broker", "operations", "finance"] as ShopStaffRole[]) {
      expect(roleHasCapability(role, "editorial.publish")).toBe(false);
    }
  });

  it("keeps catalogue.write for catalogue editors so artworks and artists stay editable", () => {
    expect(roleHasCapability("catalogue_editor", "catalogue.write")).toBe(true);
  });
});

describe("overviewKpiKeysForRole", () => {
  it("offers a figure only to roles that hold the capability for its list", () => {
    for (const role of ROLES) {
      for (const key of overviewKpiKeysForRole(role)) {
        expect(roleHasCapability(role, OVERVIEW_KPI_CAPABILITY[key])).toBe(true);
      }
    }
  });

  it("offers nothing to roles with no overview list, and every figure to admins", () => {
    expect(overviewKpiKeysForRole("catalogue_editor")).toEqual([]);
    expect(overviewKpiKeysForRole("shop_admin")).toHaveLength(
      Object.keys(OVERVIEW_KPI_CAPABILITY).length,
    );
  });
});

describe("clientListScope", () => {
  it("reads everything for full client access, even alongside assigned access", () => {
    expect(clientListScope(["client.read_all"])).toBe("all");
    expect(clientListScope(["client.read_assigned", "client.read_all"])).toBe("all");
  });

  it("limits assigned-only staff to their own clients", () => {
    expect(clientListScope(["client.read_assigned"])).toBe("assigned");
  });

  it("gives everyone else no client list", () => {
    expect(clientListScope(["order.read"])).toBe("none");
    expect(clientListScope([])).toBe("none");
  });
});
