import { userUiPreference } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import { DrizzleUiPreferenceRepository } from "./drizzle-ui-preference.repository.js";

describe("DrizzleUiPreferenceRepository", () => {
  it("getForUser returns null when no row", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;
    const repo = new DrizzleUiPreferenceRepository(db);
    expect(await repo.getForUser("u1")).toBeNull();
    expect(from).toHaveBeenCalledWith(userUiPreference);
  });

  it("upsert returns row from returning()", async () => {
    const now = new Date();
    const row = {
      userId: "u1",
      theme: "light",
      createdAt: now,
      updatedAt: now,
    };
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const returning = vi.fn().mockResolvedValue([row]);
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { select, insert } as never;
    const repo = new DrizzleUiPreferenceRepository(db);
    const out = await repo.upsert("u1", { theme: "light" });
    expect(out.theme).toBe("light");
    expect(insert).toHaveBeenCalledWith(userUiPreference);
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: userUiPreference.userId,
        set: expect.objectContaining({ theme: "light" }),
      }),
    );
  });

  it("resetLayoutDefaults inserts defaults when no row exists", async () => {
    const now = new Date();
    const returned = {
      userId: "u1",
      theme: "system",
      viewLotsDefault: "auto",
      viewArtistsDefault: "auto",
      viewSalesDefault: "auto",
      density: "comfortable",
      viewSync: false,
      createdAt: now,
      updatedAt: now,
    };
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const insertReturning = vi.fn().mockResolvedValue([returned]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    const insert = vi.fn().mockReturnValue({ values: insertValues });
    const db = { select, insert } as never;
    const repo = new DrizzleUiPreferenceRepository(db);
    const out = await repo.resetLayoutDefaults("u1");
    expect(out.viewLotsDefault).toBe("auto");
    expect(out.viewSync).toBe(false);
    expect(insert).toHaveBeenCalledWith(userUiPreference);
  });

  it("resetLayoutDefaults updates view columns when a row exists", async () => {
    const now = new Date();
    const existingRow = {
      userId: "u1",
      theme: "dark",
      viewLotsDefault: "list",
      viewArtistsDefault: "list",
      viewSalesDefault: "grid",
      density: "compact",
      viewSync: true,
      createdAt: now,
      updatedAt: now,
    };
    const limit = vi.fn().mockResolvedValue([existingRow]);
    const whereSel = vi.fn().mockReturnValue({ limit });
    const fromSel = vi.fn().mockReturnValue({ where: whereSel });
    const select = vi.fn().mockReturnValue({ from: fromSel });

    const returned = {
      ...existingRow,
      viewLotsDefault: "auto",
      viewArtistsDefault: "auto",
      viewSalesDefault: "auto",
      updatedAt: now,
    };
    const updateReturning = vi.fn().mockResolvedValue([returned]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const db = { select, update } as never;
    const repo = new DrizzleUiPreferenceRepository(db);
    const out = await repo.resetLayoutDefaults("u1");
    expect(out.viewLotsDefault).toBe("auto");
    expect(update).toHaveBeenCalledWith(userUiPreference);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        viewLotsDefault: "auto",
        viewArtistsDefault: "auto",
        viewSalesDefault: "auto",
      }),
    );
  });
});
