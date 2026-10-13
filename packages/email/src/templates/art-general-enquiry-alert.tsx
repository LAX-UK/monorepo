import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["art-general-enquiry-alert"];

export const subject = ({ topicLabel }: Vars) => `New LAX Art enquiry: ${topicLabel}`;

/** Staff alert for lax.art contact, viewing, advisory and selling enquiries. */
export default function ArtGeneralEnquiryAlertEmail({
  topicLabel,
  buyerEmail,
  message,
  contextSlug,
  contactPhone,
}: Vars) {
  return (
    <Layout
      category="alert"
      eyebrow="LAX Art enquiry"
      preview={`${topicLabel} enquiry from ${buyerEmail}.`}
      title={topicLabel}
    >
      <TextBlock>Contact email on file: {buyerEmail}</TextBlock>
      {contactPhone ? <TextBlock>Contact phone: {contactPhone}</TextBlock> : null}
      {contextSlug ? <TextBlock>Regarding: {contextSlug}</TextBlock> : null}
      <TextBlock>Message: {message}</TextBlock>
    </Layout>
  );
}
