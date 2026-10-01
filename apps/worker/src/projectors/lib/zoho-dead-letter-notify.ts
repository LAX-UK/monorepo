import type { IEmailService } from "@auction/email";
import type { DomainEventDeliveryRow } from "@auction/persistence/interfaces";

export async function notifyZohoCrmDeadLetter(options: {
  emailService: IEmailService;
  adminEmail: string;
  delivery: DomainEventDeliveryRow;
  lastError: string;
  eventType?: string | undefined;
}): Promise<void> {
  const { delivery, lastError, adminEmail, emailService } = options;
  await emailService.enqueue({
    template: "shop-zoho-dead-letter-notice",
    category: "transactional",
    to: adminEmail,
    idempotencyKey: `shop-zoho-dead-letter:${delivery.consumer}:${delivery.eventId}`,
    vars: {
      eventId: String(delivery.eventId),
      deliveryId: String(delivery.id),
      lastError,
      eventType: options.eventType ?? "unknown",
    },
  });
}
