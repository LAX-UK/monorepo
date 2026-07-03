import type { Database } from "@auction/db";
import type { DomainEventInput, DomainEventPublisher } from "../services/domain-event.publisher.js";
import type { IPaymentDomainEventsRepository } from "./interfaces/payment-domain-events.repository.js";

export class DrizzlePaymentDomainEventsRepository implements IPaymentDomainEventsRepository {
  constructor(
    private readonly db: Database,
    private readonly publisher: DomainEventPublisher,
  ) {}

  publish(event: DomainEventInput): Promise<void> {
    return this.publisher.publish(this.db, event);
  }
}
