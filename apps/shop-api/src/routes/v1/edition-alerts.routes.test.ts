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
  createEditionAlertRateLimiter,
} from "../../application/enquiry-rate-limit.js";
import type { EditionAlertHandlers } from "../../application/handlers/edition-alerts.handler.js";
import { createInMemoryFixedWindowCounter } from "../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const userHeaders = { authorization: "Bearer user-token" };
const bffHeaders = {
  authorization: "Bearer test-bff-token-minimum-32-characters-long",
  "x-lax-client-ip": "203.0.113.9",
};
const TOKEN = "a".repeat(43);

function handlers(overrides: Partial<EditionAlertHandlers> = {}): EditionAlertHandlers {
  return {
    register: vi.fn(async () => "registered" as const),
    listForSubject: vi.fn(async () => []),
    cancelForSubject: vi.fn(async () => "cancelled" as const),
    previewUnsubscribe: vi.fn(async () => null),
    unsubscribe: vi.fn(async () => null),
    ...overrides,
  };
}

async function buildApp(
  editionAlerts: EditionAlertHandlers = handlers(),
  editionAlertRateLimiter: EnquiryRateLimiter = createEditionAlertRateLimiter(
    createInMemoryFixedWindowCounter(),
  ),
) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      interest: { ...base.interest, editionAlerts, editionAlertRateLimiter },
    }),
    logger: false,
  });
  await app.ready();
  return { app, editionAlerts };
}

const notify = (payload: Record<string, unknown>) => ({
  method: "POST" as const,
  url: "/v1/artworks/reed-study/interest",
  payload: { intent: "notify_me", ...payload },
});

