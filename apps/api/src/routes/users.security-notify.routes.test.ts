import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRouteServices } from "../container/create-user-route-services.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createTestUserRouteServicesInput } from "../testing/create-test-user-route-services.js";
import { createUserRoutes } from "./users.js";

const FAKE_COOKIE = "better-auth.session_token=test-session-token-fixture";

function securityNotifyTestApp(opts: {
  twoFactorEnabled?: boolean | null;
  getById?: ReturnType<typeof vi.fn>;
  enqueue?: ReturnType<typeof vi.fn>;
}) {
  const getById =
    opts.getById ?? vi.fn().mockResolvedValue({ id: "u1", email: "user@example.com", name: "Ada" });
  const enqueue = opts.enqueue ?? vi.fn().mockResolvedValue(undefined);
  const container = {
    env: {},
    authDb: {},
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    userRoutes: createUserRouteServices(
      createTestUserRouteServicesInput({
        userService: { getById } as never,
        userSecurityReadService: {
          getTwoFactorEnabled: vi.fn().mockResolvedValue(opts.twoFactorEnabled ?? null),
        } as never,
        emailService: { enqueue } as never,
        authAuditPublisher: { publish: vi.fn().mockResolvedValue(undefined) } as never,
      }),
    ),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client", staffRole: null }),
  };
  const app = new Hono();
  app.route("/users", createUserRoutes(container, authenticator));
  return { app, getById, enqueue };
}

describe("POST /users/me/security-notify/two-factor-enabled", () => {
  it("returns 409 and does not enqueue when user.twoFactorEnabled is false", async () => {
    const { app, enqueue } = securityNotifyTestApp({ twoFactorEnabled: false });

    const res = await app.request("/users/me/security-notify/two-factor-enabled", {
      method: "POST",
      headers: { cookie: FAKE_COOKIE },
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("two_factor_not_enabled");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns 409 when there is no matching user row at all", async () => {
    const { app, enqueue } = securityNotifyTestApp({ twoFactorEnabled: null });
    const res = await app.request("/users/me/security-notify/two-factor-enabled", {
      method: "POST",
      headers: { cookie: FAKE_COOKIE },
    });

    expect(res.status).toBe(409);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("enqueues the 2fa-enabled email when user.twoFactorEnabled is true", async () => {
    const { app, enqueue } = securityNotifyTestApp({ twoFactorEnabled: true });

    const res = await app.request("/users/me/security-notify/two-factor-enabled", {
      method: "POST",
      headers: { cookie: FAKE_COOKIE },
    });

    expect(res.status).toBe(200);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "2fa-enabled",
        to: "user@example.com",
        userId: "u1",
        category: "auth",
      }),
    );
  });
});

describe("POST /users/me/security-notify/two-factor-disabled", () => {
  it("returns 409 and does not enqueue when user.twoFactorEnabled is still true", async () => {
    const { app, enqueue } = securityNotifyTestApp({ twoFactorEnabled: true });

    const res = await app.request("/users/me/security-notify/two-factor-disabled", {
      method: "POST",
      headers: { cookie: FAKE_COOKIE },
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("two_factor_still_enabled");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("enqueues the 2fa-disabled email when user.twoFactorEnabled is false", async () => {
    const { app, enqueue } = securityNotifyTestApp({ twoFactorEnabled: false });

    const res = await app.request("/users/me/security-notify/two-factor-disabled", {
      method: "POST",
      headers: { cookie: FAKE_COOKIE },
    });

    expect(res.status).toBe(200);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "2fa-disabled",
        to: "user@example.com",
        userId: "u1",
        category: "auth",
      }),
    );
  });
});
