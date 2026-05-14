import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import {
  PASSWORD_REQUIRED_POLICY,
  SESSION_REVOKE_POLICY,
  createRequireRecentPasswordAuth,
} from "./require-recent-password-auth.js";

const FAKE_COOKIE = "better-auth.session_token=test-session-token-fixture";

function makeAuthDb(opts: {
  lastPasswordAuthAt: Date | null;
  hasCredential: boolean;
}) {
  let limitCall = 0;
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            limitCall += 1;
            if (limitCall === 1) return [{ lastPasswordAuthAt: opts.lastPasswordAuthAt }];
            return opts.hasCredential ? [{ id: "cred-fixture" }] : [];
          }),
        })),
      })),
    })),
  };
}

function mountWithPolicy(
  policy: typeof PASSWORD_REQUIRED_POLICY,
  authDb: ReturnType<typeof makeAuthDb>,
) {
  const container = { authDb } as unknown as Container;
  const app = new Hono<{ Variables: { userId?: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "u1");
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
    const authDb = makeAuthDb({ lastPasswordAuthAt: fresh, hasCredential: false });
    const app = mountWithPolicy(PASSWORD_REQUIRED_POLICY, authDb);
    const res = await app.request("/ok", { headers: { cookie: FAKE_COOKIE } });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("credential_required");
  });

  it("SESSION_REVOKE: OAuth-only → allows", async () => {
    const authDb = makeAuthDb({ lastPasswordAuthAt: null, hasCredential: false });
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, authDb);
    const res = await app.request("/ok", { headers: { cookie: FAKE_COOKIE } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("SESSION_REVOKE: credential + stale last_password_auth_at → recent_auth_required", async () => {
    const authDb = makeAuthDb({ lastPasswordAuthAt: stale, hasCredential: true });
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, authDb);
    const res = await app.request("/ok", { headers: { cookie: FAKE_COOKIE } });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("recent_auth_required");
  });

  it("SESSION_REVOKE: credential + fresh proof → allows", async () => {
    const authDb = makeAuthDb({ lastPasswordAuthAt: fresh, hasCredential: true });
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, authDb);
    const res = await app.request("/ok", { headers: { cookie: FAKE_COOKIE } });
    expect(res.status).toBe(200);
  });

  it("PASSWORD_REQUIRED: credential + stale → recent_auth_required", async () => {
    const authDb = makeAuthDb({ lastPasswordAuthAt: stale, hasCredential: true });
    const app = mountWithPolicy(PASSWORD_REQUIRED_POLICY, authDb);
    const res = await app.request("/ok", { headers: { cookie: FAKE_COOKIE } });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("recent_auth_required");
  });

  it("returns session_required when cookie token missing", async () => {
    const authDb = makeAuthDb({ lastPasswordAuthAt: fresh, hasCredential: true });
    const app = mountWithPolicy(SESSION_REVOKE_POLICY, authDb);
    const res = await app.request("/ok");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("session_required");
  });
});
