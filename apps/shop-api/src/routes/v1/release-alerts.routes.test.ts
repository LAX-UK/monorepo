import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: "shop.read shop.write" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import {
  type EnquiryRateLimiter,
  createReleaseAlertRateLimiter,
} from "../../application/enquiry-rate-limit.js";
import type { ShopAlertHandlers } from "../../application/handlers/shop-alerts.handler.js";
import { createInMemoryFixedWindowCounter } from "../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const userHeaders = { authorization: "Bearer user-token" };
const bffHeaders = {
  authorization: "Bearer test-bff-token-minimum-32-characters-long",
  "x-lax-client-ip": "203.0.113.9",
};
const TOKEN = "a".repeat(43);

function handlers(overrides: Partial<ShopAlertHandlers> = {}): ShopAlertHandlers {
  return {
    subscribeGuest: vi.fn(async () => "check_email" as const),
    subscribeAccount: vi.fn(async () => "subscribed" as const),
    isSubscribed: vi.fn(async () => false),
    stopAccount: vi.fn(async () => undefined),
    confirm: vi.fn(async () => "confirmed" as const),
    previewUnsubscribe: vi.fn(async () => null),
    unsubscribe: vi.fn(async () => true),
    ...overrides,
  };
}

async function buildApp(
  releaseAlerts: ShopAlertHandlers = handlers(),
  releaseAlertRateLimiter: EnquiryRateLimiter = createReleaseAlertRateLimiter(
    createInMemoryFixedWindowCounter(),
  ),
) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      interest: { ...base.interest, releaseAlerts, releaseAlertRateLimiter },
    }),
    logger: false,
  });
  await app.ready();
  return { app, releaseAlerts };
}

const subscribe = (payload: Record<string, unknown>) => ({
  method: "POST" as const,
  url: "/v1/release-alerts",
  payload,
});

