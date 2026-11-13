import { openPendingLogin } from "@/lib/pending-login-cookie";
import { startAccountLogin } from "@/server/application/start-account-login";
import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "k".repeat(32);
const sessionGet = vi.fn();
const cookieValues = new Map<string, string>();
const cookieSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined),
    set: cookieSet,
  }),
}));
vi.mock("@/server/container", () => ({
  getLaxAccountContainer: () => ({
    config: {
      publicOrigin: "https://account.test",
      oidcIssuer: "https://auth.test",
      oidcClientId: "lax-account-web",
      sessionEncryptionKey: KEY,
    },
    cookies: {
      sessionCookie: "lax_account_session",
      loginCookie: "__Host-lax-account-login",
      secure: true,
    },
    sessions: { get: sessionGet },
    startAccountLogin,
  }),
}));

const { GET } = await import("./route");

const reauth = (extra = "") =>
  GET(
    new Request(
      `https://account.test/api/auth/login?intent=reauth&returnTo=/account/security${extra}`,
    ),
  );

function pendingSaved(): Record<string, unknown> {
  const call = cookieSet.mock.calls.find(([name]) => name === "__Host-lax-account-login");
  return JSON.parse(openPendingLogin(call?.[1] as string, KEY) as string);
}

describe("GET /api/auth/login", () => {
  beforeEach(() => {
    sessionGet.mockReset();
    cookieSet.mockReset();
    cookieValues.clear();
  });

  it("stores the pending sign-in signed, under a __Host- name, Secure, Path=/ and no Domain", async () => {
    await GET(new Request("https://account.test/api/auth/login?returnTo=/account"));
    const call = cookieSet.mock.calls.find(([name]) => name === "__Host-lax-account-login");
    expect(call?.[1]).not.toContain("{");
    expect(call?.[2]).toMatchObject({ secure: true, path: "/", httpOnly: true });
    expect(call?.[2]).not.toHaveProperty("domain");
    expect(cookieSet.mock.calls.some(([name]) => name === "lax-account-login-pending")).toBe(false);
  });

  it("asks for a fresh sign-in on behalf of the person signed in here, and remembers who", async () => {
    cookieValues.set("lax_account_session", "sess-1");
    sessionGet.mockResolvedValue({ subject: "user-a" });
    const response = await reauth();
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("prompt")).toBe(
      "login",
    );
    expect(pendingSaved()).toMatchObject({ reauth: true, reauthSubject: "user-a" });
  });

  it("tells the sign-in page why, from the fixed list of reasons", async () => {
    cookieValues.set("lax_account_session", "sess-1");
    sessionGet.mockResolvedValue({ subject: "user-a" });
    const response = await reauth("&reason=add_sign_in_method");
    const url = new URL(response.headers.get("location") ?? "");
    expect(url.searchParams.get("reauth_reason")).toBe("add_sign_in_method");
    expect(url.searchParams.get("prompt")).toBe("login");
  });

  it("drops a reason that is not on the list instead of passing it on", async () => {
    cookieValues.set("lax_account_session", "sess-1");
    sessionGet.mockResolvedValue({ subject: "user-a" });
    for (const reason of ["<script>alert(1)</script>", "delete_account", ""]) {
      const response = await reauth(`&reason=${encodeURIComponent(reason)}`);
      expect(
        new URL(response.headers.get("location") ?? "").searchParams.has("reauth_reason"),
      ).toBe(false);
    }
  });

  it("does not pass a reason on to an ordinary sign-in", async () => {
    const response = await GET(
      new Request(
        "https://account.test/api/auth/login?returnTo=/account&reason=add_sign_in_method",
      ),
    );
    expect(new URL(response.headers.get("location") ?? "").searchParams.has("reauth_reason")).toBe(
      false,
    );
  });

  it("starts an ordinary sign-in, not a step-up, when there is no session here", async () => {
    const response = await reauth();
    expect(new URL(response.headers.get("location") ?? "").searchParams.has("prompt")).toBe(false);
    expect(pendingSaved().reauth).toBeUndefined();
    expect(sessionGet).not.toHaveBeenCalled();
  });

  it("starts an ordinary sign-in when the session store cannot be read", async () => {
    cookieValues.set("lax_account_session", "sess-1");
    sessionGet.mockRejectedValue(new Error("redis down"));
    const response = await reauth();
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(pendingSaved().reauth).toBeUndefined();
    expect(pendingSaved().reauthSubject).toBeUndefined();
  });

  it("does not look at the session for an ordinary sign-in", async () => {
    cookieValues.set("lax_account_session", "sess-1");
    await GET(new Request("https://account.test/api/auth/login?returnTo=/account"));
    expect(sessionGet).not.toHaveBeenCalled();
    expect(pendingSaved().reauth).toBeUndefined();
  });
});
