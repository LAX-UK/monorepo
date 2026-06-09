import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Activate your London Art Exchange account";

export default function AccountActivation({
  activationUrl,
  userName,
  expirationMinutes,
}: TemplateVarsByName["account-activation"]) {
  return (
    <Layout
      category="account"
      eyebrow="Account activation"
      preview="Activate your account with one click."
      title="Activate your account"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Click the button below to activate your London Art Exchange account. You&apos;ll confirm on
        a secure page, then you can optionally set a password. This link expires in{" "}
        {expirationMinutes} minutes and can only be used once.
      </TextBlock>
      <Button href={activationUrl}>Activate account</Button>
      <TextBlock>
        If the button does not work, copy and paste this link into your browser:
        <br />
        {activationUrl}
      </TextBlock>
      <TextBlock>
        If you did not expect this email, you can ignore it. Your account will not be activated
        unless you click the link.
      </TextBlock>
    </Layout>
  );
}
