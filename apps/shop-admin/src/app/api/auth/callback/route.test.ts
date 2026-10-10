import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SHOP_ADMIN_LOGIN_COOKIE,
  SHOP_ADMIN_LOGIN_RETRY_COOKIE,
} from "../../../../lib/session-cookie.js";

const completeStaffLogin = vi.fn();
const cookieStore = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => {
      cookieStore.set(name, { value });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

vi.mock("../../../../server/container", () => ({
  getShopAdminContainer: () => ({
    config: {
      publicOrigin: "https://admin.example.com",
      NODE_ENV: "test",
      sessionTtlSeconds: 3600,
    },
    completeStaffLogin,
    sessions: {},
  }),
}));

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    cookieStore.clear();
    completeStaffLogin.mockReset();
  });

  it("uses publicOrigin for missing pending restart redirect", async () => {
    const { GET } = await import("./route.js");
    const response = await GET(
      new Request("https://internal:3030/api/auth/callback?code=c&state=s"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/api/auth/login?returnTo=/",
    );
    expect(cookieStore.has(SHOP_ADMIN_LOGIN_RETRY_COOKIE)).toBe(true);
  });

  it("shows missing_pending on second attempt without pending cookie", async () => {
    cookieStore.set(SHOP_ADMIN_LOGIN_RETRY_COOKIE, { value: "1" });
    const { GET } = await import("./route.js");
    const response = await GET(
      new Request("https://internal:3030/api/auth/callback?code=c&state=s"),
    );
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/login?error=missing_pending",
    );
  });

  it("uses publicOrigin on auth_failed", async () => {
    cookieStore.set(SHOP_ADMIN_LOGIN_COOKIE, { value: "not-json" });
    const { GET } = await import("./route.js");
    const response = await GET(
      new Request("https://internal:3030/api/auth/callback?code=c&state=s"),
    );
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/login?error=auth_failed",
    );
  });

  it("maps OAuth login_required to mfa_required", async () => {
    cookieStore.set(SHOP_ADMIN_LOGIN_COOKIE, {
      value: JSON.stringify({ state: "s", nonce: "n", codeVerifier: "v", returnTo: "/" }),
    });
    const { GET } = await import("./route.js");
    const response = await GET(
      new Request(
        "https://internal:3030/api/auth/callback?error=login_required&error_description=Silver+ACR+required&state=s",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/login?error=mfa_required",
    );
    expect(cookieStore.has(SHOP_ADMIN_LOGIN_COOKIE)).toBe(false);
  });

  it("maps access_denied", async () => {
    const { GET } = await import("./route.js");
    const response = await GET(
      new Request("https://internal:3030/api/auth/callback?error=access_denied&state=s"),
    );
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/login?error=access_denied",
    );
  });

  it("uses missing_code only when callback has neither code nor error", async () => {
    const { GET } = await import("./route.js");
    const response = await GET(new Request("https://internal:3030/api/auth/callback"));
    expect(response.headers.get("location")).toBe(
      "https://admin.example.com/login?error=missing_code",
    );
  });
});
