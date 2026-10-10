import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRouteServices } from "../container/create-user-route-services.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createTestUserRouteServicesInput } from "../testing/create-test-user-route-services.js";
import { createUserRoutes } from "./users.js";

const FAKE_COOKIE = "better-auth.session_token=test-session-token-fixture";
const TOKEN = "a".repeat(43);

function acceptTestApp(accept: ReturnType<typeof vi.fn>) {
  const container = {
    env: {},
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    userRoutes: createUserRouteServices(
      createTestUserRouteServicesInput({ staffInvitationAccept: { accept } }),
    ),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "u1", role: "client", staffRole: null, scopes: ["bid.write"] }),
  };
  const app = new Hono();
  app.route("/users", createUserRoutes(container, authenticator));
  return app;
}

function post(app: Hono, body: unknown) {
  return app.request("/users/me/invitations/accept", {
    method: "POST",
    headers: { cookie: FAKE_COOKIE, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /users/me/invitations/accept", () => {
  it("accepts for the signed-in user and returns the welcome path", async () => {
    const accept = vi.fn().mockResolvedValue(
      ok({
        grants: [{ product: "shop", role: "broker" }],
        welcomePath: "/invitations/welcome?platforms=shop",
      }),
    );
    const res = await post(acceptTestApp(accept), { token: TOKEN });

    expect(res.status).toBe(201);
    expect(accept).toHaveBeenCalledWith("u1", TOKEN);
    const body = (await res.json()) as { data: { welcomePath: string } };
    expect(body.data.welcomePath).toBe("/invitations/welcome?platforms=shop");
  });

  it("maps invitation errors to their HTTP status", async () => {
    const accept = vi.fn().mockResolvedValue(err({ message: "email_mismatch", status: 403 }));
    const res = await post(acceptTestApp(accept), { token: TOKEN });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "email_mismatch" });
  });

  it("rejects a missing token before calling the service", async () => {
    const accept = vi.fn();
    const res = await post(acceptTestApp(accept), {});

    expect(res.status).toBe(400);
    expect(accept).not.toHaveBeenCalled();
  });
});
