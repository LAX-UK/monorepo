import { IdentityRejectedError, IdentityUnavailableError } from "@auction/identity-rp";
import { describe, expect, it, vi } from "vitest";
import { StaffSessionEndedError } from "../domain/staff-session-ended";
import { createMemorySessionStore } from "../infrastructure/memory-session-store";
import type { StaffSessionRecord } from "../ports/session-store";
import type { StaffSessionRenewal } from "../ports/staff-session-renewal";
import { refreshStaffSessionIfNeeded } from "./refresh-staff-session";

const NOW_MS = 1_800_000_000_000;

const expiring: StaffSessionRecord = {
  subject: "staff-1",
  sid: "sid-1",
  idToken: "id-old",
  accessToken: "shop-old",
  refreshToken: "refresh-old",
  accessTokenExpiresAtMs: NOW_MS + 10_000,
  authTime: 100,
  acr: "bronze",
};

function renewal(overrides: Partial<StaffSessionRenewal> = {}): StaffSessionRenewal {
  return {
    refresh: vi.fn(async () => ({
      access_token: "opaque",
      token_type: "Bearer",
      refresh_token: "refresh-new",
      id_token: "id-new",
      expires_in: 900,
    })),
    verifyIdToken: vi.fn(async () => ({ authTime: 100, acr: "silver" })),
    exchangeForShopApi: vi.fn(async () => ({ accessToken: "shop-new", expiresInSeconds: 900 })),
    ...overrides,
  };
}

async function setup(session: StaffSessionRecord = expiring) {
  const sessions = createMemorySessionStore();
  await sessions.save("session-1", session, 3600);
  return sessions;
}

function refresh(
  sessions: ReturnType<typeof createMemorySessionStore>,
  ports: StaffSessionRenewal,
  session: StaffSessionRecord = expiring,
) {
  return refreshStaffSessionIfNeeded({
    sessions,
    renewal: ports,
    clock: { nowMs: () => NOW_MS },
    sessionTtlSeconds: 3600,
    sessionId: "session-1",
    session,
  });
}

describe("refreshStaffSessionIfNeeded", () => {
  it("keeps a session whose Shop API token is still fresh", async () => {
    const sessions = await setup();
    const ports = renewal();
    const fresh = { ...expiring, accessTokenExpiresAtMs: NOW_MS + 600_000 };

    await expect(refresh(sessions, ports, fresh)).resolves.toBe(fresh);
    expect(ports.refresh).not.toHaveBeenCalled();
  });

  it("renews the tokens and keeps the sign-in's step-up evidence", async () => {
    const sessions = await setup();
    const ports = renewal();

    const updated = await refresh(sessions, ports);

    expect(updated).toMatchObject({
      idToken: "id-new",
      refreshToken: "refresh-new",
      accessToken: "shop-new",
      accessTokenExpiresAtMs: NOW_MS + 900_000,
      authTime: 100,
      acr: "silver",
    });
    expect(ports.exchangeForShopApi).toHaveBeenCalledWith("id-new");
    await expect(sessions.get("session-1")).resolves.toEqual(updated);
  });

  it("keeps the current refresh token when the issuer does not rotate it", async () => {
    const sessions = await setup();
    const ports = renewal({
      refresh: vi.fn(async () => ({ access_token: "a", token_type: "Bearer", id_token: "id-new" })),
    });

    await expect(refresh(sessions, ports)).resolves.toMatchObject({
      refreshToken: "refresh-old",
      idToken: "id-new",
    });
  });

  it("ends the session for a new sign-in when the ID token is not renewed", async () => {
    const sessions = await setup();
    const ports = renewal({
      refresh: vi.fn(async () => ({
        access_token: "a",
        token_type: "Bearer",
        refresh_token: "refresh-new",
      })),
    });

    await expect(refresh(sessions, ports)).rejects.toEqual(
      new StaffSessionEndedError("id_token_not_renewed"),
    );
    expect(ports.exchangeForShopApi).not.toHaveBeenCalled();
    await expect(sessions.get("session-1")).resolves.toBeNull();
  });

  it("ends and removes the session when the issuer refuses the refresh", async () => {
    const sessions = await setup();
    const ports = renewal({
      refresh: vi.fn(async () => {
        throw new IdentityRejectedError(400, "refresh rejected", "invalid_grant");
      }),
    });

    const error = await refresh(sessions, ports).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StaffSessionEndedError);
    expect((error as StaffSessionEndedError).reason).toBe("refresh_rejected");
    await expect(sessions.get("session-1")).resolves.toBeNull();
  });

  it("ends the session but keeps the record when the issuer cannot be reached", async () => {
    const sessions = await setup();
    const ports = renewal({
      refresh: vi.fn(async () => {
        throw new IdentityUnavailableError("timeout");
      }),
    });

    const error = await refresh(sessions, ports).catch((caught: unknown) => caught);
    expect((error as StaffSessionEndedError).reason).toBe("renewal_failed");
    await expect(sessions.get("session-1")).resolves.not.toBeNull();
  });

  it("ends the session when the renewed ID token does not verify", async () => {
    const sessions = await setup();
    const ports = renewal({ verifyIdToken: vi.fn(async () => null) });

    const error = await refresh(sessions, ports).catch((caught: unknown) => caught);
    expect((error as StaffSessionEndedError).reason).toBe("renewal_failed");
    expect(ports.exchangeForShopApi).not.toHaveBeenCalled();
  });
});
