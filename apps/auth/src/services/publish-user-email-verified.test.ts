import { describe, expect, it, vi } from "vitest";
import { publishUserEmailVerified } from "./publish-user-email-verified.js";

function buildDb(existingRows: Array<{ id: number }>) {
  const limit = vi.fn().mockResolvedValue(existingRows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  const insert = vi.fn().mockReturnValue({ values });
  return { db: { select, insert } as never, insert, values, onConflictDoNothing };
}

describe("publishUserEmailVerified", () => {
  it("inserts user.email_verified with verifiedAt", async () => {
    const { db, insert, values } = buildDb([]);

    await publishUserEmailVerified(db, { userId: "user-1", email: "a@b.com" });

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "user",
        aggregateId: "user-1",
        eventType: "user.email_verified",
        producer: "apps/auth",
        payload: expect.objectContaining({
          userId: "user-1",
          email: "a@b.com",
          verifiedAt: expect.any(String),
        }),
      }),
    );
  });

  it("is idempotent — skips insert when the event already exists", async () => {
    const { db, insert } = buildDb([{ id: 7 }]);

    await publishUserEmailVerified(db, { userId: "user-1", email: "a@b.com" });

    expect(insert).not.toHaveBeenCalled();
  });
});
