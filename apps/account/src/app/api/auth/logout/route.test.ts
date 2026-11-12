import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = { values: new Map<string, string>(), set: vi.fn() };
const sessions = { get: vi.fn(), delete: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: cookieJar.set,
  }),
}));
vi.mock("@/server/container", () => ({
  getLaxAccountContainer: () => ({
    config: {
      publicOrigin: "https://account.lax.test",
      oidcIssuer: "https://auth.lax.test",
      oidcClientId: "lax-account-web",
    },
    cookies: { secure: true, sessionCookie: "__Host-lax-account" },
    sessions,
  }),
}));

import { POST } from "./route";

const request = () =>
  new Request("https://account.lax.test/api/auth/logout", {
    method: "POST",
    headers: { origin: "https://account.lax.test" },
  });

describe("LAX Account sign-out", () => {
  beforeEach(() => {
    cookieJar.values.clear();
    cookieJar.set.mockClear();
    sessions.get.mockReset();
    sessions.delete.mockReset();
  });

  it("refuses a request from another origin", async () => {
    const response = await POST(
      new Request("https://account.lax.test/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("asks the issuer to end this sign-in with the ID token it holds", async () => {
    cookieJar.values.set("__Host-lax-account", "sid-1");
    sessions.get.mockResolvedValue({ idToken: "the.id.token" });

    const response = await POST(request());

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe(
      "https://auth.lax.test/api/auth/oauth2/endsession",
    );
    expect(location.searchParams.get("id_token_hint")).toBe("the.id.token");
    expect(location.searchParams.get("client_id")).toBe("lax-account-web");
  });

  it("still asks the issuer to end this browser's sign-in when the session store is down", async () => {
    cookieJar.values.set("__Host-lax-account", "sid-1");
    sessions.get.mockRejectedValue(new Error("redis down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/api/auth/oauth2/endsession");
    expect(location.searchParams.has("id_token_hint")).toBe(false);
    expect(location.searchParams.get("client_id")).toBe("lax-account-web");
    expect(location.searchParams.get("post_logout_redirect_uri")).toBe("https://account.lax.test/");
    expect(cookieJar.set).toHaveBeenCalledWith(
      "__Host-lax-account",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it("goes home without asking the issuer when there is no sign-in here", async () => {
    const response = await POST(request());
    expect(response.headers.get("location")).toBe("https://account.lax.test/");
  });
});
