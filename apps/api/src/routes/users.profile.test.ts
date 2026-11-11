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
    timeZoneMode: "automatic",
    timeZone: null,
    ...over,
  };
}

function appWithGetProfile(
  row: (ProfileMeRow & { securityStatusAvailable?: boolean }) | null,
  opts?: { suspended?: boolean },
) {
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
  it.each([true, false])("includes Identity security availability %s", async (available) => {
    const { app } = appWithGetProfile({
      ...baseProfile({ twoFactorEnabled: false }),
      securityStatusAvailable: available,
    });
    const response = await app.request("/users/me");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { securityStatusAvailable: boolean };
    };
    expect(body.data.securityStatusAvailable).toBe(available);
  });

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

  it("rejects structured phone update", async () => {
    const profileService = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const app = appWithProfileService(profileService);

    const res = await app.request("/users/me/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: { country: "GB", number: "7400123456" } }),
    });

    expect(res.status, await res.clone().text()).toBe(400);
    expect(profileService.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects mobile clear with phone null", async () => {
    const profileService = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const app = appWithProfileService(profileService);

    const res = await app.request("/users/me/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: null, mobile: null }),
    });

    expect(res.status, await res.clone().text()).toBe(400);
    expect(profileService.updateProfile).not.toHaveBeenCalled();
  });
});

describe("LAX Account time zone", () => {
  function appWithIdentity(identityTimeZone: {
    setSubjectTimeZone: ReturnType<typeof vi.fn>;
    reportSubjectDeviceZone: ReturnType<typeof vi.fn>;
  }) {
    const userRoutes = createUserRouteServices(
      createTestUserRouteServicesInput({ identityTimeZone: identityTimeZone as never }),
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

  const put = (app: Hono, path: string, body: unknown, method = "PUT") =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("includes the choice in GET /users/me", async () => {
    const { app } = appWithGetProfile(
      baseProfile({ timeZoneMode: "fixed", timeZone: "Australia/Sydney" }),
    );
    const res = await app.request("/users/me");
    const body = (await res.json()) as { data: { timeZone: unknown } };
    expect(body.data.timeZone).toEqual({ mode: "fixed", zone: "Australia/Sydney" });
  });

  it("saves a fixed city through Identity for the signed-in person", async () => {
    const identity = {
      setSubjectTimeZone: vi.fn().mockResolvedValue({ mode: "fixed", zone: "Asia/Tokyo" }),
      reportSubjectDeviceZone: vi.fn(),
    };
    const res = await put(appWithIdentity(identity), "/users/me/time-zone", {
      mode: "fixed",
      zone: "Asia/Tokyo",
    });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ data: { mode: "fixed", zone: "Asia/Tokyo" } });
    expect(identity.setSubjectTimeZone).toHaveBeenCalledWith("u1", {
      mode: "fixed",
      zone: "Asia/Tokyo",
    });
  });

  it.each([
    ["UTC", { mode: "fixed", zone: "UTC" }],
    ["an Etc zone", { mode: "fixed", zone: "Etc/GMT+3" }],
    ["no zone", { mode: "fixed" }],
    ["an unknown mode", { mode: "later", zone: "Asia/Tokyo" }],
  ])("refuses %s and calls nothing", async (_name, body) => {
    const identity = { setSubjectTimeZone: vi.fn(), reportSubjectDeviceZone: vi.fn() };
    const res = await put(appWithIdentity(identity), "/users/me/time-zone", body);
    expect(res.status).toBe(400);
    expect(identity.setSubjectTimeZone).not.toHaveBeenCalled();
  });

  it("goes back to automatic with the device's zone, or none when the device reports UTC", async () => {
    const identity = {
      setSubjectTimeZone: vi.fn().mockResolvedValue({ mode: "automatic", zone: null }),
      reportSubjectDeviceZone: vi.fn(),
    };
    const app = appWithIdentity(identity);
    await put(app, "/users/me/time-zone", { mode: "automatic", zone: "UTC" });
    expect(identity.setSubjectTimeZone).toHaveBeenLastCalledWith("u1", {
      mode: "automatic",
      deviceZone: null,
    });
    await put(app, "/users/me/time-zone", { mode: "automatic", zone: "Europe/Paris" });
    expect(identity.setSubjectTimeZone).toHaveBeenLastCalledWith("u1", {
      mode: "automatic",
      deviceZone: "Europe/Paris",
    });
  });

  it("reports the device's zone to Identity", async () => {
    const identity = {
      setSubjectTimeZone: vi.fn(),
      reportSubjectDeviceZone: vi.fn().mockResolvedValue({ mode: "automatic", zone: "Asia/Tokyo" }),
    };
    const res = await put(
      appWithIdentity(identity),
      "/users/me/time-zone/device",
      { zone: "Asia/Tokyo" },
      "POST",
    );
    expect(res.status).toBe(200);
    expect(identity.reportSubjectDeviceZone).toHaveBeenCalledWith("u1", "Asia/Tokyo");
  });
});
