import { emailSubjects } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.twoFactorDisabled;

export default function TwoFactorDisabledEmail({ userName }: TemplateVarsByName["2fa-disabled"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      preview="Two-factor authentication was turned off on your account."
      title="Two-factor disabled"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>Two-factor authentication (2FA) was turned off on your account.</TextBlock>
      <TextBlock>
        If you did not make this change, sign in and re-enable 2FA from your security settings, then
        contact support.
      </TextBlock>
    </Layout>
  );
}
