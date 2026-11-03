import type {
  DomainEventDeliveryRow,
  FailedWebhookRow,
  IDomainEventDeliveryRepository,
  IIntegrationDeadLetterReader,
  IWebhookRetryQueue,
} from "@auction/persistence/interfaces";

export type DeliveryOpsListItem =
  | { kind: "domain_event"; row: DomainEventDeliveryRow }
  | ({ kind: "webhook" } & FailedWebhookRow);

/** Engineers' view of deliveries that gave up: events Xero and Zoho refused, and failed webhooks. */
export class DeliveryOpsApplicationService {
  constructor(
    private readonly deliveryRepo: IDomainEventDeliveryRepository,
    private readonly deadLetters: Pick<IIntegrationDeadLetterReader, "listFailedWebhooks">,
    private readonly webhooks: IWebhookRetryQueue,
  ) {}

  async listDeadLetters(input: {
    consumer?: string;
    limit: number;
    offset: number;
  }): Promise<DeliveryOpsListItem[]> {
    const [domainRows, webhookRows] = await Promise.all([
      this.deliveryRepo.listDeadLettered(input),
      this.deadLetters.listFailedWebhooks(input),
    ]);
    return [
      ...domainRows.map((row) => ({ kind: "domain_event" as const, row })),
      ...webhookRows.map((row) => ({ kind: "webhook" as const, ...row })),
    ];
  }

  async getDomainDelivery(deliveryId: number): Promise<DomainEventDeliveryRow | null> {
    return this.deliveryRepo.getById(deliveryId);
  }

  async replayDomainDelivery(deliveryId: number): Promise<void> {
    await this.deliveryRepo.replay({ deliveryId });
  }

  async markWebhookRetry(eventKey: string): Promise<void> {
    await this.webhooks.requeue(eventKey);
  }
}
