import { describe, expect, it, vi } from "vitest";
import type { AuthHookDeps } from "./auth-hook-deps.js";
import { buildSessionDatabaseHooks } from "./session-hooks.js";

const CREATED = new Date("2026-10-23T13:05:00.000Z");

function setup(enableNewDeviceLoginEmail: boolean | undefined = true) {
  const notify = vi.fn(async () => undefined);
  const hooks = buildSessionDatabaseHooks({
    ports: {
      subjectStatusReader: { isDisabledOrMerged: async () => false },
      securityNotices: { notify },
    },
    enableNewDeviceLoginEmail,
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
      sessionExpiry: { clamp },
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
