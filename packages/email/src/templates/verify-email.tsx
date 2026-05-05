import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Verify your London Art Exchange email";

export default function VerifyEmail({
  verificationUrl,
  userName,
}: TemplateVarsByName["verify-email"]) {
  return (
    <Layout
      preview="Verify your email to finish setting up your account."
      title="Verify your email"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>Confirm this email address to finish setting up your account.</TextBlock>
      <Button href={verificationUrl}>Verify email</Button>
      <TextBlock>
        If you did not create a London Art Exchange account, you can ignore this email.
      </TextBlock>
    </Layout>
  );
}
