import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createRequireAuth } from "./require-auth.js";

function appWithScopes(scopes: readonly string[]) {
  const authenticator: IAuthenticator = {
    getSessionUser: async () => ({ id: "user-1", role: "client", staffRoles: [], scopes }),
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

describe("require-auth 401 codes", () => {
  function appRejecting(reason: "token_key_unknown" | null | "throws" | "absent") {
    const authenticator: IAuthenticator = {
      getSessionUser: async () => null,
      ...(reason === "absent"
        ? {}
        : {
            diagnoseRejection: async () => {
              if (reason === "throws") throw new Error("jwks down");
              return reason;
            },
          }),
    };
    const app = new Hono();
    let handlerRan = false;
    app.use("/protected", createRequireAuth(authenticator));
    app.post("/protected", (c) => {
      handlerRan = true;
      return c.json({ ok: true });
    });
    return { app, ran: () => handlerRan };
  }

  it("returns token_key_unknown, before any handler runs, when the signing key is gone", async () => {
    const { app, ran } = appRejecting("token_key_unknown");
    const res = await app.request("/protected", { method: "POST" });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized", code: "token_key_unknown" });
    expect(ran()).toBe(false);
  });

  it.each([null, "throws", "absent"] as const)(
    "keeps session_required for every other 401 (%s)",
    async (reason) => {
      const res = await appRejecting(reason).app.request("/protected", { method: "POST" });
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({
        error: "Unauthorized",
        code: "session_required",
      });
    },
  );
});
