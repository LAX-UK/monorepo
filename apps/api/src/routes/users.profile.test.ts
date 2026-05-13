import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { ProfileMeRow } from "../services/interfaces/profile.js";
import { createUserRoutes } from "./users.js";

function baseProfile(over: Partial<ProfileMeRow> = {}): ProfileMeRow {
  return {
    id: "u1",
    email: "a@b.com",
    name: "A",
    image: null,
    role: "client",
    staffRole: null,
    emailVerified: true,
    emailStatus: "ok",
    emailStatusChangedAt: null,
    pendingNewEmail: null,
    hasSeenActingContextTooltip: false,
    kycStatus: "unverified",
    signupPersona: null,
    deletionRequestedAt: null,
    twoFactorEnabled: false,
    ...over,
  };
}

function appWithGetProfile(row: ProfileMeRow | null) {
  const profileService = {
    getProfile: vi.fn().mockResolvedValue(row),
    updateProfile: vi.fn().mockResolvedValue(undefined),
  };
  const app = new Hono();
  const container = {
    profileService,
    uiPreferenceService: {
      getForUser: vi.fn().mockResolvedValue({ theme: "system" }),
      patch: vi.fn(),
    },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    mediaUrlResolver: {
      resolve: vi.fn().mockImplementation((x: string | null) => Promise.resolve(x)),
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client" }),
  };
  app.route("/users", createUserRoutes(container, authenticator));
  return { app, profileService };
}

describe("GET /users/me", () => {
  it("includes twoFactorEnabled false", async () => {
    const { app } = appWithGetProfile(baseProfile({ twoFactorEnabled: false }));
    const res = await app.request("/users/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { twoFactorEnabled: boolean; uiPreferences: { theme: string } };
    };
    expect(body.data.twoFactorEnabled).toBe(false);
    expect(body.data.uiPreferences).toEqual({ theme: "system" });
  });

  it("includes twoFactorEnabled true", async () => {
    const { app } = appWithGetProfile(baseProfile({ twoFactorEnabled: true }));
    const res = await app.request("/users/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { twoFactorEnabled: boolean; uiPreferences: { theme: string } };
    };
    expect(body.data.twoFactorEnabled).toBe(true);
    expect(body.data.uiPreferences).toEqual({ theme: "system" });
  });
});

describe("PATCH /users/me/profile", () => {
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
