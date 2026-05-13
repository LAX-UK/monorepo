import { emailSubjects } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.passwordChangedElsewhere;

export default function PasswordChangedElsewhereEmail({
  userName,
}: TemplateVarsByName["password-changed-elsewhere"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      preview="Your password was changed from another session."
      title="Password changed"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your password was changed while you still had an active session. Other sessions were signed
        out for your protection.
      </TextBlock>
      <TextBlock>
        If this was not you, reset your password immediately and contact support.
      </TextBlock>
    </Layout>
  );
}