describe("edition alert routes", () => {
  it("registers a guest alert by email through the BFF", async () => {
    const { app, editionAlerts } = await buildApp();
    const response = await app.inject({
      ...notify({ email: "Grace@Example.com" }),
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "registered" });
    expect(editionAlerts.register).toHaveBeenCalledWith({
      artworkSlug: "reed-study",
      recipient: { kind: "guest", email: "Grace@Example.com" },
    });
    await app.close();
  });

  it("needs an email address from a guest", async () => {
    const { app, editionAlerts } = await buildApp();
    const response = await app.inject({ ...notify({}), headers: bffHeaders });
    expect(response.statusCode).toBe(400);
    expect(editionAlerts.register).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects a malformed email address", async () => {
    const { app, editionAlerts } = await buildApp();
    const response = await app.inject({
      ...notify({ email: "not-an-email" }),
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(400);
    expect(editionAlerts.register).not.toHaveBeenCalled();
    await app.close();
  });

  it("tells a guest 'registered' even when the address already has an alert", async () => {
    const { app } = await buildApp(
      handlers({ register: vi.fn(async () => "already_subscribed" as const) }),
    );
    const response = await app.inject({
      ...notify({ email: "grace@example.com" }),
      headers: bffHeaders,
    });
    expect(response.json()).toEqual({ status: "registered" });
    await app.close();
  });

  it("tells a signed-in shopper when they are already on the list, using the account", async () => {
    const register = vi.fn(async () => "already_subscribed" as const);
    const { app } = await buildApp(handlers({ register }));
    const response = await app.inject({
      ...notify({ email: "typed@example.com" }),
      headers: userHeaders,
    });
    expect(response.json()).toEqual({ status: "already_subscribed" });
    expect(register).toHaveBeenCalledWith({
      artworkSlug: "reed-study",
      recipient: { kind: "account", identitySubjectId: "collector-1" },
    });
    await app.close();
  });

  it("answers a honeypot hit as success and stores nothing", async () => {
    const { app, editionAlerts } = await buildApp();
    const response = await app.inject({
      ...notify({ email: "bot@example.com", website: "https://spam.example" }),
      headers: bffHeaders,
    });
    expect(response.json()).toEqual({ status: "registered" });
    expect(editionAlerts.register).not.toHaveBeenCalled();
    await app.close();
  });

  it("limits repeated requests for one address", async () => {
    const { app, editionAlerts } = await buildApp();
    let last = 0;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await app.inject({
        ...notify({ email: "grace@example.com" }),
        headers: bffHeaders,
      });
      last = response.statusCode;
      if (attempt === 10) expect(response.headers["retry-after"]).toBeDefined();
    }
    expect(last).toBe(429);
    expect(editionAlerts.register).toHaveBeenCalledTimes(10);
    await app.close();
  });

  it("refuses an alert for an edition that can be bought", async () => {
    const { app } = await buildApp(
      handlers({ register: vi.fn(async () => "not_subscribable" as const) }),
    );
    const response = await app.inject({
      ...notify({ email: "grace@example.com" }),
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("lists a signed-in shopper's waiting alerts and needs sign-in to do so", async () => {
    const listForSubject = vi.fn(async () => [
      {
        id: "00000000-0000-4000-8000-000000000001",
        artworkSlug: "reed-study",
        artworkTitle: "Reed Study",
        artistName: "Elias Moore",
        imageUrl: null,
        createdAt: new Date("2026-10-20T10:00:00.000Z"),
      },
    ]);
    const { app } = await buildApp(handlers({ listForSubject }));
    expect((await app.inject({ method: "GET", url: "/v1/me/alerts" })).statusCode).toBe(401);
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/alerts",
      headers: userHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items[0]).toMatchObject({
      artworkSlug: "reed-study",
      createdAt: "2026-10-20T10:00:00.000Z",
    });
    expect(listForSubject).toHaveBeenCalledWith("collector-1");
    await app.close();
  });

  it("stops an alert by id and answers 404 for someone else's", async () => {
    const cancelForSubject = vi
      .fn<EditionAlertHandlers["cancelForSubject"]>()
      .mockResolvedValueOnce("cancelled")
      .mockResolvedValueOnce("not_found");
    const { app } = await buildApp(handlers({ cancelForSubject }));
    const url = "/v1/me/alerts/00000000-0000-4000-8000-000000000001";
    const first = await app.inject({ method: "DELETE", url, headers: userHeaders });
    expect(first.json()).toEqual({ status: "cancelled" });
    const second = await app.inject({ method: "DELETE", url, headers: userHeaders });
    expect(second.statusCode).toBe(404);
    expect(cancelForSubject).toHaveBeenCalledWith({
      identitySubjectId: "collector-1",
      target: { alertId: "00000000-0000-4000-8000-000000000001" },
    });
    await app.close();
  });

  it("stops the alert for an artwork from its page", async () => {
    const cancelForSubject = vi.fn(async () => "already_stopped" as const);
    const { app } = await buildApp(handlers({ cancelForSubject }));
    const response = await app.inject({
      method: "DELETE",
      url: "/v1/me/alerts/artworks/reed-study",
      headers: userHeaders,
    });
    expect(response.json()).toEqual({ status: "already_stopped" });
    expect(cancelForSubject).toHaveBeenCalledWith({
      identitySubjectId: "collector-1",
      target: { artworkSlug: "reed-study" },
    });
    await app.close();
  });

  it("previews and applies an unsubscribe by token without signing in", async () => {
    const previewUnsubscribe = vi.fn(async () => ({
      maskedEmail: "g•••@example.com",
      artworkTitle: "Reed Study",
      waitingCount: 2,
    }));
    const unsubscribe = vi.fn(async () => ({ stopped: 2 }));
    const { app } = await buildApp(handlers({ previewUnsubscribe, unsubscribe }));
    const preview = await app.inject({
      method: "GET",
      url: `/v1/alerts/unsubscribe?token=${TOKEN}`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["cache-control"]).toBe("no-store");
    expect(preview.json()).toEqual({
      maskedEmail: "g•••@example.com",
      artworkTitle: "Reed Study",
      waitingCount: 2,
    });
    const applied = await app.inject({
      method: "POST",
      url: "/v1/alerts/unsubscribe",
      payload: { token: TOKEN },
    });
    expect(applied.json()).toEqual({ stopped: 2 });
    expect(unsubscribe).toHaveBeenCalledWith(TOKEN);
    await app.close();
  });

  it("answers 404 for an unknown token and 400 for a malformed one", async () => {
    const { app } = await buildApp();
    const unknown = await app.inject({
      method: "POST",
      url: "/v1/alerts/unsubscribe",
      payload: { token: TOKEN },
    });
    expect(unknown.statusCode).toBe(404);
    const malformed = await app.inject({
      method: "GET",
      url: "/v1/alerts/unsubscribe?token=short",
    });
    expect(malformed.statusCode).toBe(400);
    await app.close();
  });
});
