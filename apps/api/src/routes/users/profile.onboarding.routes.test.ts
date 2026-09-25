import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { UserHono, UserRouteDeps } from "./_shared.js";
import { attachUserProfileRoutes } from "./profile.routes.js";

describe("POST /users/me/onboarding", () => {
  it("returns 409 when onboarding is already complete", async () => {
    const complete = vi.fn().mockResolvedValue({
      status: 409,
      body: { error: "Account onboarding is already complete", code: "already_complete" },
    });
    const users = new Hono() as UserHono;
    users.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    const passThrough: MiddlewareHandler = async (_c, next) => next();
    attachUserProfileRoutes(users, {
      container: {
        userRoutes: {
          accountOnboardingHttp: { complete },
          profileHttp: {},
        },
      },
      requireAuth: passThrough,
      requireAuthAllowSuspended: passThrough,
    } as unknown as UserRouteDeps);
    const app = new Hono().route("/users", users);

    const res = await app.request("/users/me/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        persona: "individual",
        acceptTerms: true,
      }),
    });

    expect(res.status).toBe(409);
    expect(complete).toHaveBeenCalledOnce();
  });
});
