import { sealPendingLogin } from "@/lib/pending-login-cookie";
import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "k".repeat(32);
const NAME = "__Host-lax-account-login";
const cookieValues = new Map<string, string>();
const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const completeAccountLogin = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined),
    set: cookieSet,
    delete: cookieDelete,
  }),
}));
vi.mock("@/server/container", () => ({
  getLaxAccountContainer: () => ({
    config: {
      publicOrigin: "https://account.test",
      sessionEncryptionKey: KEY,
      sessionTtlSeconds: 600,
    },
    cookies: { sessionCookie: "__Host-lax-account-session", loginCookie: NAME, secure: true },
    sessions: {},
    completeAccountLogin,
  }),
}));

const { GET } = await import("./route");

const pending = JSON.stringify({
  state: "st",
  nonce: "n",
  codeVerifier: "v",
  returnTo: "/account",
});
const callback = () => GET(new Request("https://account.test/api/auth/callback?code=c&state=st"));
const restarted = (response: Response) =>
  (response.headers.get("location") ?? "").includes("/api/auth/login");

describe("GET /api/auth/callback pending-login cookie", () => {
  beforeEach(() => {
    cookieValues.clear();
    cookieSet.mockReset();
    cookieDelete.mockReset();
    completeAccountLogin.mockReset();
    completeAccountLogin.mockResolvedValue({ sessionId: "sess", returnTo: "/account" });
  });

  it("completes the sign-in from a correctly signed cookie", async () => {
    cookieValues.set(NAME, sealPendingLogin(pending, KEY));
    const response = await callback();
    expect(completeAccountLogin).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe("https://account.test/account");
  });

  it("restarts sign-in, without exchanging the code, for a tampered cookie", async () => {
    const [, sig] = sealPendingLogin(pending, KEY).split(".") as [string, string];
    const forged = Buffer.from(pending.replace('"st"', '"zz"')).toString("base64url");
    cookieValues.set(NAME, `${forged}.${sig}`);
    const response = await callback();
    expect(restarted(response)).toBe(true);
    expect(completeAccountLogin).not.toHaveBeenCalled();
  });

  it("restarts sign-in for an unsigned plain-JSON value", async () => {
    cookieValues.set(NAME, pending);
    expect(restarted(await callback())).toBe(true);
    expect(completeAccountLogin).not.toHaveBeenCalled();
  });

  it("ignores a value under the old unprefixed name", async () => {
    cookieValues.set("lax-account-login-pending", pending);
    expect(restarted(await callback())).toBe(true);
    expect(completeAccountLogin).not.toHaveBeenCalled();
  });
});
