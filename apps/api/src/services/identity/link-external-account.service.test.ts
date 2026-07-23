import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { LinkExternalAccountService } from "./link-external-account.service.js";

describe("LinkExternalAccountService", () => {
  it("publishes user.linked_external only on first insert", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const externalAccounts = {
      upsert: vi.fn().mockResolvedValue({
        inserted: true,
        row: {
          id: "ea-1",
          userId: "user-1",
          provider: "shopify",
          externalId: "cust-1",
          email: "a@example.com",
          linkedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
    };
    const service = new LinkExternalAccountService(
      externalAccounts as never,
      mockDomainEventSink(publish),
    );

    const result = await service.linkInTransaction({} as Database, {
      userId: "user-1",
      provider: "shopify",
      externalId: "cust-1",
      email: "a@example.com",
    });

    expect(result.linked).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "user.linked_external",
        aggregateId: "user-1",
        payload: expect.objectContaining({
          provider: "shopify",
          externalId: "cust-1",
        }),
      }),
    );
  });

  it("skips domain event when row already existed", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const externalAccounts = {
      upsert: vi.fn().mockResolvedValue({
        inserted: false,
        row: {
          id: "ea-1",
          userId: "user-1",
          provider: "shopify",
          externalId: "cust-1",
          email: null,
          linkedAt: new Date(),
        },
      }),
    };
    const service = new LinkExternalAccountService(
      externalAccounts as never,
      mockDomainEventSink(publish),
    );

    await service.linkInTransaction({} as Database, {
      userId: "user-1",
      provider: "shopify",
      externalId: "cust-1",
    });

    expect(publish).not.toHaveBeenCalled();
  });
});
