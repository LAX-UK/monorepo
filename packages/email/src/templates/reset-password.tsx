import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Reset your London Art Exchange password";

export default function ResetPassword({
  resetLink,
  userEmail,
  userName,
  expirationMinutes,
}: TemplateVarsByName["reset-password"]) {
  return (
    <Layout preview="Use this link to reset your password." title="Reset your password">
      <TextBlock>Hi {userName || userEmail},</TextBlock>
      <TextBlock>
        We received a request to reset the password for your London Art Exchange account.
      </TextBlock>
      <Button href={resetLink}>Reset password</Button>
      <TextBlock>This link expires in {expirationMinutes} minutes.</TextBlock>
      <TextBlock>If you did not request a reset, you can ignore this email.</TextBlock>
    </Layout>
  );
}
