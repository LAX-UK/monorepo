import { COLORS, FONT_STACK_BODY, emailSubjects } from "@auction/branding";
import { Text } from "@react-email/components";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.accountDeletionRequested;

export default function AccountDeletionRequestedEmail({
  userName,
  whenDisplay,
  deviceLabel,
  effectiveDateDisplay,
  graceDays,
  cancelDeletionUrl,
  secureAccountUrl,
}: TemplateVarsByName["account-deletion-requested"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      header="account"
      preview={`Your LAX Account will be deleted on ${effectiveDateDisplay} unless you cancel.`}
      title="Your account is scheduled for deletion"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        We received a request to delete your LAX Account. Your personal details will be erased on{" "}
        {effectiveDateDisplay}, {graceDays} days after the request. Until then you can change your
        mind and keep everything as it is.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Deletion date", value: effectiveDateDisplay },
          { label: "Requested", value: whenDisplay },
          { label: "Device", value: deviceLabel },
        ]}
      />
      <Text style={subheading}>To keep your account</Text>
      <TextBlock>
        Sign in and cancel the request from the Delete your account page. Nothing is lost if you
        cancel before the deletion date.
      </TextBlock>
      <Button href={cancelDeletionUrl}>Cancel deletion</Button>
      <Text style={subheading}>If this wasn't you</Text>
      <TextBlock>
        Cancel the request above, then secure your account by signing out everywhere and changing
        your password from your LAX Account security page.
      </TextBlock>
      <Button href={secureAccountUrl} tone="subtle">
        Secure your account
      </Button>
      <TextBlock>If this was you, there's nothing more to do.</TextBlock>
    </Layout>
  );
}

const subheading = {
  color: COLORS.ink,
  fontFamily: FONT_STACK_BODY,
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "24px",
  margin: "20px 0 6px",
};
