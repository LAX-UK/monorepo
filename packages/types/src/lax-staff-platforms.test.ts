import { describe, expect, it } from "vitest";
import {
  LAX_STAFF_PLATFORMS,
  laxStaffRoleOption,
  normalizeLaxStaffGrants,
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

  it("rejects unknown platforms, foreign roles and duplicates", () => {
    expect(normalizeLaxStaffGrants([{ product: "vault", role: "x" }]).ok).toBe(false);
    expect(normalizeLaxStaffGrants([{ product: "shop", role: "super_admin" }]).ok).toBe(false);
    expect(
      normalizeLaxStaffGrants([
        { product: "bid", role: "specialist" },
        { product: "bid", role: "finance_ops" },
      ]).ok,
    ).toBe(false);
  });
});
