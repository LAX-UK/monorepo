import { describe, expect, it } from "vitest";
import { SHOP_ADMIN_SESSION_COOKIE_NAMES, shopAdminSessionCookie } from "./session-cookie";

describe("shopAdminSessionCookie", () => {
  it("uses the __Host- prefix only in production, where the cookie is Secure", () => {
    expect(shopAdminSessionCookie({ NODE_ENV: "production" })).toBe(
      "__Host-lax-shop-admin-session",
    );
    expect(shopAdminSessionCookie({ NODE_ENV: "development" })).toBe("lax-shop-admin-session");
    expect(shopAdminSessionCookie({ NODE_ENV: "test" })).toBe("lax-shop-admin-session");
  });

  it("lets the middleware recognise the name of every environment", () => {
    for (const env of ["production", "development", "test"]) {
      expect(SHOP_ADMIN_SESSION_COOKIE_NAMES).toContain(shopAdminSessionCookie({ NODE_ENV: env }));
    }
  });
});
