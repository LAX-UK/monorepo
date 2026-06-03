import { describe, expect, it, vi } from "vitest";
import { publishUserEmailVerified } from "./publish-user-email-verified.js";

describe("publishUserEmailVerified", () => {
  it("inserts user.email_verified with verifiedAt", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as never;

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
});
