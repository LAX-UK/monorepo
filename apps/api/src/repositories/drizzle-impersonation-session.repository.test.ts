import { describe, expect, it, vi } from "vitest";
import { DrizzleImpersonationSessionRepository } from "./drizzle-impersonation-session.repository.js";

describe("DrizzleImpersonationSessionRepository", () => {
  it("start inserts and returns the created session row", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: "session-1",
        actorUserId: "staff-1",
        targetLegalEntityId: "entity-1",
        expiresAt: new Date("2026-07-04T00:00:00.000Z"),
      },
    ]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as never;

    const repo = new DrizzleImpersonationSessionRepository(db);
    const row = await repo.start("staff-1", "entity-1");

    expect(row.id).toBe("session-1");
    expect(insert).toHaveBeenCalled();
  });

  it("findById returns null when no row exists", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const repo = new DrizzleImpersonationSessionRepository(db);
    const row = await repo.findById("missing");

    expect(row).toBeNull();
  });

  it("forConnection returns a repository bound to the given client", async () => {
    const tx = { insert: vi.fn() } as never;
    const repo = new DrizzleImpersonationSessionRepository({} as never);
    const txRepo = repo.forConnection(tx);

    expect(txRepo).toBeInstanceOf(DrizzleImpersonationSessionRepository);
    expect(txRepo).not.toBe(repo);
  });
});
