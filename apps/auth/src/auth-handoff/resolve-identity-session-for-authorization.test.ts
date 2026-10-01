import { describe, expect, it, vi } from "vitest";
import {
  buildSessionLookupCookieHeader,
  resolveIdentitySessionForAuthorization,
} from "./resolve-identity-session-for-authorization.js";

function firstWinsGetSession(headers: Headers) {
  const cookie = headers.get("cookie") ?? "";
  const tokenMatch = cookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
  if (!tokenMatch) return { session: null };
  const token = tokenMatch[1];
  if (token === "stale-token") return { session: null };
  if (token === "fresh-token") return { session: { id: "identity-session-1" } };
  return { session: null };
}

describe("buildSessionLookupCookieHeader", () => {
  it("prefers fresh session_token over a stale incoming token (first-wins parse)", () => {
    const request = new Headers({
      cookie:
        "better-auth.session_token=stale-token; __Secure-better-auth.session_data=stale-cache",
    });
    const { headers, strippedStale, sessionSource } = buildSessionLookupCookieHeader(request, [
      "better-auth.session_token=fresh-token; Path=/; HttpOnly",
    ]);
    expect(strippedStale).toBe(true);
    expect(sessionSource).toBe("fresh");
    expect(headers.get("cookie")).toMatch(/better-auth\.session_token=fresh-token/);
    expect(headers.get("cookie")).not.toMatch(/stale-token/);
    expect(headers.get("cookie")).not.toMatch(/session_data/);
    expect(firstWinsGetSession(headers).session?.id).toBe("identity-session-1");
  });

  it("leaves the incoming header unchanged when no fresh cookies were issued", () => {
    const request = new Headers({ cookie: "better-auth.session_token=only-token" });
    const { headers, sessionSource, strippedStale } = buildSessionLookupCookieHeader(request, []);
    expect(sessionSource).toBe("incoming");
    expect(strippedStale).toBe(false);
    expect(headers.get("cookie")).toBe("better-auth.session_token=only-token");
  });
});

describe("resolveIdentitySessionForAuthorization", () => {
  it("resolves session id when fresh cookie wins", async () => {
    const getSession = vi.fn(async (headers: Headers) => firstWinsGetSession(headers));
    const result = await resolveIdentitySessionForAuthorization({
      getSession,
      requestHeaders: new Headers({
        cookie: "better-auth.session_token=stale-token",
      }),
      setCookieHeaders: ["better-auth.session_token=fresh-token; Path=/; HttpOnly"],
    });
    expect(result.identitySessionId).toBe("identity-session-1");
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
