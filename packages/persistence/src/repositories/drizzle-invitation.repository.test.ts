import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleUserInvitationRepository } from "./drizzle-invitation.repository.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DrizzleUserInvitationRepository.counts", () => {
  it("applies filters to total, pending, and accepted aggregates", async () => {
    const where = vi.fn().mockResolvedValue([
      {
        total: 2,
        pending: 2,
        accepted: 0,
      },
    ]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select };
    const repo = new DrizzleUserInvitationRepository(db as never);

    const result = await repo.counts({ status: "pending", q: "alice" });

    expect(result).toEqual({ total: 2, pending: 2, accepted: 0 });
    expect(where).toHaveBeenCalledOnce();
  });

  it("counts without filters when none provided", async () => {
    const from = vi.fn().mockResolvedValue([{ total: 10, pending: 4, accepted: 3 }]);
    const select = vi.fn().mockReturnValue({ from });
    const repo = new DrizzleUserInvitationRepository({ select } as never);

    await expect(repo.counts({})).resolves.toEqual({
      total: 10,
      pending: 4,
      accepted: 3,
    });
  });
});
