import type { IEmailService } from "@auction/email";
import type { DomainEventDeliveryRow } from "@auction/persistence/interfaces";

export async function notifyZohoCrmDeadLetter(options: {
  emailService: IEmailService;
  adminEmail: string;
  delivery: DomainEventDeliveryRow;
  lastError: string;
  eventType?: string | undefined;
}): Promise<void> {
  const eventType = options.eventType ?? "unknown";
  if (!eventType.startsWith("shop.")) {
    return;
  }
  const { delivery, lastError, adminEmail, emailService } = options;
  const hourBucket = new Date().toISOString().slice(0, 13);
  await emailService.enqueue({
    template: "shop-zoho-dead-letter-notice",
    category: "transactional",
    to: adminEmail,
    idempotencyKey: `shop-zoho-dead-letter:${delivery.consumer}:${hourBucket}`,
    vars: {
      eventId: String(delivery.eventId),
      deliveryId: String(delivery.id),
      lastError,
      eventType,
    },
  });
}
