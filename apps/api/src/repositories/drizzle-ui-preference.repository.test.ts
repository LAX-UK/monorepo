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
    const returning = vi.fn().mockResolvedValue([row]);
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as never;
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
});
