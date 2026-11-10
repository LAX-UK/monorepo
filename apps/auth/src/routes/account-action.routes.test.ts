import { describe, expect, it, vi } from "vitest";
import { createAccountActionRoutes, returnWordForProviderError } from "./account-action.routes.js";

const ACCOUNT = "https://account.test";
const SECRET = "s".repeat(43);

function setup(
  overrides: {
    redeem?: unknown;
    session?: { session: { id: string }; user: { id: string } } | null;
    isLinked?: boolean;
    wait?: number | null;
    startLink?: () => Promise<{ url: string; cookies: string[] }>;
  } = {},
) {
  const actions = {
    redeem: vi
      .fn()
      .mockResolvedValue(overrides.redeem ?? { ok: true, action: "google", subjectId: "u1" }),
    isLinked: vi.fn().mockResolvedValue(overrides.isLinked ?? true),
  };
  const startLink = vi.fn(
    overrides.startLink ??
      (async () => ({
        url: "https://accounts.google.test/auth?state=abc",
        cookies: ["state=abc; Path=/; HttpOnly", "verifier=def; Path=/; HttpOnly"],
      })),
  );
  const onFailure = vi.fn();
  const app = createAccountActionRoutes({
    actions,
    getSession: async () =>
      overrides.session === undefined
        ? { session: { id: "sid-1" }, user: { id: "u1" } }
        : overrides.session,
    startLink,
    accountOrigin: ACCOUNT,
    rateLimit: async () => overrides.wait ?? null,
    clientKey: () => "203.0.113.7",
    onFailure,
  });
  return { app, actions, startLink, onFailure };
}

const back = (word: string, provider?: string) =>
  `${ACCOUNT}/account/security?signInMethod=${word}${provider ? `&provider=${provider}` : ""}`;

