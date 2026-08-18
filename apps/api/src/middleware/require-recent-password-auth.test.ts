import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { IdentityIssuerClientError } from "../infrastructure/http-identity-issuer.client.js";
import {
  PASSWORD_REQUIRED_POLICY,
  SESSION_REVOKE_POLICY,
  createRequireRecentPasswordAuth,
} from "./require-recent-password-auth.js";

function makeIdentityClient(opts: {
  lastPasswordAuthAt: Date | null;
  hasCredential: boolean;
}) {
  return {
    stepUpStatus: vi.fn(async () => ({
      lastPasswordAuthAt: opts.lastPasswordAuthAt,
      hasCredential: opts.hasCredential,
    })),
  };
}

function mountWithPolicy(
  policy: typeof PASSWORD_REQUIRED_POLICY,
  identityIssuer: ReturnType<typeof makeIdentityClient>,
  withIdentitySession = true,
) {
  const container = { identityIssuer } as unknown as Container;
  const app = new Hono<{ Variables: { userId?: string; identitySessionId?: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "u1");
    if (withIdentitySession) c.set("identitySessionId", "identity-session-1");
    await next();
  });
  app.use("*", createRequireRecentPasswordAuth(container, policy));
  app.get("/ok", (c) => c.json({ ok: true }));
  return app;
}

describe("createRequireRecentPasswordAuth", () => {
  const stale = new Date(Date.now() - 20 * 60 * 1000);
  const fresh = new Date();

  it("PASSWORD_REQUIRED: OAuth-only → credential_required", async () => {
    const identityIssuer = makeIdentityClient({ lastPasswordAuthAt: fresh, hasCredential: false });
    const app = mountWithPolicy(PASSWORD_REQUIRED_POLICY, identityIssuer);
    const res = await app.request("/ok");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("credential_required");
  });

  it("SESSION_REVOKE: OAuth-only → allows", async () => {
    const identityIssuer = makeIdentityClient({ lastPasswordAuthAt: null, hasCredential: false });
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, identityIssuer);
    const res = await app.request("/ok");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("SESSION_REVOKE: credential + stale last_password_auth_at → recent_auth_required", async () => {
    const identityIssuer = makeIdentityClient({ lastPasswordAuthAt: stale, hasCredential: true });
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, identityIssuer);
    const res = await app.request("/ok");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("recent_auth_required");
  });

  it("SESSION_REVOKE: credential + fresh proof → allows", async () => {
    const identityIssuer = makeIdentityClient({ lastPasswordAuthAt: fresh, hasCredential: true });
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, identityIssuer);
    const res = await app.request("/ok");
    expect(res.status).toBe(200);
  });

  it("PASSWORD_REQUIRED: credential + stale → recent_auth_required", async () => {
    const identityIssuer = makeIdentityClient({ lastPasswordAuthAt: stale, hasCredential: true });
    const app = mountWithPolicy(PASSWORD_REQUIRED_POLICY, identityIssuer);
    const res = await app.request("/ok");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("recent_auth_required");
  });

  it("returns session_required when the OIDC sid is missing", async () => {
    const identityIssuer = makeIdentityClient({ lastPasswordAuthAt: fresh, hasCredential: true });
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, identityIssuer, false);
    const res = await app.request("/ok");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("session_required");
  });

  it("returns identity_unavailable when the issuer cannot be reached", async () => {
    const identityIssuer = {
      stepUpStatus: vi.fn(async () => {
        throw new IdentityIssuerClientError("network", "unreachable");
      }),
    };
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, identityIssuer as never);
    const res = await app.request("/ok");
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: "identity_unavailable" });
  });
});
