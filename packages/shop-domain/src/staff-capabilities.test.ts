import { describe, expect, it } from "vitest";
import { ADMINISTRATOR_ONLY_CAPABILITIES, checkSeparateApprover } from "./staff-action-rules.js";
import {
  OVERVIEW_KPI_CAPABILITY,
  READ_IMPLIED_BY_WRITE,
  READ_ONLY_CAPABILITIES,
  SHOP_STAFF_CAPABILITIES,
  SHOP_STAFF_ROLES,
  type ShopStaffCapability,
  type ShopStaffRole,
  capabilitiesForRole,
  capabilitiesForRoles,
  clientListScope,
  overviewKpiKeysFor,
  rolesGranting,
  rolesHaveCapability,
} from "./staff-capabilities.js";

const can = (role: ShopStaffRole, capability: ShopStaffCapability) =>
  rolesHaveCapability([role], capability);

describe("staff capabilities matrix", () => {
  it.each(
    SHOP_STAFF_ROLES.flatMap((role) =>
      SHOP_STAFF_CAPABILITIES.map((capability) => [role, capability] as const),
    ),
  )("role %s capability %s", (role, capability) => {
    expect(can(role, capability)).toBe(capabilitiesForRole(role).includes(capability));
  });

  it("gives the Administrator every capability", () => {
    expect([...capabilitiesForRoles(["shop_admin"])].sort()).toEqual(
      [...SHOP_STAFF_CAPABILITIES].sort(),
    );
  });

  it("keeps settings, edition corrections and hors commerce approval with the Administrator", () => {
    for (const capability of ADMINISTRATOR_ONLY_CAPABILITIES) {
      expect(rolesGranting(capability)).toEqual(["shop_admin"]);
    }
  });

  it("brokers do not receive third_party_sale.write; operations do", () => {
    expect(can("broker", "third_party_sale.write")).toBe(false);
    expect(can("operations", "third_party_sale.write")).toBe(true);
  });

  it("stock_hold.override is limited to managers and admins", () => {
    expect(rolesGranting("stock_hold.override")).toEqual(["shop_admin", "account_manager"]);
  });

  it.each<[ShopStaffRole, ShopStaffCapability[]]>([
    [
      "shop_admin",
      ["editorial.write", "editorial.publish", "enquiry.read", "enquiry.write", "order.read"],
    ],
    ["catalogue_editor", []],
    ["editor", ["editorial.write", "editorial.publish"]],
    ["account_manager", ["enquiry.read", "enquiry.write", "order.read"]],
    ["broker", ["enquiry.read"]],
    ["operations", ["order.read", "enquiry.read"]],
    ["finance", ["order.read"]],
    ["read_only", ["order.read", "enquiry.read"]],
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

  it("moves editorial work from Catalogue editor to Editor", () => {
    expect(rolesGranting("editorial.publish")).toEqual(["shop_admin", "editor"]);
    expect(rolesGranting("editorial.write")).toEqual(["shop_admin", "editor"]);
    expect(capabilitiesForRole("editor")).not.toContain("catalogue.write");
  });

  it("keeps catalogue and artist applications with Catalogue editor", () => {
    expect(rolesGranting("artist_application.review")).toEqual(["shop_admin", "catalogue_editor"]);
    expect(can("catalogue_editor", "catalogue.write")).toBe(true);
    expect(can("catalogue_editor", "artwork_price.write")).toBe(false);
  });

  it("gives Read-only only read capabilities, and never buying prices or client records", () => {
    expect([...capabilitiesForRole("read_only")]).toEqual([...READ_ONLY_CAPABILITIES]);
    for (const capability of capabilitiesForRole("read_only")) {
      expect(capability.endsWith(".read")).toBe(true);
    }
    for (const closed of [
      "purchase_price.read_assigned",
      "client.read_all",
      "client.read_assigned",
      "audit.read",
    ] as const) {
      expect(can("read_only", closed)).toBe(false);
    }
  });
});

describe("several roles", () => {
  it("unions the capabilities of every role held", () => {
    const both = capabilitiesForRoles(["catalogue_editor", "editor"]);
    expect(both.has("catalogue.write")).toBe(true);
    expect(both.has("editorial.publish")).toBe(true);
    expect(both.has("refund.write")).toBe(false);
  });

  it("gives nothing for no roles", () => {
    expect(capabilitiesForRoles([]).size).toBe(0);
    expect(rolesHaveCapability([], "order.read")).toBe(false);
  });
});

describe("overviewKpiKeysFor", () => {
  it("offers a figure only to people who hold the capability for its list", () => {
    for (const role of SHOP_STAFF_ROLES) {
      const capabilities = capabilitiesForRoles([role]);
      for (const key of overviewKpiKeysFor(capabilities)) {
        expect(capabilities.has(OVERVIEW_KPI_CAPABILITY[key])).toBe(true);
      }
    }
  });

  it("counts every role a person holds", () => {
    expect(overviewKpiKeysFor(capabilitiesForRoles(["operations", "finance"]))).toEqual([
      "fulfilmentOpenCount",
      "payoutsDueCount",
    ]);
  });

  it("offers nothing to roles with no overview list, and every figure to admins", () => {
    expect(overviewKpiKeysFor(capabilitiesForRoles(["catalogue_editor", "editor"]))).toEqual([]);
    expect(overviewKpiKeysFor(capabilitiesForRoles(["read_only"]))).toEqual([]);
    expect(overviewKpiKeysFor(capabilitiesForRoles(["shop_admin"]))).toHaveLength(
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
    expect(clientListScope(capabilitiesForRoles(["read_only"]))).toBe("none");
  });
});

describe("separate approver", () => {
  const base = { action: "refund.write" as const, requestedBy: "staff-a", approvalRequired: true };

  it("refuses approval by the person who requested it", () => {
    expect(checkSeparateApprover({ ...base, approvedBy: "staff-a" })).toEqual({
      ok: false,
      reason: "approver_is_requester",
    });
    expect(
      checkSeparateApprover({ ...base, action: "payout.mark_paid", approvedBy: " staff-a " }),
    ).toEqual({ ok: false, reason: "approver_is_requester" });
  });

  it("asks for an approver when approval is required, and accepts someone else", () => {
    expect(checkSeparateApprover({ ...base, approvedBy: null })).toEqual({
      ok: false,
      reason: "approver_missing",
    });
    expect(checkSeparateApprover({ ...base, approvedBy: "staff-b" })).toEqual({ ok: true });
  });

  it("needs nothing when the action does not ask for approval", () => {
    expect(checkSeparateApprover({ ...base, approvalRequired: false, approvedBy: null })).toEqual({
      ok: true,
    });
  });
});

describe("catalogue and editorial reads", () => {
  it("gives every role that writes a kind of record the read for it", () => {
    for (const role of SHOP_STAFF_ROLES)
      for (const [write, read] of Object.entries(READ_IMPLIED_BY_WRITE))
        if (can(role, write as ShopStaffCapability)) expect(can(role, read)).toBe(true);
  });

  it("keeps every capability each role held before the reads existed", () => {
    const before: Record<ShopStaffRole, ShopStaffCapability[]> = {
      shop_admin: [...SHOP_STAFF_CAPABILITIES],
      account_manager: [
        "sale_authority.write",
        "original_sale.write",
        "stock_hold.write",
        "stock_hold.override",
        "client.read_all",
        "enquiry.read",
        "enquiry.write",
        "order.read",
      ],
      broker: [
        "stock_hold.write",
        "client.read_assigned",
        "purchase_price.read_assigned",
        "enquiry.read",
      ],
      operations: [
        "production.write",
        "fulfilment.write",
        "third_party_sale.write",
        "order.read",
        "enquiry.read",
      ],
      finance: [
        "fee.approve",
        "refund.write",
        "payout.mark_paid",
        "audit.read",
        "order.read",
        "artwork_price.write",
      ],
      catalogue_editor: ["catalogue.write", "artist_application.review"],
      editor: ["editorial.write", "editorial.publish"],
      read_only: ["order.read", "enquiry.read", "merchandise.read"],
    };
    for (const role of SHOP_STAFF_ROLES)
      for (const capability of before[role])
        expect(can(role, capability), `${role} ${capability}`).toBe(true);
  });

  it("gives the Catalogue editor and Editor their own read only", () => {
    expect(capabilitiesForRole("catalogue_editor")).toContain("catalogue.read");
    expect(capabilitiesForRole("catalogue_editor")).not.toContain("editorial.read");
    expect(capabilitiesForRole("editor")).toContain("editorial.read");
    expect(capabilitiesForRole("editor")).not.toContain("catalogue.read");
  });

  it("lets Read-only open the catalogue and editorial, and nothing sensitive or writable", () => {
    expect(READ_ONLY_CAPABILITIES).toContain("catalogue.read");
    expect(READ_ONLY_CAPABILITIES).toContain("editorial.read");
    const held = capabilitiesForRole("read_only");
    for (const capability of held) {
      expect(capability.endsWith(".read"), capability).toBe(true);
    }
    for (const forbidden of [
      "client.read_all",
      "client.read_assigned",
      "purchase_price.read_assigned",
      "audit.read",
    ] as const)
      expect(held).not.toContain(forbidden);
  });
});
