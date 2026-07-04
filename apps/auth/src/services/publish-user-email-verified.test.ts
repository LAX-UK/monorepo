import type { IUserEmailVerifiedPublisher } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { publishUserEmailVerified } from "./publish-user-email-verified.js";

describe("publishUserEmailVerified", () => {
  it("delegates to the publisher port", async () => {
    const publishIfAbsent = vi.fn().mockResolvedValue(undefined);
    const publisher: IUserEmailVerifiedPublisher = { publishIfAbsent };

    await publishUserEmailVerified(publisher, { userId: "user-1", email: "a@b.com" });

    expect(publishIfAbsent).toHaveBeenCalledWith({ userId: "user-1", email: "a@b.com" });
  });
});
