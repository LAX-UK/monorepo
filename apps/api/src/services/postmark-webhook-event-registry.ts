export type PostmarkWebhookPayload = Record<string, unknown> & {
  RecordType?: string;
  MessageID?: string;
  MessageId?: string;
  Type?: string;
  Email?: string;
  OriginalRecipient?: string;
  To?: string;
};

export type PostmarkIngestEventType =
  | "delivered"
  | "bounce"
  | "soft_bounce"
  | "complaint"
  | "unsubscribe"
  | "open"
  | "click";

type PostmarkRecordTypeResolver = (payload: PostmarkWebhookPayload) => PostmarkIngestEventType;

const POSTMARK_RECORD_TYPE_REGISTRY: Record<
  string,
  PostmarkIngestEventType | PostmarkRecordTypeResolver
> = {
  Delivery: "delivered",
  Bounce: (payload) =>
    String(payload.Type ?? "")
      .toLowerCase()
      .includes("transient")
      ? "soft_bounce"
      : "bounce",
  SpamComplaint: "complaint",
  SubscriptionChange: "unsubscribe",
  Open: "open",
  Click: "click",
};

export function mapPostmarkRecordType(
  recordType: string,
  payload: PostmarkWebhookPayload,
): PostmarkIngestEventType {
  const resolver = POSTMARK_RECORD_TYPE_REGISTRY[recordType];
  if (typeof resolver === "function") return resolver(payload);
  if (resolver) return resolver;
  return "delivered";
}
