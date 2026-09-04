import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRouteServices } from "../container/create-user-route-services.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createTestUserRouteServicesInput } from "../testing/create-test-user-route-services.js";

import { createUserRoutes } from "./users.js";

function uiPreferenceTestContainer(uiPreferenceService: {
  getForUser: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  resetLayoutDefaults?: ReturnType<typeof vi.fn>;
}) {
  return {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    userRoutes: createUserRouteServices(
      createTestUserRouteServicesInput({ uiPreferenceService: uiPreferenceService as never }),
    ),
  } as unknown as Container;
}

describe("GET /users/me/preferences/ui", () => {
  it("returns theme", async () => {
    const uiPreferenceService = {
      getForUser: vi.fn().mockResolvedValue({ theme: "dark" }),
      patch: vi.fn(),
    };
    const app = new Hono();
    const container = uiPreferenceTestContainer(uiPreferenceService);
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.read"] }),
    };
    app.route("/users", createUserRoutes(container, authenticator));

    const res = await app.request("/users/me/preferences/ui");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { theme: string } };
    expect(body.data.theme).toBe("dark");
    expect(uiPreferenceService.getForUser).toHaveBeenCalledWith("u1");
  });
});

describe("PATCH /users/me/preferences/ui", () => {
  it("upserts theme", async () => {
    const row = {
      userId: "u1",
      theme: "light" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const uiPreferenceService = {
      getForUser: vi.fn(),
      patch: vi.fn().mockResolvedValue(row),
    };
    const app = new Hono();
    const container = uiPreferenceTestContainer(uiPreferenceService);
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.write"] }),
    };
    app.route("/users", createUserRoutes(container, authenticator));

    const res = await app.request("/users/me/preferences/ui", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: "light" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { theme: string } };
    expect(body.data.theme).toBe("light");
    expect(uiPreferenceService.patch).toHaveBeenCalledWith("u1", { theme: "light" });
  });
});

describe("POST /users/me/preferences/ui/reset-layout", () => {
  it("returns reset layout projection", async () => {
    const now = new Date();
    const row = {
      userId: "u1",
      theme: "dark" as const,
      viewLotsDefault: "auto" as const,
      viewArtistsDefault: "auto" as const,
      viewSalesDefault: "auto" as const,
      density: "comfortable" as const,
      viewSync: false,
      createdAt: now,
      updatedAt: now,
    };
    const uiPreferenceService = {
      getForUser: vi.fn(),
      patch: vi.fn(),
      resetLayoutDefaults: vi.fn().mockResolvedValue(row),
    };
    const app = new Hono();
    const container = uiPreferenceTestContainer(uiPreferenceService);
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.write"] }),
    };
    app.route("/users", createUserRoutes(container, authenticator));

    const res = await app.request("/users/me/preferences/ui/reset-layout", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { viewLotsDefault: string } };
    expect(body.data.viewLotsDefault).toBe("auto");
    expect(uiPreferenceService.resetLayoutDefaults).toHaveBeenCalledWith("u1");
  });
});
