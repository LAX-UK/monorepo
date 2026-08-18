import type { ProfileMeRow } from "@auction/persistence/interfaces";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRouteServices } from "../container/create-user-route-services.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createTestUserRouteServicesInput } from "../testing/create-test-user-route-services.js";
import { createUserRoutes } from "./users.js";

function baseProfile(over: Partial<ProfileMeRow> = {}): ProfileMeRow {
  return {
    id: "u1",
    email: "a@b.com",
    name: "A",
    mobile: null,
    mobileCountry: null,
    phoneNumber: null,
    phoneNumberVerified: false,
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
    suspended: false,
    ...over,
  };
}

function appWithGetProfile(row: ProfileMeRow | null, opts?: { suspended?: boolean }) {
  const profileService = {
    getProfile: vi.fn().mockResolvedValue(row),
    updateProfile: vi.fn().mockResolvedValue(undefined),
  };
  const uiPreferenceService = {
    getForUser: vi.fn().mockResolvedValue({
      theme: "system",
      viewLotsDefault: "auto",
      viewArtistsDefault: "auto",
      viewSalesDefault: "auto",
      density: "comfortable",
      viewSync: false,
    }),
    patch: vi.fn(),
    resetLayoutDefaults: vi.fn(),
  };
  const mediaUrlResolver = {
    resolve: vi.fn().mockImplementation((x: string | null) => Promise.resolve(x)),
  };
  const userRoutes = createUserRouteServices(
    createTestUserRouteServicesInput({
      profileService: profileService as never,
      uiPreferenceService: uiPreferenceService as never,
      mediaUrlResolver: mediaUrlResolver as never,
    }),
  );
  const app = new Hono();
  const container = {
    env: {},
    userSuspensionChecker: {
      isSuspended: vi.fn().mockResolvedValue(opts?.suspended ?? false),
    },
    userRoutes,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.read", "bid.write"] }),
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
      data: { twoFactorEnabled: boolean; uiPreferences: Record<string, unknown> };
    };
    expect(body.data.twoFactorEnabled).toBe(false);
    expect(body.data.uiPreferences).toEqual({
      theme: "system",
      viewLotsDefault: "auto",
      viewArtistsDefault: "auto",
      viewSalesDefault: "auto",
      density: "comfortable",
      viewSync: false,
    });
  });

  it("includes twoFactorEnabled true", async () => {
    const { app } = appWithGetProfile(baseProfile({ twoFactorEnabled: true }));
    const res = await app.request("/users/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { twoFactorEnabled: boolean; uiPreferences: Record<string, unknown> };
    };
    expect(body.data.twoFactorEnabled).toBe(true);
    expect(body.data.uiPreferences).toEqual({
      theme: "system",
      viewLotsDefault: "auto",
      viewArtistsDefault: "auto",
      viewSalesDefault: "auto",
      density: "comfortable",
      viewSync: false,
    });
  });

  it("includes mobile when set", async () => {
    const { app } = appWithGetProfile(
      baseProfile({ mobile: "+447400123456", mobileCountry: "GB" }),
    );
    const res = await app.request("/users/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { mobile: string | null } };
    expect(body.data.mobile).toBe("+447400123456");
  });

  it("returns suspended true for suspended users instead of 403", async () => {
    const { app } = appWithGetProfile(baseProfile({ suspended: true }), { suspended: true });
    const res = await app.request("/users/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { suspended: boolean } };
    expect(body.data.suspended).toBe(true);
  });
});

describe("PATCH /users/me/profile", () => {
  function appWithProfileService(profileService: { updateProfile: ReturnType<typeof vi.fn> }) {
    const userRoutes = createUserRouteServices(
      createTestUserRouteServicesInput({
        profileService: profileService as never,
      }),
    );
    const app = new Hono();
    const container = {
      env: {},
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      userRoutes,
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.read", "bid.write"] }),
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

  it("accepts structured phone update", async () => {
    const profileService = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const app = appWithProfileService(profileService);

    const res = await app.request("/users/me/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: { country: "GB", number: "7400123456" } }),
    });

    expect(res.status, await res.clone().text()).toBe(200);
    expect(profileService.updateProfile).toHaveBeenCalledWith("u1", {
      mobile: "+447400123456",
      mobileCountry: "GB",
    });
  });

  it("accepts mobile clear with phone null", async () => {
    const profileService = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const app = appWithProfileService(profileService);

    const res = await app.request("/users/me/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: null, mobile: null }),
    });

    expect(res.status, await res.clone().text()).toBe(200);
    expect(profileService.updateProfile).toHaveBeenCalledWith("u1", {
      mobile: null,
      mobileCountry: null,
    });
  });
});
