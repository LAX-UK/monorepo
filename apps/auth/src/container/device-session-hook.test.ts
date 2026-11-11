import { describe, expect, it, vi } from "vitest";
import {
  DEVICE_MARKER_COOKIE,
  DeviceMarkerHasher,
  mintDeviceMarker,
} from "../services/device-marker.js";
import { createDeviceSessionHook, normaliseCountry } from "./device-session-hook.js";

const hasher = new DeviceMarkerHasher({ secret: "k".repeat(32), fallbackSecret: "f".repeat(32) });

function setup(sessions: { request?: string | null; response?: string | null } = {}) {
  const takeOver = vi.fn(async () => undefined);
  const log = { warn: vi.fn(), error: vi.fn() };
  const readSession = vi.fn(async (headers: Headers) => {
    const cookie = headers.get("cookie") ?? "";
    const id = cookie.includes("session_token=new") ? sessions.response : sessions.request;
    return id ? { id } : null;
  });
  const hook = createDeviceSessionHook({ takeover: { takeOver }, hasher, readSession, log });
  return { hook, takeOver, log, readSession };
}

const signedIn = (token = "new.sig", extra: string[] = []) => {
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", `better-auth.session_token=${token}; Path=/; HttpOnly`);
  for (const cookie of extra) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};

const requestAt = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  new Request(`https://auth.test${path}`, {
    method: "POST",
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  });

