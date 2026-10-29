import { describe, expect, it } from "vitest";
import {
  LAX_STAFF_PLATFORMS,
  bidStaffRolesFromGrants,
  laxStaffRoleOption,
  normalizeLaxStaffGrants,
  staffToolsFromGrants,
} from "./lax-staff-platforms.js";
import { userStaffRoles } from "./user.js";

describe("LAX staff platforms", () => {
  it("offers every Bid staff role with copy", () => {
    const bid = LAX_STAFF_PLATFORMS.find((p) => p.product === "bid");
    expect(bid?.roles.map((r) => r.value)).toEqual([...userStaffRoles]);
    for (const role of bid?.roles ?? []) {
      expect(role.label).not.toBe("");
      expect(role.summary).not.toBe("");
    }
  });

  it("resolves role options per platform", () => {
    expect(laxStaffRoleOption("shop", "broker")?.label).toBe("Broker");
    expect(laxStaffRoleOption("shop", "specialist")).toBeNull();
  });

  it("normalizes grants into catalogue order", () => {
    expect(
      normalizeLaxStaffGrants([
        { product: "shop", role: "finance" },
        { product: "bid", role: "specialist" },
      ]),
    ).toEqual({
      ok: true,
      grants: [
        { product: "bid", role: "specialist" },
        { product: "shop", role: "finance" },
      ],
    });
  });

  it("opens Bid admin for any Bid staff role and LAX Admin for any Shop role", () => {
    for (const role of userStaffRoles) {
      expect(staffToolsFromGrants([{ product: "bid", role }])).toEqual(["bid-admin"]);
    }
    expect(staffToolsFromGrants([{ product: "shop", role: "catalogue_editor" }])).toEqual([
      "lax-admin",
    ]);
    expect(
      staffToolsFromGrants([
        { product: "shop", role: "broker" },
        { product: "bid", role: "finance" },
      ]),
    ).toEqual(["bid-admin", "lax-admin"]);
  });

  it("opens nothing for no grants or roles the platform does not know", () => {
    expect(staffToolsFromGrants([])).toEqual([]);
    // Bid records a staff user without a staff role as the plain word "staff".
    expect(staffToolsFromGrants([{ product: "bid", role: "staff" }])).toEqual([]);
    expect(staffToolsFromGrants([{ product: "shop", role: "administrator" }])).toEqual([]);
  });

  it("rejects unknown platforms, foreign roles and duplicates", () => {
    expect(normalizeLaxStaffGrants([{ product: "vault", role: "x" }]).ok).toBe(false);
    expect(normalizeLaxStaffGrants([{ product: "shop", role: "administrator" }]).ok).toBe(false);
    expect(
      normalizeLaxStaffGrants([
        { product: "bid", role: "specialist" },
        { product: "bid", role: "specialist" },
      ]),
    ).toEqual({ ok: false, message: "Bid role chosen twice (Specialist)" });
  });

  it("allows several Bid roles, in role order, beside a LAX Admin role", () => {
    expect(
      normalizeLaxStaffGrants([
        { product: "shop", role: "broker" },
        { product: "bid", role: "fulfilment" },
        { product: "bid", role: "sales_manager" },
      ]),
    ).toEqual({
      ok: true,
      grants: [
        { product: "bid", role: "sales_manager" },
        { product: "bid", role: "fulfilment" },
        { product: "shop", role: "broker" },
      ],
    });
  });

  it("allows several LAX Admin roles, in role order", () => {
    expect(
      normalizeLaxStaffGrants([
        { product: "shop", role: "editor" },
        { product: "shop", role: "catalogue_editor" },
      ]),
    ).toEqual({
      ok: true,
      grants: [
        { product: "shop", role: "catalogue_editor" },
        { product: "shop", role: "editor" },
      ],
    });
  });

  it("reads the Bid roles of a set of grants", () => {
    expect(
      bidStaffRolesFromGrants([
        { product: "shop", role: "finance" },
        { product: "bid", role: "fulfilment" },
        { product: "bid", role: "cataloguer" },
      ]),
    ).toEqual(["cataloguer", "fulfilment"]);
  });
});
