import { describe, expect, it, vi } from "vitest";
import type { AuthHookDeps } from "./auth-hook-deps.js";
import { buildSessionDatabaseHooks } from "./session-hooks.js";

const CREATED = new Date("2026-10-23T13:05:00.000Z");

function setup(
  enableNewDeviceLoginEmail: boolean | undefined = true,
  readDeviceHash?: (headers: Headers | undefined) => string | null,
) {
  const notify = vi.fn(async () => undefined);
  const hooks = buildSessionDatabaseHooks({
    ports: {
      subjectStatusReader: { isDisabledOrMerged: async () => false },
      securityNotices: { notify },
    },
    enableNewDeviceLoginEmail,
    readDeviceHash,
  } as unknown as AuthHookDeps);
  return { hooks, notify };
}

describe("session create hook", () => {
  it("reports the sign-in with the session's user agent and an edge region, never an address", async () => {
    const { hooks, notify } = setup();

    await hooks.create.after(
      { userId: "user-1", createdAt: CREATED, userAgent: "Mozilla/5.0 Chrome/130" },
      {
        request: {
          headers: new Headers({ "cf-ipcountry": "GB", "x-forwarded-for": "203.0.113.9" }),
        },
      },
    );

    expect(notify).toHaveBeenCalledWith({
      kind: "sign_in",
      userId: "user-1",
      at: CREATED,
      userAgent: "Mozilla/5.0 Chrome/130",
      region: "GB",
      deviceHash: null,
    });
    expect(JSON.stringify(notify.mock.calls)).not.toContain("203.0.113.9");
  });

  it("falls back to the request's user agent and to no region", async () => {
    const { hooks, notify } = setup();

    await hooks.create.after(
      { userId: "user-1", createdAt: CREATED },
      { request: { headers: new Headers({ "user-agent": "Safari" }) } },
    );

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userAgent: "Safari", region: null }),
    );
  });

  it("attaches the hash of the request's device marker, never the marker", async () => {
    const { hooks, notify } = setup(true, (headers) =>
      headers?.get("cookie")?.includes("__Host-lax_device") ? "keyed-hash" : null,
    );

    await hooks.create.after(
      { userId: "user-1", createdAt: CREATED },
      { request: { headers: new Headers({ cookie: "__Host-lax_device=raw-marker-value" }) } },
    );

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ deviceHash: "keyed-hash" }));
    expect(JSON.stringify(notify.mock.calls)).not.toContain("raw-marker-value");
  });

  it("does nothing unless new-device notices are enabled", async () => {
    const { hooks, notify } = setup(false);

    await hooks.create.after({ userId: "user-1", createdAt: CREATED });

    expect(notify).not.toHaveBeenCalled();
  });
});

describe("session expiry hooks", () => {
  const SOON = new Date("2026-10-30T13:05:00.000Z");
  const WEEK = new Date("2026-10-30T13:05:00.000Z");
  const clamp = vi.fn(
    async ({ expiresAt }: { expiresAt: Date }) => new Date(expiresAt.getTime() - 1000),
  );
  const withClamp = () =>
    buildSessionDatabaseHooks({
      ports: { subjectStatusReader: { isDisabledOrMerged: async () => false } },
      sessionExpiry: { clamp, now: () => new Date("2026-10-30T12:00:00.000Z") },
    } as unknown as AuthHookDeps);

  it("holds a new session's expiry to the person's limits", async () => {
    clamp.mockClear();
    const result = await withClamp().create.before({ userId: "user-1", expiresAt: WEEK });
    expect(clamp).toHaveBeenCalledWith({ userId: "user-1", sessionId: null, expiresAt: WEEK });
    expect(result).toEqual({ data: { expiresAt: new Date(WEEK.getTime() - 1000) } });
  });

  it("holds a renewal to the limits of the session the request was served from", async () => {
    clamp.mockClear();
    const result = await withClamp().update.before(
      { expiresAt: SOON },
      { context: { session: { session: { id: "sess-1", userId: "user-1" } } } },
    );
    expect(clamp).toHaveBeenCalledWith({ userId: "user-1", sessionId: "sess-1", expiresAt: SOON });
    expect(result).toEqual({ data: { expiresAt: new Date(SOON.getTime() - 1000) } });
  });

  it("refuses a renewal that the limits clamp to a time that has passed", async () => {
    const over = vi.fn(async () => new Date("2026-10-30T13:00:00.000Z"));
    const hooks = buildSessionDatabaseHooks({
      ports: { subjectStatusReader: { isDisabledOrMerged: async () => false } },
      sessionExpiry: { clamp: over, now: () => new Date("2026-10-30T13:00:00.000Z") },
    } as unknown as AuthHookDeps);
    const result = await hooks.update.before(
      { expiresAt: SOON },
      { context: { session: { session: { id: "sess-1", userId: "user-1" } } } },
    );
    expect(result).toBe(false);
  });

  it("leaves an update that does not move the expiry, or that names no session, alone", async () => {
    clamp.mockClear();
    const hooks = withClamp();
    expect(
      await hooks.update.before(
        {},
        { context: { session: { session: { id: "s", userId: "u" } } } },
      ),
    ).toBeUndefined();
    expect(await hooks.update.before({ expiresAt: SOON }, null)).toBeUndefined();
    expect(clamp).not.toHaveBeenCalled();
  });

  it("changes nothing when no limits are configured", async () => {
    const { hooks } = setup();
    expect(await hooks.create.before({ userId: "user-1", expiresAt: WEEK })).toBeUndefined();
    expect(await hooks.update.before({ expiresAt: WEEK }, null)).toBeUndefined();
  });
});

describe("session delete hook", () => {
  const markerHash = (headers: Headers | undefined) =>
    headers?.get("cookie")?.includes("__Host-lax_device=") ? "keyed-hash" : null;
  const withMarker = { headers: new Headers({ cookie: "__Host-lax_device=raw-marker-value" }) };

  function deleteSetup() {
    const forgetDeviceMarker = vi.fn(async () => undefined);
    const hooks = buildSessionDatabaseHooks({
      ports: { subjectStatusReader: { isDisabledOrMerged: async () => false } },
      readDeviceHash: markerHash,
      forgetDeviceMarker,
    } as unknown as AuthHookDeps);
    return { hooks, forgetDeviceMarker };
  }

  it("forgets the marker of the browser that signs itself out", async () => {
    const { hooks, forgetDeviceMarker } = deleteSetup();

    await hooks.delete.after({ userId: "user-1" }, { path: "/sign-out", request: withMarker });

    expect(forgetDeviceMarker).toHaveBeenCalledWith({ userId: "user-1", deviceHash: "keyed-hash" });
  });

  it("leaves markers alone when sessions end for another reason, such as a password change", async () => {
    const { hooks, forgetDeviceMarker } = deleteSetup();

    await hooks.delete.after(
      { userId: "user-1" },
      { path: "/change-password", request: withMarker },
    );
    await hooks.delete.after({ userId: "user-1" }, null);

    expect(forgetDeviceMarker).not.toHaveBeenCalled();
  });

  it("never turns a sign-out into an error when forgetting fails", async () => {
    const { hooks, forgetDeviceMarker } = deleteSetup();
    forgetDeviceMarker.mockRejectedValue(new Error("db down"));

    await expect(
      hooks.delete.after({ userId: "user-1" }, { path: "/sign-out", request: withMarker }),
    ).resolves.toBeUndefined();
  });
});
