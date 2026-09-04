import type { IdentityEventPublisher } from "@auction/auth";
import { describe, expect, it, vi } from "vitest";
import { publishUserEmailVerified } from "./publish-user-email-verified.js";

describe("publishUserEmailVerified", () => {
  it("delegates to the identity event publisher port", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const publisher: IdentityEventPublisher = { publish };

    await publishUserEmailVerified(publisher, { userId: "user-1", email: "a@b.com" });

    expect(publish).toHaveBeenCalledWith(
      { type: "user.email_verified", userId: "user-1", email: "a@b.com" },
      { producer: "apps/auth" },
    );
  });
});
