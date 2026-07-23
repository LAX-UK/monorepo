import { describe, expect, it, vi } from "vitest";
import { DrizzleWebhookEventRepository } from "./drizzle-webhook-event.repository.js";

describe("DrizzleWebhookEventRepository", () => {
  it("markFailed does not set processedAt", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const db = { update: vi.fn().mockReturnValue({ set }) } as never;
    const repo = new DrizzleWebhookEventRepository(db);

    await repo.markFailed("key-1", "boom");

    expect(set).toHaveBeenCalledWith({
      lastError: "boom",
      claimExpiresAt: null,
    });
  });
});
