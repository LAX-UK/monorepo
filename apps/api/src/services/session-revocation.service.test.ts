import { describe, expect, it, vi } from "vitest";
import { SessionRevocationService } from "./session-revocation.service.js";

const NOW = new Date("2026-01-01T00:00:00Z");

function makeRow(partial: Partial<{ id: string; token: string; userId: string }> = {}) {
  return {
    id: partial.id ?? "sess-1",
    token: partial.token ?? "token-abc",
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: "1.2.3.4",
    userAgent: "Mozilla/5.0",
    lastPasswordAuthAt: null,
    userId: partial.userId ?? "user-1",
  };
}

function buildDb(rows: ReturnType<typeof makeRow>[] = []) {
  const returning = vi.fn(async () => rows.map((r) => ({ id: r.id })));
  const whereInner = vi.fn(() => ({ returning, orderBy: vi.fn(async () => rows) }));
  const deleteFrom = vi.fn(() => ({ where: whereInner }));
  const limit = vi.fn(async () => (rows.length > 0 ? [{ id: rows[0]?.id }] : []));
  const orderBy = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit, orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    delete: deleteFrom,
    select,
    _whereInner: whereInner,
    _returning: returning,
    _orderBy: orderBy,
  };
}

describe("SessionRevocationService", () => {
  describe("revokeAllForUser", () => {
    it("calls delete with userId condition", async () => {
      const db = buildDb();
      const svc = new SessionRevocationService(db as never);
      await svc.revokeAllForUser("user-1");
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(db._whereInner).toHaveBeenCalledTimes(1);
    });
  });

  describe("revokeAllForUserExcept", () => {
    it("calls delete scoped to userId + ne(sessionId)", async () => {
      const db = buildDb();
      const svc = new SessionRevocationService(db as never);
      await svc.revokeAllForUserExcept("user-1", "sess-keep");
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("listForUser", () => {
    it("returns session rows for user", async () => {
      const row = makeRow();
      const db = buildDb([row]);
      const svc = new SessionRevocationService(db as never);
      const list = await svc.listForUser("user-1");
      expect(list).toHaveLength(1);
    });
  });

  describe("deleteSessionForUser", () => {
    it("returns true when a row is deleted", async () => {
      const db = buildDb([makeRow()]);
      const svc = new SessionRevocationService(db as never);
      const ok = await svc.deleteSessionForUser("user-1", "sess-1");
      expect(ok).toBe(true);
    });

    it("returns false when no row matched", async () => {
      const db = buildDb([]);
      const svc = new SessionRevocationService(db as never);
      const ok = await svc.deleteSessionForUser("user-1", "nonexistent");
      expect(ok).toBe(false);
    });
  });

  describe("getSessionIdForCookieToken", () => {
    it("returns session id when token matches", async () => {
      const row = makeRow({ id: "sess-abc", token: "tok-xyz" });
      const db = buildDb([row]);
      const svc = new SessionRevocationService(db as never);
      const id = await svc.getSessionIdForCookieToken("user-1", "tok-xyz");
      expect(id).toBe("sess-abc");
    });

    it("returns null when no session found", async () => {
      const db = buildDb([]);
      const svc = new SessionRevocationService(db as never);
      const id = await svc.getSessionIdForCookieToken("user-1", "no-match");
      expect(id).toBeNull();
    });
  });
});
