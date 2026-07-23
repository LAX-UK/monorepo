import type { Database } from "@auction/db";
import { webhookEvent } from "@auction/db/schema";
import type {
  DomainEventDeliveryRow,
  IDomainEventDeliveryRepository,
} from "@auction/persistence/interfaces";
import { eq, isNull } from "drizzle-orm";

export type DeliveryOpsListItem =
  | { kind: "domain_event"; row: DomainEventDeliveryRow }
  | {
      kind: "webhook";
      id: string;
      source: string;
      eventKey: string;
      attempts: number;
      lastError: string | null;
      receivedAt: Date;
    };

export class DeliveryOpsApplicationService {
  constructor(
    private readonly deliveryRepo: IDomainEventDeliveryRepository,
    private readonly db: Database,
  ) {}

  async listDeadLetters(input: {
    consumer?: string;
    limit: number;
    offset: number;
  }): Promise<DeliveryOpsListItem[]> {
    const domainRows = await this.deliveryRepo.listDeadLettered(input);
    const webhookRows = await this.db
      .select({
        id: webhookEvent.id,
        source: webhookEvent.source,
        eventKey: webhookEvent.eventKey,
        attempts: webhookEvent.attempts,
        lastError: webhookEvent.lastError,
        receivedAt: webhookEvent.receivedAt,
      })
      .from(webhookEvent)
      .where(isNull(webhookEvent.processedAt))
      .orderBy(webhookEvent.receivedAt)
      .limit(input.limit)
      .offset(input.offset);

    const webhookDlq = webhookRows.filter((row) => row.lastError != null && row.lastError !== "");

    return [
      ...domainRows.map((row) => ({ kind: "domain_event" as const, row })),
      ...webhookDlq.map((row) => ({ kind: "webhook" as const, ...row })),
    ];
  }

  async getDomainDelivery(deliveryId: number): Promise<DomainEventDeliveryRow | null> {
    return this.deliveryRepo.getById(deliveryId);
  }

  async replayDomainDelivery(deliveryId: number): Promise<void> {
    await this.deliveryRepo.replay({ deliveryId });
  }

  async markWebhookRetry(eventKey: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({ lastError: null, processedAt: null })
      .where(eq(webhookEvent.eventKey, eventKey));
  }
}
