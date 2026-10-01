import { describe, expect, it, vi } from "vitest";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

describe("createShopDomainEventPublisher", () => {
  it("validates payload in enforce mode before insert", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const tx = { insert: () => ({ values: insert }) } as never;
    const publisher = createShopDomainEventPublisher("enforce");

    await publisher.insertInTransaction(tx, {
      aggregateType: "shop_edition",
      aggregateId: "00000000-0000-4000-8000-000000000001",
      eventType: "shop.edition.reserved",
      producer: "shop-api",
      payload: {
        schemaVersion: 1,
        orderId: "00000000-0000-4000-8000-000000000002",
        artworkId: "00000000-0000-4000-8000-000000000003",
        editionNumber: 1,
      },
    });

    expect(insert).toHaveBeenCalledOnce();
  });

  it("rejects invalid shop edition reserved payload in enforce mode", async () => {
    const tx = { insert: vi.fn() } as never;
    const publisher = createShopDomainEventPublisher("enforce");

    await expect(
      publisher.insertInTransaction(tx, {
        aggregateType: "shop_edition",
        aggregateId: "00000000-0000-4000-8000-000000000001",
        eventType: "shop.edition.reserved",
        producer: "shop-api",
        payload: {
          schemaVersion: 1,
          orderId: "not-a-uuid",
          artworkId: "00000000-0000-4000-8000-000000000003",
          editionNumber: 1,
        },
      }),
    ).rejects.toThrow();
  });
});
