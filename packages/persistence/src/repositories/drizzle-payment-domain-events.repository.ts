import type { Database } from "@auction/db";
import type { IPaymentDomainEventsRepository } from "../interfaces/payment-domain-events.repository.js";
import type { DomainEventInput, IDomainEventPublisher } from "../lib/domain-event.types.js";

export class DrizzlePaymentDomainEventsRepository implements IPaymentDomainEventsRepository {
  constructor(
    private readonly db: Database,
    private readonly publisher: IDomainEventPublisher,
  ) {}

  publish(event: DomainEventInput): Promise<void> {
    return this.publisher.publish(this.db, event);
  }
}
