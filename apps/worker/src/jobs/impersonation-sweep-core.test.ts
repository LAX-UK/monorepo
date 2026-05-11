import { describe, expect, it, vi } from "vitest";
import { sweepStaleImpersonationSessions } from "./impersonation-sweep-core.js";

describe("sweepStaleImpersonationSessions", () => {
  it("returns zero when no candidates", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const n = await sweepStaleImpersonationSessions(db as never, {
      cutoff: new Date(),
      batchLimit: 500,
    });
    expect(n).toBe(0);
  });
});
