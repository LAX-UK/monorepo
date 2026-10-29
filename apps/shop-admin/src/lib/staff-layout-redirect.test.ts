import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { resolveStaffLayoutRedirect, staffSignInHref } from "./staff-layout-redirect";

describe("resolveStaffLayoutRedirect", () => {
  const session = {
    subject: "sub",
    role: "shop_admin",
    roles: ["shop_admin"],
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

describe("staffSignInHref", () => {
  it("sends an account that is not staff to the sign-in error page", () => {
    expect(
      staffSignInHref({ action: "reauth", returnTo: "/orders", reason: "not_authorized" }),
    ).toBe("/login?error=not_authorized&returnTo=%2Forders");
  });

  it("starts sign-in with a GET that does not end the session", () => {
    const href = staffSignInHref({ action: "reauth", returnTo: "/orders" });
    expect(href).toBe("/api/auth/login?returnTo=%2Forders");
    expect(href).not.toContain("reauth");
  });
});