describe("GET /account-action", () => {
  it("spends the ticket and sends the browser to the provider, with the round trip's cookies", async () => {
    const { app, actions, startLink } = setup();
    const response = await app.request(`/account-action?ticket=${SECRET}`);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://accounts.google.test/auth?state=abc");
    expect(response.headers.getSetCookie()).toEqual([
      "state=abc; Path=/; HttpOnly",
      "verifier=def; Path=/; HttpOnly",
    ]);
    expect(actions.redeem).toHaveBeenCalledWith(SECRET, { id: "sid-1", userId: "u1" });
    expect(startLink).toHaveBeenCalledWith("google", expect.any(Headers));
  });

  it("is never cached, and never leaks the ticket in a referrer", async () => {
    const { app } = setup();
    const response = await app.request(`/account-action?ticket=${SECRET}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("returns to Security as expired for a missing or malformed ticket, without asking the service", async () => {
    const { app, actions } = setup();
    for (const path of [
      "/account-action",
      "/account-action?ticket=short",
      `/account-action?ticket=${SECRET}x`,
    ]) {
      const response = await app.request(path);
      expect(response.headers.get("location")).toBe(back("expired"));
    }
    expect(actions.redeem).not.toHaveBeenCalled();
  });

  it.each(["expired", "reauth_required", "staff_not_allowed", "provider_unavailable"] as const)(
    "returns to Security with %s when the ticket cannot be used",
    async (code) => {
      const { app, startLink } = setup({ redeem: { ok: false, code } });
      const response = await app.request(`/account-action?ticket=${SECRET}`);
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(back(code));
      expect(startLink).not.toHaveBeenCalled();
    },
  );

  it("names the provider when the refused ticket was for one", async () => {
    const { app } = setup({ redeem: { ok: false, code: "reauth_required", provider: "apple" } });
    const response = await app.request(`/account-action?ticket=${SECRET}`);
    expect(response.headers.get("location")).toBe(back("reauth_required", "apple"));
  });

  it("passes the browser's session, or none, to the service", async () => {
    const { app, actions } = setup({ session: null });
    await app.request(`/account-action?ticket=${SECRET}`);
    expect(actions.redeem).toHaveBeenCalledWith(SECRET, null);
  });

  it("calls a provider linked in another tab done", async () => {
    const { app } = setup({ redeem: { ok: false, code: "already_done", provider: "apple" } });
    const response = await app.request(`/account-action?ticket=${SECRET}`);
    expect(response.headers.get("location")).toBe(back("apple_linked"));
  });

  it("sends a spent passkey ticket to the issuer's own passkey page, starting no provider", async () => {
    const { app, startLink } = setup({ redeem: { ok: true, action: "passkey", subjectId: "u1" } });
    const response = await app.request(`/account-action?ticket=${SECRET}`);
    expect(response.headers.get("location")).toBe("/account-action/passkey");
    expect(startLink).not.toHaveBeenCalled();
  });

  it("returns to Security as rate limited, before anything is spent", async () => {
    const { app, actions } = setup({ wait: 30 });
    const response = await app.request(`/account-action?ticket=${SECRET}`);
    expect(response.headers.get("location")).toBe(back("rate_limited"));
    expect(actions.redeem).not.toHaveBeenCalled();
  });

  it("returns to Security with a fixed word, and reports it, when the provider cannot be started", async () => {
    const { app, onFailure } = setup({
      startLink: async () => {
        throw new Error("provider secret leaked in here");
      },
    });
    const response = await app.request(`/account-action?ticket=${SECRET}`);
    expect(response.headers.get("location")).toBe(back("provider_unavailable"));
    expect(response.headers.get("location")).not.toContain("secret");
    expect(onFailure).toHaveBeenCalled();
  });
});

describe("GET /account-action/done", () => {
  it("returns to Security as linked when the account now has the provider", async () => {
    const { app, actions } = setup({ isLinked: true });
    const response = await app.request("/account-action/done?provider=apple");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(back("apple_linked"));
    expect(actions.isLinked).toHaveBeenCalledWith("u1", "apple");
  });

  it("never believes the address: a visit with nothing linked is 'provider_unavailable'", async () => {
    const { app } = setup({ isLinked: false });
    const response = await app.request("/account-action/done?provider=google");
    expect(response.headers.get("location")).toBe(back("provider_unavailable", "google"));
  });

  it.each([
    ["account_already_linked_to_different_user", "already_linked_elsewhere"],
    ["access_denied", "cancelled"],
    ["user_cancelled_authorize", "cancelled"],
    ["unable_to_link_account", "provider_unavailable"],
    ["email_doesn't_match", "provider_unavailable"],
    ["<script>alert(1)</script>", "provider_unavailable"],
  ])("turns the provider's %s into the fixed word %s", async (error, word) => {
    const { app, actions } = setup();
    const response = await app.request(
      `/account-action/done?provider=google&error=${encodeURIComponent(error)}`,
    );
    expect(response.headers.get("location")).toBe(back(word, "google"));
    expect(actions.isLinked).not.toHaveBeenCalled();
  });

  it("asks for a sign-in again when the browser has no session", async () => {
    const { app } = setup({ session: null });
    const response = await app.request("/account-action/done?provider=google");
    expect(response.headers.get("location")).toBe(back("reauth_required", "google"));
  });

  it("refuses a provider it does not know, and a missing one", async () => {
    const { app } = setup();
    for (const path of ["/account-action/done", "/account-action/done?provider=github"]) {
      expect((await app.request(path)).headers.get("location")).toBe(back("provider_unavailable"));
    }
  });

  it("only ever returns to Account's Security page, whatever the request says", async () => {
    const { app } = setup();
    const response = await app.request(
      "/account-action/done?provider=google&returnTo=https://evil.test&redirect=https://evil.test&next=//evil.test",
    );
    const target = new URL(response.headers.get("location") ?? "");
    expect(target.origin).toBe(ACCOUNT);
    expect(target.pathname).toBe("/account/security");
    // A success carries only its word, which already names the provider.
    expect([...target.searchParams.keys()]).toEqual(["signInMethod"]);
  });

  it("adds only a known provider to an error return, never anything from the request", async () => {
    const { app } = setup({ isLinked: false });
    const response = await app.request(
      "/account-action/done?provider=google&error=x&returnTo=https://evil.test",
    );
    const target = new URL(response.headers.get("location") ?? "");
    expect([...target.searchParams.keys()]).toEqual(["signInMethod", "provider"]);
    expect(target.searchParams.get("provider")).toBe("google");
  });

  it("is never cached and returns rate limited before reading anything", async () => {
    const { app, actions } = setup({ wait: 10 });
    const response = await app.request("/account-action/done?provider=google");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBe(back("rate_limited"));
    expect(actions.isLinked).not.toHaveBeenCalled();
  });
});

describe("returnWordForProviderError", () => {
  it("maps nothing but the known errors, and everything else to unavailable", () => {
    expect(returnWordForProviderError(undefined)).toBe("provider_unavailable");
    expect(returnWordForProviderError("cancelled")).toBe("cancelled");
    expect(returnWordForProviderError("anything else")).toBe("provider_unavailable");
  });
});