describe("release alert routes", () => {
  it("starts a confirmation for a visitor's address through the BFF", async () => {
    const { app, releaseAlerts } = await buildApp();
    const response = await app.inject({
      ...subscribe({ email: "Grace@Example.com", source: "shop_home" }),
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "check_email" });
    expect(releaseAlerts.subscribeGuest).toHaveBeenCalledWith({
      email: "Grace@Example.com",
      source: "shop_home",
    });
    await app.close();
  });

  it("gives a visitor the same answer whether or not the address is known", async () => {
    const known = await buildApp(
      handlers({ subscribeGuest: vi.fn(async () => "check_email" as const) }),
    );
    const fresh = await buildApp();
    const body = subscribe({ email: "grace@example.com" });
    const first = await known.app.inject({ ...body, headers: bffHeaders });
    const second = await fresh.app.inject({ ...body, headers: bffHeaders });
    expect(first.statusCode).toBe(second.statusCode);
    expect(first.json()).toEqual(second.json());
    await known.app.close();
    await fresh.app.close();
  });

  it("needs an address from a visitor and refuses a malformed one", async () => {
    const { app, releaseAlerts } = await buildApp();
    expect((await app.inject({ ...subscribe({}), headers: bffHeaders })).statusCode).toBe(400);
    expect(
      (await app.inject({ ...subscribe({ email: "nope" }), headers: bffHeaders })).statusCode,
    ).toBe(400);
    expect(releaseAlerts.subscribeGuest).not.toHaveBeenCalled();
    await app.close();
  });

  it("subscribes a signed-in shopper with the account address, ignoring a typed one", async () => {
    const { app, releaseAlerts } = await buildApp();
    const response = await app.inject({
      ...subscribe({ email: "typed@example.com" }),
      headers: userHeaders,
    });
    expect(response.json()).toEqual({ status: "subscribed" });
    expect(releaseAlerts.subscribeAccount).toHaveBeenCalledWith({
      identitySubjectId: "collector-1",
      source: undefined,
    });
    expect(releaseAlerts.subscribeGuest).not.toHaveBeenCalled();
    await app.close();
  });

  it("says so when an account has no address to write to", async () => {
    const { app } = await buildApp(handlers({ subscribeAccount: vi.fn(async () => null) }));
    const response = await app.inject({ ...subscribe({}), headers: userHeaders });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("answers a honeypot hit as success and stores nothing", async () => {
    const { app, releaseAlerts } = await buildApp();
    const response = await app.inject({
      ...subscribe({ email: "bot@example.com", website: "https://spam.example" }),
      headers: bffHeaders,
    });
    expect(response.json()).toEqual({ status: "check_email" });
    expect(releaseAlerts.subscribeGuest).not.toHaveBeenCalled();
    await app.close();
  });

  it("limits repeated requests for one address and says when to try again", async () => {
    const { app, releaseAlerts } = await buildApp();
    let last = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await app.inject({
        ...subscribe({ email: "grace@example.com" }),
        headers: bffHeaders,
      });
      last = response.statusCode;
      if (attempt === 5) expect(response.headers["retry-after"]).toBeDefined();
    }
    expect(last).toBe(429);
    expect(releaseAlerts.subscribeGuest).toHaveBeenCalledTimes(5);
    await app.close();
  });

  it("needs sign-in to read or stop the signed-in shopper's subscription", async () => {
    const { app, releaseAlerts } = await buildApp(
      handlers({ isSubscribed: vi.fn(async () => true) }),
    );
    expect((await app.inject({ method: "GET", url: "/v1/me/release-alerts" })).statusCode).toBe(
      401,
    );
    const read = await app.inject({
      method: "GET",
      url: "/v1/me/release-alerts",
      headers: userHeaders,
    });
    expect(read.json()).toEqual({ subscribed: true });
    const stop = await app.inject({
      method: "DELETE",
      url: "/v1/me/release-alerts",
      headers: userHeaders,
    });
    expect(stop.json()).toEqual({ subscribed: false });
    expect(releaseAlerts.stopAccount).toHaveBeenCalledWith("collector-1");
    await app.close();
  });

  it("confirms with the emailed token and treats an unknown one as not found", async () => {
    const confirm = vi
      .fn<ShopAlertHandlers["confirm"]>()
      .mockResolvedValueOnce("confirmed")
      .mockResolvedValueOnce("expired")
      .mockResolvedValueOnce("invalid");
    const { app } = await buildApp(handlers({ confirm }));
    const post = () =>
      app.inject({ method: "POST", url: "/v1/release-alerts/confirm", payload: { token: TOKEN } });
    expect((await post()).json()).toEqual({ outcome: "confirmed" });
    expect((await post()).json()).toEqual({ outcome: "expired" });
    expect((await post()).statusCode).toBe(404);
    const malformed = await app.inject({
      method: "POST",
      url: "/v1/release-alerts/confirm",
      payload: { token: "short" },
    });
    expect(malformed.statusCode).toBe(400);
    await app.close();
  });

  it("previews and stops alerts from an email link without signing in", async () => {
    const unsubscribe = vi
      .fn<ShopAlertHandlers["unsubscribe"]>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const { app } = await buildApp(
      handlers({
        previewUnsubscribe: vi.fn(async () => ({ maskedEmail: "g•••@example.com", active: true })),
        unsubscribe,
      }),
    );
    const preview = await app.inject({
      method: "GET",
      url: `/v1/release-alerts/unsubscribe?token=${TOKEN}`,
    });
    expect(preview.json()).toEqual({ maskedEmail: "g•••@example.com", active: true });
    expect(preview.headers["cache-control"]).toBe("no-store");
    const stop = () =>
      app.inject({
        method: "POST",
        url: "/v1/release-alerts/unsubscribe",
        payload: { token: TOKEN },
      });
    expect((await stop()).json()).toEqual({ subscribed: false });
    expect((await stop()).statusCode).toBe(404);
    await app.close();
  });

  it("serves the same links for lax.art under the shared address, with signed tokens", async () => {
    const signed = `${"e".repeat(60)}.${"f".repeat(43)}`;
    const unsubscribe = vi.fn<ShopAlertHandlers["unsubscribe"]>(async () => true);
    const confirm = vi.fn<ShopAlertHandlers["confirm"]>(async () => "confirmed");
    const { app } = await buildApp(
      handlers({
        unsubscribe,
        confirm,
        previewUnsubscribe: vi.fn(async () => ({ maskedEmail: "c•••@example.com", active: true })),
      }),
    );
    const preview = await app.inject({
      method: "GET",
      url: `/v1/email-alerts/unsubscribe?token=${signed}`,
    });
    expect(preview.json()).toEqual({ maskedEmail: "c•••@example.com", active: true });
    const stop = await app.inject({
      method: "POST",
      url: "/v1/email-alerts/unsubscribe",
      payload: { token: signed },
    });
    expect(stop.json()).toEqual({ subscribed: false });
    expect(unsubscribe).toHaveBeenCalledWith(signed);
    const confirmed = await app.inject({
      method: "POST",
      url: "/v1/release-alerts/confirm",
      payload: { token: signed },
    });
    expect(confirmed.json()).toEqual({ outcome: "confirmed" });
    expect(confirm).toHaveBeenCalledWith(signed);
    await app.close();
  });
});
