export type WebhookEventStoredPayload = {
  body: Record<string, unknown>;
  routing: {
    topic?: string;
    webhookId?: string;
    eventName?: string;
    tenantId?: string;
    resourceId?: string;
    eventCategory?: string;
    eventType?: string;
    eventDateUtc?: string;
  };
};
