import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.consignmentUpdate;

/**
 * One email for changes to a consignment after it was handed in: what happens to an unsold lot,
 * a withdrawal, a move to an organisation, or a reminder from the specialist. The service that
 * sends it writes the heading and the message.
 */
export default function ConsignmentUpdateEmail({
  userName,
  heading,
  message,
  submissionUrl,
  unsubscribeUrl,
}: TemplateVarsByName["consignment-update"]) {
  return (
    <Layout
      category="account"
      eyebrow="Consignment update"
      preview={message}
      title={heading}
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>{message}</TextBlock>
      <Button href={submissionUrl}>Open the consignment</Button>
    </Layout>
  );
}