const markerCookieOf = (response: Response) =>
  response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${DEVICE_MARKER_COOKIE}=`));

describe("device session hook", () => {
  // One rule for every way of signing in: the path never matters, only that a session cookie is set.
  it.each([
    "/api/auth/sign-in/email",
    "/api/auth/sign-in/social",
    "/api/auth/magic-link/verify",
    "/api/auth/verify-email",
    "/api/auth/callback/google",
    "/api/auth/callback/apple",
    "/api/auth/two-factor/verify-totp",
    "/api/auth/two-factor/verify-backup-code",
    "/api/auth/passkey/verify-authentication",
  ])("takes the browser's record over for a sign-in at %s", async (path) => {
    const { hook, takeOver } = setup({ request: "old", response: "new" });
    await hook({
      request: requestAt(path, "better-auth.session_token=old.sig"),
      response: signedIn(),
      path,
    });
    expect(takeOver).toHaveBeenCalledWith(
      expect.objectContaining({ newSessionId: "new", previousSessionId: "old" }),
    );
  });

  it("gives a new browser a marker and stores only its hash", async () => {
    const { hook, takeOver } = setup({ response: "new" });
    const response = await hook({
      request: requestAt("/api/auth/sign-in/email"),
      response: signedIn(),
      path: "/api/auth/sign-in/email",
    });
    const cookie = markerCookieOf(response) ?? "";
    const marker = /__Host-lax_device=([^;]+)/.exec(cookie)?.[1] ?? "";
    expect(marker).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(cookie).toMatch(/Secure; HttpOnly; SameSite=Lax/);
    const call = (takeOver.mock.calls[0] as unknown as [{ deviceHash: string }])[0];
    expect(call.deviceHash).toBe(hasher.hash(marker));
    expect(call.deviceHash).not.toContain(marker);
  });

  it("recognises the same browser by its marker and renews it", async () => {
    const marker = mintDeviceMarker();
    const { hook, takeOver } = setup({ response: "new" });
    const response = await hook({
      request: requestAt("/api/auth/sign-in/email", `${DEVICE_MARKER_COOKIE}=${marker}`),
      response: signedIn(),
      path: "/api/auth/sign-in/email",
    });
    expect(markerCookieOf(response)).toContain(`${DEVICE_MARKER_COOKIE}=${marker};`);
    expect(takeOver).toHaveBeenCalledWith(
      expect.objectContaining({ deviceHash: hasher.hash(marker), previousSessionId: null }),
    );
  });

  it("replaces a marker it did not make instead of trusting it", async () => {
    const { hook } = setup({ response: "new" });
    const response = await hook({
      request: requestAt("/api/auth/sign-in/email", `${DEVICE_MARKER_COOKIE}=forged`),
      response: signedIn(),
      path: "/api/auth/sign-in/email",
    });
    expect(markerCookieOf(response)).not.toContain("forged");
  });

  it("keeps the response, its body and its other cookies intact", async () => {
    const { hook } = setup({ response: "new" });
    const response = await hook({
      request: requestAt("/api/auth/sign-in/email"),
      response: signedIn("new.sig", ["better-auth.session_data=cache; Path=/"]),
      path: "/api/auth/sign-in/email",
    });
    expect(await response.json()).toEqual({ ok: true });
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((cookie) => cookie.startsWith("better-auth.session_token="))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith("better-auth.session_data="))).toBe(true);
  });

  it("does nothing when the response sets the session cookie the request already had", async () => {
    const { hook, takeOver } = setup({ request: "same", response: "same" });
    const response = await hook({
      request: requestAt("/api/auth/get-session", "better-auth.session_token=new.sig"),
      response: signedIn("new.sig"),
      path: "/api/auth/get-session",
    });
    expect(takeOver).not.toHaveBeenCalled();
    expect(markerCookieOf(response)).toBeUndefined();
  });

  it("does nothing when the new record is the one the browser already used", async () => {
    const { hook, takeOver } = setup({ request: "new", response: "new" });
    await hook({
      request: requestAt("/api/auth/sign-in/email", "better-auth.session_token=other"),
      response: signedIn(),
      path: "/api/auth/sign-in/email",
    });
    expect(takeOver).not.toHaveBeenCalled();
  });

  it("leaves failed requests and cookie-less responses untouched", async () => {
    const { hook, takeOver } = setup({ response: "new" });
    const failed = Response.json({ code: "INVALID" }, { status: 401 });
    const clearing = new Response(null, {
      headers: { "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/" },
    });
    expect(await hook({ request: requestAt("/a"), response: failed, path: "/a" })).toBe(failed);
    expect(await hook({ request: requestAt("/a"), response: clearing, path: "/a" })).toBe(clearing);
    expect(takeOver).not.toHaveBeenCalled();
  });

  it("renews the marker on a browser request that carries one, without a sign-in", async () => {
    const marker = mintDeviceMarker();
    const { hook, takeOver } = setup();
    const response = await hook({
      request: requestAt("/api/auth/get-session", `${DEVICE_MARKER_COOKIE}=${marker}`),
      response: Response.json({ session: null }),
      path: "/api/auth/get-session",
    });
    expect(markerCookieOf(response)).toContain(marker);
    expect(takeOver).not.toHaveBeenCalled();
  });

  it("never fails the sign-in when taking over fails, and says so", async () => {
    const { hook, takeOver, log } = setup({ response: "new" });
    takeOver.mockRejectedValueOnce(new Error("db down"));
    const response = await hook({
      request: requestAt("/api/auth/sign-in/email"),
      response: signedIn(),
      path: "/api/auth/sign-in/email",
    });
    expect(response.status).toBe(200);
    expect(markerCookieOf(response)).toBeDefined();
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ effect: "session_takeover", errorMessage: "db down" }),
      "auth_security_effect_failed",
    );
  });

  it("stores the edge's country, and only a real one", async () => {
    const { hook, takeOver } = setup({ response: "new" });
    await hook({
      request: requestAt("/api/auth/sign-in/email", undefined, { "cf-ipcountry": "gb" }),
      response: signedIn(),
      path: "/api/auth/sign-in/email",
    });
    expect(takeOver).toHaveBeenCalledWith(expect.objectContaining({ country: "GB" }));
  });
});

describe("normaliseCountry", () => {
  it("keeps a two-letter code and drops unknown or masked ones", () => {
    expect(normaliseCountry("fr")).toBe("FR");
    expect(normaliseCountry(" GB ")).toBe("GB");
    expect(normaliseCountry("XX")).toBeNull();
    expect(normaliseCountry("T1")).toBeNull();
    expect(normaliseCountry("GBR")).toBeNull();
    expect(normaliseCountry(null)).toBeNull();
  });
});
