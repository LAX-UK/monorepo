import { emailSubjects } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

const PROVIDER_LABEL: Record<"google" | "apple", string> = {
  google: "Google",
  apple: "Apple",
};

export const subject = emailSubjects.socialAccountUnlinked;

export default function SocialAccountUnlinkedEmail({
  provider,
  userName,
}: TemplateVarsByName["social-account-unlinked"]) {
  const label = PROVIDER_LABEL[provider];
  return (
    <Layout
      category="account"
      eyebrow="Security"
      preview={`${label} was disconnected from your account.`}
      title={`${label} account disconnected`}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your {label} account was disconnected from your London Art Exchange account. You can no
        longer sign in with {label} unless you link it again.
      </TextBlock>
      <TextBlock>
        If you did not make this change, contact support immediately and review your remaining
        sign-in methods in Security settings.
      </TextBlock>
    </Layout>
  );
}
