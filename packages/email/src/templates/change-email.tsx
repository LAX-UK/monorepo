import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Confirm your email change";

export default function ChangeEmail({
  confirmationUrl,
  oldEmail,
  newEmail,
  userName,
}: TemplateVarsByName["change-email"]) {
  return (
    <Layout preview="Confirm this email change for your account." title="Confirm email change">
      <TextBlock>Hi {userName || oldEmail},</TextBlock>
      <TextBlock>
        We received a request to change your London Art Exchange email from {oldEmail} to {newEmail}
        .
      </TextBlock>
      <Button href={confirmationUrl}>Confirm change</Button>
      <TextBlock>If this was not you, do not click the link and contact support.</TextBlock>
    </Layout>
  );
}
