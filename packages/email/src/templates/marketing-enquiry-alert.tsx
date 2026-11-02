import { Link } from "@react-email/components";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["marketing-enquiry-alert"];

export const subject = ({ topicLabel }: Vars) => `New contact enquiry: ${topicLabel}`;

/** Staff alert for a message sent through the public contact form. */
export default function MarketingEnquiryAlertEmail({
  topicLabel,
  name,
  senderEmail,
  phone,
  message,
  sourcePage,
  adminEnquiryUrl,
}: Vars) {
  return (
    <Layout
      category="alert"
      eyebrow="Contact enquiry"
      preview={`${topicLabel} enquiry from ${name}.`}
      title={topicLabel}
    >
      <TextBlock>Name: {name}</TextBlock>
      <TextBlock>Email: {senderEmail}</TextBlock>
      {phone ? <TextBlock>Phone: {phone}</TextBlock> : null}
      {sourcePage ? <TextBlock>Sent from: {sourcePage}</TextBlock> : null}
      <TextBlock>Message: {message}</TextBlock>
      <TextBlock>
        <Link href={adminEnquiryUrl}>Open the enquiry</Link> to reply and mark it handled.
      </TextBlock>
    </Layout>
  );
}
