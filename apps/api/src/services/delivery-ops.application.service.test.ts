import type {
  DomainEventDeliveryRow,
  FailedWebhookRow,
  IDomainEventDeliveryRepository,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { DeliveryOpsApplicationService } from "./delivery-ops.application.service.js";

const delivery = { id: 7, consumer: "xero", status: "dead_lettered" } as DomainEventDeliveryRow;
const webhook: FailedWebhookRow = {
  id: "w-1",
  source: "stripe",
  eventKey: "evt_1",
  attempts: 3,
  lastError: "timeout",
  receivedAt: new Date("2026-11-01T07:00:00Z"),
};

function setup() {
  const deliveries = {
    listDeadLettered: vi.fn().mockResolvedValue([delivery]),
    getById: vi.fn().mockResolvedValue(delivery),
    replay: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDomainEventDeliveryRepository;
  const deadLetters = { listFailedWebhooks: vi.fn().mockResolvedValue([webhook]) };
  const webhooks = { requeue: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new DeliveryOpsApplicationService(deliveries, deadLetters, webhooks),
    deadLetters,
    webhooks,
    deliveries,
  };
}

describe("DeliveryOpsApplicationService", () => {
  it("lists dead-lettered deliveries and failed webhooks together", async () => {
    const { service, deadLetters } = setup();
    const items = await service.listDeadLetters({ limit: 50, offset: 10 });
    expect(items).toEqual([
      { kind: "domain_event", row: delivery },
      { kind: "webhook", ...webhook },
    ]);
    expect(deadLetters.listFailedWebhooks).toHaveBeenCalledWith({ limit: 50, offset: 10 });
  });

  it("replays a delivery and requeues a webhook through the ports", async () => {
    const { service, deliveries, webhooks } = setup();
    await service.replayDomainDelivery(7);
    await service.markWebhookRetry("evt_1");
    expect(deliveries.replay).toHaveBeenCalledWith({ deliveryId: 7 });
    expect(webhooks.requeue).toHaveBeenCalledWith("evt_1");
  });
});
