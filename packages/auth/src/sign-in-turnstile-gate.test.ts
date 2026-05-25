import { describe, expect, it, vi } from "vitest";
import { isSignInEmailPost, runSignInTurnstileGate } from "./sign-in-turnstile-gate.js";

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
