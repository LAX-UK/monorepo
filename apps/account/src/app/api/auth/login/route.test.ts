import { LAX_ACCOUNT_LOGIN_COOKIE } from "@/lib/session-cookie";
import { startAccountLogin } from "@/server/application/start-account-login";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    },
    cookies: { sessionCookie: "lax_account_session", secure: true },
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
  const call = cookieSet.mock.calls.find(([name]) => name === LAX_ACCOUNT_LOGIN_COOKIE);
  return JSON.parse(call?.[1] as string);
}

describe("GET /api/auth/login", () => {
  beforeEach(() => {
    sessionGet.mockReset();
    cookieSet.mockReset();
    cookieValues.clear();
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
