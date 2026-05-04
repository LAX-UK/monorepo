import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createUserRoutes } from "./users.js";

function appWithProfileService(profileService: { updateProfile: ReturnType<typeof vi.fn> }) {
  const app = new Hono();
  const container = {
    profileService,
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client" }),
  };
  app.route("/users", createUserRoutes(container, authenticator));
  return app;
}

describe("PATCH /users/me/profile", () => {
  it("accepts avatar removal", async () => {
    const profileService = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const app = appWithProfileService(profileService);

    const res = await app.request("/users/me/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: null }),
    });

    expect(res.status, await res.clone().text()).toBe(200);
    expect(profileService.updateProfile).toHaveBeenCalledWith("u1", { image: null });
  });

  it("accepts storage keys for newly uploaded avatars", async () => {
    const profileService = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const app = appWithProfileService(profileService);

    const res = await app.request("/users/me/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: "uploads/pending/avatar/u1/new.webp" }),
    });

    expect(res.status, await res.clone().text()).toBe(200);
    expect(profileService.updateProfile).toHaveBeenCalledWith("u1", {
      image: "uploads/pending/avatar/u1/new.webp",
    });
  });
});
