import { describe, expect, it, vi } from "vitest";
import { DrizzleExistingAccountReader } from "./drizzle-existing-account.reader.js";

describe("DrizzleExistingAccountReader", () => {
  it("returns userId and emailVerified for a case-insensitive match", async () => {
    const limit = vi.fn().mockResolvedValue([
      {
        userId: "user-1",
        emailVerified: true,
      },
    ]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const reader = new DrizzleExistingAccountReader(db);
    const result = await reader.findByEmail("Taken@Example.com");

    expect(result).toEqual({ userId: "user-1", emailVerified: true });
    expect(where).toHaveBeenCalled();
  });

  it("returns null when no account exists", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const reader = new DrizzleExistingAccountReader(db);
    const result = await reader.findByEmail("missing@example.com");

    expect(result).toBeNull();
  });
});
