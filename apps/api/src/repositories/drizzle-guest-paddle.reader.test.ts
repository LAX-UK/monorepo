import { describe, expect, it, vi } from "vitest";
import { DrizzleGuestPaddleReader } from "./drizzle-guest-paddle.reader.js";

describe("DrizzleGuestPaddleReader", () => {
  it("returns paddle number from the most recent checked-in registration", async () => {
    const limit = vi.fn().mockResolvedValue([{ paddleNumber: 142 }]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const reader = new DrizzleGuestPaddleReader(db);
    const paddle = await reader.findCheckedInPaddle("sale-1", "user-1");
    expect(paddle).toBe(142);
  });

  it("returns null when no checked-in paddle exists", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const reader = new DrizzleGuestPaddleReader(db);
    const paddle = await reader.findCheckedInPaddle("sale-1", "user-1");
    expect(paddle).toBeNull();
  });
});
