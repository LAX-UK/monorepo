import { describe, expect, it, vi } from "vitest";

const verified = vi.hoisted(() => ({ scope: "shop.read shop.write" }));

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: verified.scope },
  })),
}));

import { createShopApiApp } from "../../app.js";
import type { AccountEmailAlertHandlers } from "../../application/handlers/account-email-alerts.handler.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const userHeaders = { authorization: "Bearer user-token" };

function handlers(overrides: Partial<AccountEmailAlertHandlers> = {}): AccountEmailAlertHandlers {
  return {
    view: vi.fn(async () => ({
      topics: [
        { topic: "shop.releases" as const, emailOn: true },
        { topic: "art.followed_artists" as const, emailOn: false },
      ],
      waitingEditions: 2,
    })),
    setTopic: vi.fn(async () => null),
    ...overrides,
  };
}

async function buildApp(accountEmailAlerts: AccountEmailAlertHandlers = handlers()) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({ interest: { ...base.interest, accountEmailAlerts } }),
    logger: false,
  });
  await app.ready();
  return { app, accountEmailAlerts };
}

describe("account email alert routes", () => {
  it("needs sign-in", async () => {
    const { app } = await buildApp();
    expect((await app.inject({ method: "GET", url: "/v1/me/email-alerts" })).statusCode).toBe(401);
    await app.close();
  });

  it("shows the person's own switches, never cached", async () => {
    verified.scope = "shop.read";
    const { app, accountEmailAlerts } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/email-alerts",
      headers: userHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({ waitingEditions: 2 });
    expect(accountEmailAlerts.view).toHaveBeenCalledWith("collector-1");
    await app.close();
  });

  it("switches a topic for the caller", async () => {
    verified.scope = "shop.write";
    const { app, accountEmailAlerts } = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/me/email-alerts/topics/art.followed_artists",
      headers: userHeaders,
      payload: { on: true },
    });
    expect(response.json()).toEqual({ ok: true });
    expect(accountEmailAlerts.setTopic).toHaveBeenCalledWith({
      identitySubjectId: "collector-1",
      topic: "art.followed_artists",
      on: true,
    });
    await app.close();
  });

  it("says why a topic could not be switched on", async () => {
    verified.scope = "shop.write";
    const { app } = await buildApp(
      handlers({ setTopic: vi.fn(async () => "unverified" as const) }),
    );
    const response = await app.inject({
      method: "PUT",
      url: "/v1/me/email-alerts/topics/shop.releases",
      headers: userHeaders,
      payload: { on: true },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ ok: false, reason: "unverified" });
    await app.close();
  });

  it("refuses topics a person does not switch themselves", async () => {
    verified.scope = "shop.write";
    const { app } = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/me/email-alerts/topics/shop.back_in_stock",
      headers: userHeaders,
      payload: { on: true },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("accepts LAX Account's narrow alert scopes, each for its own method only", async () => {
    const { app } = await buildApp();
    verified.scope = "lax.alerts.read";
    const read = await app.inject({
      method: "GET",
      url: "/v1/me/email-alerts",
      headers: userHeaders,
    });
    expect(read.statusCode).toBe(200);
    const readCannotWrite = await app.inject({
      method: "PUT",
      url: "/v1/me/email-alerts/topics/shop.releases",
      headers: userHeaders,
      payload: { on: false },
    });
    expect(readCannotWrite.statusCode).toBe(403);
    verified.scope = "lax.alerts.write";
    const write = await app.inject({
      method: "PUT",
      url: "/v1/me/email-alerts/topics/shop.releases",
      headers: userHeaders,
      payload: { on: false },
    });
    expect(write.statusCode).toBe(200);
    verified.scope = "lax.portfolio.read";
    const portfolio = await app.inject({
      method: "GET",
      url: "/v1/me/email-alerts",
      headers: userHeaders,
    });
    expect(portfolio.statusCode).toBe(403);
    await app.close();
  });
});
