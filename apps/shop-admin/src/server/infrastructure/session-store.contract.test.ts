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
  });
});
