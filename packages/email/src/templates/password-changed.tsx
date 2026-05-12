import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your password was changed";

export default function PasswordChanged({ userName }: TemplateVarsByName["password-changed"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      preview="Your London Art Exchange password was changed."
      title="Password changed"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>Your London Art Exchange password was changed successfully.</TextBlock>
      <TextBlock>
        If this was not you, reset your password immediately and contact support.
      </TextBlock>
    </Layout>
  );
}
