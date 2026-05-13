import { emailSubjects } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.twoFactorEnabled;

export default function TwoFactorEnabledEmail({ userName }: TemplateVarsByName["2fa-enabled"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      preview="Two-factor authentication is now enabled on your account."
      title="Two-factor enabled"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Two-factor authentication (2FA) was successfully enabled on your account.
      </TextBlock>
      <TextBlock>
        If you did not make this change, contact support immediately and secure your account.
      </TextBlock>
    </Layout>
  );
}
