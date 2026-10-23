import { describe, expect, it, vi } from "vitest";
import { AccountIdentityService } from "./account-identity.service.js";
import type { IdentitySession } from "./identity-operations.service.js";
import { SECURITY_EFFECT_RETRY_DELAYS_MS } from "./settle-security-effect.js";

const NOW = new Date("2026-10-23T12:00:00.000Z");
const SUBJECT = "11111111-1111-4111-8111-111111111111";

function session(overrides: Partial<IdentitySession> & { id: string }): IdentitySession {
  return {
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: new Date(NOW.getTime() - 30_000),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    ipAddress: "203.0.113.9",
    userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0",
    lastPasswordAuthAt: null,
    isCurrent: false,
    ...overrides,
  };
}

function setup(sessions: IdentitySession[]) {
  const operations = {
    readSubject: vi.fn().mockResolvedValue({ id: SUBJECT, name: "Ada Lovelace" }),
    updateSubjectProfile: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue(sessions),
    removeSession: vi.fn().mockResolvedValue(true),
    removeOtherSessions: vi.fn().mockResolvedValue(["old-1", "old-2"]),
  };
  const logout = {
    revokeIdentitySessions: vi.fn().mockResolvedValue(1),
    revokeSubjectExceptIdentitySession: vi.fn().mockResolvedValue(2),
  };
  const log = { warn: vi.fn(), error: vi.fn() };
  const service = new AccountIdentityService({ operations, logout } as never, log, () => NOW);
  return { service, operations, logout, log };
}

const freshCurrent = session({ id: "current" });
const staleCurrent = session({ id: "current", createdAt: new Date(NOW.getTime() - 10 * 60_000) });
const other = session({ id: "other", userAgent: "Mozilla/5.0 (iPhone) Safari/605" });

