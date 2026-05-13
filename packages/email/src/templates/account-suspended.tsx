import { SITE_SHORT_NAME } from "@auction/branding";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = `Your ${SITE_SHORT_NAME} account has been suspended`;

export default function AccountSuspendedEmail({
  userName,
  supportContactEmail,
}: TemplateVarsByName["account-suspended"]) {
  return (
    <Layout
      category="account"
      eyebrow="Account status"
      preview="Your account access has been suspended."
      title="Account suspended"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your {SITE_SHORT_NAME} account has been suspended. You can no longer sign in until this is
        resolved by our team.
      </TextBlock>
      <TextBlock>
        If you believe this is a mistake, contact{" "}
        <a href={`mailto:${supportContactEmail}`}>{supportContactEmail}</a> and include the email
        address on this account.
      </TextBlock>
    </Layout>
  );
}
