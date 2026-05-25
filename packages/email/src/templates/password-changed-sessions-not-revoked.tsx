import { emailSubjects } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.passwordChangedSessionsNotRevoked;

export default function PasswordChangedSessionsNotRevokedEmail({
  userName,
  sessionsSettingsUrl,
}: TemplateVarsByName["password-changed-sessions-not-revoked"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      preview="Your password was changed but other sessions may still be active."
      title="Review your active sessions"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your London Art Exchange password was changed successfully. We could not sign out your other
        active sessions automatically.
      </TextBlock>
      <TextBlock>
        For your security, review active sessions and sign out anywhere you do not recognise:{" "}
        {sessionsSettingsUrl}
      </TextBlock>
      <TextBlock>
        If this was not you, reset your password immediately and contact support.
      </TextBlock>
    </Layout>
  );
}
