import { describe, expect, it, vi } from "vitest";
import type { ISessionRepository } from "../repositories/interfaces/session.repository.js";
import type { AuthSessionListRow } from "../repositories/session.types.js";
import { SessionRevocationService } from "./session-revocation.service.js";

const NOW = new Date("2026-01-01T00:00:00Z");

function makeRow(partial: Partial<{ id: string; token: string }> = {}): AuthSessionListRow {
  return {
    id: partial.id ?? "sess-1",
    token: partial.token ?? "token-abc",
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: "1.2.3.4",
    userAgent: "Mozilla/5.0",
    lastPasswordAuthAt: null,
  };
}

function fakeRepo(overrides: Partial<ISessionRepository> = {}): ISessionRepository {
  return {
    deleteAllForUser: vi.fn(async () => 1),
    deleteAllForUserExcept: vi.fn(async () => undefined),
    listForUser: vi.fn(async () => []),
    deleteSessionForUser: vi.fn(async () => false),
    getSessionIdForCookieToken: vi.fn(async () => null),
    ...overrides,
  };
}

describe("SessionRevocationService", () => {
  describe("revokeAllForUser", () => {
    it("delegates to session repository", async () => {
      const sessions = fakeRepo();
      const svc = new SessionRevocationService(sessions);
      await svc.revokeAllForUser("user-1");
      expect(sessions.deleteAllForUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("revokeAllForUserExcept", () => {
    it("delegates to session repository", async () => {
      const sessions = fakeRepo();
      const svc = new SessionRevocationService(sessions);
      await svc.revokeAllForUserExcept("user-1", "sess-keep");
      expect(sessions.deleteAllForUserExcept).toHaveBeenCalledWith("user-1", "sess-keep");
    });
  });

  describe("listForUser", () => {
    it("returns session rows from repository", async () => {
      const row = makeRow();
      const svc = new SessionRevocationService(fakeRepo({ listForUser: vi.fn(async () => [row]) }));
      const list = await svc.listForUser("user-1");
      expect(list).toHaveLength(1);
    });
  });

  describe("deleteSessionForUser", () => {
    it("returns true when repository deletes a row", async () => {
      const svc = new SessionRevocationService(
        fakeRepo({ deleteSessionForUser: vi.fn(async () => true) }),
      );
      const ok = await svc.deleteSessionForUser("user-1", "sess-1");
      expect(ok).toBe(true);
    });

    it("returns false when repository finds no row", async () => {
      const svc = new SessionRevocationService(
        fakeRepo({ deleteSessionForUser: vi.fn(async () => false) }),
      );
      const ok = await svc.deleteSessionForUser("user-1", "nonexistent");
      expect(ok).toBe(false);
    });
  });

  describe("getSessionIdForCookieToken", () => {
    it("returns session id when repository finds a match", async () => {
      const svc = new SessionRevocationService(
        fakeRepo({ getSessionIdForCookieToken: vi.fn(async () => "sess-abc") }),
      );
      const id = await svc.getSessionIdForCookieToken("user-1", "tok-xyz");
      expect(id).toBe("sess-abc");
    });

    it("returns null when repository finds no session", async () => {
      const svc = new SessionRevocationService(
        fakeRepo({ getSessionIdForCookieToken: vi.fn(async () => null) }),
      );
      const id = await svc.getSessionIdForCookieToken("user-1", "no-match");
      expect(id).toBeNull();
    });
  });
});
