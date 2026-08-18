import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createRequireAuth } from "./require-auth.js";

function appWithScopes(scopes: readonly string[]) {
  const authenticator: IAuthenticator = {
    getSessionUser: async () => ({ id: "user-1", role: "client", scopes }),
  };
  const app = new Hono();
  app.use("/protected", createRequireAuth(authenticator));
  app.get("/protected", (c) => c.json({ ok: true }));
  app.post("/protected", (c) => c.json({ ok: true }));
  app.get("/public", (c) => c.json({ ok: true }));
  return app;
}

function appWithLegacyScopes(scopes: readonly string[] | undefined) {
  const authenticator = {
    getSessionUser: async () => ({
      id: "legacy-user",
      role: "client" as const,
      ...(scopes === undefined ? {} : { scopes }),
    }),
  } as unknown as IAuthenticator;
  const app = new Hono();
  app.use("/protected", createRequireAuth(authenticator));
  app.get("/protected", (c) => c.json({ ok: true }));
  return app;
}

describe("require-auth resource scope enforcement", () => {
  it("requires bid.read on protected reads before route authorization", async () => {
    expect((await appWithScopes(["bid.read"]).request("/protected")).status).toBe(200);
    const denied = await appWithScopes(["bid.write"]).request("/protected");
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toMatchObject({
      code: "insufficient_scope",
      requiredScope: "bid.read",
    });
  });

  it("requires bid.write on protected mutations and leaves public routes public", async () => {
    expect(
      (await appWithScopes(["bid.write"]).request("/protected", { method: "POST" })).status,
    ).toBe(200);
    expect(
      (await appWithScopes(["bid.read"]).request("/protected", { method: "POST" })).status,
    ).toBe(403);
    expect((await appWithScopes([]).request("/public")).status).toBe(200);
  });

  it.each([
    ["missing", undefined],
    ["empty", []],
  ] as const)("fails closed for %s legacy scope claims", async (_label, scopes) => {
    const response = await appWithLegacyScopes(scopes).request("/protected");
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "insufficient_scope",
      requiredScope: "bid.read",
    });
  });
});
