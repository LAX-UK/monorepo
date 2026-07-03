import { describe, expect, it, vi } from "vitest";
import { DrizzleSaleroomDisplaySessionRepository } from "./drizzle-saleroom-display-session.repository.js";

describe("DrizzleSaleroomDisplaySessionRepository", () => {
  it("setDisplayOverlay returns updated true when a session row is updated", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "session-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as never;

    const repo = new DrizzleSaleroomDisplaySessionRepository(db);
    const result = await repo.setDisplayOverlay({
      saleId: "sale-1",
      overlay: { kind: "fair_warning", emittedAt: "2026-07-03T00:00:00.000Z" },
    });

    expect(result).toEqual({ updated: true });
    expect(update).toHaveBeenCalled();
  });

  it("setDisplayOverlay returns updated false when no session exists", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as never;

    const repo = new DrizzleSaleroomDisplaySessionRepository(db);
    const result = await repo.setDisplayOverlay({
      saleId: "sale-missing",
      overlay: { kind: "announcement", emittedAt: "2026-07-03T00:00:00.000Z" },
    });

    expect(result).toEqual({ updated: false });
  });

  it("clearDisplayOverlay returns updated true when a session row is updated", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "session-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as never;

    const repo = new DrizzleSaleroomDisplaySessionRepository(db);
    const result = await repo.clearDisplayOverlay("sale-1");

    expect(result).toEqual({ updated: true });
  });
});
