import { emailSubjects } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

const PROVIDER_LABEL: Record<"google" | "apple", string> = {
  google: "Google",
  apple: "Apple",
};

export const subject = emailSubjects.socialAccountLinked;

export default function SocialAccountLinkedEmail({
  provider,
  userName,
}: TemplateVarsByName["social-account-linked"]) {
  const label = PROVIDER_LABEL[provider];
  return (
    <Layout
      category="account"
      eyebrow="Security"
      preview={`${label} was linked to your account.`}
      title={`${label} account linked`}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your {label} account was linked to your London Art Exchange account. You can now sign in
        with {label}.
      </TextBlock>
      <TextBlock>
        If you did not make this change, contact support immediately and review your sign-in methods
        in Security settings.
      </TextBlock>
    </Layout>
  );
}
