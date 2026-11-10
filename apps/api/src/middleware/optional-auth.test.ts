import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type {
  AuthRejectionReason,
  AuthenticatedUser,
  IAuthenticator,
} from "../services/interfaces/authenticator.js";
import { createOptionalAuth } from "./optional-auth.js";

const USER: AuthenticatedUser = { id: "user-1", role: "client", staffRoles: [], scopes: [] };

function appFor(options: {
  user?: AuthenticatedUser | null;
  rejection?: AuthRejectionReason | null | "throws";
}) {
  const diagnoseRejection = vi.fn(async () => {
    if (options.rejection === "throws") throw new Error("jwks down");
    return options.rejection ?? null;
  });
  const authenticator: IAuthenticator = {
    getSessionUser: async () => options.user ?? null,
    diagnoseRejection,
  };
  const app = new Hono<{ Variables: { userId?: string } }>();
  app.use("/lots/:id", createOptionalAuth(authenticator));
  app.get("/lots/:id", (c) => c.json({ userId: c.get("userId") ?? null }));
  return { app, diagnoseRejection };
}

const withBearer = { headers: { authorization: "Bearer api.jwt" } };

describe("createOptionalAuth", () => {
  it("serves a visitor with no credential anonymously, without asking why", async () => {
    const { app, diagnoseRejection } = appFor({ rejection: "token_key_unknown" });
    const res = await app.request("/lots/1");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: null });
    expect(diagnoseRejection).not.toHaveBeenCalled();
  });

  it("sets the signed-in user for a valid credential", async () => {
    const { app } = appFor({ user: USER });
    const res = await app.request("/lots/1", withBearer);
    await expect(res.json()).resolves.toEqual({ userId: "user-1" });
  });

  it.each(["token_key_unknown", "token_expired"] as const)(
    "answers 401 %s when the credential is one a fresh token replaces",
    async (code) => {
      const { app } = appFor({ rejection: code });
      const res = await app.request("/lots/1", withBearer);
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized", code });
    },
  );

  it.each([null, "throws"] as const)(
    "keeps any other rejected credential anonymous (%s)",
    async (rejection) => {
      const { app } = appFor({ rejection });
      const res = await app.request("/lots/1", withBearer);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ userId: null });
    },
  );
});
