import { afterEach, describe, expect, it, vi } from "vitest";
import { TRUSTED_CLIENT_IP_HEADER } from "./client-ip-headers.js";
import {
  isSignInEmailPost,
  isSignInMagicLinkPost,
  runSignInTurnstileGate,
} from "./sign-in-turnstile-gate.js";

describe("isSignInEmailPost", () => {
  it("matches Better Auth email sign-in path", () => {
    expect(
      isSignInEmailPost(
        new Request("https://api.example.com/api/auth/sign-in/email", { method: "POST" }),
      ),
    ).toBe(true);
  });

  it("ignores other routes", () => {
    expect(
      isSignInEmailPost(
        new Request("https://api.example.com/api/auth/session", { method: "POST" }),
      ),
    ).toBe(false);
  });
});

describe("isSignInMagicLinkPost", () => {
  it("matches Better Auth magic-link sign-in path", () => {
    expect(
      isSignInMagicLinkPost(
        new Request("https://api.example.com/api/auth/sign-in/magic-link", { method: "POST" }),
      ),
    ).toBe(true);
  });
});

describe("runSignInTurnstileGate failure counter", () => {
  it("increments on 401 but not on 403", async () => {
    const redis = {
      get: vi.fn().mockResolvedValue("0"),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn(),
      del: vi.fn(),
    };
    const authHandler = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "bad password" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "email not verified" }), { status: 403 }),
      );

    await runSignInTurnstileGate({
      incoming: new Request("https://auth.example.com/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "wrong" }),
      }),
      redis,
      turnstileSecret: "secret",
      authHandler,
    });

    await runSignInTurnstileGate({
      incoming: new Request("https://auth.example.com/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "wrong" }),
      }),
      redis,
      turnstileSecret: "secret",
      authHandler,
    });

    expect(redis.incr).toHaveBeenCalledTimes(1);
  });
});

describe("runSignInTurnstileGate remote address", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function siteverifyRemoteIp(headers: Record<string, string>): Promise<string | null> {
    const fetchMock = vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
      void init;
      return Response.json({ success: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    await runSignInTurnstileGate({
      incoming: new Request("https://auth.example.com/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ email: "user@example.com", turnstileToken: "token" }),
      }),
      redis: { get: vi.fn(), incr: vi.fn(), expire: vi.fn(), del: vi.fn() },
      turnstileSecret: "secret",
      authHandler: vi.fn(async () => new Response("{}", { status: 200 })),
    });
    const call = fetchMock.mock.calls[0];
    return call ? call[1].body.get("remoteip") : null;
  }

  it("sends the trusted address to Turnstile", async () => {
    await expect(siteverifyRemoteIp({ [TRUSTED_CLIENT_IP_HEADER]: "203.0.113.7" })).resolves.toBe(
      "203.0.113.7",
    );
  });

  it("does not send a spoofed forwarding header to Turnstile", async () => {
    await expect(
      siteverifyRemoteIp({ "x-forwarded-for": "198.51.100.9", "x-real-ip": "198.51.100.10" }),
    ).resolves.toBeNull();
  });
});
