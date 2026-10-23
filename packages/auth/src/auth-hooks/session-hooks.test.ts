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
