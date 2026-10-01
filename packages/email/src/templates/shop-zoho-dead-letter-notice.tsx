import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Shop Zoho CRM delivery dead-lettered";

export default function ShopZohoDeadLetterNoticeEmail({
  eventId,
  deliveryId,
  eventType,
  lastError,
}: TemplateVarsByName["shop-zoho-dead-letter-notice"]) {
  return (
    <Layout
      category="alert"
      eyebrow="Shop CRM sync"
      preview={`Zoho delivery dead-lettered for event ${eventId}.`}
      title="Zoho CRM delivery failed"
    >
      <TextBlock>
        Domain event {eventId} ({eventType}) could not be delivered to Zoho CRM and was
        dead-lettered.
      </TextBlock>
      <TextBlock>Delivery id: {deliveryId}</TextBlock>
      <TextBlock>Last error: {lastError}</TextBlock>
    </Layout>
  );
}
