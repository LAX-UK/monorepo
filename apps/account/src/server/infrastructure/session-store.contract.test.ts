import { describe, expect, it } from "vitest";
import { createMemorySessionStore } from "./memory-session-store";

const sampleRecord = {
  subject: "staff-subject",
  sid: "session-sid",
  idToken: "id.jwt.token",
  accessToken: "access",
  refreshToken: "refresh",
  accessTokenExpiresAtMs: Date.now() + 3_600_000,
  authTime: Math.floor(Date.now() / 1000),
  acr: "silver",
};

describe("SessionStore contract (memory)", () => {
  it("persists, invalidates by sid, and dedupes logout jti", async () => {
    const store = createMemorySessionStore();
    await store.save("sess-1", sampleRecord, 3600);
    expect(await store.get("sess-1")).toMatchObject({ subject: "staff-subject" });
    await store.invalidateBySidOrSubject({ sid: "session-sid" });
    expect(await store.get("sess-1")).toBeNull();
    expect(await store.claimBackchannelLogoutJti("jti-1", 60)).toBe(true);
    expect(await store.claimBackchannelLogoutJti("jti-1", 60)).toBe(false);
    await store.releaseBackchannelLogoutJti("jti-1");
    expect(await store.claimBackchannelLogoutJti("jti-1", 60)).toBe(true);
  });

  it("scopes a sid logout to that session and a subject logout to every session", async () => {
    const store = createMemorySessionStore();
    await store.save("browser-a", sampleRecord, 3600);
    await store.save("browser-b", { ...sampleRecord, sid: "other-sid" }, 3600);

    await store.invalidateBySidOrSubject({ sid: "session-sid", sub: "staff-subject" });
    expect(await store.get("browser-a")).toBeNull();
    expect(await store.get("browser-b")).not.toBeNull();

    await store.save("browser-a", sampleRecord, 3600);
    await store.invalidateBySidOrSubject({ sub: "staff-subject" });
    expect(await store.get("browser-a")).toBeNull();
    expect(await store.get("browser-b")).toBeNull();
  });

  it("claims a pending sign-in once, and a sign-out ends it at any stage", async () => {
    const store = createMemorySessionStore();
    expect(await store.claimPendingLogin("state-a", 600)).toBe(true);
    expect(await store.claimPendingLogin("state-a", 600)).toBe(false);

    await store.revokePendingLogin("state-b", 600);
    expect(await store.claimPendingLogin("state-b", 600)).toBe(false);

    expect(await store.claimPendingLogin("state-c", 600)).toBe(true);
    await store.revokePendingLogin("state-c", 600);
    expect(await store.settlePendingLogin("state-c", "sess-c")).toBe(false);

    expect(await store.claimPendingLogin("state-d", 600)).toBe(true);
    await store.save("sess-d", sampleRecord, 3600);
    expect(await store.settlePendingLogin("state-d", "sess-d")).toBe(true);
    await store.revokePendingLogin("state-d", 600);
    expect(await store.get("sess-d")).toBeNull();
  });
});
