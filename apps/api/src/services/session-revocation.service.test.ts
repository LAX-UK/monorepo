import { describe, expect, it, vi } from "vitest";
import { SessionRevocationService } from "./session-revocation.service.js";

const NOW = new Date("2026-01-01T00:00:00Z");

function makeRow(partial: Partial<{ id: string; isCurrent: boolean }> = {}) {
  return {
    id: partial.id ?? "sess-1",
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: "1.2.3.4",
    userAgent: "Mozilla/5.0",
    lastPasswordAuthAt: null,
    isCurrent: partial.isCurrent ?? false,
  };
}

function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    revokeAllSessions: vi.fn(async () => 1),
    listSessions: vi.fn(async () => []),
    revokeSession: vi.fn(async () => false),
    ...overrides,
  };
}

describe("SessionRevocationService", () => {
  describe("revokeAllForUser", () => {
    it("delegates to session repository", async () => {
      const sessions = fakeClient();
      const svc = new SessionRevocationService(sessions as never);
      await svc.revokeAllForUser("user-1");
      expect(sessions.revokeAllSessions).toHaveBeenCalledWith("user-1");
    });
  });

  describe("revokeAllForUserExcept", () => {
    it("delegates to session repository", async () => {
      const sessions = fakeClient();
      const svc = new SessionRevocationService(sessions as never);
      await svc.revokeAllForUserExcept("user-1", "token-keep");
      expect(sessions.revokeAllSessions).toHaveBeenCalledWith("user-1", "token-keep");
    });
  });

  describe("listForUser", () => {
    it("returns session rows from repository", async () => {
      const row = makeRow();
      const svc = new SessionRevocationService(
        fakeClient({ listSessions: vi.fn(async () => [row]) }) as never,
      );
      const list = await svc.listForUser("user-1");
      expect(list).toHaveLength(1);
    });
  });

  describe("deleteSessionForUser", () => {
    it("returns true when repository deletes a row", async () => {
      const svc = new SessionRevocationService(
        fakeClient({ revokeSession: vi.fn(async () => true) }) as never,
      );
      const ok = await svc.deleteSessionForUser("user-1", "sess-1");
      expect(ok).toBe(true);
    });

    it("returns false when repository finds no row", async () => {
      const svc = new SessionRevocationService(
        fakeClient({ revokeSession: vi.fn(async () => false) }) as never,
      );
      const ok = await svc.deleteSessionForUser("user-1", "nonexistent");
      expect(ok).toBe(false);
    });
  });

  describe("getSessionIdForCookieToken", () => {
    it("returns session id when repository finds a match", async () => {
      const svc = new SessionRevocationService(
        fakeClient({
          listSessions: vi.fn(async () => [makeRow({ id: "sess-abc", isCurrent: true })]),
        }) as never,
      );
      const id = await svc.getSessionIdForCookieToken("user-1", "tok-xyz");
      expect(id).toBe("sess-abc");
    });

    it("returns null when repository finds no session", async () => {
      const svc = new SessionRevocationService(
        fakeClient({ listSessions: vi.fn(async () => []) }) as never,
      );
      const id = await svc.getSessionIdForCookieToken("user-1", "no-match");
      expect(id).toBeNull();
    });
  });
});
