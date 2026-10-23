import { beforeEach, describe, expect, it, vi } from "vitest";

const sessions = { get: vi.fn() };
const cookieValue = vi.fn<() => string | undefined>();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: cookieValue() }) }),
}));
vi.mock("../container", () => ({
  getLaxAccountContainer: () => ({
    cookies: { sessionCookie: "account_session" },
    config: { sessionTtlSeconds: 600 },
    sessions,
    tokenEndpoint: { requestToken: vi.fn() },
  }),
}));

const { loadAccountSession } = await import("./load-account-session");

describe("loadAccountSession", () => {
  beforeEach(() => {
    sessions.get.mockReset();
    cookieValue.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("is unsigned without a session cookie", async () => {
    cookieValue.mockReturnValue(undefined);
    await expect(loadAccountSession()).resolves.toEqual({ status: "unsigned" });
    expect(sessions.get).not.toHaveBeenCalled();
  });

  it("is unsigned when the session no longer exists", async () => {
    cookieValue.mockReturnValue("sid-1");
    sessions.get.mockResolvedValue(null);
    await expect(loadAccountSession()).resolves.toEqual({ status: "unsigned" });
  });

  it("reports unavailable, not signed out, when the session store throws", async () => {
    cookieValue.mockReturnValue("sid-1");
    sessions.get.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:6379"));
    await expect(loadAccountSession()).resolves.toEqual({ status: "unavailable" });
  });
});
