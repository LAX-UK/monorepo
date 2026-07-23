import { describe, expect, it, vi } from "vitest";
import type { ContainerMarketingRoutesSlice } from "../container.js";
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

function setup(input?: { authenticated?: boolean; enabled?: boolean }) {
  const attributionStore = {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
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
    clickIdStore: { put: vi.fn(), get: vi.fn() },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
  } as unknown as ContainerMarketingRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue(input?.authenticated === false ? null : { id: "user-1", role: "client" }),
  };
  return { routes: createMarketingRoutes(container, authenticator), attributionStore };
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

  it("does not persist without marketing consent", async () => {
    const { routes, attributionStore } = setup();
    const response = await routes.request("/attribution", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-lax-consent-marketing": "0" },
      body: JSON.stringify({ snapshot }),
    });
    expect(response.status).toBe(204);
    expect(attributionStore.put).not.toHaveBeenCalled();
  });

  it("persists a valid consented snapshot when enabled", async () => {
    const { routes, attributionStore } = setup();
    const response = await routes.request("/attribution", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-lax-consent-marketing": "1" },
      body: JSON.stringify({ snapshot }),
    });
    expect(response.status).toBe(204);
    expect(attributionStore.put).toHaveBeenCalledWith("user-1", snapshot);
  });

  it("allows deletion without marketing consent", async () => {
    const { routes, attributionStore } = setup({ enabled: false });
    const response = await routes.request("/attribution", { method: "DELETE" });
    expect(response.status).toBe(204);
    expect(attributionStore.delete).toHaveBeenCalledWith("user-1");
  });

  it("leaves storage untouched while the runtime flag is off", async () => {
    const { routes, attributionStore } = setup({ enabled: false });
    const response = await routes.request("/attribution", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-lax-consent-marketing": "1" },
      body: JSON.stringify({ snapshot }),
    });
    expect(response.status).toBe(204);
    expect(attributionStore.put).not.toHaveBeenCalled();
  });
});
