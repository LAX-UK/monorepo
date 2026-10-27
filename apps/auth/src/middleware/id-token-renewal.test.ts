import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createIdTokenRenewalMiddleware } from "./id-token-renewal.js";
import { createOAuthTokenRequestContextMiddleware } from "./oauth-token-request-context.js";

type Renewal = Parameters<typeof createIdTokenRenewalMiddleware>[0]["renewal"];

function setup(options: {
  response: Record<string, unknown>;
  status?: number;
  renew?: Renewal["renew"];
}) {
  const renewal = {
    rememberIssued: vi.fn(async () => undefined),
    renew: vi.fn(options.renew ?? (async () => "renewed-id-token")),
  } satisfies Renewal;
  const outcomes: string[] = [];
  const app = new Hono();
  app.use("/api/auth/oauth2/token", createOAuthTokenRequestContextMiddleware());
  app.use(
    "/api/auth/*",
    createIdTokenRenewalMiddleware({ renewal, onOutcome: (outcome) => outcomes.push(outcome) }),
  );
  app.post("/api/auth/oauth2/token", (c) =>
    c.json(options.response, (options.status ?? 200) as 200),
  );
  return { app, renewal, outcomes };
}

function tokenRequest(app: Hono, body: string) {
  return app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

const REFRESH = "grant_type=refresh_token&refresh_token=refresh-current";

describe("ID token renewal middleware", () => {
  it("adds a renewed ID token to an OpenID refresh response", async () => {
    const { app, renewal, outcomes } = setup({
      response: { access_token: "a", refresh_token: "refresh-next", scope: "openid email" },
    });

    const response = await tokenRequest(app, REFRESH);

    await expect(response.json()).resolves.toEqual({
      access_token: "a",
      refresh_token: "refresh-next",
      scope: "openid email",
      id_token: "renewed-id-token",
    });
    expect(renewal.renew).toHaveBeenCalledWith({
      previousRefreshToken: "refresh-current",
      nextRefreshToken: "refresh-next",
    });
    expect(outcomes).toEqual(["renewed"]);
  });

  it("leaves the refresh response as it is when the sign-in cannot be renewed", async () => {
    const body = { access_token: "a", refresh_token: "refresh-next", scope: "openid" };
    const { app, outcomes } = setup({ response: body, renew: async () => null });

    await expect((await tokenRequest(app, REFRESH)).json()).resolves.toEqual(body);
    expect(outcomes).toEqual(["not_renewed"]);
  });

  it("never fails the refresh when renewal throws", async () => {
    const body = { access_token: "a", refresh_token: "refresh-next", scope: "openid" };
    const { app, outcomes } = setup({
      response: body,
      renew: async () => {
        throw new Error("signing key unavailable");
      },
    });

    const response = await tokenRequest(app, REFRESH);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
    expect(outcomes).toEqual(["failed"]);
  });

  it("does not renew without the openid scope or when the response has an ID token", async () => {
    const plain = setup({ response: { access_token: "a", refresh_token: "r", scope: "email" } });
    await tokenRequest(plain.app, REFRESH);
    expect(plain.renewal.renew).not.toHaveBeenCalled();

    const withToken = setup({
      response: { access_token: "a", refresh_token: "r", scope: "openid", id_token: "issuer-own" },
    });
    await expect((await tokenRequest(withToken.app, REFRESH)).json()).resolves.toMatchObject({
      id_token: "issuer-own",
    });
    expect(withToken.renewal.renew).not.toHaveBeenCalled();
  });

  it("ignores failed token responses", async () => {
    const { app, renewal } = setup({ response: { error: "invalid_grant" }, status: 400 });
    expect((await tokenRequest(app, REFRESH)).status).toBe(400);
    expect(renewal.renew).not.toHaveBeenCalled();
  });

  it("remembers the tokens an authorization code issues", async () => {
    const { app, renewal, outcomes } = setup({
      response: { access_token: "a", refresh_token: "refresh-1", id_token: "id-1" },
    });

    await tokenRequest(app, "grant_type=authorization_code&code=abc&code_verifier=v");

    expect(renewal.rememberIssued).toHaveBeenCalledWith({
      refreshToken: "refresh-1",
      idToken: "id-1",
    });
    expect(outcomes).toEqual(["remembered"]);
  });
});
