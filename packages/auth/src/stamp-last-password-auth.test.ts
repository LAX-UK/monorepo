import { describe, expect, it, vi } from "vitest";
import type { SessionStampStore } from "./ports/session-stamp-store.js";
import {
  stampLastPasswordAuthFromSignInResponse,
  stampMfaCompletedFromResponse,
} from "./stamp-last-password-auth.js";

function responseWithSessionCookie(token: string): Response {
  return new Response(null, {
    status: 200,
    headers: {
      "set-cookie": `__Secure-better-auth.session_token=${encodeURIComponent(token)}; Path=/; HttpOnly`,
    },
  });
}

describe("stampMfaCompletedFromResponse", () => {
  it("stamps the session token from Set-Cookie after TOTP verify", async () => {
    const stampMfaCompleted = vi.fn(async () => undefined);
    const store = { stampMfaCompleted, stampPasswordAuth: vi.fn() } satisfies SessionStampStore;

    await stampMfaCompletedFromResponse(store, responseWithSessionCookie("rotated-session-token"));

    expect(stampMfaCompleted).toHaveBeenCalledOnce();
    expect(stampMfaCompleted.mock.calls[0]?.[0]).toBe("rotated-session-token");
    expect(stampMfaCompleted.mock.calls[0]?.[1]).toBeInstanceOf(Date);
  });

  it("no-ops when the response has no session cookie", async () => {
    const stampMfaCompleted = vi.fn(async () => undefined);
    const store = { stampMfaCompleted, stampPasswordAuth: vi.fn() } satisfies SessionStampStore;

    await stampMfaCompletedFromResponse(store, new Response(null, { status: 200 }));

    expect(stampMfaCompleted).not.toHaveBeenCalled();
  });
});

describe("stampLastPasswordAuthFromSignInResponse", () => {
  it("stamps password auth from sign-in Set-Cookie", async () => {
    const stampPasswordAuth = vi.fn(async () => undefined);
    const store = { stampPasswordAuth, stampMfaCompleted: vi.fn() } satisfies SessionStampStore;

    await stampLastPasswordAuthFromSignInResponse(
      store,
      responseWithSessionCookie("fresh-session"),
    );

    expect(stampPasswordAuth).toHaveBeenCalledWith("fresh-session", expect.any(Date));
  });
});
