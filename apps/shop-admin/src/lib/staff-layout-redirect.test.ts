import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { resolveStaffLayoutRedirect, staffReauthHref } from "./staff-layout-redirect";

describe("resolveStaffLayoutRedirect", () => {
  const session = {
    subject: "sub",
    role: "shop_admin",
    capabilities: [],
    features: {
      payouts: false,
      thirdPartySales: false,
      originalSales: false,
      merchandise: false,
    },
  };

  it("renders when session is ok", () => {
    expect(resolveStaffLayoutRedirect({ status: "ok", data: session }, "/orders")).toEqual({
      action: "render",
    });
  });

  it("reauths on unauthorized with sanitized return path", () => {
    expect(resolveStaffLayoutRedirect({ status: "unauthorized" }, "/orders?tab=1")).toEqual({
      action: "reauth",
      returnTo: "/orders?tab=1",
    });
  });

  it("reauths with not_authorized reason for staff_required", () => {
    expect(
      resolveStaffLayoutRedirect(
        { status: "forbidden", code: SHOP_API_ERROR_CODES.STAFF_REQUIRED },
        "/overview",
      ),
    ).toEqual({ action: "reauth", returnTo: "/overview", reason: "not_authorized" });
  });

  it("reauths on step_up_required", () => {
    expect(
      resolveStaffLayoutRedirect(
        { status: "forbidden", code: SHOP_API_ERROR_CODES.STEP_UP_REQUIRED },
        "//evil",
      ),
    ).toEqual({ action: "reauth", returnTo: "/overview" });
  });

  it("fails on unknown forbidden codes", () => {
    expect(
      resolveStaffLayoutRedirect({ status: "forbidden", code: "shop.internal" }, "/x"),
    ).toEqual({ action: "fail", detail: "forbidden:shop.internal" });
  });
});

describe("staffReauthHref", () => {
  it("includes reason when not authorized", () => {
    expect(
      staffReauthHref({ action: "reauth", returnTo: "/orders", reason: "not_authorized" }),
    ).toBe("/api/auth/reauth?returnTo=%2Forders&reason=not_authorized");
  });
});
