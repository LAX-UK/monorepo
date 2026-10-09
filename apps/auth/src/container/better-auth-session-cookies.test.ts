import { describe, expect, it } from "vitest";
import {
  buildSessionDataClearSetCookies,
  stripBetterAuthSessionCookies,
  withSessionDataClearedOnLogout,
} from "./better-auth-session-cookies.js";

describe("better-auth session cookies", () => {
  it("strips session_token and session_data including chunked names", () => {
    const raw =
      "better-auth.session_token=old; better-auth.session_data=cache; better-auth.session_data.0=chunk; shop=keep";
    expect(stripBetterAuthSessionCookies(raw)).toBe("shop=keep");
  });

  it("appends session_data expiry when session_token is cleared on logout", () => {
    const response = new Response(null, {
      status: 302,
      headers: {
        "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly",
      },
    });
    const next = withSessionDataClearedOnLogout(response, "/api/auth/sign-out");
    const cookies = next.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c) => c.startsWith("better-auth.session_data=; Max-Age=0"))).toBe(true);
    expect(buildSessionDataClearSetCookies(response).length).toBeGreaterThan(0);
  });
});