describe("AccountIdentityService", () => {
  describe("listSessions", () => {
    it("marks the caller's own sign-in and never exposes IP addresses", async () => {
      const { service } = setup([freshCurrent, other]);
      const result = await service.listSessions(SUBJECT, "current");
      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      expect(result.sessions.map((row) => [row.id, row.isCurrent])).toEqual([
        ["current", true],
        ["other", false],
      ]);
      expect(JSON.stringify(result)).not.toContain("203.0.113.9");
    });

    it("hides sessions that have already expired", async () => {
      const expired = session({ id: "expired", expiresAt: new Date(NOW.getTime() - 1) });
      const { service } = setup([freshCurrent, expired]);
      const result = await service.listSessions(SUBJECT, "current");
      expect(result.ok && result.sessions.map((row) => row.id)).toEqual(["current"]);
    });

    it("asks to sign in again when the caller's sign-in is not one of the person's sessions", async () => {
      const { service } = setup([other]);
      expect(await service.listSessions(SUBJECT, "someone-elses-session")).toEqual({
        ok: false,
        reason: "reauth_required",
      });
    });

    it("lists without a recent sign-in, because reading is not a sensitive change", async () => {
      const { service } = setup([staleCurrent, other]);
      expect((await service.listSessions(SUBJECT, "current")).ok).toBe(true);
    });
  });

  describe("rename", () => {
    it("updates the name through the operation that queues the profile event", async () => {
      const { service, operations } = setup([freshCurrent]);
      expect(await service.rename(SUBJECT, "current", "Ada King")).toEqual({
        ok: true,
        name: "Ada King",
      });
      expect(operations.updateSubjectProfile).toHaveBeenCalledWith(SUBJECT, { name: "Ada King" });
    });

    it("requires a recent sign-in and changes nothing without one", async () => {
      const { service, operations } = setup([staleCurrent]);
      expect(await service.rename(SUBJECT, "current", "Ada King")).toEqual({
        ok: false,
        reason: "reauth_required",
      });
      expect(operations.updateSubjectProfile).not.toHaveBeenCalled();
    });

    it("refuses a sign-in that is not the person's own", async () => {
      const { service, operations } = setup([freshCurrent]);
      const result = await service.rename(SUBJECT, "another-persons-session", "Ada King");
      expect(result.ok).toBe(false);
      expect(operations.updateSubjectProfile).not.toHaveBeenCalled();
    });
  });

  describe("revokeSession", () => {
    it("signs out one device and tells relying parties", async () => {
      const { service, operations, logout } = setup([freshCurrent, other]);
      expect(await service.revokeSession(SUBJECT, "current", "other")).toEqual({
        ok: true,
        revoked: 1,
      });
      expect(operations.removeSession).toHaveBeenCalledWith(SUBJECT, "other");
      expect(logout.revokeIdentitySessions).toHaveBeenCalledWith(["other"]);
    });

    it("requires a recent sign-in", async () => {
      const { service, operations, logout } = setup([staleCurrent, other]);
      expect(await service.revokeSession(SUBJECT, "current", "other")).toEqual({
        ok: false,
        reason: "reauth_required",
      });
      expect(operations.removeSession).not.toHaveBeenCalled();
      expect(logout.revokeIdentitySessions).not.toHaveBeenCalled();
    });

    it("never signs out the device making the request", async () => {
      const { service, operations } = setup([freshCurrent, other]);
      expect(await service.revokeSession(SUBJECT, "current", "current")).toEqual({
        ok: false,
        reason: "cannot_revoke_current",
      });
      expect(operations.removeSession).not.toHaveBeenCalled();
    });

    it("revokes nothing and skips the fan-out for a session that is not the person's", async () => {
      const { service, operations, logout } = setup([freshCurrent]);
      operations.removeSession.mockResolvedValue(false);
      expect(await service.revokeSession(SUBJECT, "current", "not-mine")).toEqual({
        ok: true,
        revoked: 0,
      });
      expect(logout.revokeIdentitySessions).not.toHaveBeenCalled();
    });

    it("keeps the sign-out when relying-party logout fails, and retries it in the background", async () => {
      vi.useFakeTimers();
      try {
        const { service, logout, log } = setup([freshCurrent, other]);
        logout.revokeIdentitySessions.mockRejectedValueOnce(new Error("backchannel down"));
        expect(await service.revokeSession(SUBJECT, "current", "other")).toEqual({
          ok: true,
          revoked: 1,
        });
        expect(log.error).toHaveBeenCalledWith(
          expect.objectContaining({ effect: "revoke_session", userId: SUBJECT }),
          "auth_security_effect_failed",
        );
        await vi.advanceTimersByTimeAsync(SECURITY_EFFECT_RETRY_DELAYS_MS[0]);
        expect(logout.revokeIdentitySessions).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("revokeOtherSessions", () => {
    it("ends every other session and every relying-party session except the current one", async () => {
      const { service, operations, logout } = setup([freshCurrent, other]);
      expect(await service.revokeOtherSessions(SUBJECT, "current")).toEqual({
        ok: true,
        revoked: 2,
      });
      expect(operations.removeOtherSessions).toHaveBeenCalledWith(SUBJECT, "current");
      expect(logout.revokeSubjectExceptIdentitySession).toHaveBeenCalledWith(SUBJECT, "current");
    });

    it("requires a recent sign-in", async () => {
      const { service, operations, logout } = setup([staleCurrent, other]);
      expect(await service.revokeOtherSessions(SUBJECT, "current")).toEqual({
        ok: false,
        reason: "reauth_required",
      });
      expect(operations.removeOtherSessions).not.toHaveBeenCalled();
      expect(logout.revokeSubjectExceptIdentitySession).not.toHaveBeenCalled();
    });
  });

  it("reads the person's name, and nothing when the person no longer exists", async () => {
    const { service, operations } = setup([]);
    expect(await service.readProfile(SUBJECT)).toEqual({ name: "Ada Lovelace" });
    operations.readSubject.mockResolvedValue(null);
    expect(await service.readProfile(SUBJECT)).toBeNull();
  });
});
