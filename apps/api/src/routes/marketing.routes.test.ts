import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createMarketingRoutes } from "./marketing.js";

const snapshot = {
  version: 1,
  lastTouch: {
    capturedAt: "2026-01-01T00:00:00.000Z",
    landingPath: "/campaign",
    utmSource: "newsletter",
  },
};

function setup(input?: {
  authenticated?: boolean;
  enabled?: boolean;
  linkedProvider?: boolean;
  oauthSource?: "apple" | "credential" | "google";
}) {
  const attributionStore = { put: vi.fn(), get: vi.fn(), delete: vi.fn() };
  const marketingEventService = { emit: vi.fn(), stage: vi.fn(), enqueue: vi.fn() };
  const authDb = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(
            input?.linkedProvider === false
              ? []
              : [
                  {
                    providerId: "google",
                  },
                ],
          ),
        }),
      }),
    })),
  };
  const oauthAttributionStore = {
    markNewUser: vi.fn(),
    completeNewUserAccount: vi.fn(),
    resolveOutcome: vi
      .fn()
      .mockResolvedValue(input?.oauthSource === "credential" ? "login" : "signup"),
  };
  const container = {
    env: {
      NODE_ENV: "production",
      SGTM_ENDPOINT_URL: "https://gtm.example",
      GA4_MEASUREMENT_ID: "G-TEST",
      META_PIXEL_ID: "pixel",
      META_CAPI_ACCESS_TOKEN: "token",
      MARKETING_ATTRIBUTION_ENABLED: input?.enabled === false ? "false" : "true",
    },
    attributionStore,
    authDb,
    marketingEventService,
    oauthAttributionStore,
    clickIdStore: { put: vi.fn(), get: vi.fn() },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue(input?.authenticated === false ? null : { id: "user-1", role: "client" }),
  };
  return {
    routes: createMarketingRoutes(container, authenticator),
    attributionStore,
    marketingEventService,
    oauthAttributionStore,
  };
}

describe("marketing attribution routes", () => {
  it("requires authentication", async () => {
    const { routes } = setup({ authenticated: false });
    const response = await routes.request("/attribution", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-lax-consent-marketing": "1" },
      body: JSON.stringify({ snapshot }),
    });
    expect(response.status).toBe(401);
  });

  it("persists only with consent and an enabled flag", async () => {
    const { routes, attributionStore } = setup();
    const denied = await routes.request("/attribution", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-lax-consent-marketing": "0" },
      body: JSON.stringify({ snapshot }),
    });
    expect(denied.status).toBe(204);
    expect(attributionStore.put).not.toHaveBeenCalled();

    const accepted = await routes.request("/attribution", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-lax-consent-marketing": "1" },
      body: JSON.stringify({ snapshot }),
    });
    expect(accepted.status).toBe(204);
    expect(attributionStore.put).toHaveBeenCalledWith("user-1", snapshot);
  });

  it("allows deletion without marketing consent", async () => {
    const { routes, attributionStore } = setup();
    const response = await routes.request("/attribution", { method: "DELETE" });
    expect(response.status).toBe(204);
    expect(attributionStore.delete).toHaveBeenCalledWith("user-1");
  });

  it("emits an idempotent Lead only for a verified, recent OAuth signup", async () => {
    const { routes, marketingEventService } = setup({ oauthSource: "google" });
    const response = await routes.request("/oauth-outcome", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lax-consent-marketing": "1",
        "x-lax-consent-analytics": "1",
      },
      body: JSON.stringify({ provider: "google" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { event: "signup", method: "google" },
    });
    expect(marketingEventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Lead",
        eventId: "oauth-lead:user-1",
        customData: { method: "oauth" },
      }),
    );
  });

  it("classifies existing OAuth users as login without emitting Lead", async () => {
    const { routes, marketingEventService } = setup({ oauthSource: "credential" });
    const response = await routes.request("/oauth-outcome", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lax-consent-marketing": "1",
        "x-lax-consent-analytics": "1",
      },
      body: JSON.stringify({ provider: "google" }),
    });
    await expect(response.json()).resolves.toEqual({
      data: { event: "login", method: "google" },
    });
    expect(marketingEventService.emit).not.toHaveBeenCalled();
  });

  it("does not emit a signup Lead without both consents", async () => {
    const { routes, marketingEventService } = setup({ oauthSource: "google" });
    const response = await routes.request("/oauth-outcome", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lax-consent-marketing": "1",
        "x-lax-consent-analytics": "0",
      },
      body: JSON.stringify({ provider: "google" }),
    });
    expect(response.status).toBe(200);
    expect(marketingEventService.emit).not.toHaveBeenCalled();
  });

  it("rejects a provider that is not linked to the authenticated user", async () => {
    const { routes } = setup({ linkedProvider: false });
    const response = await routes.request("/oauth-outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google" }),
    });
    expect(response.status).toBe(403);
  });

  it("suppresses replayed OAuth outcome events", async () => {
    const { routes, marketingEventService, oauthAttributionStore } = setup();
    oauthAttributionStore.resolveOutcome.mockResolvedValue("ignored");
    const response = await routes.request("/oauth-outcome", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lax-consent-marketing": "1",
        "x-lax-consent-analytics": "1",
      },
      body: JSON.stringify({ provider: "google" }),
    });
    await expect(response.json()).resolves.toEqual({
      data: { event: "ignored", method: "google" },
    });
    expect(marketingEventService.emit).not.toHaveBeenCalled();
  });
});
