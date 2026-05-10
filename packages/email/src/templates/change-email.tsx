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
  recipient,
}: TemplateVarsByName["change-email"]) {
  const isNewInbox = recipient === "new";
  return (
    <Layout
      preview={
        isNewInbox
          ? "Confirm you control this address for your LAX account."
          : "Confirm this email change from your current address."
      }
      title="Confirm email change"
    >
      <TextBlock>Hi {userName || (isNewInbox ? newEmail : oldEmail)},</TextBlock>
      {isNewInbox ? (
        <>
          <TextBlock>
            Someone requested to use this address ({newEmail}) as the login email for a London Art
            Exchange account currently registered as {oldEmail}. Confirm only if this was you.
          </TextBlock>
          <Button href={confirmationUrl}>Confirm I control this address</Button>
        </>
      ) : (
        <>
          <TextBlock>
            We received a request to change your London Art Exchange email from {oldEmail} to{" "}
            {newEmail}. Click below to confirm you still control {oldEmail} and approve this change.
          </TextBlock>
          <Button href={confirmationUrl}>Confirm from current email</Button>
        </>
      )}
      <TextBlock>If this was not you, do not click the link and contact support.</TextBlock>
    </Layout>
  );
}
